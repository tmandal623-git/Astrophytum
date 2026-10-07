// src/pages/CheckoutPage.tsx
// ── Key fixes vs previous version ─────────────────────────────
//  1. Uses useAuth() for real user.id — no more MOCK_USER_ID
//  2. Uses fetch() with credentials:'include' directly (no orderService)
//     so the auth cookie is always sent with the request
//  3. Auth guard: redirects to home if not logged in
//  4. Errors are shown in the UI AND in the toast — never silent
//  5. clearCart() waits for server confirmation before navigating

// src/pages/CheckoutPage.tsx
import { useEffect, useState } from 'react';
import { useNavigate }         from 'react-router-dom';
import { useAuth }             from '../context/AuthContext';
import { useAuthModal }        from '../context/AuthModalContext';
import { useCart }             from '../context/CartContext';
import { useToast }            from '../context/ToastContext';
import { cn }                  from '../utils/cn';
import { SHIPPING_COST, SHIPPING_THRESHOLD } from '../config/store';
import { SORTED_COUNTRIES, getCountry, getStates, getCities } from '../utils/locations';

const OTHER_CITY = '__other__';

// ── Config ────────────────────────────────────────────────────
const TAX_RATE           = 0.00;

// ── Google Pay business config (update with your real values) ─
const GPAY_CONFIG = {
  upiId:        'astrophytum@okicici',          // ← your real UPI ID
  businessName: 'AstroLab',
  qrCodeUrl:    '/Images/gpay-qr.png',          // ← place your QR PNG in public/Images/
};

// ── Types ─────────────────────────────────────────────────────
interface Address {
  firstName: string; lastName:  string;
  email:     string; phone:     string;
  line1:     string; line2:     string;
  city:      string; state:     string;
  zip:       string; country:   string;
}
interface CardDetails { number: string; name: string; expiry: string; cvv: string; }
type PaymentMethod = 'card' | 'paypal' | 'applepay' | 'googlepay';
type Step          = 'address' | 'payment' | 'review';

const EMPTY_ADDRESS: Address = {
  firstName:'', lastName:'', email:'', phone:'',
  line1:'', line2:'', city:'', state:'', zip:'', country:'IN',
};
const EMPTY_CARD: CardDetails = { number:'', name:'', expiry:'', cvv:'' };

// ── Formatters ────────────────────────────────────────────────
const fmtCard   = (v: string) => v.replace(/\D/g,'').slice(0,16).replace(/(.{4})/g,'$1 ').trim();
const fmtExpiry = (v: string) => { const d=v.replace(/\D/g,'').slice(0,4); return d.length>2?`${d.slice(0,2)}/${d.slice(2)}`:d; };

