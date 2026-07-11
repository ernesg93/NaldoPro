import { Component, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import type { ErrorInfo, ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';

const Login = lazy(() => import('./pages/Login').then((module) => ({ default: module.Login })));
const Dashboard = lazy(() => import('./pages/Dashboard').then((module) => ({ default: module.Dashboard })));
const Catalog = lazy(() => import('./pages/Catalog').then((module) => ({ default: module.Catalog })));
const ProductEditor = lazy(() => import('./pages/ProductEditor').then((module) => ({ default: module.ProductEditor })));
const TemplateEditor = lazy(() => import('./pages/TemplateEditor').then((module) => ({ default: module.TemplateEditor })));
const Campaigns = lazy(() => import('./pages/Campaigns').then((module) => ({ default: module.Campaigns })));
const CampaignEditor = lazy(() => import('./pages/CampaignEditor').then((module) => ({ default: module.CampaignEditor })));
const CampaignShare = lazy(() => import('./pages/CampaignShare').then((module) => ({ default: module.CampaignShare })));
const Settings = lazy(() => import('./pages/Settings').then((module) => ({ default: module.Settings })));

function RouteFallback() {
  return <div className="p-8 text-center text-gray-500 font-medium">Cargando...</div>;
}

type RouteErrorBoundaryProps = {
  children: ReactNode;
  resetKey: string;
};

type RouteErrorBoundaryState = {
  hasError: boolean;
};

export const ROUTE_ERROR_EVENT = 'naldo:route-error';

export type RouteErrorEventDetail = {
  message: string;
  stack?: string;
  componentStack?: string;
  pathname: string;
};

function reportRouteError(error: Error, errorInfo: ErrorInfo) {
  if (typeof window === 'undefined' || typeof window.CustomEvent !== 'function') {
    return;
  }

  const detail: RouteErrorEventDetail = {
    message: error.message,
    stack: error.stack,
    componentStack: errorInfo.componentStack ?? undefined,
    pathname: window.location.pathname,
  };

  window.dispatchEvent(new CustomEvent<RouteErrorEventDetail>(ROUTE_ERROR_EVENT, { detail }));
}

export class RouteErrorBoundary extends Component<RouteErrorBoundaryProps, RouteErrorBoundaryState> {
  state: RouteErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): RouteErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    try {
      reportRouteError(error, errorInfo);
    } catch (reportingError) {
      console.error('Route error reporting failed', reportingError);
    }

    console.error('Route rendering failed', error, errorInfo);
  }

  componentDidUpdate(previousProps: RouteErrorBoundaryProps) {
    if (this.state.hasError && previousProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
          <div className="max-w-md rounded-lg bg-white p-6 text-center shadow-sm border border-gray-200">
            <h1 className="text-lg font-semibold text-gray-900">No pudimos cargar esta sección</h1>
            <p className="mt-2 text-sm text-gray-600">
              Puede haber una actualización disponible o un problema temporal de conexión.
              Recargá la página para intentar nuevamente.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 transition-colors"
            >
              Recargar página
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function RouteErrorBoundaryReset({ children }: { children: ReactNode }) {
  const location = useLocation();

  return <RouteErrorBoundary resetKey={location.pathname}>{children}</RouteErrorBoundary>;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <RouteErrorBoundaryReset>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <Layout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<Dashboard />} />
                <Route path="catalog" element={<Catalog />} />
                <Route path="product/:id" element={<ProductEditor />} />
                <Route path="template" element={<TemplateEditor />} />
                <Route path="settings" element={<Settings />} />
                <Route path="campaigns" element={<Campaigns />} />
                <Route path="campaigns/:id" element={<CampaignEditor />} />
                <Route path="campaigns/:id/share" element={<CampaignShare />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </RouteErrorBoundaryReset>
      </BrowserRouter>
    </AuthProvider>
  );
}
