// src/pages/OrderDetailsPage.tsx
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth }        from '../context/AuthContext';
import { cn }             from '../utils/cn';
import { StatusBadge }    from '../components/ui/StatusBadge';
import { METHOD_LABELS }  from './OrderConfirmationPage';
import { ShipmentDetails, StatusTimeline, TrackingProgress } from '../components/orders/OrderTracking';
import { Shipment, StatusHistoryEntry, TrackingStatus } from '../utils/orderTracking';
import { MyReview, ProductReview } from '../components/orders/ProductReview';

// ── Types ─────────────────────────────────────────────────────
interface OrderDetailItem {
  cactusId:     number;
  name:         string;
  quantity:     number;
  unitPrice:    number;
  thumbnailUrl: string | null;
  myReview?:    MyReview | null;   // the customer's review of this cactus, if any
}

interface OrderDetail {
  id:            number;
  orderNumber:   string;
  status:        string;
  orderStatus:   string | null;
  paymentStatus: string | null;
  subtotal:      number;
  shipping:      number;
  tax:           number;
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
  trackingStatus?: TrackingStatus;
  shipment?:     Shipment | null;
  history?:      StatusHistoryEntry[];
}

const money = (n: number) => `₹${n.toFixed(2)}`;
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString('en-US', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });

const BACK_TO_ORDERS = '/profile?tab=orders';

