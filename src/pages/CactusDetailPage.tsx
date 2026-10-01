// src/pages/CactusDetailPage.tsx
// Changes vs previous version:
//  1. Description no longer shown below the name — moved to accordion below action panel
//  2. "Care Tips" accordion added below Description accordion
//  3. Gallery uses new horizontal 5-thumbnail strip (CactusGallery updated separately)

import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth }               from '../context/AuthContext';
import { useAuthModal }          from '../context/AuthModalContext';
import { useCart }               from '../context/CartContext';
import { useToast }              from '../context/ToastContext';
import { CactusDetail, AuctionInfo, BidHistory } from '../types';
import { CactusGallery }         from '../components/cactus/CactusGallery';
import { Badge }                 from '../components/ui/Badge';
import { CactusDetailSkeleton }  from '../components/ui/LoadingSkeleton';
import { cn }                    from '../utils/cn';

// ── Care tips by category ─────────────────────────────────────
const CARE_TIPS: Record<string, { icon: string; title: string; detail: string }[]> = {
  default: [
    { icon: '💧', title: 'Watering',    detail: 'Water deeply but infrequently — every 2–3 weeks in summer, once a month in winter. Allow soil to dry completely between waterings.' },
    { icon: '☀️', title: 'Light',       detail: 'Prefers bright, direct sunlight for at least 6 hours a day. South or east-facing windows are ideal indoors.' },
    { icon: '🌡️', title: 'Temperature', detail: 'Thrives between 15–35°C (60–95°F). Protect from frost — most cacti are damaged below 5°C (40°F).' },
    { icon: '🪴', title: 'Soil',        detail: 'Use a fast-draining cactus or succulent mix. Adding perlite or coarse sand improves drainage significantly.' },
    { icon: '🌱', title: 'Repotting',   detail: 'Repot every 2–3 years in spring. Choose a pot only slightly larger than the root ball with drainage holes.' },
  ],
  Indoor: [
    { icon: '💧', title: 'Watering',    detail: 'Water every 2–4 weeks in summer. Reduce to once every 6–8 weeks in winter when growth slows.' },
    { icon: '☀️', title: 'Light',       detail: 'Place near a bright window with indirect light. Rotate the pot quarter-turn monthly for even growth.' },
    { icon: '🌡️', title: 'Temperature', detail: 'Keep between 18–24°C (65–75°F). Avoid cold drafts from windows or air conditioning vents.' },
    { icon: '🪴', title: 'Soil',        detail: 'Use well-draining cactus mix. Avoid pots without drainage holes to prevent root rot.' },
    { icon: '🌿', title: 'Humidity',    detail: 'Low humidity is ideal. Standard indoor humidity levels (30–50%) work perfectly.' },
  ],
  Outdoor: [
    { icon: '💧', title: 'Watering',    detail: 'Established outdoor cacti rarely need supplemental watering — rely on rainfall. Water every 2–3 weeks only during prolonged droughts.' },
    { icon: '☀️', title: 'Light',       detail: 'Full sun location with at least 6–8 hours of direct sunlight daily. Ideal for south or west-facing garden beds.' },
    { icon: '🌡️', title: 'Cold Hardy',  detail: 'Check the hardiness rating of your specific variety. Many outdoor cacti tolerate light frost but need protection below -5°C (23°F).' },
    { icon: '🪴', title: 'Soil',        detail: 'Plant in sandy or gravelly, well-drained soil. Raised beds or slopes prevent waterlogging in rainy seasons.' },
    { icon: '🐛', title: 'Pests',       detail: 'Inspect for mealybugs and scale insects, especially in warm months. Treat with neem oil or isopropyl alcohol on a cotton swab.' },
  ],
  Rare: [
    { icon: '💧', title: 'Watering',    detail: 'Err on the side of underwatering — rare specimens are especially susceptible to root rot. Water every 3–4 weeks in the growing season.' },
    { icon: '☀️', title: 'Light',       detail: 'Bright indirect light is safest for rare grafted or unusual varieties. Avoid harsh afternoon sun which can cause sunscald.' },
    { icon: '🌡️', title: 'Temperature', detail: 'Maintain stable temperatures between 18–28°C (65–82°F). Avoid sudden temperature swings which stress rare specimens.' },
    { icon: '🔬', title: 'Care Level',  detail: 'This is a collector\'s specimen that benefits from extra attention. Research the specific species for optimal growing conditions.' },
    { icon: '🪴', title: 'Soil',        detail: 'Use a specialist cactus mix with added perlite (50/50 ratio). Terra cotta pots wick moisture away from roots — ideal for rare varieties.' },
  ],
  Flowering: [
    { icon: '💧', title: 'Watering',    detail: 'Increase watering slightly during the flowering season (spring/summer). Reduce in autumn to encourage next year\'s blooms.' },
    { icon: '☀️', title: 'Light',       detail: 'Bright indirect light encourages blooms. Some flowering varieties like Christmas Cactus prefer shaded conditions.' },
    { icon: '🌸', title: 'Blooming',    detail: 'To encourage blooms: provide a cool, dry rest period in autumn (12–14 hours of darkness, 10–15°C / 50–60°F nights).' },
    { icon: '✂️', title: 'Pruning',     detail: 'After flowering, remove spent blooms to redirect energy into new growth. Do not prune excessively.' },
    { icon: '🌱', title: 'Fertiliser',  detail: 'Feed with a low-nitrogen, high-potassium fertiliser once a month during the growing season to promote blooms.' },
  ],
};

