// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen, waitFor } from '@testing-library/react';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import type { ReactElement, ReactNode } from 'react';
import App, { ROUTE_ERROR_EVENT, RouteErrorBoundary } from '../App';

const authState = vi.hoisted(() => ({
  user: null as { uid: string } | null,
  loading: false,
}));

vi.mock('../contexts/AuthContext', () => ({
  AuthProvider: ({ children }: { children: ReactNode }) => children,
  useAuth: () => authState,
}));

vi.mock('../services/AuthService', () => ({
  AuthService: {
    logout: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../pages/Login', () => ({
  Login: () => <h1>Login route</h1>,
}));

vi.mock('../pages/Dashboard', () => ({
  Dashboard: () => <h1>Dashboard route</h1>,
}));

vi.mock('../pages/Catalog', () => ({
  Catalog: () => <h1>Catalog route</h1>,
}));

vi.mock('../pages/ProductEditor', () => ({
  ProductEditor: () => <h1>Product editor route</h1>,
}));

vi.mock('../pages/TemplateEditor', () => ({
  TemplateEditor: () => <h1>Template editor route</h1>,
}));

vi.mock('../pages/Settings', () => ({
  Settings: () => <h1>Settings route</h1>,
}));

vi.mock('../pages/Campaigns', () => ({
  Campaigns: () => <h1>Campaigns route</h1>,
}));

vi.mock('../pages/CampaignEditor', () => ({
  CampaignEditor: () => <h1>Campaign editor route</h1>,
}));

vi.mock('../pages/CampaignShare', () => ({
  CampaignShare: () => <h1>Campaign share route</h1>,
}));

function renderAppAt(path: string, user: { uid: string } | null = null) {
  authState.user = user;
  authState.loading = false;
  window.history.pushState({}, '', path);
  return render(<App />);
}

function BrokenRoute(): ReactElement {
  throw new Error('Route failed to render');
}

describe('App router behavior', () => {
  afterEach(() => {
    cleanup();
    authState.user = null;
    authState.loading = false;
    window.history.pushState({}, '', '/');
    vi.clearAllMocks();
  });

  it('redirects an unauthenticated protected route to the login route', async () => {
    renderAppAt('/catalog');

    expect(await screen.findByRole('heading', { name: /login route/i })).toBeInTheDocument();
    expect(screen.queryByText('Catálogo MVP')).not.toBeInTheDocument();
  });

  it('renders the layout shell and dashboard nested route for authenticated / after lazy resolution', async () => {
    renderAppAt('/', { uid: 'user-1' });

    expect(await screen.findByText('Catálogo MVP')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: /dashboard route/i })).toBeInTheDocument();
  });

  it('redirects an unknown route to / and resolves through protected route behavior', async () => {
    renderAppAt('/missing-route', { uid: 'user-1' });

    expect(await screen.findByText('Catálogo MVP')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: /dashboard route/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(window.location.pathname).toBe('/');
    });
  });

  it('resolves lazy route modules under Suspense without breaking nested rendering', async () => {
    renderAppAt('/campaigns/abc/share', { uid: 'user-1' });

    expect(await screen.findByText('Catálogo MVP')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: /campaign share route/i })).toBeInTheDocument();
  });

  it('shows a Spanish recovery UI when route rendering fails', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    render(
      <RouteErrorBoundary resetKey="/broken">
        <BrokenRoute />
      </RouteErrorBoundary>
    );

    expect(screen.getByRole('heading', { name: /no pudimos cargar esta sección/i })).toBeInTheDocument();
    expect(screen.getByText(/recargá la página para intentar nuevamente/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /recargar página/i })).toBeInTheDocument();

    consoleError.mockRestore();
  });

  it('reloads the page from the route error recovery button', async () => {
    const user = userEvent.setup();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    render(
      <RouteErrorBoundary resetKey="/broken">
        <BrokenRoute />
      </RouteErrorBoundary>
    );

    consoleError.mockClear();

    await user.click(screen.getByRole('button', { name: /recargar página/i }));

    expect(
      consoleError.mock.calls.some(([message]) =>
        String(message).includes('Not implemented: navigation (except hash changes)') &&
        String(message).includes('Location.reload')
      )
    ).toBe(true);

    consoleError.mockRestore();
  });

  it('dispatches a route error event with safe diagnostic details', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const routeErrorListener = vi.fn<(event: Event) => void>();
    window.history.pushState({}, '', '/broken');
    window.addEventListener(ROUTE_ERROR_EVENT, routeErrorListener);

    render(
      <RouteErrorBoundary resetKey="/broken">
        <BrokenRoute />
      </RouteErrorBoundary>
    );

    await waitFor(() => {
      expect(routeErrorListener).toHaveBeenCalledOnce();
    });

    const event = routeErrorListener.mock.calls[0][0] as CustomEvent;
    expect(event.detail).toMatchObject({
      message: 'Route failed to render',
      pathname: '/broken',
    });
    expect(event.detail.stack).toContain('Route failed to render');
    expect(event.detail.componentStack).toContain('BrokenRoute');

    window.removeEventListener(ROUTE_ERROR_EVENT, routeErrorListener);
    consoleError.mockRestore();
  });

  it('resets the route error boundary when the route key changes', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const { rerender } = render(
      <RouteErrorBoundary resetKey="/broken">
        <BrokenRoute />
      </RouteErrorBoundary>
    );

    expect(screen.getByRole('heading', { name: /no pudimos cargar esta sección/i })).toBeInTheDocument();

    rerender(
      <RouteErrorBoundary resetKey="/healthy">
        <h1>Recovered route</h1>
      </RouteErrorBoundary>
    );

    expect(await screen.findByRole('heading', { name: /recovered route/i })).toBeInTheDocument();

    consoleError.mockRestore();
  });
});
