// src/pages/AuctionsPage.tsx
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { cactusService } from '../services/cactusService';
import { auctionService } from '../services/auctionService';
import { CactusListItem, AuctionInfo } from '../types';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { SkeletonAuctionGrid } from '../components/ui/LoadingSkeleton';
import { NoAuctionsEmpty, NetworkErrorEmpty } from '../components/ui/EmptyState';
import { cn } from '../utils/cn';

// ── Types ─────────────────────────────────────────────────────
interface AuctionEntry {
  cactus:  CactusListItem;
  auction: AuctionInfo;
}

// ── Countdown hook ─────────────────────────────────────────────
function useCountdown(endsAt: string) {
  const calc = () => {
    const ms = new Date(endsAt).getTime() - Date.now();
    if (ms <= 0) return { h: 0, m: 0, s: 0, expired: true };
    return {
      h:       Math.floor(ms / 3_600_000),
      m:       Math.floor((ms % 3_600_000) / 60_000),
      s:       Math.floor((ms % 60_000) / 1_000),
      expired: false,
    };
  };

  const [time, setTime] = useState(calc);

  useEffect(() => {
    const id = setInterval(() => setTime(calc()), 1_000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endsAt]);

  return time;
}

// ── Countdown display ──────────────────────────────────────────
function CountdownBadge({ endsAt }: { endsAt: string }) {
  const { h, m, s, expired } = useCountdown(endsAt);

  if (expired) {
    return <span className="text-xs text-gray-400">Auction ended</span>;
  }

  const urgent = h === 0 && m < 30;

  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    <div className="flex items-center gap-1.5">
      <span className={cn('text-xs font-medium', urgent ? 'text-red-500' : 'text-amber-600 dark:text-amber-400')}>
        ⏱
      </span>
      <div className="flex items-center gap-0.5 font-mono text-sm font-semibold">
        <span className={cn(urgent ? 'text-red-500' : 'text-gray-700 dark:text-gray-200')}>
          {pad(h)}:{pad(m)}:{pad(s)}
        </span>
      </div>
      <span className="text-[11px] text-gray-400 dark:text-gray-500">remaining</span>
    </div>
  );
}

// ── Single auction card ────────────────────────────────────────
function AuctionCard({ entry, onBid }: { entry: AuctionEntry; onBid: (cactusId: number) => void }) {
  const { cactus, auction } = entry;
  const navigate = useNavigate();

  const pctAboveStart = auction.startPrice > 0
    ? Math.round(((auction.currentPrice - auction.startPrice) / auction.startPrice) * 100)
    : 0;

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-5 flex gap-4 hover:border-cactus-300 dark:hover:border-cactus-700 transition-colors">

      {/* Thumbnail / emoji */}
      <div className="w-20 h-20 rounded-xl bg-cactus-50 dark:bg-cactus-950 flex items-center justify-center flex-shrink-0 text-4xl overflow-hidden">
        {cactus.thumbnailUrl
          ? <img src={cactus.thumbnailUrl} alt={cactus.name} className="w-full h-full object-cover rounded-xl" />
          : '🌵'
        }
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        {/* Category + live badge */}
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[11px] font-medium text-cactus-600 dark:text-cactus-400 uppercase tracking-wider">
            {cactus.categoryName}
          </span>
          <Badge variant="danger" pulse>Live</Badge>
        </div>

        {/* Name */}
        <h3
          className="font-display text-lg text-gray-900 dark:text-white mb-1 truncate cursor-pointer hover:text-cactus-600 dark:hover:text-cactus-400 transition-colors"
          onClick={() => navigate(`/cactus/${cactus.id}`)}
        >
          {cactus.name}
        </h3>

        {/* Price row */}
        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-xl font-semibold text-red-500">
            ${auction.currentPrice.toFixed(2)}
          </span>
          <span className="text-xs text-gray-400 dark:text-gray-500">
            started at ${auction.startPrice.toFixed(2)}
          </span>
          {pctAboveStart > 0 && (
            <span className="text-[11px] font-semibold text-cactus-600 dark:text-cactus-400">
              +{pctAboveStart}%
            </span>
          )}
        </div>

        {/* Bid count + countdown */}
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {auction.totalBids} {auction.totalBids === 1 ? 'bid' : 'bids'}
          </span>
          <span className="text-gray-200 dark:text-gray-700">·</span>
          <CountdownBadge endsAt={auction.endsAt} />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => onBid(cactus.id)}
            className="flex-1 sm:flex-none"
          >
            Place Bid
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => navigate(`/cactus/${cactus.id}`)}
          >
            Details
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Sort options ───────────────────────────────────────────────
type SortKey = 'ending_soon' | 'highest_bid' | 'most_bids' | 'lowest_bid';

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'ending_soon', label: 'Ending Soon' },
  { value: 'highest_bid', label: 'Highest Bid' },
  { value: 'lowest_bid',  label: 'Lowest Bid'  },
  { value: 'most_bids',   label: 'Most Active' },
];

function sortEntries(entries: AuctionEntry[], key: SortKey): AuctionEntry[] {
  return [...entries].sort((a, b) => {
    switch (key) {
      case 'ending_soon': return new Date(a.auction.endsAt).getTime() - new Date(b.auction.endsAt).getTime();
      case 'highest_bid': return b.auction.currentPrice - a.auction.currentPrice;
      case 'lowest_bid':  return a.auction.currentPrice - b.auction.currentPrice;
      case 'most_bids':   return b.auction.totalBids    - a.auction.totalBids;
      default:            return 0;
    }
  });
}

