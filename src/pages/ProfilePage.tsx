// src/pages/ProfilePage.tsx
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth }   from '../context/AuthContext';
import { useToast }  from '../context/ToastContext';
import { cn }        from '../utils/cn';
import { Badge }     from '../components/ui/Badge';
import { Pagination } from '../components/ui/Pagination';
import { StatusBadge } from '../components/ui/StatusBadge';

const PAGE_SIZE = 5;

// ── Types ─────────────────────────────────────────────────────
interface MyBid {
  id:          number;
  myAmount:    number;
  currentPrice:number;
  endsAt:      string;
  isActive:    boolean;
  cactusId:    number;
  cactusName:  string;
  thumbnailUrl:string | null;
  status:      'winning' | 'outbid' | 'won' | 'lost';
  placedAt:    string;
}

interface OrderItem {
  cactusId:     number;
  name:         string;
  quantity:     number;
  unitPrice:    number;
  thumbnailUrl: string | null;
}

interface MyOrder {
  id:            number;
  orderNumber:   string;
  status:        string;
  total:         number;
  paymentMethod: string;
  createdAt:     string;
  items:         OrderItem[];
  trackingStatus?: string;
}

type Tab = 'bids' | 'orders';

// ── Status config ─────────────────────────────────────────────
const STATUS_CONFIG = {
  winning: { label: 'Winning',  variant: 'success'  as const },
  outbid:  { label: 'Outbid',   variant: 'danger'   as const },
  won:     { label: 'Won',      variant: 'info'     as const },
  lost:    { label: 'Lost',     variant: 'outline'  as const },
};

