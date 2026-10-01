// src/pages/MyCartPage.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import { EmptyState } from '../components/ui/EmptyState';
import { cn } from '../utils/cn';
import { SHIPPING_COST, SHIPPING_THRESHOLD } from '../config/store';

const TAX_RATE           = 0.08; // 8%

// ── Promo codes (mock) ─────────────────────────────────────────
const PROMO_CODES: Record<string, { discount: number; label: string }> = {
  CACTUS10: { discount: 0.10, label: '10% off your order' },
  PRICKLY5: { discount: 0.05, label: '5% off your order'  },
  WELCOME20: { discount: 0.20, label: '20% welcome discount' },
};

export function MyCartPage() {
  const navigate                         = useNavigate();
  const { items, totalItems, subtotal, removeFromCart, updateQty, clearCart } = useCart();
  const { showToast }                    = useToast();

  const [promoInput,    setPromoInput]   = useState('');
  const [appliedPromo,  setAppliedPromo] = useState<{ code: string; discount: number; label: string } | null>(null);
  const [promoError,    setPromoError]   = useState('');

  // ── Calculations ───────────────────────────────────────────
  const discountAmt  = appliedPromo ? subtotal * appliedPromo.discount : 0;
  const discounted   = subtotal - discountAmt;
  const shipping     = discounted >= SHIPPING_THRESHOLD ? 0 : SHIPPING_COST;
  const tax          = discounted * TAX_RATE;
  const total        = discounted + shipping + tax;

  // ── Handlers ───────────────────────────────────────────────
  const handleApplyPromo = () => {
    const code = promoInput.trim().toUpperCase();
    if (!code) return;
    const found = PROMO_CODES[code];
    if (found) {
      setAppliedPromo({ code, ...found });
      setPromoError('');
      setPromoInput('');
      showToast(`Promo applied: ${found.label} 🎉`);
    } else {
      setPromoError('Invalid promo code. Try CACTUS10, PRICKLY5, or WELCOME20.');
    }
  };

  const handleRemovePromo = () => {
    setAppliedPromo(null);
    showToast('Promo code removed.');
  };

  // ── Empty cart ─────────────────────────────────────────────
  if (items.length === 0) {
    return (
      <div className="max-w-4xl mx-auto">
        <h1 className="font-display text-3xl text-gray-900 dark:text-white mb-8">My Cart</h1>
        <EmptyState
          icon="🛒"
          title="Your cart is empty"
          description="Looks like you haven't added anything yet. Browse our collection and find a cactus you love!"
          action={{ label: 'Browse Collection', onClick: () => navigate('/home') }}
          secondaryAction={{ label: 'View Auctions', onClick: () => navigate('/auctions') }}
        />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl text-gray-900 dark:text-white">My Cart</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {totalItems} {totalItems === 1 ? 'item' : 'items'}
          </p>
        </div>
        <button
          onClick={() => { clearCart(); showToast('Cart cleared.'); }}
          className="text-sm text-red-400 hover:text-red-500 transition-colors"
        >
          Clear all
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Left: item list ─────────────────────────────── */}
        <div className="lg:col-span-2 flex flex-col gap-3">

          {/* Free shipping progress */}
          {subtotal < SHIPPING_THRESHOLD && (
            <div className="bg-amber-50 dark:bg-amber-950 border border-amber-100 dark:border-amber-900 rounded-xl px-4 py-3">
              <div className="flex items-center justify-between text-sm mb-1.5">
                <span className="text-amber-800 dark:text-amber-300 font-medium">
                  Add ₹{(SHIPPING_THRESHOLD - subtotal).toFixed(2)} more for free shipping!
                </span>
                <span className="text-amber-600 dark:text-amber-400 text-xs">
                  ₹{subtotal.toFixed(2)} / ₹{SHIPPING_THRESHOLD}
                </span>
              </div>
              <div className="h-1.5 bg-amber-200 dark:bg-amber-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min((subtotal / SHIPPING_THRESHOLD) * 100, 100)}%` }}
                />
              </div>
            </div>
          )}

          {subtotal >= SHIPPING_THRESHOLD && (
            <div className="bg-cactus-50 dark:bg-cactus-950 border border-cactus-100 dark:border-cactus-900 rounded-xl px-4 py-3 text-sm text-cactus-700 dark:text-cactus-300 font-medium flex items-center gap-2">
              🚚 You've unlocked free shipping!
            </div>
          )}

          {/* Items */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
            {items.map((item, idx) => (
              <div
                key={item.id}
                className={cn(
                  'flex items-center gap-3 sm:gap-4 p-3 sm:p-4',
                  idx < items.length - 1 && 'border-b border-gray-100 dark:border-gray-800',
                )}
              >
                {/* Thumbnail */}
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-cactus-50 dark:bg-cactus-950 flex-shrink-0 overflow-hidden flex items-center justify-center">
                  {item.thumbnailUrl
                    ? <img src={item.thumbnailUrl} alt={item.name} className="w-full h-full object-cover" />
                    : <span className="text-3xl">🌵</span>
                  }
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 dark:text-white truncate">{item.name}</p>
                      <p className="text-xs text-cactus-600 dark:text-cactus-400 mt-0.5">{item.categoryName}</p>
                    </div>
                    <button
                      onClick={() => { removeFromCart(item.id); showToast(`${item.name} removed.`); }}
                      className="text-gray-300 dark:text-gray-600 hover:text-red-400 dark:hover:text-red-400 transition-colors flex-shrink-0 p-1"
                      title="Remove item"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  <div className="flex items-center justify-between mt-3">
                    {/* Qty stepper */}
                    <div className="flex items-center gap-1 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                      <button
                        onClick={() => updateQty(item.id, item.quantity - 1)}
                        className="w-8 h-8 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-lg leading-none"
                      >
                        −
                      </button>
                      <span className="w-9 text-center text-sm font-medium text-gray-900 dark:text-white">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQty(item.id, item.quantity + 1)}
                        className="w-8 h-8 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-lg leading-none"
                      >
                        +
                      </button>
                    </div>

                    {/* Line total */}
                    <p className="font-semibold text-gray-900 dark:text-white">
                      ₹{(item.price * item.quantity).toFixed(2)}
                      {item.quantity > 1 && (
                        <span className="ml-1 text-xs font-normal text-gray-400">
                          (₹{item.price.toFixed(2)} ea)
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Continue shopping */}
          <button
            onClick={() => navigate('/home')}
            className="text-sm text-cactus-600 dark:text-cactus-400 hover:underline self-start mt-1"
          >
            ← Continue Shopping
          </button>
        </div>

        {/* ── Right: order summary ─────────────────────────── */}
        <div className="flex flex-col gap-4">

          {/* Promo code */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Promo Code</p>

            {appliedPromo ? (
              <div className="flex items-center justify-between bg-cactus-50 dark:bg-cactus-950 border border-cactus-200 dark:border-cactus-800 rounded-lg px-3 py-2">
                <div>
                  <p className="text-sm font-semibold text-cactus-700 dark:text-cactus-300">{appliedPromo.code}</p>
                  <p className="text-[11px] text-cactus-600 dark:text-cactus-400">{appliedPromo.label}</p>
                </div>
                <button onClick={handleRemovePromo} className="text-gray-400 hover:text-red-400 transition-colors text-xs">
                  Remove
                </button>
              </div>
            ) : (
              <>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Enter code"
                    value={promoInput}
                    onChange={(e) => { setPromoInput(e.target.value); setPromoError(''); }}
                    onKeyDown={(e) => e.key === 'Enter' && handleApplyPromo()}
                    className="flex-1 px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-cactus-500"
                  />
                  <button
                    onClick={handleApplyPromo}
                    className="px-3 py-2 text-sm font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  >
                    Apply
                  </button>
                </div>
                {promoError && <p className="text-xs text-red-500 mt-1.5">{promoError}</p>}
              </>
            )}
          </div>

          {/* Price breakdown */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 flex flex-col gap-3">
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Order Summary</p>

            <div className="flex flex-col gap-2 text-sm">
              <Row label="Subtotal" value={`₹${subtotal.toFixed(2)}`} />
              {appliedPromo && (
                <Row
                  label={`Discount (${Math.round(appliedPromo.discount * 100)}%)`}
                  value={`−₹${discountAmt.toFixed(2)}`}
                  valueClass="text-cactus-600 dark:text-cactus-400"
                />
              )}
              <Row
                label="Shipping"
                value={shipping === 0 ? 'Free 🚚' : `₹${shipping.toFixed(2)}`}
                valueClass={shipping === 0 ? 'text-cactus-600 dark:text-cactus-400' : ''}
              />
              <Row label={`Tax (${TAX_RATE * 100}%)`} value={`₹${tax.toFixed(2)}`} />
            </div>

            <div className="border-t border-gray-100 dark:border-gray-800 pt-3 flex items-center justify-between">
              <span className="font-bold text-gray-900 dark:text-white">Total</span>
              <span className="font-bold text-xl text-gray-900 dark:text-white">₹{total.toFixed(2)}</span>
            </div>

            <button
              onClick={() => navigate('/checkout')}
              className="w-full py-3.5 rounded-xl bg-cactus-600 hover:bg-cactus-700 active:bg-cactus-800 text-white font-semibold text-base transition-all duration-200 shadow-sm hover:shadow-md mt-1"
            >
              Proceed to Checkout →
            </button>

            {/* Trust badges */}
            <div className="flex items-center justify-center gap-4 pt-2">
              {['🔒 Secure', '↩️ Easy returns', '🌿 Live guarantee'].map((t) => (
                <span key={t} className="text-[10px] text-gray-400 dark:text-gray-500">{t}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, valueClass = '' }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between text-gray-600 dark:text-gray-400">
      <span>{label}</span>
      <span className={cn('font-medium text-gray-800 dark:text-gray-200', valueClass)}>{value}</span>
    </div>
  );
}