// ── Countdown ─────────────────────────────────────────────────
function useCountdown(endsAt: string | null) {
  const [time, setTime] = useState({ h: 0, m: 0, s: 0, expired: true });
  useEffect(() => {
    if (!endsAt) return;
    const calc = () => {
      const ms = new Date(endsAt).getTime() - Date.now();
      if (ms <= 0) return setTime({ h: 0, m: 0, s: 0, expired: true });
      setTime({
        h: Math.floor(ms / 3_600_000),
        m: Math.floor((ms % 3_600_000) / 60_000),
        s: Math.floor((ms % 60_000) / 1_000),
        expired: false,
      });
    };
    calc();
    const id = setInterval(calc, 1_000);
    return () => clearInterval(id);
  }, [endsAt]);
  return time;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  return hrs < 24 ? `${hrs} hr ago` : `${Math.floor(hrs / 24)}d ago`;
}

function getAvatar(username: string) {
  const colors = [
    'bg-violet-100 dark:bg-violet-900 text-violet-700 dark:text-violet-300',
    'bg-sky-100 dark:bg-sky-900 text-sky-700 dark:text-sky-300',
    'bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300',
    'bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300',
    'bg-rose-100 dark:bg-rose-900 text-rose-700 dark:text-rose-300',
  ];
  return {
    initials: username.slice(0, 2).toUpperCase(),
    color:    colors[username.charCodeAt(0) % colors.length],
  };
}

