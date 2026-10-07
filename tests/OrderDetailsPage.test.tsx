// @vitest-environment jsdom
// Clicking an ordered item on My Orders opens that order's details page.
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ProfilePage } from '../src/pages/ProfilePage';
import { OrderDetailsPage } from '../src/pages/OrderDetailsPage';

vi.mock('../src/context/AuthContext',  () => ({
  useAuth: () => ({ user: { id: 'u1', username: 'alice', email: 'a@b.co' }, isLoggedIn: true, loading: false }),
}));
vi.mock('../src/context/ToastContext', () => ({ useToast: () => ({ showToast: vi.fn() }) }));

const ITEMS = [
  { cactusId: 7, name: 'Star Cactus',  quantity: 2, unitPrice: 450, thumbnailUrl: null },
  { cactusId: 8, name: 'Bishop’s Cap', quantity: 1, unitPrice: 300, thumbnailUrl: null },
];
const LIST = [{ id: 42, orderNumber: 'CM-000042', status: 'confirmed', total: 1200, paymentMethod: 'googlepay', createdAt: '2026-10-01T10:00:00.000Z', items: ITEMS }];
const DETAIL = {
  ...LIST[0], orderStatus: 'confirmed', paymentStatus: 'paid', subtotal: 1200, shipping: 0, tax: 0,
  transactionId: 'UTR123456', rejectionNote: null, verifiedAt: '2026-10-02T10:00:00.000Z',
  firstName: 'Alice', lastName: 'Smith', email: 'a@b.co', phone: '+91 99999 99999',
  addressLine1: '12 Desert Rd', addressLine2: null, city: 'Pune', state: 'MH', zip: '411001', country: 'India',
};

const fetchMock = vi.fn(async (url: string) => {
  if (url === '/api/auth/my-bids')         return new Response('[]', { status: 200 });
  if (url === '/api/auth/my-orders')       return new Response(JSON.stringify(LIST), { status: 200 });
  if (url === '/api/auth/my-orders/42')    return new Response(JSON.stringify(DETAIL), { status: 200 });
  return new Response(JSON.stringify({ error: 'Order not found' }), { status: 404 });
});

const renderAt = (path: string) => render(
  <MemoryRouter initialEntries={[path]}>
    <Routes>
      <Route path="/profile"    element={<ProfilePage />} />
      <Route path="/orders/:id" element={<OrderDetailsPage />} />
    </Routes>
  </MemoryRouter>,
);

beforeEach(() => vi.stubGlobal('fetch', fetchMock));
afterEach(() => { cleanup(); fetchMock.mockClear(); vi.unstubAllGlobals(); });

describe('Order details', () => {
  it('opens the order details when an ordered item is clicked', async () => {
    renderAt('/profile?tab=orders');
    fireEvent.click(await screen.findByRole('button', { name: /details for Bishop’s Cap/ }));

    expect(await screen.findByRole('heading', { name: 'CM-000042' })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/my-orders/42', { credentials: 'include' });
    expect(screen.getByText('Qty: 2 × ₹450.00')).toBeInTheDocument();
    expect(screen.getByText('UTR123456')).toBeInTheDocument();
    expect(screen.getByText('Google Pay')).toBeInTheDocument();
    expect(screen.getByText(/12 Desert Rd/)).toBeInTheDocument();
    expect(screen.getAllByText('Confirmed').length).toBeGreaterThan(0);
    // The clicked item is highlighted
    expect(screen.getByRole('button', { name: 'Bishop’s Cap' }).closest('[data-selected]')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Star Cactus' }).closest('[data-selected]')).toBeNull();
  });

  it('shows a not-found state for an order that is not the user’s', async () => {
    renderAt('/orders/99');
    expect(await screen.findByText('Order not found')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Back to My Orders/ })).toBeInTheDocument();
  });
});
