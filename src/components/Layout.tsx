import React, { useState, useCallback } from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { AuthService } from '../services/AuthService';
import { LogOut, Menu, X } from 'lucide-react';

const NAV_LINKS = [
  { to: '/', label: 'Dashboard' },
  { to: '/catalog', label: 'Catálogo' },
  { to: '/campaigns', label: 'Campañas' },
  { to: '/template', label: 'Plantilla' },
  { to: '/settings', label: 'Configuración' },
] as const;

export function Layout() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const navigate = useNavigate();

  const closeMobileNav = useCallback(() => setMobileNavOpen(false), []);

  const handleLogout = async () => {
    await AuthService.logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans overflow-x-hidden">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0 font-bold text-xl tracking-tight text-gray-900">
                Catálogo MVP
              </div>

              {/* Desktop nav — hidden on mobile, visible on lg+ */}
              <nav aria-label="Desktop" className="ml-6 hidden lg:flex space-x-8">
                {NAV_LINKS.map(link => (
                  <Link
                    key={link.to}
                    to={link.to}
                    className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors"
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>
            </div>

            <div className="flex items-center gap-2">
              {/* Hamburger toggle — visible on mobile, hidden on lg+ */}
              <button
                onClick={() => setMobileNavOpen(prev => !prev)}
                aria-expanded={mobileNavOpen}
                aria-label={mobileNavOpen ? 'Close menu' : 'Open menu'}
                className="lg:hidden inline-flex items-center justify-center p-2 rounded-md text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
              >
                {mobileNavOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>

              <button
                onClick={handleLogout}
                className="text-gray-500 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium inline-flex items-center gap-2"
                title="Cerrar sesión"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Salir</span>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile nav panel — visible when toggled, hidden on lg+ */}
        <nav
          aria-label="Mobile"
          className={mobileNavOpen ? 'lg:hidden border-t border-gray-200' : 'hidden'}
        >
          <div className="px-4 pt-2 pb-4 space-y-1">
            {NAV_LINKS.map(link => (
              <Link
                key={link.to}
                to={link.to}
                onClick={closeMobileNav}
                className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </nav>
      </header>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
}