// ── Accordion component ───────────────────────────────────────
function Accordion({
  title, icon, defaultOpen = false, children,
}: {
  title: string; icon?: string; defaultOpen?: boolean; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-t border-gray-200 dark:border-gray-700">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between py-4 text-left group"
      >
        <span className="flex items-center gap-2.5 text-sm font-medium text-gray-800 dark:text-gray-200">
          {icon && <span className="text-base">{icon}</span>}
          {title}
        </span>
        {/* Chevron */}
        <svg
          className={cn(
            'w-4 h-4 text-gray-400 transition-transform duration-200 flex-shrink-0',
            open ? 'rotate-180' : 'rotate-0',
          )}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Animated content */}
      <div className={cn(
        'overflow-hidden transition-all duration-300',
        open ? 'max-h-[600px] opacity-100 mb-4' : 'max-h-0 opacity-0',
      )}>
        {children}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────
export function CactusDetailPage() {
  const { id }   = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { user, isLoggedIn } = useAuth();
  const { openModal }        = useAuthModal();
  const { addToCart, isInCart } = useCart();
  const { showToast }           = useToast();

  const [cactus,      setCactus]      = useState<CactusDetail | null>(null);
  const [auction,     setAuction]     = useState<AuctionInfo | null>(null);
  const [bidHistory,  setBidHistory]  = useState<BidHistory[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [loadError,   setLoadError]   = useState<string | null>(null);
  const [selectedBid, setSelectedBid] = useState(0);
  const [placing,     setPlacing]     = useState(false);
  const [bidSuccess,  setBidSuccess]  = useState(false);
  const [bidError,    setBidError]    = useState('');
  const [adding,      setAdding]      = useState(false);

  const inCart = cactus ? isInCart(cactus.id) : false;

  useEffect(() => {
    if (!id) return;
    const numId = Number(id);
    if (isNaN(numId)) { setLoadError('Invalid ID'); setLoading(false); return; }

    setLoading(true);
    setLoadError(null);
    setCactus(null);
    setAuction(null);
    setBidHistory([]);

    fetch(`/api/cactus/${numId}`, { credentials: 'include' })
      .then(async res => {
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `HTTP ${res.status}`);
        return res.json() as Promise<CactusDetail>;
      })
      .then(async data => {
        setCactus(data);
        if (data.auction) {
          setAuction(data.auction);
          setSelectedBid(
            parseFloat((data.auction.currentPrice + data.auction.bidIncrement).toFixed(2)),
          );
          fetch(`/api/auction/history/${numId}`, { credentials: 'include' })
            .then(r => r.ok ? r.json() : [])
            .then(setBidHistory)
            .catch(() => {});
        }
      })
      .catch(err => setLoadError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  const countdown = useCountdown(auction?.endsAt ?? null);

  const bidOptions = auction
    ? Array.from({ length: 8 }, (_, i) =>
        parseFloat((auction.currentPrice + auction.bidIncrement * (i + 1)).toFixed(2)),
      )
    : [];

  const handlePlaceBid = async () => {
    if (!isLoggedIn) {
      openModal('Please log in to place a bid. Your bid history is saved to your account.', 'login');
      return;
    }
    if (!cactus || !auction || placing) return;
    setPlacing(true); setBidError(''); setBidSuccess(false);
    try {
      const res = await fetch('/api/auction/bid', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cactusId: cactus.id, userId: user!.id, amount: selectedBid }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setAuction(prev => prev
        ? { ...prev, currentPrice: selectedBid, totalBids: prev.totalBids + 1 }
        : prev,
      );
      setBidHistory(prev => [
        { id: body.id, username: user!.username, amount: selectedBid, placedAt: new Date().toISOString() },
        ...prev,
      ]);
      setSelectedBid(parseFloat((selectedBid + auction.bidIncrement).toFixed(2)));
      setBidSuccess(true);
      showToast(`Bid of ₹${selectedBid.toFixed(2)} placed! 🎉`);
      setTimeout(() => setBidSuccess(false), 4_000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to place bid';
      setBidError(msg); showToast(msg, 'error');
    } finally {
      setPlacing(false);
    }
  };

  const handleAddToCart = async () => {
    if (!isLoggedIn) {
      openModal('Please log in to add items to your cart. Your cart is saved across sessions.', 'login');
      return;
    }
    if (!cactus) return;
    if (inCart) { navigate('/my-cart'); return; }
    setAdding(true);
    try {
      await addToCart({
        id: cactus.id, name: cactus.name, categoryName: cactus.categoryName,
        price: Number(cactus.basePrice),
        thumbnailUrl: cactus.media.find(m => m.type === 'Image')?.url ?? null,
      });
      showToast(`${cactus.name} added to cart 🛒`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to add to cart', 'error');
    } finally {
      setAdding(false);
    }
  };

  const handleBuyNow = async () => {
    if (!isLoggedIn) {
      openModal('Please log in to purchase. Your orders are saved to your account.', 'login');
      return;
    }
    if (!cactus) return;
    try {
      await addToCart({
        id: cactus.id, name: cactus.name, categoryName: cactus.categoryName,
        price: Number(cactus.basePrice),
        thumbnailUrl: cactus.media.find(m => m.type === 'Image')?.url ?? null,
      });
    } catch { /* non-fatal */ }
    navigate('/checkout');
  };

  if (loading) return <div className="max-w-5xl mx-auto"><CactusDetailSkeleton /></div>;

  if (loadError || !cactus) {
    return (
      <div className="max-w-5xl mx-auto py-20 text-center">
        <p className="text-4xl mb-4">🌵</p>
        <p className="font-display text-2xl text-gray-700 dark:text-gray-300 mb-2">
          {loadError ?? 'Cactus not found'}
        </p>
        <button onClick={() => navigate('/home')}
          className="mt-4 px-6 py-3 bg-cactus-600 text-white rounded-xl font-medium hover:bg-cactus-700 transition-colors">
          ← Back to Collection
        </button>
      </div>
    );
  }

  // Care tips for this category (fallback to default)
  const careTips = CARE_TIPS[cactus.categoryName] ?? CARE_TIPS.default;

  return (
    <div className="max-w-5xl mx-auto">

      {/* Back */}
      <button onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-sm text-cactus-600 dark:text-cactus-400 font-medium mb-6 hover:underline">
        ← Back to Collection
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* ── Left: Gallery (5-thumbnail strip) ────────────── */}
        <CactusGallery media={cactus.media} name={cactus.name} />

        {/* ── Right: Info + actions + accordions ───────────── */}
        <div className="flex flex-col gap-4">

          {/* Badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="success">{cactus.categoryName}</Badge>
            {auction && <Badge variant="danger" pulse>Live Auction</Badge>}
            <span className="text-xs text-gray-400 dark:text-gray-500">ID #{cactus.id}</span>
          </div>

          {/* Name */}
          <h1 className="font-display text-4xl text-gray-900 dark:text-white leading-tight">
            {cactus.name}
          </h1>

          {/* Price */}
          <div className="flex items-baseline gap-2">
            <span className="font-display text-3xl text-gray-900 dark:text-white">
              ₹{Number(cactus.basePrice).toFixed(2)}
            </span>
            <span className="text-sm text-gray-400">base price</span>
          </div>

          {/* ══════════════════════════════════════════════════
              PANEL A — LIVE AUCTION
          ══════════════════════════════════════════════════ */}
          {auction && (
            <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <span>🔨</span>
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Live Auction</span>
              </div>
              <div className="p-5 flex flex-col gap-4">

                {/* Starting / Current */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Starting Price', value: `₹${Number(auction.startPrice).toFixed(2)}`,  red: false },
                    { label: 'Current Bid',    value: `₹${Number(auction.currentPrice).toFixed(2)}`, red: true  },
                  ].map(({ label, value, red }) => (
                    <div key={label} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 border border-gray-100 dark:border-gray-700">
                      <p className="text-xs text-gray-400 mb-1">{label}</p>
                      <p className={cn('text-xl font-semibold', red ? 'text-red-500' : 'text-gray-900 dark:text-white')}>{value}</p>
                    </div>
                  ))}
                </div>

                {/* Countdown */}
                {!countdown.expired ? (
                  <div>
                    <p className="text-xs text-gray-400 mb-2 uppercase tracking-wider font-medium">Time Remaining</p>
                    <div className="flex gap-2">
                      {[
                        { val: countdown.h, label: 'hrs' },
                        { val: countdown.m, label: 'min' },
                        { val: countdown.s, label: 'sec' },
                      ].map(({ val, label }) => (
                        <div key={label} className="flex-1 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg py-2 text-center">
                          <span className="block font-display text-2xl text-gray-900 dark:text-white">
                            {String(val).padStart(2, '0')}
                          </span>
                          <span className="text-[10px] text-gray-400 uppercase tracking-widest">{label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-red-500 bg-red-50 dark:bg-red-950 rounded-lg px-4 py-3 font-medium">
                    ⏱ This auction has ended.
                  </p>
                )}

                {/* Bid controls */}
                {!countdown.expired && (
                  <div className="flex flex-col gap-3">
                    <select
                      value={selectedBid}
                      onChange={e => setSelectedBid(parseFloat(e.target.value))}
                      className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-cactus-500 cursor-pointer"
                    >
                      {bidOptions.map((v, i) => (
                        <option key={v} value={v}>₹{v.toFixed(2)}{i === 0 ? ' (minimum)' : ''}</option>
                      ))}
                    </select>

                    {!isLoggedIn && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 border border-amber-100 dark:border-amber-900 rounded-lg px-3 py-2 text-center">
                        🔒 Log in to place a bid
                      </p>
                    )}

                    <button
                      onClick={handlePlaceBid}
                      disabled={placing}
                      className="w-full py-3.5 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                      {placing
                        ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Placing bid…</>
                        : isLoggedIn
                          ? `Place Bid of ₹${selectedBid.toFixed(2)}`
                          : `Log In to Bid — ₹${selectedBid.toFixed(2)}`
                      }
                    </button>

                    {bidSuccess && (
                      <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg px-4 py-3 text-sm text-green-700 dark:text-green-300">
                        ✓ Bid placed! You are now the highest bidder.
                      </div>
                    )}
                    {bidError && (
                      <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3 text-sm text-red-600 dark:text-red-400">
                        {bidError}
                      </div>
                    )}
                  </div>
                )}

                {/* Bid history */}
                <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-3">Bid History</p>
                  {bidHistory.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-4">No bids yet — be the first!</p>
                  ) : (
                    <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                      {bidHistory.map((bid, idx) => {
                        const av = getAvatar(bid.username);
                        return (
                          <li key={bid.id} className="flex items-center gap-3 py-2.5 first:pt-0">
                            <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0', av.color)}>
                              {av.initials}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={cn('text-sm font-medium truncate', idx === 0 ? 'text-cactus-700 dark:text-cactus-400' : 'text-gray-700 dark:text-gray-300')}>
                                {bid.username}
                                {idx === 0 && (
                                  <span className="ml-2 text-[10px] font-semibold bg-cactus-100 dark:bg-cactus-900 text-cactus-700 dark:text-cactus-300 px-1.5 py-0.5 rounded">
                                    HIGHEST
                                  </span>
                                )}
                              </p>
                              <p className="text-[11px] text-gray-400">{timeAgo(bid.placedAt)}</p>
                            </div>
                            <span className={cn('text-sm font-semibold flex-shrink-0', idx === 0 ? 'text-red-500' : 'text-gray-700 dark:text-gray-300')}>
                              ₹{Number(bid.amount).toFixed(2)}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════
              PANEL B — BUY NOW / ADD TO CART
          ══════════════════════════════════════════════════ */}
          {!auction && (
            <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-5 flex flex-col gap-4">
              <div className="flex items-center gap-2 text-sm text-cactus-600 dark:text-cactus-400 font-medium">
                <span className="w-2 h-2 rounded-full bg-cactus-500 inline-block" />
                In stock — ships within 3 business days
              </div>

              {!isLoggedIn && (
                <div className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 border border-amber-100 dark:border-amber-900 rounded-lg px-3 py-2 text-center">
                  🔒 Log in to purchase — your cart and orders are saved to your account
                </div>
              )}

              {/* Add to Cart */}
              <button
                onClick={handleAddToCart}
                disabled={adding}
                className={cn(
                  'w-full py-3.5 rounded-xl font-semibold text-base border-2 transition-all duration-200 flex items-center justify-center gap-2',
                  inCart
                    ? 'border-cactus-300 dark:border-cactus-700 bg-cactus-50 dark:bg-cactus-950 text-cactus-700 dark:text-cactus-300'
                    : 'border-cactus-600 text-cactus-600 dark:text-cactus-400 hover:bg-cactus-50 dark:hover:bg-cactus-950',
                  adding && 'opacity-70 cursor-wait',
                )}
              >
                {adding ? (
                  <><span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />Adding…</>
                ) : inCart ? (
                  <>✓ In Cart — <span className="underline text-sm cursor-pointer" onClick={e => { e.stopPropagation(); navigate('/my-cart'); }}>View Cart</span></>
                ) : isLoggedIn ? (
                  `Add to Cart — ₹${Number(cactus.basePrice).toFixed(2)}`
                ) : (
                  `Log In to Add — ₹${Number(cactus.basePrice).toFixed(2)}`
                )}
              </button>

              {/* Buy Now */}
              <button
                onClick={handleBuyNow}
                className="w-full py-3.5 rounded-xl bg-cactus-600 hover:bg-cactus-700 active:bg-cactus-800 text-white font-semibold text-base transition-all duration-200 shadow-sm hover:shadow-md"
              >
                {isLoggedIn ? 'Buy Now' : 'Log In to Buy'}
              </button>

              {/* Guarantees */}
              <div className="grid grid-cols-3 gap-2 pt-1 border-t border-gray-100 dark:border-gray-800">
                {[
                  { icon: '🌿', label: 'Live plant guarantee' },
                  { icon: '📦', label: 'Secure packaging'     },
                  { icon: '↩️', label: '7-day returns'        },
                ].map(({ icon, label }) => (
                  <div key={label} className="flex flex-col items-center gap-1 text-center">
                    <span className="text-lg">{icon}</span>
                    <span className="text-[10px] text-gray-400 leading-tight">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════
              ACCORDIONS — Description + Care Tips
              Shown below the action panel, matching the screenshot
          ══════════════════════════════════════════════════ */}
          <div className="mt-2">

            {/* Description accordion — closed by default */}
            <Accordion title="Description" icon="📝" defaultOpen={false}>
              <p className="text-[15px] text-gray-500 dark:text-gray-400 leading-relaxed pb-2">
                {cactus.description ?? 'No description available for this species.'}
              </p>
            </Accordion>

            {/* Care Tips accordion — open by default */}
            <Accordion title="Care Tips" icon="🌱" defaultOpen={false}>
              <div className="flex flex-col gap-4 pb-2">
                {careTips.map(({ icon, title, detail }) => (
                  <div key={title} className="flex gap-3">
                    <span className="text-xl flex-shrink-0 mt-0.5">{icon}</span>
                    <div>
                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-0.5">{title}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Accordion>

          </div>
        </div>
      </div>
    </div>
  );
}