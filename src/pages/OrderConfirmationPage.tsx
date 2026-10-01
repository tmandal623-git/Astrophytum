// src/pages/OrderConfirmationPage.tsx
import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

interface OrderState {
  orderNumber: string;
  items:       Array<{ id: number; name: string; price: number; quantity: number; thumbnailUrl: string | null }>;
  total:       number;
  address:     { firstName: string; lastName: string; line1: string; city: string; state: string; zip: string; country: string; email: string };
  method:      string;
}

// ── Tiny CSS confetti (no external lib) ──────────────────────
function Confetti() {
  const COLORS = ['#2d7425','#c8a84b','#ef4444','#3b82f6','#a855f7','#f97316'];
  const pieces = Array.from({ length: 48 }, (_, i) => ({
    id: i,
    color: COLORS[i % COLORS.length],
    left:  `${Math.random() * 100}%`,
    delay: `${Math.random() * 1.5}s`,
    size:  `${6 + Math.random() * 8}px`,
    dur:   `${1.8 + Math.random() * 1.2}s`,
    rotate:`${Math.random() * 360}deg`,
  }));

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 h-screen overflow-hidden z-50">
      <style>{`
        @keyframes confettiFall {
          0%   { transform: translateY(-20px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh)  rotate(720deg); opacity: 0; }
        }
      `}</style>
      {pieces.map(p => (
        <div
          key={p.id}
          style={{
            position: 'absolute',
            left: p.left,
            top: '-10px',
            width: p.size,
            height: p.size,
            background: p.color,
            borderRadius: '2px',
            animation: `confettiFall ${p.dur} ${p.delay} ease-in forwards`,
            transform: `rotate(${p.rotate})`,
          }}
        />
      ))}
    </div>
  );
}

const METHOD_LABELS: Record<string, string> = {
  card:      'Credit / Debit Card',
  paypal:    'PayPal',
  applepay:  'Apple Pay',
  googlepay: 'Google Pay',
};

export function OrderConfirmationPage() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const order     = location.state as OrderState | null;

  // Fallback if navigated here directly
  if (!order) {
    return (
      <div className="max-w-2xl mx-auto text-center py-20">
        <p className="text-5xl mb-4">🌵</p>
        <p className="font-display text-2xl text-gray-700 dark:text-gray-300 mb-2">No order found</p>
        <p className="text-gray-400 mb-6 text-sm">It looks like you arrived here directly.</p>
        <button onClick={() => navigate('/home')} className="px-6 py-3 bg-cactus-600 text-white rounded-xl font-medium hover:bg-cactus-700 transition-colors">
          Back to Home
        </button>
      </div>
    );
  }

  const estimatedDelivery = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
    .toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <>
      <Confetti />

      <div className="max-w-2xl mx-auto">

        {/* Success hero */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-cactus-100 dark:bg-cactus-900 rounded-full flex items-center justify-center text-4xl mx-auto mb-4 shadow-inner">
            🌵
          </div>
          <h1 className="font-display text-4xl text-gray-900 dark:text-white mb-2">
            Order Confirmed!
          </h1>
          <p className="text-gray-500 dark:text-gray-400 leading-relaxed max-w-sm mx-auto">
            Thank you, <strong className="text-gray-700 dark:text-gray-200">{order.address.firstName}</strong>!
            Your cacti are being carefully packed and will be on their way soon.
          </p>
        </div>

        {/* Order number banner */}
        <div className="bg-cactus-50 dark:bg-cactus-950 border border-cactus-200 dark:border-cactus-800 rounded-xl px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5">
          <div>
            <p className="text-xs font-semibold text-cactus-500 dark:text-cactus-400 uppercase tracking-widest mb-0.5">Order Number</p>
            <p className="font-display text-2xl text-cactus-700 dark:text-cactus-300">{order.orderNumber}</p>
          </div>
          <div className="sm:text-right min-w-0">
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">Confirmation sent to</p>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 break-all">{order.address.email}</p>
          </div>
        </div>

        {/* What happens next */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-5 mb-5">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">What happens next?</p>
          <div className="flex flex-col gap-4">
            {[
              { icon: '📧', title: 'Confirmation email',   desc: `A receipt has been sent to ${order.address.email}` },
              { icon: '📦', title: 'Packing & dispatch',   desc: 'Your order is being prepared with care — typically 1–2 business days.' },
              { icon: '🚚', title: 'Estimated delivery',   desc: `Expected by ${estimatedDelivery}` },
              { icon: '🌵', title: 'Unbox & enjoy!',       desc: 'Follow the care guide included in your box for the best results.' },
            ].map(({ icon, title, desc }, i, arr) => (
              <div key={title} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-9 h-9 rounded-full bg-cactus-50 dark:bg-cactus-950 flex items-center justify-center text-lg flex-shrink-0">
                    {icon}
                  </div>
                  {i < arr.length - 1 && <div className="w-0.5 flex-1 bg-gray-100 dark:bg-gray-800 mt-1" />}
                </div>
                <div className="pb-4">
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{title}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Items ordered */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-5 mb-5">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Items Ordered</p>
          <div className="flex flex-col divide-y divide-gray-100 dark:divide-gray-800">
            {order.items.map((item) => (
              <div key={item.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                <div className="w-10 h-10 rounded-lg bg-cactus-50 dark:bg-cactus-950 flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {item.thumbnailUrl
                    ? <img src={item.thumbnailUrl} alt={item.name} className="w-full h-full object-cover rounded-lg" />
                    : <span className="text-lg">🌵</span>
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{item.name}</p>
                  <p className="text-xs text-gray-400">Qty: {item.quantity}</p>
                </div>
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  ₹{(item.price * item.quantity).toFixed(2)}
                </p>
              </div>
            ))}
          </div>

          {/* Total row */}
          <div className="border-t border-gray-100 dark:border-gray-800 pt-3 mt-1 flex items-center justify-between">
            <span className="text-sm font-bold text-gray-900 dark:text-white">Total Charged</span>
            <span className="font-bold text-lg text-gray-900 dark:text-white">₹{order.total.toFixed(2)}</span>
          </div>
        </div>

        {/* Delivery + payment summary */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">📍 Deliver To</p>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              {order.address.firstName} {order.address.lastName}<br />
              {order.address.line1}<br />
              {order.address.city}, {order.address.state} {order.address.zip}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">💳 Payment</p>
            <p className="text-sm text-gray-700 dark:text-gray-300">{METHOD_LABELS[order.method] ?? order.method}</p>
            <p className="text-xs text-gray-400 mt-1">Charged successfully</p>
          </div>
        </div>

        {/* CTA buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => navigate('/home')}
            className="px-8 py-3 bg-cactus-600 hover:bg-cactus-700 text-white rounded-xl font-semibold transition-colors"
          >
            Continue Shopping
          </button>
          <button
            onClick={() => navigate('/my-bids')}
            className="px-8 py-3 border-2 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 rounded-xl font-semibold hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            View My Bids
          </button>
        </div>

        {/* Support note */}
        <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-8">
          Questions about your order? Email{' '}
          <a href="mailto:support@cactusmart.com" className="text-cactus-600 dark:text-cactus-400 hover:underline">
            support@cactusmart.com
          </a>{' '}
          with your order number.
        </p>
      </div>
    </>
  );
}
