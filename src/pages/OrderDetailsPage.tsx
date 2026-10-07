// src/pages/OrderDetailsPage.tsx
import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth }        from '../context/AuthContext';
import { cn }             from '../utils/cn';
import { StatusBadge }    from '../components/ui/StatusBadge';
import { PAYMENT_METHOD_LABELS, STORE } from '../config/store';

// ── Types ─────────────────────────────────────────────────────
interface OrderDetailItem {
  cactusId:     number;
  name:         string;
  quantity:     number;
  unitPrice:    number;
  thumbnailUrl: string | null;
}

interface OrderDetail {
  id:            number;
  orderNumber:   string;
  status:        string;
  orderStatus:   string | null;
  paymentStatus: string | null;
  subtotal:      number | null;
  shipping:      number | null;
  tax:           number | null;
  total:         number;
  paymentMethod: string;
  transactionId: string | null;
  rejectionNote: string | null;
  verifiedAt:    string | null;
  createdAt:     string;
  firstName:     string;
  lastName:      string;
  email:         string;
  phone:         string | null;
  addressLine1:  string;
  addressLine2:  string | null;
  city:          string;
  state:         string;
  zip:           string;
  country:       string;
  items:         OrderDetailItem[];
}

const money = (n: number) => `₹${n.toFixed(2)}`;

function formatDate(iso: string, withTime = false) {
  return new Date(iso).toLocaleDateString('en-US', {
    day: 'numeric', month: 'short', year: 'numeric',
    ...(withTime && { hour: 'numeric', minute: '2-digit' }),
  });
}