function timeAgo(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function timeLeft(endsAt: string) {
  const ms   = new Date(endsAt).getTime() - Date.now();
  if (ms <= 0) return 'Ended';
  const hrs  = Math.floor(ms / 3_600_000);
  const mins = Math.floor((ms % 3_600_000) / 60_000);
  return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
}

// ── Component ─────────────────────────────────────────────────
export function ProfilePage() {
  const navigate              = useNavigate();
  const [searchParams]        = useSearchParams();
  const { user, isLoggedIn }  = useAuth();
  const { showToast }         = useToast();

  const defaultTab = (searchParams.get('tab') as Tab) ?? 'bids';
  const [tab,    setTab]    = useState<Tab>(defaultTab);
  const [bids,   setBids]   = useState<MyBid[]>([]);
  const [orders, setOrders] = useState<MyOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [bidsPage,   setBidsPage]   = useState(1);
  const [ordersPage, setOrdersPage] = useState(1);

  // Redirect if not logged in
  useEffect(() => {
    if (!isLoggedIn) navigate('/home', { replace: true });
  }, [isLoggedIn, navigate]);

  // Load data
  useEffect(() => {
    if (!isLoggedIn) return;
    setLoading(true);
    Promise.all([
      fetch('/api/auth/my-bids',   { credentials: 'include' }).then(r => r.json()),
      fetch('/api/auth/my-orders', { credentials: 'include' }).then(r => r.json()),
    ]).then(([bidsData, ordersData]) => {
      setBids(Array.isArray(bidsData)   ? bidsData   : []);
      setOrders(Array.isArray(ordersData) ? ordersData : []);
    }).catch(() => showToast('Failed to load profile data', 'error'))
      .finally(() => setLoading(false));
  }, [isLoggedIn]);

  if (!user) return null;

  const activeBids  = bids.filter(b => b.isActive);
  const endedBids   = bids.filter(b => !b.isActive);
  const winningCount = activeBids.filter(b => b.status === 'winning').length;

  // Pagination (client-side, PAGE_SIZE per page)
  const bidsTotalPages    = Math.max(1, Math.ceil(bids.length   / PAGE_SIZE));
  const ordersTotalPages  = Math.max(1, Math.ceil(orders.length / PAGE_SIZE));
  const bidsCurrentPage   = Math.min(bidsPage,   bidsTotalPages);
  const ordersCurrentPage = Math.min(ordersPage, ordersTotalPages);
  const pagedBids   = bids.slice((bidsCurrentPage - 1) * PAGE_SIZE, bidsCurrentPage * PAGE_SIZE);
  const pagedOrders = orders.slice((ordersCurrentPage - 1) * PAGE_SIZE, ordersCurrentPage * PAGE_SIZE);

  return (
    <div className="max-w-4xl mx-auto">

      {/* ── Profile hero ────────────────────────────────────── */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 sm:p-6 mb-6 flex items-center gap-4 sm:gap-5">
        <div className="w-16 h-16 rounded-2xl bg-cactus-600 text-white flex items-center justify-center font-display text-2xl flex-shrink-0">
          {user.username.slice(0, 2).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="font-display text-2xl text-gray-900 dark:text-white">{user.username}</h1>
          <p className="text-sm text-gray-400 dark:text-gray-500 truncate">{user.email}</p>
        </div>
        {/* Summary pills */}
        <div className="hidden sm:flex gap-3">
          <div className="text-center px-4 py-2 bg-gray-50 dark:bg-gray-800 rounded-xl">
            <p className="font-display text-xl text-gray-900 dark:text-white">{bids.length}</p>
            <p className="text-[11px] text-gray-400">Total Bids</p>
          </div>
          <div className="text-center px-4 py-2 bg-gray-50 dark:bg-gray-800 rounded-xl">
            <p className="font-display text-xl text-cactus-600 dark:text-cactus-400">{winningCount}</p>
            <p className="text-[11px] text-gray-400">Winning</p>
          </div>
          <div className="text-center px-4 py-2 bg-gray-50 dark:bg-gray-800 rounded-xl">
            <p className="font-display text-xl text-gray-900 dark:text-white">{orders.length}</p>
            <p className="text-[11px] text-gray-400">Orders</p>
          </div>
        </div>
      </div>

      {/* ── Tabs ─────────────────────────────────────────────── */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 mb-6 w-full sm:w-fit">
        {([
          { key: 'bids',   label: `My Bids (${bids.length})`    },
          { key: 'orders', label: `My Orders (${orders.length})` },
        ] as { key: Tab; label: string }[]).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              'flex-1 sm:flex-none px-3 sm:px-5 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all duration-200',
              tab === key
                ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Loading ───────────────────────────────────────────── */}
      {loading && (
        <div className="space-y-3">
          {[1,2,3].map(i => (
            <div key={i} className="h-20 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          MY BIDS TAB
      ═══════════════════════════════════════════════════════ */}
      {!loading && tab === 'bids' && (
        <div>
          {bids.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-5xl mb-4 opacity-30">🔨</p>
              <p className="font-display text-xl text-gray-600 dark:text-gray-400 mb-2">No bids yet</p>
              <p className="text-sm text-gray-400 mb-6">Find a cactus you love and place your first bid!</p>
              <button onClick={() => navigate('/auctions')} className="px-5 py-2.5 bg-cactus-600 text-white rounded-xl font-medium hover:bg-cactus-700 transition-colors">
                Browse Auctions
              </button>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-800">
                    <tr>
                      {['Cactus','My Bid','Highest Bid','Status','Time Left',''].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {pagedBids.map(bid => {
                      const cfg = STATUS_CONFIG[bid.status];
                      return (
                        <tr key={bid.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                          {/* Cactus */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-cactus-50 dark:bg-cactus-950 flex-shrink-0 overflow-hidden flex items-center justify-center">
                                {bid.thumbnailUrl
                                  ? <img src={bid.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                                  : <span className="text-lg">🌵</span>
                                }
                              </div>
                              <span className="font-medium text-gray-900 dark:text-white">{bid.cactusName}</span>
                            </div>
                          </td>
                          {/* My bid */}
                          <td className="px-4 py-3 font-medium">₹{bid.myAmount.toFixed(2)}</td>
                          {/* Current / highest */}
                          <td className="px-4 py-3">
                            <span className={cn('font-semibold', bid.myAmount >= bid.currentPrice ? 'text-cactus-600 dark:text-cactus-400' : 'text-red-500')}>
                              ₹{bid.currentPrice.toFixed(2)}
                            </span>
                          </td>
                          {/* Status */}
                          <td className="px-4 py-3">
                            <Badge variant={cfg.variant}>{cfg.label}</Badge>
                          </td>
                          {/* Time */}
                          <td className="px-4 py-3 text-gray-400 text-xs">
                            {bid.isActive ? timeLeft(bid.endsAt) : 'Ended'}
                          </td>
                          {/* Action */}
                          <td className="px-4 py-3">
                            {bid.isActive && bid.status === 'outbid' && (
                              <button
                                onClick={() => navigate(`/cactus/${bid.cactusId}`)}
                                className="px-3 py-1.5 bg-cactus-600 hover:bg-cactus-700 text-white text-xs font-semibold rounded-lg transition-colors"
                              >
                                Rebid
                              </button>
                            )}
                            {(!bid.isActive || bid.status === 'winning') && (
                              <button
                                onClick={() => navigate(`/cactus/${bid.cactusId}`)}
                                className="px-3 py-1.5 border border-gray-200 dark:border-gray-700 text-gray-500 text-xs font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                              >
                                View
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="px-5 pb-5">
                <Pagination
                  currentPage={bidsCurrentPage}
                  totalPages={bidsTotalPages}
                  totalCount={bids.length}
                  pageSize={PAGE_SIZE}
                  onPageChange={setBidsPage}
                  itemLabel="bids"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          MY ORDERS TAB
      ═══════════════════════════════════════════════════════ */}
      {!loading && tab === 'orders' && (
        <div>
          {orders.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-5xl mb-4 opacity-30">📦</p>
              <p className="font-display text-xl text-gray-600 dark:text-gray-400 mb-2">No orders yet</p>
              <p className="text-sm text-gray-400 mb-6">Browse our collection and place your first order!</p>
              <button onClick={() => navigate('/home')} className="px-5 py-2.5 bg-cactus-600 text-white rounded-xl font-medium hover:bg-cactus-700 transition-colors">
                Browse Collection
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {pagedOrders.map(order => (
                <div key={order.id} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                  {/* Order header */}
                  <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-5 py-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800">
                    <div className="flex items-center gap-4">
                      <div>
                        <p className="text-xs text-gray-400 mb-0.5">Order Number</p>
                        <p className="font-semibold text-gray-900 dark:text-white font-mono">{order.orderNumber}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 mb-0.5">Date</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {new Date(order.createdAt).toLocaleDateString('en-US', { day:'numeric', month:'short', year:'numeric' })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {order.trackingStatus ? <StatusBadge status={order.trackingStatus} /> : (
                        <span className={cn(
                          'text-xs font-semibold px-2.5 py-1 rounded-full capitalize',
                          order.status === 'confirmed' ? 'bg-cactus-100 dark:bg-cactus-900 text-cactus-700 dark:text-cactus-300' : 'bg-gray-100 dark:bg-gray-800 text-gray-500',
                        )}>
                          {order.status}
                        </span>
                      )}
                      <p className="font-display text-lg text-gray-900 dark:text-white">₹{order.total.toFixed(2)}</p>
                      <Link
                        to={`/profile/orders/${order.id}`}
                        className="px-3 py-1.5 border border-gray-200 dark:border-gray-700 text-gray-500 text-xs font-medium rounded-lg hover:bg-white dark:hover:bg-gray-900 transition-colors"
                      >
                        View Details
                      </Link>
                    </div>
                  </div>

                  {/* Order items */}
                  <div className="px-2 sm:px-3 py-2 flex flex-col gap-1">
                    {order.items.map((item, i) => (
                      <Link
                        key={i}
                        to={`/profile/orders/${order.id}?item=${item.cactusId}`}
                        className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors"
                      >
                        <div className="w-10 h-10 rounded-lg bg-cactus-50 dark:bg-cactus-950 flex-shrink-0 overflow-hidden flex items-center justify-center">
                          {item.thumbnailUrl
                            ? <img src={item.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                            : <span>🌵</span>
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{item.name}</p>
                          <p className="text-xs text-gray-400">Qty: {item.quantity} × ₹{item.unitPrice.toFixed(2)}</p>
                        </div>
                        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                          ₹{(item.quantity * item.unitPrice).toFixed(2)}
                        </p>
                        <span className="text-gray-300 dark:text-gray-600" aria-hidden>›</span>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
              <Pagination
                currentPage={ordersCurrentPage}
                totalPages={ordersTotalPages}
                totalCount={orders.length}
                pageSize={PAGE_SIZE}
                onPageChange={setOrdersPage}
                itemLabel="orders"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}