// ── Field component ───────────────────────────────────────────
function Field({ label, error, required, children }: {
  label: string; error?: string; required?: boolean; children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
const inputCls = (err?: string) => cn(
  'w-full px-3 py-2.5 text-sm border rounded-lg bg-white dark:bg-gray-900',
  'text-gray-900 dark:text-gray-100 placeholder:text-gray-400',
  'focus:outline-none focus:ring-2 focus:ring-cactus-500 transition-colors',
  err ? 'border-red-400' : 'border-gray-200 dark:border-gray-700',
);

// ── Step bar ──────────────────────────────────────────────────
function StepBar({ current }: { current: Step }) {
  const steps = [
    { key:'address' as Step, label:'Delivery', icon:'📍' },
    { key:'payment' as Step, label:'Payment',  icon:'💳' },
    { key:'review'  as Step, label:'Review',   icon:'✅' },
  ];
  const idx = steps.findIndex(s => s.key === current);
  return (
    <div className="flex items-center gap-0 mb-8">
      {steps.map((step, i) => (
        <div key={step.key} className="flex items-center flex-1 last:flex-none">
          <div className="flex flex-col items-center gap-1.5">
            <div className={cn('w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all',
              i<idx ? 'bg-cactus-600 border-cactus-600 text-white'
              : i===idx ? 'bg-white dark:bg-gray-900 border-cactus-600 text-cactus-600'
              : 'bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-400')}>
              {i < idx ? '✓' : step.icon}
            </div>
            <span className={cn('text-xs font-medium', i===idx ? 'text-cactus-600 dark:text-cactus-400' : 'text-gray-400')}>{step.label}</span>
          </div>
          {i < steps.length-1 && (
            <div className={cn('flex-1 h-0.5 mx-2 mb-5 rounded', i<idx ? 'bg-cactus-600' : 'bg-gray-200 dark:bg-gray-700')} />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Google Pay panel ──────────────────────────────────────────
function GooglePayPanel({
  total, transactionId, onTransactionIdChange, error,
}: {
  total: number;
  transactionId: string;
  onTransactionIdChange: (v: string) => void;
  error?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [qrError, setQrError] = useState(false);

  const copyUpiId = () => {
    navigator.clipboard.writeText(GPAY_CONFIG.upiId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="flex flex-col gap-5">

      {/* Header */}
      <div className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-950 rounded-xl border border-blue-100 dark:border-blue-900">
        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm flex-shrink-0">
          <svg viewBox="0 0 24 24" className="w-6 h-6">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-blue-800 dark:text-blue-200">Pay with Google Pay / UPI</p>
          <p className="text-xs text-blue-600 dark:text-blue-400">Scan QR or use UPI ID to pay <span className="font-bold">₹{total.toFixed(2)}</span></p>
        </div>
      </div>

      {/* QR Code */}
      <div className="flex flex-col items-center gap-3">
        <div className="bg-white border-2 border-gray-200 dark:border-gray-600 rounded-2xl p-4 shadow-sm">
          {qrError ? (
            /* Fallback QR placeholder when image not found */
            <div className="w-48 h-48 flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-800 rounded-xl gap-3">
              <div className="grid grid-cols-3 gap-1.5">
                {Array.from({ length: 9 }).map((_, i) => (
                  <div key={i} className={cn(
                    'w-12 h-12 rounded-sm',
                    [0,2,6,8].includes(i) ? 'bg-gray-900 dark:bg-white' :
                    i===4 ? 'bg-cactus-600' : 'bg-gray-200 dark:bg-gray-600'
                  )} />
                ))}
              </div>
              <p className="text-[10px] text-gray-400 text-center leading-tight">
                Add your QR code image<br/>at <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">public/images/gpay-qr.png</code>
              </p>
            </div>
          ) : (
            <img
              src={GPAY_CONFIG.qrCodeUrl}
              alt="Google Pay QR Code"
              className="w-48 h-48 object-contain"
              onError={() => setQrError(true)}
            />
          )}
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
          Scan with any UPI app (Google Pay, PhonePe, Paytm, etc.)
        </p>
      </div>

      {/* UPI ID */}
      <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
          Or pay using UPI ID
        </p>
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2.5">
            <p className="text-sm font-mono font-semibold text-gray-900 dark:text-white select-all">
              {GPAY_CONFIG.upiId}
            </p>
          </div>
          <button
            type="button"
            onClick={copyUpiId}
            className={cn(
              'px-3 py-2.5 text-xs font-semibold rounded-lg border transition-all flex-shrink-0',
              copied
                ? 'bg-cactus-600 border-cactus-600 text-white'
                : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-cactus-400 hover:text-cactus-600',
            )}
          >
            {copied ? '✓ Copied' : 'Copy'}
          </button>
        </div>
        <p className="text-[11px] text-gray-400 mt-2">
          Business name: <span className="font-medium text-gray-600 dark:text-gray-300">{GPAY_CONFIG.businessName}</span>
          {' · '}Amount: <span className="font-medium text-gray-600 dark:text-gray-300">₹{total.toFixed(2)}</span>
        </p>
      </div>

      {/* Instructions */}
      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          Payment instructions
        </p>
        {[
          { step: '1', text: 'Open your UPI app (Google Pay, PhonePe, or Paytm)' },
          { step: '2', text: `Scan the QR code above or send to UPI ID: ${GPAY_CONFIG.upiId}` },
          { step: '3', text: `Enter the exact amount: ₹${total.toFixed(2)}` },
          { step: '4', text: 'Complete the payment and note the Transaction ID / UTR number' },
          { step: '5', text: 'Enter the Transaction ID in the field below, then click Place Order' },
        ].map(({ step, text }) => (
          <div key={step} className="flex items-start gap-3">
            <div className="w-5 h-5 rounded-full bg-cactus-600 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
              {step}
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{text}</p>
          </div>
        ))}
      </div>

      {/* Transaction ID input */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
        <Field label="Transaction ID / UTR Number" required error={error}>
          <input
            type="text"
            placeholder="e.g. 423156789012 or UPI123456789"
            value={transactionId}
            onChange={e => onTransactionIdChange(e.target.value.trim())}
            className={cn(inputCls(error), 'font-mono')}
            maxLength={50}
          />
        </Field>
        <p className="text-[11px] text-gray-400 mt-1.5">
          Find this in your UPI app under payment history. Usually 12 digits.
        </p>
        {transactionId && transactionId.length >= 6 && (
          <div className="flex items-center gap-2 mt-2 text-xs text-cactus-600 dark:text-cactus-400 font-medium">
            <span>✓</span> Transaction ID entered — ready to place order
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main CheckoutPage ─────────────────────────────────────────
export function CheckoutPage() {
  const navigate             = useNavigate();
  const { user, isLoggedIn } = useAuth();
  const { openModal }        = useAuthModal();
  const { items, subtotal, clearCart } = useCart();
  const { showToast }        = useToast();

  const [step,          setStep]          = useState<Step>('address');
  const [address,       setAddress]       = useState<Address>(EMPTY_ADDRESS);
  const [card,          setCard]          = useState<CardDetails>(EMPTY_CARD);
  const [method,        setMethod]        = useState<PaymentMethod>('googlepay');
  const [transactionId, setTransactionId] = useState('');
  const [addrErr,       setAddrErr]       = useState<Partial<Record<keyof Address,string>>>({});
  const [cardErr,       setCardErr]       = useState<Partial<CardDetails>>({});
  const [txnErr,        setTxnErr]        = useState('');
  const [placing,       setPlacing]       = useState(false);
  const [apiError,      setApiError]      = useState('');
  const [cityOther,     setCityOther]     = useState(false);

  const shipping = subtotal >= SHIPPING_THRESHOLD ? 0 : SHIPPING_COST;
  const tax      = subtotal * TAX_RATE;
  const total    = subtotal + shipping + tax;

  useEffect(() => {
    if (!isLoggedIn) openModal('Please log in to complete your purchase.', 'login');
  }, [isLoggedIn]);

  // Reset transaction ID when switching away from GPay
  useEffect(() => {
    if (method !== 'googlepay') setTransactionId('');
  }, [method]);

  // Steps swap in place (no route change), so start each step at the top
  useEffect(() => { window.scrollTo(0, 0); }, [step]);

  if (items.length === 0) {
    return (
      <div className="max-w-3xl mx-auto text-center py-20">
        <p className="text-4xl mb-4">🛒</p>
        <p className="font-display text-2xl text-gray-700 dark:text-gray-300 mb-2">Your cart is empty</p>
        <button onClick={() => navigate('/home')} className="mt-4 px-6 py-3 bg-cactus-600 text-white rounded-xl font-medium hover:bg-cactus-700 transition-colors">
          Browse Collection
        </button>
      </div>
    );
  }

  // ── Validation ────────────────────────────────────────────
  const validateAddress = () => {
    const e: typeof addrErr = {};
    if (!address.firstName.trim()) e.firstName = 'Required';
    if (!address.lastName.trim())  e.lastName  = 'Required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address.email)) e.email = 'Valid email required';
    if (!address.line1.trim())     e.line1     = 'Required';
    if (!address.city.trim())      e.city      = 'Required';
    if (!address.state.trim())     e.state     = 'Required';
    if (!address.zip.trim())       e.zip       = 'Required';
    setAddrErr(e);
    return Object.keys(e).length === 0;
  };

  const validateCard = () => {
    if (method !== 'card') return true;
    const e: Partial<CardDetails> = {};
    if (card.number.replace(/\s/g,'').length < 16) e.number = 'Enter valid 16-digit number';
    if (!card.name.trim())                          e.name   = 'Required';
    if (!/^\d{2}\/\d{2}$/.test(card.expiry))        e.expiry = 'Format: MM/YY';
    if (card.cvv.length < 3)                        e.cvv    = '3–4 digits required';
    setCardErr(e);
    return Object.keys(e).length === 0;
  };

  const validatePayment = () => {
    if (method === 'googlepay') {
      if (!transactionId || transactionId.length < 6) {
        setTxnErr('Please enter your Transaction ID / UTR number (min 6 characters)');
        return false;
      }
      setTxnErr('');
    }
    return validateCard();
  };

  const handleNextStep = () => {
    if (step === 'address' && validateAddress()) setStep('payment');
    if (step === 'payment' && validatePayment()) setStep('review');
  };

  // ── Place order ───────────────────────────────────────────
  const handlePlaceOrder = async () => {
    if (!isLoggedIn || !user) { openModal('Please log in.', 'login'); return; }

    // Final validation for GPay
    if (method === 'googlepay' && (!transactionId || transactionId.length < 6)) {
      setTxnErr('Transaction ID is required to place a Google Pay order');
      setStep('payment');
      return;
    }

    setPlacing(true);
    setApiError('');

    const payload = {
      userId:        user.id,
      paymentMethod: method,
      subtotal:      parseFloat(subtotal.toFixed(2)),
      shipping:      parseFloat(shipping.toFixed(2)),
      tax:           parseFloat(tax.toFixed(2)),
      total:         parseFloat(total.toFixed(2)),
      transactionId: method === 'googlepay' ? transactionId : undefined,
      upiId:         method === 'googlepay' ? GPAY_CONFIG.upiId : undefined,
      address: {
        firstName: address.firstName.trim(),
        lastName:  address.lastName.trim(),
        email:     address.email.trim(),
        phone:     address.phone.trim() || null,
        line1:     address.line1.trim(),
        line2:     address.line2.trim() || null,
        city:      address.city.trim(),
        state:     address.state.trim(),
        zip:       address.zip.trim(),
        country:   address.country,
      },
      items: items.map(i => ({
        cactusId:  i.id,
        quantity:  i.quantity,
        unitPrice: parseFloat(i.price.toFixed(2)),
      })),
    };

    console.log('📦 Placing order:', payload);

    try {
      const res  = await fetch('/api/orders', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      console.log(`📦 Order response ${res.status}:`, body);

      if (!res.ok) throw new Error(body.error ?? `Server error ${res.status}`);

      await clearCart();

      const isGPay = method === 'googlepay';
      showToast(isGPay
        ? '⏳ Order placed — awaiting payment verification'
        : '✅ Order placed successfully! 🌵'
      );

      navigate('/order-confirmed', {
        state: {
          orderNumber:          body.orderNumber,
          orderId:              body.id,
          items:                [...items],
          total:                body.total ?? total,
          address,
          method,
          paymentStatus:        body.paymentStatus,
          orderStatus:          body.orderStatus,
          requiresVerification: body.requiresVerification,
          transactionId:        method === 'googlepay' ? transactionId : undefined,
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to place order';
      console.error('❌ Order failed:', msg);
      setApiError(msg);
      showToast(msg, 'error');
    } finally {
      setPlacing(false);
    }
  };

  // ── Order Summary ─────────────────────────────────────────
  const OrderSummary = () => (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-5 sticky top-4">
      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Order Summary</p>
      <div className="flex flex-col gap-2 mb-4 max-h-48 overflow-y-auto">
        {items.map(item => (
          <div key={item.id} className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-cactus-50 dark:bg-cactus-950 flex items-center justify-center flex-shrink-0 overflow-hidden">
              {item.thumbnailUrl ? <img src={item.thumbnailUrl} alt={item.name} className="w-full h-full object-cover rounded-lg" /> : <span>🌵</span>}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">{item.name}</p>
              <p className="text-[11px] text-gray-400">Qty: {item.quantity}</p>
            </div>
            <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 flex-shrink-0">
              ₹{(item.price * item.quantity).toFixed(2)}
            </p>
          </div>
        ))}
      </div>
      <div className="border-t border-gray-100 dark:border-gray-800 pt-3 flex flex-col gap-1.5 text-sm">
        <div className="flex justify-between text-gray-500"><span>Subtotal</span><span>₹{subtotal.toFixed(2)}</span></div>
        <div className="flex justify-between text-gray-500">
          <span>Shipping</span>
          <span className={shipping===0?'text-cactus-600':''}>{shipping===0?'Free':`₹${shipping.toFixed(2)}`}</span>
        </div>
        <div className="flex justify-between text-gray-500"><span>Tax{TAX_RATE ? ` (${Math.round(TAX_RATE * 100)}%)` : ''}</span><span>₹{tax.toFixed(2)}</span></div>
        <div className="flex justify-between font-bold text-gray-900 dark:text-white border-t border-gray-100 dark:border-gray-800 pt-2 mt-1">
          <span>Total</span><span>₹{total.toFixed(2)}</span>
        </div>
      </div>
      {method === 'googlepay' && (
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 rounded-lg px-3 py-2">
            <span>⏳</span>
            <span>Google Pay orders require manual verification (1–24 hrs)</span>
          </div>
        </div>
      )}
      {user && (
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-cactus-600 text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0">
            {user.username.slice(0,2).toUpperCase()}
          </div>
          <p className="text-xs text-gray-400 truncate">
            Ordering as <span className="font-medium text-gray-700 dark:text-gray-300">{user.username}</span>
          </p>
        </div>
      )}
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto">
      <button onClick={() => navigate('/my-cart')} className="flex items-center gap-2 text-sm text-cactus-600 dark:text-cactus-400 font-medium mb-6 hover:underline">
        ← Back to Cart
      </button>
      <h1 className="font-display text-2xl sm:text-3xl text-gray-900 dark:text-white mb-6">Checkout</h1>
      <StepBar current={step} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">

          {/* ── STEP 1: Address ─── */}
          {step === 'address' && (
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 sm:p-6">
              <h2 className="font-display text-xl text-gray-900 dark:text-white mb-5">Delivery Address</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="First Name" error={addrErr.firstName}>
                  <input className={inputCls(addrErr.firstName)} placeholder="First Name" value={address.firstName} onChange={e => setAddress({...address,firstName:e.target.value})} />
                </Field>
                <Field label="Last Name" error={addrErr.lastName}>
                  <input className={inputCls(addrErr.lastName)} placeholder="Last Name" value={address.lastName} onChange={e => setAddress({...address,lastName:e.target.value})} />
                </Field>
                <Field label="Email" error={addrErr.email}>
                  <input type="email" className={inputCls(addrErr.email)} placeholder="email@gmail.com" value={address.email} onChange={e => setAddress({...address,email:e.target.value})} />
                </Field>
                <Field label="Phone">
                  <input type="tel" className={inputCls()} placeholder="+91 78223 77667" value={address.phone} onChange={e => setAddress({...address,phone:e.target.value})} />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Address Line 1" error={addrErr.line1}>
                    <input className={inputCls(addrErr.line1)} placeholder="Address Line 1" value={address.line1} onChange={e => setAddress({...address,line1:e.target.value})} />
                  </Field>
                </div>
                <div className="sm:col-span-2">
                  <Field label="Address Line 2 (optional)">
                    <input className={inputCls()} placeholder="Address Line 2…" value={address.line2} onChange={e => setAddress({...address,line2:e.target.value})} />
                  </Field>
                </div>
                <Field label="Country">
                  <select
                    className={inputCls()}
                    value={address.country}
                    onChange={e => { setCityOther(false); setAddress({...address,country:e.target.value,state:'',city:''}); }}
                  >
                    {SORTED_COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                  </select>
                </Field>
                <Field label="State / Province" error={addrErr.state}>
                  <select
                    className={inputCls(addrErr.state)}
                    value={address.state}
                    onChange={e => { setCityOther(false); setAddress({...address,state:e.target.value,city:''}); }}
                  >
                    <option value="">Select state</option>
                    {getStates(address.country).map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </Field>
                <Field label="City" error={addrErr.city}>
                  <select
                    className={inputCls(addrErr.city)}
                    value={cityOther ? OTHER_CITY : address.city}
                    disabled={!address.state}
                    onChange={e => {
                      const other = e.target.value === OTHER_CITY;
                      setCityOther(other);
                      setAddress({...address,city: other ? '' : e.target.value});
                    }}
                  >
                    <option value="">{address.state ? 'Select city' : 'Select state first'}</option>
                    {getCities(address.country, address.state).map(c => <option key={c} value={c}>{c}</option>)}
                    {address.state && <option value={OTHER_CITY}>Other (not listed)</option>}
                  </select>
                  {cityOther && (
                    <input className={inputCls(addrErr.city)} placeholder="Enter your city / town" value={address.city} onChange={e => setAddress({...address,city:e.target.value})} />
                  )}
                </Field>
                <Field label="ZIP / PIN" error={addrErr.zip}>
                  <input className={inputCls(addrErr.zip)} placeholder="ZIP / PIN" value={address.zip} onChange={e => setAddress({...address,zip:e.target.value})} />
                </Field>
              </div>
              <div className="flex justify-end mt-6">
                <button onClick={handleNextStep} className="px-8 py-3 bg-cactus-600 hover:bg-cactus-700 text-white rounded-xl font-semibold transition-colors">
                  Continue to Payment →
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 2: Payment ─── */}
          {step === 'payment' && (
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 sm:p-6">
              <h2 className="font-display text-xl text-gray-900 dark:text-white mb-5">Payment Method</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                {([
                  // { key:'card'      as PaymentMethod, icon:'💳', label:'Credit / Debit Card' },
                  // { key:'paypal'    as PaymentMethod, icon:'🅿️', label:'PayPal' },
                  // { key:'applepay'  as PaymentMethod, icon:'🍎', label:'Apple Pay' },
                  { key:'googlepay' as PaymentMethod, icon: (
                    <svg viewBox="0 0 24 24" className="w-5 h-5">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                  ), label:'Google Pay / UPI' },
                ]).map((m) => (
                  <button key={m.key} onClick={() => setMethod(m.key)}
                    className={cn('flex items-center gap-3 p-3.5 rounded-xl border-2 text-sm font-medium transition-all text-left',
                      method===m.key ? 'border-cactus-500 bg-cactus-50 dark:bg-cactus-950 text-cactus-700 dark:text-cactus-300'
                                     : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300')}>
                    <span className="text-xl flex-shrink-0">
                      {typeof m.icon === 'string' ? m.icon : m.icon}
                    </span>
                    {m.label}
                  </button>
                ))}
              </div>

              {/* Card form */}
              {method === 'card' && (
                <div className="flex flex-col gap-4">
                  <p className="text-xs text-gray-400 flex items-center gap-1.5">🔒 Your payment info is encrypted.</p>
                  <Field label="Card Number" error={cardErr.number}>
                    <input className={inputCls(cardErr.number)} placeholder="1234 5678 9012 3456" value={card.number} onChange={e => setCard({...card,number:fmtCard(e.target.value)})} maxLength={19} />
                  </Field>
                  <Field label="Cardholder Name" error={cardErr.name}>
                    <input className={inputCls(cardErr.name)} placeholder="Jane Smith" value={card.name} onChange={e => setCard({...card,name:e.target.value})} />
                  </Field>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Expiry" error={cardErr.expiry}>
                      <input className={inputCls(cardErr.expiry)} placeholder="MM/YY" value={card.expiry} onChange={e => setCard({...card,expiry:fmtExpiry(e.target.value)})} maxLength={5} />
                    </Field>
                    <Field label="CVV" error={cardErr.cvv}>
                      <input className={inputCls(cardErr.cvv)} placeholder="123" type="password" value={card.cvv} onChange={e => setCard({...card,cvv:e.target.value.replace(/\D/,'').slice(0,4)})} maxLength={4} />
                    </Field>
                  </div>
                </div>
              )}

              {/* Google Pay panel */}
              {method === 'googlepay' && (
                <GooglePayPanel
                  total={total}
                  transactionId={transactionId}
                  onTransactionIdChange={setTransactionId}
                  error={txnErr}
                />
              )}

              {/* Other methods */}
              {(method === 'paypal' || method === 'applepay') && (
                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-5 text-center text-sm text-gray-500 dark:text-gray-400">
                  <p className="text-2xl mb-2">{method === 'paypal' ? '🅿️' : '🍎'}</p>
                  <p>You'll be redirected to complete payment after placing your order.</p>
                </div>
              )}

              <div className="flex justify-between gap-3 mt-6">
                <button onClick={() => setStep('address')} className="px-6 py-3 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 rounded-xl font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">← Back</button>
                <button onClick={handleNextStep} className="px-8 py-3 bg-cactus-600 hover:bg-cactus-700 text-white rounded-xl font-semibold transition-colors">Review Order →</button>
              </div>
            </div>
          )}

          {/* ── STEP 3: Review ─── */}
          {step === 'review' && (
            <div className="flex flex-col gap-4">

              {/* Address */}
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">📍 Delivery Address</p>
                  <button onClick={() => setStep('address')} className="text-xs text-cactus-600 dark:text-cactus-400 hover:underline">Edit</button>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                  {address.firstName} {address.lastName}<br/>
                  {address.line1}{address.line2?`, ${address.line2}`:''}<br/>
                  {address.city}, {address.state} {address.zip} · {getCountry(address.country)?.name ?? address.country}<br/>
                  <span className="text-xs">{address.email}{address.phone?` · ${address.phone}`:''}</span>
                </p>
              </div>

              {/* Payment */}
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">💳 Payment</p>
                  <button onClick={() => setStep('payment')} className="text-xs text-cactus-600 dark:text-cactus-400 hover:underline">Edit</button>
                </div>
                {method === 'googlepay' ? (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Google Pay / UPI</span>
                      <span className="text-xs bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full font-medium">
                        ⏳ Pending Verification
                      </span>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2">
                      <p className="text-xs text-gray-400 mb-0.5">Transaction ID / UTR</p>
                      <p className="text-sm font-mono font-semibold text-gray-900 dark:text-white">{transactionId}</p>
                    </div>
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      ℹ️ Your order will be confirmed within 1–24 hours after payment verification by our team.
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {method==='card' ? `Card ending in ${card.number.replace(/\s/g,'').slice(-4)} · ${card.name}` : method==='paypal' ? 'PayPal' : 'Apple Pay'}
                  </p>
                )}
              </div>

              {/* Items */}
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">🌵 Items ({items.length})</p>
                <div className="flex flex-col gap-3">
                  {items.map(item => (
                    <div key={item.id} className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-cactus-50 dark:bg-cactus-950 flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {item.thumbnailUrl ? <img src={item.thumbnailUrl} alt="" className="w-full h-full object-cover rounded-lg" /> : <span>🌵</span>}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{item.name}</p>
                        <p className="text-xs text-gray-400">Qty: {item.quantity} × ₹{item.price.toFixed(2)}</p>
                      </div>
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">₹{(item.price*item.quantity).toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              </div>

              {apiError && (
                <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl p-4 text-sm text-red-600 dark:text-red-400 flex items-start gap-2">
                  <span>⚠️</span><span>{apiError}</span>
                </div>
              )}

              <p className="text-[11px] text-gray-400 text-center leading-relaxed">
                By placing your order you agree to CactusMart's Terms of Service and Privacy Policy.
              </p>

              <div className="flex justify-between">
                <button onClick={() => setStep('payment')} className="px-6 py-3 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 rounded-xl font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">← Back</button>
                <button onClick={handlePlaceOrder} disabled={placing || !isLoggedIn}
                  className="px-8 py-3 bg-cactus-600 hover:bg-cactus-700 disabled:opacity-60 text-white rounded-xl font-semibold transition-all flex items-center gap-2">
                  {placing
                    ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>Placing Order…</>
                    : method==='googlepay' ? `Submit Order · ₹${total.toFixed(2)}` : `Place Order · ₹${total.toFixed(2)}`
                  }
                </button>
              </div>
            </div>
          )}
        </div>
        <div><OrderSummary /></div>
      </div>
    </div>
  );
}