// ── Component ─────────────────────────────────────────────────
export function OrderDetailsPage() {
  const navigate             = useNavigate();
  const { id }               = useParams();
  const [searchParams]       = useSearchParams();
  const { isLoggedIn }       = useAuth();
  const selectedItem         = Number(searchParams.get('item'));

  const [order,   setOrder]   = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  // Redirect if not logged in
  useEffect(() => {
    if (!isLoggedIn) navigate('/home', { replace: true });
  }, [isLoggedIn, navigate]);

  useEffect(() => {
    if (!isLoggedIn) return;
    setLoading(true);
    setError(null);
    fetch(`/api/auth/my-orders/${id}`, { credentials: 'include' })
      .then(async r => {
        // A non-JSON body (e.g. an HTML error page) means the API couldn't serve this order
        const data = await r.json().catch(() => null);
        if (!r.ok || !data) throw new Error(data?.error ?? 'We couldn’t load this order. Please try again later.');
        setOrder(data);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [id, isLoggedIn]);

  // ── Loading ───────────────────────────────────────────────
  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-28 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  // ── Not found / error ─────────────────────────────────────
  if (error || !order) {
    return (
      <div className="max-w-2xl mx-auto text-center py-20">
        <p className="text-5xl mb-4 opacity-30">📦</p>
        <p className="font-display text-2xl text-gray-700 dark:text-gray-300 mb-2">Order not found</p>
        <p className="text-gray-400 mb-6 text-sm">{error ?? 'We couldn’t find this order.'}</p>
        <button onClick={() => navigate(BACK_TO_ORDERS)} className="px-6 py-3 bg-cactus-600 text-white rounded-xl font-medium hover:bg-cactus-700 transition-colors">
          Back to My Orders
        </button>
      </div>
    );
  }

  const orderStatus = order.trackingStatus ?? order.orderStatus ?? order.status;
  const canReview   = order.trackingStatus === 'delivered';

  // Reviews are per cactus — update every row of that cactus once saved
  const handleReviewSaved = (cactusId: number, review: MyReview) =>
    setOrder(prev => prev && {
      ...prev,
      items: prev.items.map(it => (it.cactusId === cactusId ? { ...it, myReview: review } : it)),
    });
  const itemCount   = order.items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <div className="max-w-2xl mx-auto">

      {/* Back link */}
      <Link
        to={BACK_TO_ORDERS}
        className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-cactus-600 dark:hover:text-cactus-400 mb-4 transition-colors"
      >
        ← My Orders
      </Link>

      {/* Order number banner */}
      <div className="bg-cactus-50 dark:bg-cactus-950 border border-cactus-200 dark:border-cactus-800 rounded-xl px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5">
        <div>
          <p className="text-xs font-semibold text-cactus-500 dark:text-cactus-400 uppercase tracking-widest mb-0.5">Order Number</p>
          <p className="font-display text-2xl text-cactus-700 dark:text-cactus-300">{order.orderNumber}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Placed {fmtDate(order.createdAt)}</p>
        </div>
        <div className="flex flex-col sm:items-end gap-1.5">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Order</span>
            <StatusBadge status={orderStatus} />
          </div>
          {order.paymentStatus && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">Payment</span>
              <StatusBadge status={order.paymentStatus} />
            </div>
          )}
        </div>
      </div>

      {/* Rejection note */}
      {order.rejectionNote && (
        <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl px-4 sm:px-5 py-3 mb-5">
          <p className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wider mb-1">Note from our team</p>
          <p className="text-sm text-red-700 dark:text-red-300">{order.rejectionNote}</p>
        </div>
      )}

      {/* Order tracking */}
      {order.trackingStatus && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 sm:p-5 mb-5">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Order Tracking</p>
          <TrackingProgress status={order.trackingStatus} />
          <div className="border-t border-gray-100 dark:border-gray-800 mt-4 pt-4">
            {order.shipment?.courierName || order.shipment?.trackingNumber
              ? <ShipmentDetails shipment={order.shipment} />
              : <p className="text-sm text-gray-400">
                  {order.trackingStatus === 'cancelled' || order.trackingStatus === 'payment_failed'
                    ? 'This order will not be shipped.'
                    : 'Courier and tracking details will appear here once your order is dispatched.'}
                </p>
            }
          </div>
        </div>
      )}

      {/* Items ordered */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 sm:p-5 mb-5">
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
          Items Ordered <span className="text-gray-400 font-normal">({itemCount})</span>
        </p>
        <div className="flex flex-col divide-y divide-gray-100 dark:divide-gray-800">
          {order.items.map((item, i) => (
            <div
              key={`${item.cactusId}-${i}`}
              className={cn(
                'py-2.5 first:pt-0 last:pb-0 -mx-2 px-2 rounded-lg',
                item.cactusId === selectedItem && 'bg-cactus-50 dark:bg-cactus-950 ring-1 ring-cactus-200 dark:ring-cactus-800 first:pt-2.5 last:pb-2.5',
              )}
            >
            <Link
              to={`/cactus/${item.cactusId}`}
              className="flex items-center gap-3 -mx-2 px-2 py-1 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors"
            >
              <div className="w-12 h-12 rounded-lg bg-cactus-50 dark:bg-cactus-950 flex items-center justify-center flex-shrink-0 overflow-hidden">
                {item.thumbnailUrl
                  ? <img src={item.thumbnailUrl} alt={item.name} className="w-full h-full object-cover rounded-lg" />
                  : <span className="text-lg">🌵</span>
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{item.name}</p>
                <p className="text-xs text-gray-400">Qty: {item.quantity} × {money(item.unitPrice)}</p>
              </div>
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                {money(item.unitPrice * item.quantity)}
              </p>
            </Link>
            {canReview && (
              <ProductReview
                orderId={order.id}
                cactusId={item.cactusId}
                name={item.name}
                review={item.myReview ?? null}
                onSaved={review => handleReviewSaved(item.cactusId, review)}
              />
            )}
            </div>
          ))}
        </div>

        {/* Rating hint until the order is delivered */}
        {!canReview && order.trackingStatus && !['cancelled', 'payment_failed'].includes(order.trackingStatus) && (
          <p className="text-xs text-gray-400 mt-3">⭐ You can rate your cacti once this order has been delivered.</p>
        )}

        {/* Totals */}
        <div className="border-t border-gray-100 dark:border-gray-800 pt-3 mt-3 flex flex-col gap-1.5 text-sm">
          {[
            ['Subtotal', order.subtotal],
            ['Shipping', order.shipping],
            ['Tax',      order.tax],
          ].map(([label, value]) => (
            <div key={label as string} className="flex items-center justify-between text-gray-500 dark:text-gray-400">
              <span>{label}</span>
              <span>{label === 'Shipping' && !value ? 'Free' : money(value as number)}</span>
            </div>
          ))}
          <div className="flex items-center justify-between pt-1.5">
            <span className="font-bold text-gray-900 dark:text-white">Total</span>
            <span className="font-bold text-lg text-gray-900 dark:text-white">{money(order.total)}</span>
          </div>
        </div>
      </div>

      {/* Status history */}
      {order.history && order.history.length > 0 && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 sm:p-5 mb-5">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Status History</p>
          <StatusTimeline history={order.history} />
        </div>
      )}

      {/* Delivery + payment */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">📍 Deliver To</p>
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed break-words">
            {order.firstName} {order.lastName}<br />
            {order.addressLine1}<br />
            {order.addressLine2 && <>{order.addressLine2}<br /></>}
            {order.city}, {order.state} {order.zip}<br />
            {order.country}
          </p>
          <p className="text-xs text-gray-400 mt-2 break-all">
            {order.email}
            {order.phone && <><br />{order.phone}</>}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">💳 Payment</p>
          <p className="text-sm text-gray-700 dark:text-gray-300">{METHOD_LABELS[order.paymentMethod] ?? order.paymentMethod}</p>
          {order.transactionId && (
            <p className="text-xs font-mono bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded text-gray-600 dark:text-gray-400 mt-2 inline-block break-all">
              UTR: {order.transactionId}
            </p>
          )}
          {order.verifiedAt && (
            <p className="text-xs text-gray-400 mt-2">Verified {fmtDate(order.verifiedAt)}</p>
          )}
        </div>
      </div>

      {/* Support note */}
      <p className="text-center text-xs text-gray-400 dark:text-gray-500">
        Questions about your order? Email{' '}
        <a href="mailto:support@cactusmart.com" className="text-cactus-600 dark:text-cactus-400 hover:underline">
          support@cactusmart.com
        </a>{' '}
        with your order number.
      </p>
    </div>
  );
}
