// src/components/admin/ShipmentManagementSection.tsx
// Admin: dispatch payment-verified orders, enter courier/tracking details,
// update shipment status and review each order's status history.
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { cn }             from '../../utils/cn';
import { useToast }       from '../../context/ToastContext';
import { StatusBadge }    from '../ui/StatusBadge';
import { Pagination }     from '../ui/Pagination';
import { StatusTimeline } from '../orders/OrderTracking';
import {
  COURIER_OPTIONS, SHIPMENT_STATUS_OPTIONS, SHIPPED_STATUSES,
  Shipment, ShipmentStatus, StatusHistoryEntry, TrackingStatus, formatDateOnly,
} from '../../utils/orderTracking';

const PAGE_SIZE = 3;

// ── Types ─────────────────────────────────────────────────────
interface AdminOrder {
  id:             number;
  total:          number;
  paymentMethod:  string;
  paymentStatus:  string;
  createdAt:      string;
  firstName:      string;
  lastName:       string;
  email:          string;
  phone:          string | null;
  addressLine1:   string;
  addressLine2:   string | null;
  city:           string;
  state:          string;
  zip:            string;
  country:        string;
  trackingStatus: TrackingStatus;
  shipment:       Shipment | null;
  items:          { name: string; quantity: number; unitPrice: number }[] | null;
}

interface ShipmentForm {
  status:                ShipmentStatus;
  courier:               string;
  courierName:           string;
  trackingNumber:        string;
  trackingUrl:           string;
  dispatchDate:          string;
  estimatedDeliveryDate: string;
  note:                  string;
}

type Filter = 'all' | 'ready' | 'processing' | 'dispatched' | 'in_transit' | 'delivered' | 'cancelled' | 'awaiting';

const FILTERS: { key: Filter; label: string; match: (s: TrackingStatus) => boolean }[] = [
  { key: 'all',        label: 'All',               match: () => true },
  { key: 'ready',      label: 'Ready to Dispatch', match: s => s === 'payment_verified' },
  { key: 'processing', label: 'Processing',        match: s => s === 'processing' },
  { key: 'dispatched', label: 'Dispatched',        match: s => s === 'dispatched' },
  { key: 'in_transit', label: 'In Transit',        match: s => s === 'in_transit' },
  { key: 'delivered',  label: 'Delivered',         match: s => s === 'delivered' },
  { key: 'cancelled',  label: 'Cancelled',         match: s => s === 'cancelled' || s === 'payment_failed' },
  { key: 'awaiting',   label: 'Awaiting Payment',  match: s => s === 'payment_pending' },
];

const orderNumber = (id: number) => `CM-${String(id).padStart(6, '0')}`;
const todayLocal  = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const formFromOrder = (o: AdminOrder): ShipmentForm => ({
  status:                o.shipment?.status ?? 'processing',
  courier:               o.shipment?.courier ?? '',
  courierName:           o.shipment?.courier === 'other' ? (o.shipment.courierName ?? '') : '',
  trackingNumber:        o.shipment?.trackingNumber ?? '',
  trackingUrl:           o.shipment?.trackingUrl ?? '',
  dispatchDate:          o.shipment?.dispatchDate ?? '',
  estimatedDeliveryDate: o.shipment?.estimatedDeliveryDate ?? '',
  note:                  '',
});

// Mirrors the server-side checks so most mistakes are caught before saving
function validate(f: ShipmentForm): Partial<Record<keyof ShipmentForm, string>> {
  const e: Partial<Record<keyof ShipmentForm, string>> = {};
  const shipped = SHIPPED_STATUSES.includes(f.status);
  if (shipped && !f.courier)                 e.courier        = 'Select a courier';
  if (f.courier === 'other' && f.courierName.trim().length < 2) e.courierName = 'Enter the courier name';
  if (shipped && !f.trackingNumber.trim())   e.trackingNumber = 'Tracking / AWB number is required';
  else if (f.trackingNumber.trim() && !/^[A-Za-z0-9-]{4,40}$/.test(f.trackingNumber.trim()))
    e.trackingNumber = '4–40 letters, digits or dashes';
  if (f.trackingUrl.trim()) {
    try {
      const u = new URL(f.trackingUrl.trim());
      if (!['http:', 'https:'].includes(u.protocol)) e.trackingUrl = 'Must start with http:// or https://';
    } catch { e.trackingUrl = 'Enter a valid link'; }
  }
  if (shipped && !f.dispatchDate) e.dispatchDate = 'Dispatch date is required';
  if (f.dispatchDate && f.estimatedDeliveryDate && f.estimatedDeliveryDate < f.dispatchDate)
    e.estimatedDeliveryDate = 'Cannot be before the dispatch date';
  return e;
}