// ── Component ─────────────────────────────────────────────────
export function OrderDetailsPage() {
  const navigate        = useNavigate();
  const { id }          = useParams<{ id: string }>();
  const [searchParams]  = useSearchParams();
  const { isLoggedIn, loading: authLoading } = useAuth();

  const [order,   setOrder]   = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  // The item the user clicked on the orders list, highlighted below
  const selectedItem = Number(searchParams.get('item')) || null;

  // Redirect if not logged in (once the session check has finished)
  useEffect(() => {
    if (!authLoading && !isLoggedIn) navigate('/home', { replace: true });
  }, [authLoading, isLoggedIn, navigate]);

  useEffect(() => {
    if (!isLoggedIn || !id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/auth/my-orders/${id}`, { credentials: 'include' })
      .then(async r => {
        const body = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(r.status === 404 ? 'Order not found' : body.error ?? 'Failed to load order');
        return body as OrderDetail;
      })
      .then(data => { if (!cancelled) setOrder(data); })
      .catch(err => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id, isLoggedIn]);

  const backToOrders = () => navigate('/profile?tab=orders');

  if (authLoading || (isLoggedIn && loading)) {
    return (
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="h-5 w-32 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
        <div className="h-24 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
        <div className="h-48 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="max-w-4xl mx-auto py-20 text-center">
        <p className="text-5xl mb-4 opacity-30">📦</p>
        <p className="font-display text-2xl text-gray-700 dark:text-gray-300 mb-2">{error ?? 'Order not found'}</p>
        <button onClick={backToOrders}
          className="mt-4 px-6 py-3 bg-cactus-600 text-white rounded-xl font-medium hover:bg-cactus-700 transition-colors">
          ← Back to My Orders
        </button>
      </div>
    );
  }

  const orderStatus   = order.orderStatus ?? order.status;
  const itemCount     = order.items.reduce((n, i) => n + i.quantity, 0);
  const itemsSubtotal = order.items.reduce((n, i) => n + i.quantity * i.unitPrice, 0);

  return (
    <div className="max-w-4xl mx-auto">

      {/* Back */}
      <button onClick={backToOrders}
        className="flex items-center gap-2 text-sm text-cactus-600 dark:text-cactus-400 font-medium mb-6 hover:underline">
        ← Back to My Orders
      </button>

      {/* ── Order summary header ─────────────────────────────── */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 sm:p-6 mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs text-gray-400 mb-0.5">Order Number</p>
          <h1 className="font-display text-2xl text-gray-900 dark:text-white font-mono break-all">{order.orderNumber}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Placed on {formatDate(order.createdAt, true)} · {itemCount} {itemCount === 1 ? 'item' : 'items'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <StatusBadge status={orderStatus} />
          {order.paymentStatus && order.paymentStatus !== orderStatus && (
            <StatusBadge status={order.paymentStatus} />
          )}
          <p className="font-display text-2xl text-gray-900 dark:text-white w-full sm:w-auto sm:ml-2">{money(order.total)}</p>
        </div>
      </div>

      {/* Payment rejected by admin */}
      {order.rejectionNote && (
        <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl px-4 sm:px-5 py-3 mb-5">
          <p className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wider mb-0.5">Payment note</p>
          <p className="text-sm text-red-700 dark:text-red-300">{order.rejectionNote}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* ── Items ──────────────────────────────────────────── */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
          <p className="px-4 sm:px-5 py-4 text-sm font-semibold text-gray-700 dark:text-gray-300 border-b border-gray-100 dark:border-gray-800">
            Items Ordered
          </p>
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {order.items.map((item, i) => (
              <div
                key={`${item.cactusId}-${i}`}
                data-selected={item.cactusId === selectedItem || undefined}
                className={cn(
                  'flex items-center gap-3 px-4 sm:px-5 py-3',
                  item.cactusId === selectedItem && 'bg-cactus-50 dark:bg-cactus-950',
                )}
              >
                <div className="w-14 h-14 rounded-lg bg-cactus-50 dark:bg-cactus-950 flex-shrink-0 overflow-hidden flex items-center justify-center">
                  {item.thumbnailUrl
                    ? <img src={item.thumbnailUrl} alt={item.name} className="w-full h-full object-cover" />
                    : <span className="text-xl">🌵</span>
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <button
                    onClick={() => navigate(`/cactus/${item.cactusId}`)}
                    className="text-sm font-medium text-gray-900 dark:text-white hover:text-cactus-600 dark:hover:text-cactus-400 text-left truncate max-w-full"
                  >
                    {item.name}
                  </button>
                  <p className="text-xs text-gray-400">Qty: {item.quantity} × {money(item.unitPrice)}</p>
                </div>
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex-shrink-0">
                  {money(item.quantity * item.unitPrice)}
                </p>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="border-t border-gray-100 dark:border-gray-800 px-4 sm:px-5 py-4 flex flex-col gap-2 text-sm">
            <Row label="Subtotal" value={money(order.subtotal ?? itemsSubtotal)} />
            {order.shipping != null && (
              <Row label="Shipping" value={order.shipping === 0 ? 'Free' : money(order.shipping)} />
            )}
            {!!order.tax && <Row label="Tax" value={money(order.tax)} />}
            <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-800">
              <span className="font-bold text-gray-900 dark:text-white">Total</span>
              <span className="font-bold text-lg text-gray-900 dark:text-white">{money(order.total)}</span>
            </div>
          </div>
        </div>

        {/* ── Delivery + payment ─────────────────────────────── */}
        <div className="flex flex-col gap-5">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">📍 Deliver To</p>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed break-words">
              {order.firstName} {order.lastName}<br />
              {order.addressLine1}<br />
              {order.addressLine2 && <>{order.addressLine2}<br /></>}
              {order.city}, {order.state} {order.zip}<br />
              {order.country}
            </p>
            <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-500 dark:text-gray-400 flex flex-col gap-1 break-all">
              <span>{order.email}</span>
              {order.phone && <span>{order.phone}</span>}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">💳 Payment</p>
            <div className="flex flex-col gap-2 text-sm">
              <Row label="Method" value={PAYMENT_METHOD_LABELS[order.paymentMethod] ?? order.paymentMethod} />
              {order.paymentStatus && <Row label="Status" value={<StatusBadge status={order.paymentStatus} />} />}
              {order.transactionId && (
                <Row label="Transaction ID" value={
                  <span className="font-mono text-xs bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded break-all">{order.transactionId}</span>
                } />
              )}
              {order.verifiedAt && <Row label="Verified" value={formatDate(order.verifiedAt, true)} />}
            </div>
          </div>
        </div>
      </div>

      {/* Support note */}
      <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-8">
        Questions about this order? Email{' '}
        <a href={`mailto:${STORE.email}`} className="text-cactus-600 dark:text-cactus-400 hover:underline">
          {STORE.email}
        </a>{' '}
        with your order number.
      </p>
    </div>
  );
}

// ── Helper sub-component ──────────────────────────────────────
function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-gray-400 dark:text-gray-500 flex-shrink-0">{label}</span>
      <span className="text-gray-900 dark:text-white text-right min-w-0">{value}</span>
    </div>
  );
}
