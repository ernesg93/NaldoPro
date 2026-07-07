// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';

// Mock firebase before any module imports: keeps the test deterministic regardless
// of .env.local presence (the real firebase.ts throws if env vars are missing).
vi.mock('../lib/firebase', () => ({ auth: {} }));

// Mock AuthService: keep resolveAuthDisplayError + VALIDATION_MESSAGES real
// (the Login component uses the real resolver), but replace AuthService.login
// with vi.fn() so each test controls what error the service throws.
vi.mock('../services/AuthService', async () => {
  const actual = await vi.importActual<
    typeof import('../services/AuthService')
  >('../services/AuthService');
  return {
    ...actual,
    AuthService: {
      login: vi.fn(),
    } as unknown as typeof actual.AuthService,
  };
});

import { AuthService, VALIDATION_MESSAGES } from '../services/AuthService';
import { Login } from '../pages/Login';

/**
 * These component tests verify error-RENDERING behavior only.
 * They prove that when AuthService.login rejects, the Login component
 * displays the resolved error message correctly.
 *
 * Input VALIDATION is tested separately in AuthService.test.ts via
 * direct AuthService.login() calls with invalid arguments.
 * Browser-native validation (required, type="email") is not supported
 * by jsdom and is intentionally not tested at the component level.
 */
function renderLogin() {
  render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>,
  );
  const form = document.querySelector('form')!;
  const emailInput = screen.getByLabelText(/email/i);
  const passwordInput = screen.getByLabelText(/contraseña/i);
  return { form, emailInput, passwordInput };
}

/** Fill valid credentials and submit the form. Returns the form element. */
async function submitWithValidCredentials() {
  const { form, emailInput, passwordInput } = renderLogin();
  fireEvent.change(emailInput, { target: { value: 'test@ejemplo.com' } });
  fireEvent.change(passwordInput, { target: { value: 'mypassword' } });
  fireEvent.submit(form);
  return form;
}

describe('Login error display with resolver', () => {
  const {
    EMAIL_REQUIRED,
    EMAIL_INVALID,
    PASSWORD_REQUIRED,
    GENERIC_AUTH_ERROR,
  } = VALIDATION_MESSAGES;

  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders EMAIL_REQUIRED when login throws that validation message', async () => {
    vi.mocked(AuthService.login).mockRejectedValueOnce(
      new Error(EMAIL_REQUIRED),
    );
    await submitWithValidCredentials();
    expect(await screen.findByText(EMAIL_REQUIRED)).toBeInTheDocument();
  });

  it('renders EMAIL_INVALID when login throws that validation message', async () => {
    vi.mocked(AuthService.login).mockRejectedValueOnce(
      new Error(EMAIL_INVALID),
    );
    await submitWithValidCredentials();
    expect(
      await screen.findByText(EMAIL_INVALID),
    ).toBeInTheDocument();
  });

  it('renders PASSWORD_REQUIRED when login throws that validation message', async () => {
    vi.mocked(AuthService.login).mockRejectedValueOnce(
      new Error(PASSWORD_REQUIRED),
    );
    await submitWithValidCredentials();
    expect(
      await screen.findByText(PASSWORD_REQUIRED),
    ).toBeInTheDocument();
  });

  it('renders generic fallback and suppresses raw Firebase error', async () => {
    vi.mocked(AuthService.login).mockRejectedValueOnce(
      new Error('Firebase: Error (auth/invalid-credential)'),
    );
    await submitWithValidCredentials();
    expect(
      await screen.findByText(GENERIC_AUTH_ERROR),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Firebase:/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/\(auth\//i)).not.toBeInTheDocument();
  });

  it('renders generic fallback for unknown error and suppresses Error: prefix', async () => {
    vi.mocked(AuthService.login).mockRejectedValueOnce(
      new Error('something broke unexpectedly'),
    );
    await submitWithValidCredentials();
    expect(
      await screen.findByText(GENERIC_AUTH_ERROR),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Error:/i)).not.toBeInTheDocument();
  });
});
