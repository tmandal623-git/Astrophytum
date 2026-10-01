// src/pages/AuctionsPage.tsx
// Loads ALL active auctions from DB in a single efficient API call.
// No mock data — every field comes from PostgreSQL.

import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth }      from '../context/AuthContext';
import { useAuthModal } from '../context/AuthModalContext';
import { useToast }     from '../context/ToastContext';
import { cn }           from '../utils/cn';

// ── Types ─────────────────────────────────────────────────────
interface ActiveAuction {
  cactusId:     number;
  cactusName:   string;
  description:  string | null;
  categoryName: string;
  basePrice:    number;
  thumbnailUrl: string | null;
  auctionId:    number;
  startPrice:   number;
  currentPrice: number;
  bidIncrement: number;
  endsAt:       string;
  isActive:     boolean;
  totalBids:    number;
}

type SortKey = 'ending_soon' | 'highest_bid' | 'lowest_bid' | 'most_bids';

// ── Countdown hook ────────────────────────────────────────────
function useCountdown(endsAt: string) {
  const calc = () => {
    const ms = new Date(endsAt).getTime() - Date.now();
    if (ms <= 0) return { h: 0, m: 0, s: 0, expired: true };
    return {
      h: Math.floor(ms / 3_600_000),
      m: Math.floor((ms % 3_600_000) / 60_000),
      s: Math.floor((ms % 60_000) / 1_000),
      expired: false,
    };
  };
  const [time, setTime] = useState(calc);
  useEffect(() => {
    const id = setInterval(() => setTime(calc()), 1_000);
    return () => clearInterval(id);
  }, [endsAt]);
  return time;
}

// ── Countdown badge ───────────────────────────────────────────
function CountdownBadge({ endsAt }: { endsAt: string }) {
  const { h, m, s, expired } = useCountdown(endsAt);
  if (expired) return <span className="text-xs text-gray-400 dark:text-gray-500">Auction ended</span>;
  const urgent = h === 0 && m < 30;
  const pad    = (n: number) => String(n).padStart(2, '0');
  return (
    <div className="flex items-center gap-1.5">
      <span className={cn('text-xs', urgent ? 'text-red-500' : 'text-amber-500 dark:text-amber-400')}>⏱</span>
      <span className={cn('font-mono text-sm font-semibold', urgent ? 'text-red-500' : 'text-gray-700 dark:text-gray-200')}>
        {pad(h)}:{pad(m)}:{pad(s)}
      </span>
      <span className="text-[11px] text-gray-400 dark:text-gray-500">left</span>
    </div>
  );
}

// ── Auction card ──────────────────────────────────────────────
function AuctionCard({
  item, onBid,
}: {
  item:  ActiveAuction;
  onBid: (id: number) => void;
}) {
  const navigate        = useNavigate();
  const pctAboveStart   = item.startPrice > 0
    ? Math.round(((item.currentPrice - item.startPrice) / item.startPrice) * 100)
    : 0;
  const [imgError, setImgError] = useState(false);

  return (
    <div
      className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden hover:border-cactus-300 dark:hover:border-cactus-700 hover:shadow-md transition-all duration-200 flex flex-col"
    >
      {/* Image */}
      <div
        className="relative h-48 bg-cactus-50 dark:bg-cactus-950 flex items-center justify-center overflow-hidden cursor-pointer group"
        onClick={() => navigate(`/cactus/${item.cactusId}`)}
      >
        {item.thumbnailUrl && !imgError ? (
          <img
            src={item.thumbnailUrl}
            alt={item.cactusName}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            onError={() => setImgError(true)}
          />
        ) : (
          <span className="text-7xl opacity-30 select-none">🌵</span>
        )}

        {/* Live badge */}
        <div className="absolute top-3 left-3">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full bg-red-600 text-white">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            LIVE
          </span>
        </div>

        {/* Category badge */}
        <div className="absolute top-3 right-3">
          <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-white/90 dark:bg-gray-900/90 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
            {item.categoryName}
          </span>
        </div>

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-300 flex items-center justify-center">
          <span className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 dark:bg-gray-900/90 text-sm font-semibold text-gray-900 dark:text-white px-4 py-2 rounded-full shadow">
            View Details →
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="p-4 flex flex-col gap-3 flex-1">
        {/* Name */}
        <h3
          onClick={() => navigate(`/cactus/${item.cactusId}`)}
          className="font-display text-lg text-gray-900 dark:text-white leading-snug cursor-pointer hover:text-cactus-600 dark:hover:text-cactus-400 transition-colors line-clamp-1"
        >
          {item.cactusName}
        </h3>

        {/* Description */}
        {item.description && (
          <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed -mt-1">
            {item.description}
          </p>
        )}

        {/* Price row */}
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-semibold text-red-500">
            ₹{Number(item.currentPrice).toFixed(2)}
          </span>
          <span className="text-xs text-gray-400 dark:text-gray-500">
            started ₹{Number(item.startPrice).toFixed(2)}
          </span>
          {pctAboveStart > 0 && (
            <span className="text-[11px] font-semibold text-cactus-600 dark:text-cactus-400 ml-auto">
              +{pctAboveStart}%
            </span>
          )}
        </div>

        {/* Bids + countdown */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {item.totalBids} {item.totalBids === 1 ? 'bid' : 'bids'}
          </span>
          <CountdownBadge endsAt={item.endsAt} />
        </div>

        {/* Actions */}
        <div className="flex gap-2 mt-auto pt-1">
          <button
            onClick={() => onBid(item.cactusId)}
            className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            Place Bid
          </button>
          <button
            onClick={() => navigate(`/cactus/${item.cactusId}`)}
            className="px-4 py-2.5 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 text-sm font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Details
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────
function AuctionSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
      <div className="h-48 bg-gray-100 dark:bg-gray-800 animate-pulse" />
      <div className="p-4 space-y-3">
        <div className="h-5 w-3/4 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
        <div className="h-4 w-full  bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
        <div className="h-7 w-1/2  bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
        <div className="flex gap-2">
          <div className="flex-1 h-10 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
          <div className="w-20 h-10 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
        </div>
      </div>
    </div>
  );
}

// ── Sort helpers ──────────────────────────────────────────────
const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'ending_soon', label: '⏱ Ending Soon'  },
  { value: 'highest_bid', label: '📈 Highest Bid'  },
  { value: 'lowest_bid',  label: '📉 Lowest Bid'   },
  { value: 'most_bids',   label: '🔥 Most Active'  },
];