// ── Page ──────────────────────────────────────────────────────
export function AuctionsPage() {
  const navigate = useNavigate();

  const [entries,  setEntries]  = useState<AuctionEntry[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(false);
  const [sortKey,  setSortKey]  = useState<SortKey>('ending_soon');
  const [category, setCategory] = useState<string>('all');

  // Load active auctions by fetching cactus list then augmenting with auction data
  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      // Fetch all cacti that have auctions (no category filter — we filter client-side)
      const paged  = await cactusService.getAll(1, 50);
      const active = paged.items.filter((c) => c.hasAuction);

      // Fetch auction detail for each in parallel
      const pairs = await Promise.allSettled(
        active.map(async (c) => {
          const auction = await auctionService.getForCactus(c.id);
          return { cactus: c, auction } as AuctionEntry;
        }),
      );

      const resolved = pairs
        .filter((r): r is PromiseFulfilledResult<AuctionEntry> => r.status === 'fulfilled')
        .map((r) => r.value)
        .filter((e) => e.auction.isActive);

      setEntries(resolved);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Derived data ────────────────────────────────────────────
  const categories = ['all', ...Array.from(new Set(entries.map((e) => e.cactus.categoryName)))];

  const filtered = category === 'all'
    ? entries
    : entries.filter((e) => e.cactus.categoryName === category);

  const sorted = sortEntries(filtered, sortKey);

  // Summary stats
  const totalBids     = entries.reduce((s, e) => s + e.auction.totalBids, 0);
  const highestBid    = entries.length > 0 ? Math.max(...entries.map((e) => e.auction.currentPrice)) : 0;
  const endingSoonest = entries.length > 0
    ? entries.reduce((a, b) =>
        new Date(a.auction.endsAt) < new Date(b.auction.endsAt) ? a : b
      ).cactus.name
    : '—';

  // ── Render ──────────────────────────────────────────────────
  return (
    <div className="max-w-5xl mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-3xl text-gray-900 dark:text-white mb-1">Live Auctions</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Real-time bidding on rare and beautiful cacti. All auctions close at their listed time.
          </p>
        </div>
        {!loading && entries.length > 0 && (
          <Badge variant="danger" pulse className="mt-1 flex-shrink-0">
            {entries.length} active
          </Badge>
        )}
      </div>

      {/* Summary stats */}
      {!loading && entries.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-7">
          {[
            { label: 'Active Auctions', value: entries.length,              sub: 'ongoing right now'   },
            { label: 'Total Bids',      value: totalBids,                   sub: 'placed across all'   },
            { label: 'Highest Bid',     value: `$${highestBid.toFixed(2)}`, sub: `on ${endingSoonest}` },
          ].map(({ label, value, sub }) => (
            <div key={label} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">{label}</p>
              <p className="font-display text-2xl text-gray-900 dark:text-white">{value}</p>
              <p className="text-[11px] text-cactus-600 dark:text-cactus-400 mt-0.5">{sub}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters + sort bar */}
      {!loading && entries.length > 0 && (
        <div className="flex items-center gap-3 mb-5 flex-wrap">
          {/* Category filter pills */}
          <div className="flex items-center gap-2 flex-wrap flex-1">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={cn(
                  'px-3.5 py-1.5 rounded-full text-sm font-medium border capitalize transition-all duration-200',
                  category === cat
                    ? 'bg-cactus-600 border-cactus-600 text-white'
                    : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-cactus-400',
                )}
              >
                {cat === 'all' ? 'All categories' : cat}
              </button>
            ))}
          </div>

          {/* Sort select */}
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="
              text-sm border border-gray-200 dark:border-gray-700
              bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200
              rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-cactus-500 cursor-pointer
            "
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <SkeletonAuctionGrid count={4} />
      ) : error ? (
        <NetworkErrorEmpty onRetry={load} />
      ) : sorted.length === 0 && entries.length > 0 ? (
        // Category filter produced no results
        <div className="text-center py-16">
          <p className="text-4xl mb-3 opacity-40">🏷️</p>
          <p className="font-display text-lg text-gray-600 dark:text-gray-400 mb-1">No auctions in this category</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mb-5">Try a different category filter.</p>
          <Button variant="secondary" onClick={() => setCategory('all')}>Show all categories</Button>
        </div>
      ) : entries.length === 0 ? (
        <NoAuctionsEmpty onBrowse={() => navigate('/home')} />
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {sorted.map((entry) => (
              <AuctionCard
                key={entry.auction.id}
                entry={entry}
                onBid={(id) => navigate(`/cactus/${id}`)}
              />
            ))}
          </div>

          {/* Bottom info strip */}
          <div className="mt-8 p-4 bg-amber-50 dark:bg-amber-950 border border-amber-100 dark:border-amber-900 rounded-xl flex items-start gap-3">
            <span className="text-xl flex-shrink-0">ℹ️</span>
            <p className="text-sm text-amber-800 dark:text-amber-300 leading-relaxed">
              All bids are binding. The highest bidder at auction close wins the cactus.
              Payments are processed within 24 hours of the auction ending.
              Shipping is calculated at checkout.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
