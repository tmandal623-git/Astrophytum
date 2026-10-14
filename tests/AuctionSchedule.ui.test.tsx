// @vitest-environment jsdom
// Scheduled auctions: "Coming Soon" on the card and product page, no bidding before the start,
// and the product page opens bidding by itself when the start time arrives.
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { CactusDetailPage } from '../src/pages/CactusDetailPage';
import { CactusCard } from '../src/components/cactus/CactusCard';
import type { CactusDetail, CactusListItem } from '../src/types';

vi.mock('../src/context/AuthContext',      () => ({ useAuth: () => ({ user: null, isLoggedIn: false }) }));
vi.mock('../src/context/AuthModalContext', () => ({ useAuthModal: () => ({ openModal: vi.fn() }) }));
vi.mock('../src/context/CartContext',      () => ({ useCart: () => ({ addToCart: vi.fn(), isInCart: () => false, items: [] }) }));
vi.mock('../src/context/ToastContext',     () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock('../src/components/cactus/CactusGallery', () => ({ CactusGallery: () => null }));

const detail = (startsAt: Date): CactusDetail => ({
  id: 7, name: 'Astrophytum asterias', description: null, categoryId: 1, categoryName: 'Own root',
  basePrice: 500, createdAt: '2026-01-01T00:00:00.000Z', rating: 0, ratingCount: 0, media: [],
  auction: {
    id: 3, cactusId: 7, startPrice: 500, currentPrice: 500, bidIncrement: 50,
    startsAt: startsAt.toISOString(),
    endsAt: new Date(startsAt.getTime() + 48 * 3_600_000).toISOString(), isActive: true, totalBids: 0,
  },
});

let cactus: CactusDetail;
const fetchMock = vi.fn(async (url: string) =>
  url === '/api/cactus/7'
    ? new Response(JSON.stringify(cactus), { status: 200 })
    : new Response('[]', { status: 200 }));

const renderPage = () => render(
  <MemoryRouter initialEntries={['/cactus/7']}>
    <Routes><Route path="/cactus/:id" element={<CactusDetailPage />} /></Routes>
  </MemoryRouter>,
);

beforeEach(() => vi.stubGlobal('fetch', fetchMock));
afterEach(() => { cleanup(); fetchMock.mockClear(); vi.unstubAllGlobals(); });

describe('product page', () => {
  it('shows when bidding opens and hides the bid controls before the start', async () => {
    cactus = detail(new Date(Date.now() + 3 * 86_400_000));
    renderPage();
    expect(await screen.findByText(/will be available for bidding on/)).toBeInTheDocument();
    expect(screen.getByText('Bidding Opens In')).toBeInTheDocument();
    expect(screen.getAllByText('Coming Soon').length).toBeGreaterThan(0);
    expect(screen.queryByText(/Log In to Bid/)).not.toBeInTheDocument();
    expect(screen.queryByRole('radiogroup', { name: 'Choose your bid' })).not.toBeInTheDocument();
  });

  it('opens bidding by itself when the start time arrives', async () => {
    cactus = detail(new Date(Date.now() + 1_500));
    renderPage();
    expect(await screen.findByText('Bidding Opens In')).toBeInTheDocument();
    expect(await screen.findByText(/Log In to Bid/, {}, { timeout: 4_000 })).toBeInTheDocument();
    expect(screen.queryByText('Bidding Opens In')).not.toBeInTheDocument();
    expect(screen.getAllByText('Live Auction')).toHaveLength(2);   // badge + panel header
  });

  it('existing (already started) auctions show live bidding straight away', async () => {
    cactus = detail(new Date(Date.now() - 3_600_000));
    renderPage();
    expect(await screen.findByText(/Log In to Bid/)).toBeInTheDocument();
    expect(screen.queryByText(/will be available for bidding/)).not.toBeInTheDocument();
  });
});

describe('home page card', () => {
  const item = (extra: Partial<CactusListItem>): CactusListItem => ({
    id: 7, name: 'Astrophytum asterias', description: null, categoryName: 'Own root', categoryId: 1,
    basePrice: 500, hasAuction: true, thumbnailUrl: null, rating: 0, ratingCount: 0, quantity: 1, ...extra,
  });
  const renderCard = (c: CactusListItem) => render(<MemoryRouter><CactusCard cactus={c} /></MemoryRouter>);

  it('shows Coming Soon with the start date for a scheduled auction', () => {
    const start = new Date(new Date().getFullYear() + 0, 11, 19, 11, 0);   // 19 Dec, 11:00 local
    if (start.getTime() <= Date.now()) start.setFullYear(start.getFullYear() + 1);
    renderCard(item({ auctionStartsAt: start.toISOString() }));
    expect(screen.getByText('Coming Soon')).toBeInTheDocument();
    expect(screen.getByText(/Available for bidding on 19 December/)).toHaveTextContent('11:00 AM');
    expect(screen.queryByText('Live Bid')).not.toBeInTheDocument();
  });

  it('shows Live Bid for a started auction', () => {
    renderCard(item({ auctionStartsAt: null }));
    expect(screen.getByText('Live Bid')).toBeInTheDocument();
    expect(screen.queryByText('Coming Soon')).not.toBeInTheDocument();
  });
});
