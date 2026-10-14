// @vitest-environment jsdom
// Pages that need a login must wait for the session check on page load before redirecting —
// otherwise reloading /profile (or opening a link to an order) bounces a logged-in user to Home.
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ProfilePage } from '../src/pages/ProfilePage';
import { OrderDetailsPage } from '../src/pages/OrderDetailsPage';

const auth = vi.hoisted(() => ({ user: null as null | { id: string; username: string; email: string }, isLoggedIn: false, loading: true }));
vi.mock('../src/context/AuthContext',  () => ({ useAuth: () => auth }));
vi.mock('../src/context/ToastContext', () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock('../src/context/CartContext',  () => ({ useCart: () => ({ addToCart: vi.fn(), isInCart: () => false, items: [] }) }));

beforeEach(() => vi.stubGlobal('fetch', vi.fn(async () => new Response('[]', { status: 200 }))));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); Object.assign(auth, { user: null, isLoggedIn: false, loading: true }); });

const renderAt = (path: string) => render(
  <MemoryRouter initialEntries={[path]}>
    <Routes>
      <Route path="/home" element={<p>HOME PAGE</p>} />
      <Route path="/profile" element={<ProfilePage />} />
      <Route path="/profile/orders/:id" element={<OrderDetailsPage />} />
    </Routes>
  </MemoryRouter>,
);

describe.each([['/profile?tab=orders'], ['/profile/orders/31']])('%s', (path) => {
  it('stays put while the session is still being checked', () => {
    renderAt(path);
    expect(screen.queryByText('HOME PAGE')).not.toBeInTheDocument();
  });

  it('redirects to Home once the check finds no login', () => {
    Object.assign(auth, { loading: false, isLoggedIn: false });
    renderAt(path);
    expect(screen.getByText('HOME PAGE')).toBeInTheDocument();
  });

  it('stays for a logged-in user', () => {
    Object.assign(auth, { loading: false, isLoggedIn: true, user: { id: 'u1', username: 'Tanmay', email: 't@example.com' } });
    renderAt(path);
    expect(screen.queryByText('HOME PAGE')).not.toBeInTheDocument();
  });
});
