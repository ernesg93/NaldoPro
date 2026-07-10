// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, screen, within, act, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { Layout } from '../components/Layout';
import '@testing-library/jest-dom/vitest';

// Mock AuthService to avoid Firebase import issues in tests
vi.mock('../services/AuthService', () => ({
  AuthService: { logout: vi.fn().mockResolvedValue(undefined) },
}));

// Helper to render Layout inside a router
function renderLayout() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Layout />
    </MemoryRouter>
  );
}

describe('Layout mobile navigation', () => {
  afterEach(() => {
    cleanup();
  });

  describe('hamburger toggle', () => {
    it('renders a hamburger button with accessible label "Open menu"', () => {
      renderLayout();
      const hamburger = screen.getByRole('button', { name: /open menu/i });
      expect(hamburger).toBeInTheDocument();
    });

    it('hamburger button has aria-expanded=false initially', () => {
      renderLayout();
      const hamburger = screen.getByRole('button', { name: /open menu/i });
      expect(hamburger).toHaveAttribute('aria-expanded', 'false');
    });

    it('clicking the hamburger button sets aria-expanded to true and updates the action label', async () => {
      const user = userEvent.setup();
      renderLayout();

      const hamburger = screen.getByRole('button', { name: /open menu/i });
      await user.click(hamburger);
      expect(hamburger).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByRole('button', { name: /close menu/i })).toBe(hamburger);
    });

    it('clicking the hamburger again sets aria-expanded back to false', async () => {
      const user = userEvent.setup();
      renderLayout();

      const hamburger = screen.getByRole('button', { name: /open menu/i });
      await user.click(hamburger);
      expect(hamburger).toHaveAttribute('aria-expanded', 'true');

      await user.click(hamburger);
      expect(hamburger).toHaveAttribute('aria-expanded', 'false');
      expect(screen.getByRole('button', { name: /open menu/i })).toBe(hamburger);
    });
  });

  describe('mobile nav links', () => {
    it('contains all five route links after opening', async () => {
      const user = userEvent.setup();
      renderLayout();

      await user.click(screen.getByRole('button', { name: /open menu/i }));

      const mobileNav = screen.getByRole('navigation', { name: /mobile/i });
      expect(within(mobileNav).getByText('Dashboard')).toBeInTheDocument();
      expect(within(mobileNav).getByText('Catálogo')).toBeInTheDocument();
      expect(within(mobileNav).getByText('Campañas')).toBeInTheDocument();
      expect(within(mobileNav).getByText('Plantilla')).toBeInTheDocument();
      expect(within(mobileNav).getByText('Configuración')).toBeInTheDocument();
    });

    it('clicking a nav link sets aria-expanded to false (closes panel)', async () => {
      const user = userEvent.setup();
      renderLayout();

      const hamburger = screen.getByRole('button', { name: /open menu/i });
      await user.click(hamburger);
      expect(hamburger).toHaveAttribute('aria-expanded', 'true');

      const link = within(screen.getByRole('navigation', { name: /mobile/i })).getByText('Catálogo');
      await user.click(link);

      expect(hamburger).toHaveAttribute('aria-expanded', 'false');
    });
  });

  describe('desktop nav preservation', () => {
    it('desktop navigation is always present in the DOM', () => {
      renderLayout();
      const desktopNav = screen.getByRole('navigation', { name: /desktop/i });
      expect(desktopNav).toBeInTheDocument();
    });

    it('desktop navigation contains all route links', () => {
      renderLayout();
      const desktopNav = screen.getByRole('navigation', { name: /desktop/i });
      expect(within(desktopNav).getByText('Dashboard')).toBeInTheDocument();
      expect(within(desktopNav).getByText('Catálogo')).toBeInTheDocument();
      expect(within(desktopNav).getByText('Campañas')).toBeInTheDocument();
      expect(within(desktopNav).getByText('Plantilla')).toBeInTheDocument();
      expect(within(desktopNav).getByText('Configuración')).toBeInTheDocument();
    });
  });

  describe('overflow guard', () => {
    it('root layout container prevents horizontal overflow', () => {
      const { container } = renderLayout();
      const rootDiv = container.querySelector('.overflow-x-hidden');
      expect(rootDiv).toBeInTheDocument();
    });
  });
});