function sortItems(items: ActiveAuction[], key: SortKey): ActiveAuction[] {
  return [...items].sort((a, b) => {
    switch (key) {
      case 'ending_soon': return new Date(a.endsAt).getTime() - new Date(b.endsAt).getTime();
      case 'highest_bid': return b.currentPrice - a.currentPrice;
      case 'lowest_bid':  return a.currentPrice - b.currentPrice;
      case 'most_bids':   return b.totalBids    - a.totalBids;
      default:            return 0;
    }
  });
}

// ── Main page ─────────────────────────────────────────────────
export function AuctionsPage() {
  const navigate           = useNavigate();
  const { isLoggedIn }     = useAuth();
  const { openModal }      = useAuthModal();
  const { showToast }      = useToast();

  const [auctions,  setAuctions]  = useState<ActiveAuction[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [sortKey,   setSortKey]   = useState<SortKey>('ending_soon');
  const [category,  setCategory]  = useState('all');

  // ── Load all active auctions from DB ──────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch('/api/auctions/active', { credentials: 'include' });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setAuctions(Array.isArray(body) ? body : []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load auctions';
      setError(msg);
      console.error('AuctionsPage load error:', msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Handle "Place Bid" click ──────────────────────────────
  const handleBid = (cactusId: number) => {
    if (!isLoggedIn) {
      openModal('Please log in to place a bid. Your bid history is saved to your account.', 'login');
      return;
    }
    navigate(`/cactus/${cactusId}`);
  };

  // ── Derived data ──────────────────────────────────────────
  const categories  = ['all', ...Array.from(new Set(auctions.map(a => a.categoryName)))];
  const filtered    = category === 'all' ? auctions : auctions.filter(a => a.categoryName === category);
  const sorted      = sortItems(filtered, sortKey);

  const totalBids   = auctions.reduce((s, a) => s + a.totalBids, 0);
  const highestBid  = auctions.length > 0 ? Math.max(...auctions.map(a => a.currentPrice)) : 0;
  const endingSoon  = auctions.length > 0
    ? auctions.reduce((a, b) => new Date(a.endsAt) < new Date(b.endsAt) ? a : b).cactusName
    : '—';

  // ── Render ────────────────────────────────────────────────
  return (
    <div className="max-w-6xl mx-auto">

      {/* ── Page header ──────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4 mb-6">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl text-gray-900 dark:text-white mb-1">
            Live Auctions
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Real-time bidding on rare and beautiful cacti. All bids are binding.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 sm:mt-1">
          {!loading && auctions.length > 0 && (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-full bg-red-600 text-white">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              {auctions.length} LIVE
            </span>
          )}
          <button
            onClick={load}
            className="px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            ↺ Refresh
          </button>
        </div>
      </div>

      {/* ── Error ───────────────────────────────────────────── */}
      {error && !loading && (
        <div className="mb-6 p-5 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-600 dark:text-red-400 flex items-center justify-between gap-3">
          <span>⚠️ {error}</span>
          <button onClick={load} className="px-3 py-1 bg-red-100 dark:bg-red-900 rounded-lg text-xs font-medium hover:bg-red-200 dark:hover:bg-red-800 transition-colors">
            Retry
          </button>
        </div>
      )}

      {/* ── Stat strip ───────────────────────────────────────── */}
      {!loading && auctions.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-6">
          {[
            { label:'Active Auctions', value:auctions.length,              sub:'ongoing right now'  },
            { label:'Total Bids',      value:totalBids,                    sub:'placed across all'  },
            { label:'Highest Bid',     value:`₹${highestBid.toFixed(2)}`,  sub:`on ${endingSoon}`  },
          ].map(({ label, value, sub }) => (
            <div key={label} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-3 sm:p-4 min-w-0">
              <p className="text-[10px] sm:text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">{label}</p>
              <p className="font-display text-lg sm:text-2xl text-gray-900 dark:text-white truncate">{value}</p>
              <p className="text-[11px] text-cactus-600 dark:text-cactus-400 mt-0.5">{sub}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Filters + sort ───────────────────────────────────── */}
      {!loading && auctions.length > 0 && (
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          {/* Category pills */}
          <div className="flex items-center gap-2 flex-wrap flex-1">
            {categories.map(cat => (
              <button key={cat} onClick={() => setCategory(cat)}
                className={cn(
                  'px-3.5 py-1.5 rounded-full text-sm font-medium border capitalize transition-all duration-200',
                  category === cat
                    ? 'bg-cactus-600 border-cactus-600 text-white shadow-sm'
                    : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-cactus-400 dark:hover:border-cactus-600',
                )}>
                {cat === 'all' ? 'All Categories' : cat}
              </button>
            ))}
          </div>
          {/* Sort */}
          <select
            value={sortKey}
            onChange={e => setSortKey(e.target.value as SortKey)}
            className="text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-cactus-500 cursor-pointer flex-shrink-0"
          >
            {SORT_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      )}

      {/* ── Loading skeleton ─────────────────────────────────── */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1,2,3,4,5,6].map(i => <AuctionSkeleton key={i} />)}
        </div>
      )}

      {/* ── Empty states ─────────────────────────────────────── */}
      {!loading && !error && auctions.length === 0 && (
        <div className="text-center py-24">
          <p className="text-6xl mb-5 opacity-20 select-none">🔨</p>
          <p className="font-display text-2xl text-gray-600 dark:text-gray-400 mb-2">No live auctions right now</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mb-8">
            Check back soon — new auctions are added regularly.
          </p>
          <button
            onClick={() => navigate('/home')}
            className="px-6 py-3 bg-cactus-600 hover:bg-cactus-700 text-white rounded-xl font-semibold transition-colors"
          >
            Browse All Cacti
          </button>
        </div>
      )}

      {!loading && !error && auctions.length > 0 && sorted.length === 0 && (
        <div className="text-center py-16">
          <p className="text-4xl mb-3 opacity-30">🏷️</p>
          <p className="font-display text-lg text-gray-600 dark:text-gray-400 mb-4">
            No auctions in "{category}"
          </p>
          <button
            onClick={() => setCategory('all')}
            className="px-5 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Show all categories
          </button>
        </div>
      )}

      {/* ── Auction grid ─────────────────────────────────────── */}
      {!loading && !error && sorted.length > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {sorted.map(item => (
              <AuctionCard
                key={item.auctionId}
                item={item}
                onBid={handleBid}
              />
            ))}
          </div>

          {/* ── Guest login nudge ─────────────────────────────── */}
          {!isLoggedIn && (
            <div className="mt-8 p-5 bg-cactus-50 dark:bg-cactus-950 border border-cactus-100 dark:border-cactus-900 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-cactus-800 dark:text-cactus-200 mb-0.5">
                  🔒 Log in to place bids
                </p>
                <p className="text-xs text-cactus-600 dark:text-cactus-400">
                  Create a free account to bid on any cactus. Your bid history is saved to your profile.
                </p>
              </div>
              <button
                onClick={() => openModal('Create an account to start bidding on live auctions.', 'register')}
                className="px-4 py-2 bg-cactus-600 hover:bg-cactus-700 text-white text-sm font-semibold rounded-lg transition-colors flex-shrink-0"
              >
                Log In / Register
              </button>
            </div>
          )}

          {/* ── Info strip ───────────────────────────────────── */}
          <div className="mt-5 p-4 bg-amber-50 dark:bg-amber-950 border border-amber-100 dark:border-amber-900 rounded-xl flex items-start gap-3">
            <span className="text-xl flex-shrink-0">ℹ️</span>
            <p className="text-sm text-amber-800 dark:text-amber-300 leading-relaxed">
              All bids are binding. The highest bidder when the timer expires wins.
              Payments are processed within 24 hours of the auction ending.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
