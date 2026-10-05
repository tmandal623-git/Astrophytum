// @vitest-environment jsdom
// Bid History on the cactus detail page is only shown (and fetched) for logged-in users.
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { CactusDetailPage } from '../src/pages/CactusDetailPage';
import type { BidHistory, CactusDetail } from '../src/types';

const auth = vi.hoisted(() => ({ user: null as null | { id: string; username: string }, isLoggedIn: false }));

vi.mock('../src/context/AuthContext',      () => ({ useAuth: () => auth }));
vi.mock('../src/context/AuthModalContext', () => ({ useAuthModal: () => ({ openModal: vi.fn() }) }));
vi.mock('../src/context/CartContext',      () => ({ useCart: () => ({ addToCart: vi.fn(), isInCart: () => false }) }));
vi.mock('../src/context/ToastContext',     () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock('../src/components/cactus/CactusGallery', () => ({ CactusGallery: () => null }));

const CACTUS: CactusDetail = {
  id: 7, name: 'Astrophytum asterias', description: null, categoryId: 1, categoryName: 'Indoor',
  basePrice: 500, createdAt: '2026-01-01T00:00:00.000Z', rating: 0, ratingCount: 0, media: [],
  auction: {
    id: 3, cactusId: 7, startPrice: 500, currentPrice: 600, bidIncrement: 50,
    endsAt: new Date(Date.now() + 86_400_000).toISOString(), isActive: true, totalBids: 2,
  },
};

let history: BidHistory[];
const fetchMock = vi.fn(async (url: string) => {
  if (url === '/api/cactus/7') return new Response(JSON.stringify(CACTUS), { status: 200 });
  if (url === '/api/auction/history/7') {
    return auth.isLoggedIn
      ? new Response(JSON.stringify(history), { status: 200 })
      : new Response(JSON.stringify({ error: 'Not authenticated' }), { status: 401 });
  }
  return new Response('{}', { status: 404 });
});
const historyFetches = () => fetchMock.mock.calls.filter(([url]) => url === '/api/auction/history/7');

const renderPage = () => render(
  <MemoryRouter initialEntries={['/cactus/7']}>
    <Routes><Route path="/cactus/:id" element={<CactusDetailPage />} /></Routes>
  </MemoryRouter>,
);

beforeEach(() => {
  history = [
    { id: 2, username: 'alice', amount: 600, placedAt: new Date().toISOString() },
    { id: 1, username: 'bob',   amount: 550, placedAt: new Date().toISOString() },
  ];
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  cleanup();
  fetchMock.mockClear();
  vi.unstubAllGlobals();
  auth.user = null;
  auth.isLoggedIn = false;
});

describe('CactusDetailPage — Bid History', () => {
  it('hides Bid History and does not request it for guests', async () => {
    renderPage();
    expect(await screen.findByText('Astrophytum asterias')).toBeInTheDocument();
    expect(await screen.findByText(/Log In to Bid/)).toBeInTheDocument();   // rest of the auction panel still renders

    expect(screen.queryByText('Bid History')).not.toBeInTheDocument();
    expect(screen.queryByText('alice')).not.toBeInTheDocument();
    expect(historyFetches()).toHaveLength(0);
  });

  it('shows Bid History with bids for logged-in users', async () => {
    auth.user = { id: 'u1', username: 'carol' };
    auth.isLoggedIn = true;
    renderPage();

    expect(await screen.findByText('Bid History')).toBeInTheDocument();
    expect(await screen.findByText('alice')).toBeInTheDocument();
    expect(screen.getByText('bob')).toBeInTheDocument();
    expect(screen.getByText('HIGHEST')).toBeInTheDocument();
    expect(historyFetches()).toHaveLength(1);
  });

  it('shows the empty state for logged-in users when there are no bids', async () => {
    history = [];
    auth.user = { id: 'u1', username: 'carol' };
    auth.isLoggedIn = true;
    renderPage();

    expect(await screen.findByText('Bid History')).toBeInTheDocument();
    await waitFor(() => expect(historyFetches()).toHaveLength(1));
    expect(screen.getByText(/No bids yet/)).toBeInTheDocument();
  });

  it('loads Bid History once a guest logs in', async () => {
    const { rerender } = renderPage();
    await screen.findByText('Astrophytum asterias');
    expect(screen.queryByText('Bid History')).not.toBeInTheDocument();

    auth.user = { id: 'u1', username: 'carol' };
    auth.isLoggedIn = true;
    rerender(
      <MemoryRouter initialEntries={['/cactus/7']}>
        <Routes><Route path="/cactus/:id" element={<CactusDetailPage />} /></Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('alice')).toBeInTheDocument();
    expect(historyFetches()).toHaveLength(1);
  });
});
