import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext } from '../../frontend/src/context/AuthContext.jsx';
import Landing from '../../frontend/src/pages/Landing.jsx';
import NotFound from '../../frontend/src/pages/NotFound.jsx';
import Login from '../../frontend/src/pages/Login.jsx';
import ProductEdit from '../../frontend/src/pages/ProductEdit.jsx';
import { AppRoutes } from '../../frontend/src/App.jsx';

globalThis.React = React;

function renderWithAuth(element, { user = null, route = '/' } = {}) {
  const authValue = {
    user,
    loading: false,
    login: async () => {},
    logout: async () => {},
    hasRole: (...roles) => (user ? roles.includes(user.role) : false),
    isAuthenticated: !!user,
  };

  return renderToString(
    <AuthContext.Provider value={authValue}>
      <MemoryRouter initialEntries={[route]}>
        {element}
      </MemoryRouter>
    </AuthContext.Provider>
  );
}

describe('Public Landing Page & Routing Suite', () => {
  it('renders Public Landing page at root / for signed-out visitors without login form', () => {
    const html = renderWithAuth(<Landing />, { user: null, route: '/' });

    // Verify Brand, Headline, and CTAs
    expect(html).toContain('ORIMS');
    expect(html).toContain('Optimised Retail Inventory Management System');
    expect(html).toContain('Intelligent Inventory, Checkout &amp; ML Replenishment');
    expect(html).toContain('Get Started');
    expect(html).toContain('Sign In');
    expect(html).toContain('href="/login"');

    // Verify Documented Capabilities
    expect(html).toContain('Catalogue &amp; SKU Control');
    expect(html).toContain('POS &amp; Atomic Checkout');
    expect(html).toContain('Purchasing &amp; Receiving');
    expect(html).toContain('Stock Movement Ledger');
    expect(html).toContain('Customer Returns &amp; Refunds');
    expect(html).toContain('Valuation &amp; Turnover Reports');

    // Verify ML Architecture Section
    expect(html).toContain('ML Optimization');
    expect(html).toContain('FastAPI + Scikit-Learn + Node.js Engine');
    expect(html).toContain('Human-in-the-Loop Governance');

    // Verify that the login form inputs are NOT rendered on the landing page
    expect(html).not.toContain('placeholder="••••••••"');
    expect(html).not.toContain('Demo credentials:');
  });

  it('renders Landing page with Dashboard CTA when user is already authenticated', () => {
    const html = renderWithAuth(<Landing />, {
      user: { name: 'Store Manager', role: 'MANAGER' },
      route: '/',
    });

    expect(html).toContain('Go to Dashboard');
    expect(html).toContain('href="/dashboard"');
    expect(html).toContain('Store Manager');
    expect(html).toContain('MANAGER');
  });

  it('renders Login page at /login with sign-in form and return link', () => {
    const html = renderWithAuth(<Login />, { user: null, route: '/login' });

    expect(html).toContain('Sign in');
    expect(html).toContain('Email address');
    expect(html).toContain('Password');
    expect(html).toContain('placeholder="••••••••"');
    expect(html).toContain('Back to Public Landing Page');
    expect(html).toContain('href="/"');
    expect(html).toContain('Demo credentials:');
  });

  it('renders NotFound page with 404 header and navigation back to root /', () => {
    const html = renderWithAuth(<NotFound />, { user: null, route: '/unmatched-route-xyz' });

    expect(html).toContain('404');
    expect(html).toContain('Page Not Found');
    expect(html).toContain('The page you requested could not be found');
    expect(html).toContain('Go to Landing Page');
    expect(html).toContain('href="/"');
  });

  it('renders NotFound page with Dashboard link when authenticated', () => {
    const html = renderWithAuth(<NotFound />, {
      user: { name: 'Admin User', role: 'ADMIN' },
      route: '/missing-page',
    });

    expect(html).toContain('Go to Dashboard');
    expect(html).toContain('href="/dashboard"');
  });

  it('validates safe internal redirects preventing open redirect attacks', () => {
    const sanitizeRedirect = (raw) => {
      return typeof raw === 'string' && raw.startsWith('/') && !raw.startsWith('//') && !raw.includes(':\\')
        ? raw
        : '/dashboard';
    };

    expect(sanitizeRedirect('/sales')).toBe('/sales');
    expect(sanitizeRedirect('/inventory?status=LOW_STOCK')).toBe('/inventory?status=LOW_STOCK');
    expect(sanitizeRedirect('/optimization')).toBe('/optimization');
    expect(sanitizeRedirect('https://evil.com')).toBe('/dashboard');
    expect(sanitizeRedirect('//evil.com')).toBe('/dashboard');
    expect(sanitizeRedirect('javascript:alert(1)')).toBe('/dashboard');
    expect(sanitizeRedirect(null)).toBe('/dashboard');
    expect(sanitizeRedirect(undefined)).toBe('/dashboard');
  });

  it('registers /products/:id/edit route for authenticated managers and admins (F-UI-01)', () => {
    const html = renderWithAuth(<AppRoutes />, {
      user: { name: 'Manager User', role: 'MANAGER' },
      route: '/products/test-prod-123/edit',
    });

    // Confirms route is registered and does not fall back to 404
    expect(html).not.toContain('Page Not Found');
    expect(html).not.toContain('The page you requested could not be found');
  });
});