const inputCls = (err?: string) => cn(
  'w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-900',
  'text-gray-900 dark:text-gray-100 placeholder:text-gray-400',
  'focus:outline-none focus:ring-2 focus:ring-cactus-500',
  err ? 'border-red-400' : 'border-gray-200 dark:border-gray-700',
);

function Field({ label, error, required, children }: { label: string; error?: string; required?: boolean; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
        {label}{required && <span className="text-red-500"> *</span>}
      </span>
      {children}
      {error && <span className="text-xs text-red-500">{error}</span>}
    </label>
  );
}

// ── Main component ────────────────────────────────────────────
/** `refreshKey` — bump it to reload (e.g. after a payment is verified elsewhere on the page) */
export function ShipmentManagementSection({ refreshKey = 0 }: { refreshKey?: number }) {
  const { showToast } = useToast();

  const [orders,   setOrders]   = useState<AdminOrder[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');
  const [filter,   setFilter]   = useState<Filter>('ready');
  const [search,   setSearch]   = useState('');
  const [page,     setPage]     = useState(1);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [form,     setForm]     = useState<ShipmentForm | null>(null);
  const [errors,   setErrors]   = useState<Partial<Record<keyof ShipmentForm, string>>>({});
  const [saving,   setSaving]   = useState(false);
  const [history,  setHistory]  = useState<Record<number, StatusHistoryEntry[]>>({});

  const loadOrders = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res  = await fetch('/api/admin/orders', { credentials: 'include' });
      const body = await res.json().catch(() => null);
      if (!res.ok || !Array.isArray(body)) throw new Error(body?.error ?? `HTTP ${res.status}`);
      setOrders(body);
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to load orders'); }
    finally { setLoading(false); }
  }, []);

  const loadHistory = useCallback(async (orderId: number) => {
    try {
      const res  = await fetch(`/api/admin/orders/${orderId}/history`, { credentials: 'include' });
      const body = await res.json().catch(() => null);
      if (res.ok && Array.isArray(body)) setHistory(prev => ({ ...prev, [orderId]: body }));
    } catch { /* history is supplementary — ignore */ }
  }, []);

  useEffect(() => { loadOrders(); }, [loadOrders, refreshKey]);

  const toggleExpand = (o: AdminOrder) => {
    if (expanded === o.id) { setExpanded(null); return; }
    setExpanded(o.id);
    setForm(formFromOrder(o));
    setErrors({});
    loadHistory(o.id);
  };

  const setField = <K extends keyof ShipmentForm>(key: K, value: ShipmentForm[K]) => {
    setForm(prev => {
      if (!prev) return prev;
      const next = { ...prev, [key]: value };
      // Moving to a shipped status → default the dispatch date to today
      if (key === 'status' && SHIPPED_STATUSES.includes(value as ShipmentStatus) && !next.dispatchDate)
        next.dispatchDate = todayLocal();
      return next;
    });
    setErrors(prev => ({ ...prev, [key]: undefined }));
  };

  const handleSave = async (o: AdminOrder) => {
    if (!form) return;
    const errs = validate(form);
    setErrors(errs);
    if (Object.values(errs).some(Boolean)) return;
    if (form.status === 'cancelled' && o.trackingStatus !== 'cancelled'
        && !window.confirm(`Cancel order ${orderNumber(o.id)}? Its stock will be put back on sale and the order can no longer be updated.`))
      return;

    setSaving(true);
    try {
      const res  = await fetch(`/api/admin/orders/${o.id}/shipment`, {
        method:      'PUT',
        credentials: 'include',
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify({
          ...form,
          courierName: form.courier === 'other' ? form.courierName : '',
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
      showToast(body?.message === 'No changes' ? 'No changes to save' : `🚚 ${orderNumber(o.id)} updated`);
      setForm(prev => prev && { ...prev, note: '' });
      await Promise.all([loadOrders(), loadHistory(o.id)]);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update shipment', 'error');
    } finally { setSaving(false); }
  };

  // ── Filtering + pagination ────────────────────────────────
  const counts = Object.fromEntries(FILTERS.map(f => [f.key, orders.filter(o => f.match(o.trackingStatus)).length])) as Record<Filter, number>;
  const q = search.trim().toLowerCase();
  const filtered = orders
    .filter(o => FILTERS.find(f => f.key === filter)!.match(o.trackingStatus))
    .filter(o => !q || [orderNumber(o.id), `${o.firstName} ${o.lastName}`, o.email, o.shipment?.trackingNumber ?? '']
      .some(v => v.toLowerCase().includes(q)));
  const totalPages  = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paged       = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-5 py-4 border-b border-gray-100 dark:border-gray-800 bg-cactus-50 dark:bg-cactus-950/30">
        <div className="flex items-center gap-3">
          <span className="text-xl">🚚</span>
          <div>
            <h2 className="font-display text-xl text-gray-900 dark:text-white">Shipments &amp; Tracking</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Dispatch verified orders and keep tracking details up to date</p>
          </div>
          {counts.ready > 0 && (
            <span className="bg-cactus-600 text-white text-xs font-bold px-2.5 py-1 rounded-full">
              {counts.ready} to dispatch
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search order, name, AWB…"
            className="flex-1 sm:w-52 px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-cactus-500" />
          <button onClick={loadOrders}
            className="px-3 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-lg text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors whitespace-nowrap">
            ↺ Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-1.5 px-4 sm:px-5 py-3 border-b border-gray-100 dark:border-gray-800 overflow-x-auto">
        {FILTERS.map(f => (
          <button key={f.key} onClick={() => { setFilter(f.key); setPage(1); }}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors',
              filter === f.key
                ? 'bg-cactus-600 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200',
            )}>
            {f.label} <span className="opacity-70">({counts[f.key]})</span>
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="px-5 py-3 bg-red-50 dark:bg-red-950 text-sm text-red-600 dark:text-red-400 flex items-center justify-between border-b border-red-100 dark:border-red-900">
          ⚠️ {error}
          <button onClick={loadOrders} className="underline text-xs">Retry</button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {[1, 2].map(i => (
            <div key={i} className="flex items-center gap-4 px-5 py-5">
              <div className="flex-1 space-y-2">
                <div className="h-4 w-48 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
                <div className="h-3 w-32 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
              </div>
              <div className="h-8 w-24 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
            </div>
          ))}
        </div>
      )}

      {/* Empty */}
      {!loading && !error && filtered.length === 0 && (
        <div className="py-16 text-center">
          <p className="text-4xl mb-3">📦</p>
          <p className="font-medium text-gray-500 dark:text-gray-400">No orders here</p>
          <p className="text-sm text-gray-400 mt-1">
            {filter === 'ready' ? 'Every verified order has been picked up for dispatch.' : 'Try another filter or search.'}
          </p>
        </div>
      )}

      {/* Orders */}
      {!loading && paged.map(o => {
        const isExpanded = expanded === o.id;
        const canEdit    = o.paymentStatus === 'paid' && o.trackingStatus !== 'cancelled';
        return (
          <div key={o.id} className="border-b border-gray-100 dark:border-gray-800 last:border-0">
            {/* Row */}
            <div className="flex items-center gap-4 px-4 sm:px-5 py-4 flex-wrap">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="font-mono text-sm font-semibold text-gray-900 dark:text-white">{orderNumber(o.id)}</span>
                  <StatusBadge status={o.trackingStatus} />
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                  {o.firstName} {o.lastName}
                  <span className="text-gray-300 dark:text-gray-600 mx-1">·</span>
                  {o.city}, {o.state}
                </p>
                <div className="flex items-center gap-4 mt-1 flex-wrap">
                  <span className="text-sm font-semibold text-cactus-700 dark:text-cactus-400">₹{o.total.toFixed(2)}</span>
                  <span className="text-xs text-gray-400">{new Date(o.createdAt).toLocaleString()}</span>
                  {o.shipment?.trackingNumber && (
                    <span className="text-xs font-mono bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded text-gray-600 dark:text-gray-400">
                      {o.shipment.courierName}: {o.shipment.trackingNumber}
                    </span>
                  )}
                </div>
              </div>
              <button onClick={() => toggleExpand(o)}
                className={cn(
                  'px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors flex-shrink-0',
                  canEdit && !isExpanded
                    ? 'bg-cactus-600 hover:bg-cactus-700 text-white'
                    : 'border border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800',
                )}>
                {isExpanded ? 'Hide ▲' : canEdit ? (o.shipment ? 'Update ▼' : 'Dispatch ▼') : 'View ▼'}
              </button>
            </div>

            {/* Expanded */}
            {isExpanded && form && (
              <div className="px-4 sm:px-5 pb-5 bg-gray-50 dark:bg-gray-800/40 border-t border-gray-100 dark:border-gray-800">
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 pt-4">

                  {/* Shipment form / read-only state */}
                  <div className="lg:col-span-3 flex flex-col gap-3">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Shipment</p>

                    {o.paymentStatus !== 'paid' && (
                      <div className="p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-700 dark:text-amber-300">
                        {o.paymentStatus === 'rejected'
                          ? 'Payment was rejected — this order will not be shipped.'
                          : 'Shipment details can be added once the payment is verified.'}
                      </div>
                    )}

                    {o.trackingStatus === 'cancelled' && (
                      <div className="p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300">
                        This order is cancelled and can no longer be updated.
                        {o.shipment?.trackingNumber && <> Last tracking: {o.shipment.courierName} {o.shipment.trackingNumber}, dispatched {formatDateOnly(o.shipment.dispatchDate)}.</>}
                      </div>
                    )}

                    {canEdit && (
                      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Field label="Shipment Status" required>
                          <select value={form.status} onChange={e => setField('status', e.target.value as ShipmentStatus)} className={inputCls()}>
                            {SHIPMENT_STATUS_OPTIONS
                              .filter(s => !(o.trackingStatus === 'delivered' && s.value === 'cancelled'))
                              .map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                          </select>
                        </Field>
                        <Field label="Courier Service" required={SHIPPED_STATUSES.includes(form.status)} error={errors.courier}>
                          <select value={form.courier} onChange={e => setField('courier', e.target.value)} className={inputCls(errors.courier)}>
                            <option value="">Select courier…</option>
                            {COURIER_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                          </select>
                        </Field>
                        {form.courier === 'other' && (
                          <Field label="Courier Name" required error={errors.courierName}>
                            <input value={form.courierName} maxLength={100} onChange={e => setField('courierName', e.target.value)}
                              placeholder="e.g. Professional Couriers" className={inputCls(errors.courierName)} />
                          </Field>
                        )}
                        <Field label="Tracking / AWB Number" required={SHIPPED_STATUSES.includes(form.status)} error={errors.trackingNumber}>
                          <input value={form.trackingNumber} maxLength={40} onChange={e => setField('trackingNumber', e.target.value)}
                            placeholder="e.g. D12345678" className={cn(inputCls(errors.trackingNumber), 'font-mono uppercase')} />
                        </Field>
                        <Field label="Dispatch Date" required={SHIPPED_STATUSES.includes(form.status)} error={errors.dispatchDate}>
                          <input type="date" value={form.dispatchDate} onChange={e => setField('dispatchDate', e.target.value)}
                            className={inputCls(errors.dispatchDate)} />
                        </Field>
                        <Field label="Estimated Delivery" error={errors.estimatedDeliveryDate}>
                          <input type="date" value={form.estimatedDeliveryDate} min={form.dispatchDate || undefined}
                            onChange={e => setField('estimatedDeliveryDate', e.target.value)} className={inputCls(errors.estimatedDeliveryDate)} />
                        </Field>
                        <div className="sm:col-span-2">
                          <Field label="Tracking URL" error={errors.trackingUrl}>
                            <input type="url" value={form.trackingUrl} maxLength={500} onChange={e => setField('trackingUrl', e.target.value)}
                              placeholder="https://…" className={inputCls(errors.trackingUrl)} />
                          </Field>
                        </div>
                        <div className="sm:col-span-2">
                          <Field label="Note for status history (optional, visible to the customer)">
                            <input value={form.note} maxLength={500} onChange={e => setField('note', e.target.value)}
                              placeholder="e.g. Handed over to courier at Pune hub" className={inputCls()} />
                          </Field>
                        </div>
                        <div className="sm:col-span-2 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                          <button onClick={() => { setForm(formFromOrder(o)); setErrors({}); }} disabled={saving}
                            className="px-4 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50">
                            Reset
                          </button>
                          <button onClick={() => handleSave(o)} disabled={saving}
                            className={cn(
                              'px-5 py-2 text-sm font-semibold text-white rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2',
                              form.status === 'cancelled' ? 'bg-red-600 hover:bg-red-700' : 'bg-cactus-600 hover:bg-cactus-700',
                            )}>
                            {saving && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                            {form.status === 'cancelled' ? 'Cancel Order' : 'Save Shipment'}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Ship-to + items */}
                    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-xs text-gray-400 mb-1">Ship To</p>
                        <p className="text-gray-700 dark:text-gray-300 leading-relaxed break-words">
                          {o.firstName} {o.lastName}<br />
                          {o.addressLine1}{o.addressLine2 && <>, {o.addressLine2}</>}<br />
                          {o.city}, {o.state} {o.zip}, {o.country}<br />
                          <span className="text-gray-400">{o.phone ?? o.email}</span>
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 mb-1">Items</p>
                        {(o.items ?? []).map((item, i) => (
                          <p key={i} className="text-gray-700 dark:text-gray-300">{item.quantity} × {item.name}</p>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* History */}
                  <div className="lg:col-span-2 flex flex-col gap-3">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Status History</p>
                    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
                      {history[o.id]
                        ? <StatusTimeline history={history[o.id]} />
                        : <div className="h-16 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {!loading && filtered.length > 0 && (
        <div className="px-5 pb-5">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalCount={filtered.length}
            pageSize={PAGE_SIZE}
            onPageChange={p => { setPage(p); setExpanded(null); }}
            itemLabel="orders"
          />
        </div>
      )}
    </div>
  );
}
