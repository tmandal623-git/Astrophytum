// src/components/admin/PaymentVerificationSection.tsx
// Drop this into AdminPage.tsx as a section below the Inventory table.
// Import: import { PaymentVerificationSection } from '../components/admin/PaymentVerificationSection';

import { useCallback, useEffect, useState } from 'react';
import { cn } from '../../utils/cn';
import { StatusBadge } from '../ui/StatusBadge';

// ── Types ─────────────────────────────────────────────────────
interface PendingOrderItem {
  name:      string;
  quantity:  number;
  unitPrice: number;
}

interface PendingOrder {
  id:            number;
  userId:        string;
  username:      string;
  email:         string;
  total:         number;
  paymentMethod: string;
  transactionId: string | null;
  paymentStatus: string;
  orderStatus:   string;
  createdAt:     string;
  firstName:     string;
  lastName:      string;
  phone:         string | null;
  city:          string;
  country:       string;
  items:         PendingOrderItem[] | null;
}

interface AuditEntry {
  id:            number;
  action:        string;
  note:          string | null;
  createdAt:     string;
  adminUsername: string;
}

// ── Main component ────────────────────────────────────────────
export function PaymentVerificationSection() {
  const [orders,    setOrders]    = useState<PendingOrder[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');
  const [expanded,  setExpanded]  = useState<number | null>(null);
  const [auditLog,  setAuditLog]  = useState<Record<number, AuditEntry[]>>({});
  const [notes,     setNotes]     = useState<Record<number, string>>({});
  const [acting,    setActing]    = useState<number | null>(null);
  const [processed, setProcessed] = useState<Set<number>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/pending-payments', { credentials: 'include' });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setOrders(Array.isArray(body) ? body : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load pending payments');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const loadAudit = async (orderId: number) => {
    try {
      const res  = await fetch(`/api/admin/payment-audit/${orderId}`, { credentials: 'include' });
      const body = await res.json();
      if (res.ok) setAuditLog(prev => ({ ...prev, [orderId]: body }));
    } catch { /* non-fatal */ }
  };

  const toggleExpand = (orderId: number) => {
    if (expanded === orderId) { setExpanded(null); return; }
    setExpanded(orderId);
    loadAudit(orderId);
  };

  const handleVerify = async (orderId: number, action: 'approved' | 'rejected') => {
    const note = notes[orderId]?.trim();
    if (action === 'rejected' && !note) {
      alert('Please enter a reason for rejection before proceeding.');
      return;
    }

    if (!window.confirm(
      action === 'approved'
        ? `Approve payment for order #${orderId}? This will confirm the order.`
        : `Reject payment for order #${orderId}? This will mark the order as Payment Failed.`,
    )) return;

    setActing(orderId);
    try {
      const res = await fetch('/api/admin/verify-payment', {
        method:      'POST',
        credentials: 'include',
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify({ orderId, action, note }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);

      setProcessed(prev => new Set([...prev, orderId]));
      // Remove from pending list after short delay
      setTimeout(() => {
        setOrders(prev => prev.filter(o => o.id !== orderId));
        setProcessed(prev => { const s = new Set(prev); s.delete(orderId); return s; });
      }, 2000);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setActing(null);
    }
  };

  const pendingCount = orders.length;

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-5 py-4 border-b border-gray-100 dark:border-gray-800 bg-amber-50 dark:bg-amber-950/30">
        <div className="flex items-center gap-3">
          <span className="text-xl">🔍</span>
          <div>
            <h2 className="font-display text-xl text-gray-900 dark:text-white">Payment Verification</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Manually verify Google Pay / UPI transactions
            </p>
          </div>
          {pendingCount > 0 && (
            <span className="bg-amber-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">
              {pendingCount} pending
            </span>
          )}
        </div>
        <button onClick={load} className="px-3 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-lg text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
          ↺ Refresh
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="px-5 py-3 bg-red-50 dark:bg-red-950 text-sm text-red-600 dark:text-red-400 flex items-center justify-between">
          ⚠️ {error}
          <button onClick={load} className="underline text-xs">Retry</button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {[1,2].map(i => (
            <div key={i} className="flex items-center gap-4 px-5 py-5">
              <div className="flex-1 space-y-2">
                <div className="h-4 w-48 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
                <div className="h-3 w-32 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
              </div>
              <div className="h-8 w-20 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
            </div>
          ))}
        </div>
      )}

      {/* Empty */}
      {!loading && orders.length === 0 && (
        <div className="py-16 text-center">
          <p className="text-4xl mb-3">✅</p>
          <p className="font-medium text-gray-500 dark:text-gray-400">No pending payments</p>
          <p className="text-sm text-gray-400 mt-1">All Google Pay orders have been verified.</p>
        </div>
      )}

      {/* Order list */}
      {!loading && orders.map(order => {
        const isExpanded   = expanded === order.id;
        const isDone       = processed.has(order.id);

        return (
          <div key={order.id} className={cn(
            'border-b border-gray-100 dark:border-gray-800 last:border-0 transition-all',
            isDone && 'opacity-50',
          )}>
            {/* ── Order row ── */}
            <div className="flex flex-wrap items-center gap-4 px-4 sm:px-5 py-4">
              {/* Left: order info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="font-mono text-sm font-semibold text-gray-900 dark:text-white">
                    CM-{String(order.id).padStart(6,'0')}
                  </span>
                  <StatusBadge status={order.paymentStatus} />
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {order.firstName} {order.lastName}
                  <span className="text-gray-400 mx-1">·</span>
                  <span className="text-gray-400 break-all">{order.email}</span>
                </p>
                <div className="flex items-center gap-4 mt-1 flex-wrap">
                  <span className="text-sm font-semibold text-cactus-700 dark:text-cactus-400">
                    ₹{order.total.toFixed(2)}
                  </span>
                  <span className="text-xs text-gray-400">
                    {new Date(order.createdAt).toLocaleString()}
                  </span>
                  {order.transactionId && (
                    <span className="text-xs font-mono bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded text-gray-600 dark:text-gray-400">
                      UTR: {order.transactionId}
                    </span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={() => toggleExpand(order.id)}
                  className="px-3 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-lg text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                  {isExpanded ? 'Hide ▲' : 'Details ▼'}
                </button>
                <button
                  onClick={() => handleVerify(order.id, 'approved')}
                  disabled={!!acting || isDone}
                  className="px-4 py-1.5 text-xs font-semibold bg-cactus-600 hover:bg-cactus-700 disabled:opacity-50 text-white rounded-lg transition-colors flex items-center gap-1.5"
                >
                  {acting === order.id ? <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> : '✓'}
                  Approve
                </button>
                <button
                  onClick={() => handleVerify(order.id, 'rejected')}
                  disabled={!!acting || isDone}
                  className="px-4 py-1.5 text-xs font-semibold bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg transition-colors flex items-center gap-1.5"
                >
                  ✕ Reject
                </button>
              </div>
            </div>

            {/* ── Expanded details ── */}
            {isExpanded && (
              <div className="px-5 pb-5 bg-gray-50 dark:bg-gray-800/40 border-t border-gray-100 dark:border-gray-800">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-4">

                  {/* Customer + payment details */}
                  <div className="flex flex-col gap-3">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Customer Details</p>
                    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 flex flex-col gap-2 text-sm">
                      <Detail label="Name"    value={`${order.firstName} ${order.lastName}`} />
                      <Detail label="Email"   value={order.email} />
                      <Detail label="Phone"   value={order.phone ?? '—'} />
                      <Detail label="City"    value={`${order.city}, ${order.country}`} />
                    </div>

                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Payment Details</p>
                    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 flex flex-col gap-2 text-sm">
                      <Detail label="Method"         value="Google Pay / UPI" />
                      <Detail label="Amount"         value={`₹${order.total.toFixed(2)}`} />
                      <Detail label="Transaction ID" value={order.transactionId ?? '⚠️ Not provided'} mono />
                      <Detail label="Status"         value={<StatusBadge status={order.paymentStatus} />} />
                    </div>
                  </div>

                  {/* Items + rejection note */}
                  <div className="flex flex-col gap-3">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Order Items</p>
                    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 flex flex-col gap-2">
                      {(order.items ?? []).map((item, i) => (
                        <div key={i} className="flex items-center justify-between text-sm">
                          <span className="text-gray-700 dark:text-gray-300">
                            {item.name} <span className="text-gray-400">×{item.quantity}</span>
                          </span>
                          <span className="font-medium text-gray-900 dark:text-white">
                            ₹{(item.quantity * item.unitPrice).toFixed(2)}
                          </span>
                        </div>
                      ))}
                      {(!order.items || order.items.length === 0) && (
                        <p className="text-sm text-gray-400">No items found</p>
                      )}
                    </div>

                    {/* Rejection note input */}
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                        Rejection Reason <span className="text-gray-300 normal-case font-normal">(required if rejecting)</span>
                      </p>
                      <textarea
                        rows={2}
                        placeholder="e.g. Transaction ID not found in bank records, amount mismatch…"
                        value={notes[order.id] ?? ''}
                        onChange={e => setNotes(prev => ({ ...prev, [order.id]: e.target.value }))}
                        className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-cactus-500 resize-none"
                      />
                    </div>

                    {/* Audit log */}
                    {auditLog[order.id] && auditLog[order.id].length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Audit Log</p>
                        <div className="flex flex-col gap-1.5">
                          {auditLog[order.id].map(entry => (
                            <div key={entry.id} className="flex items-start gap-2 text-xs">
                              <span className={cn('font-bold mt-0.5',
                                entry.action==='approved' ? 'text-cactus-600 dark:text-cactus-400' : 'text-red-500')}>
                                {entry.action==='approved' ? '✓' : '✕'}
                              </span>
                              <span className="text-gray-500 dark:text-gray-400 capitalize font-medium">{entry.action}</span>
                              <span className="text-gray-400">by <span className="font-medium">{entry.adminUsername}</span></span>
                              <span className="text-gray-300 dark:text-gray-600">
                                {new Date(entry.createdAt).toLocaleString()}
                              </span>
                              {entry.note && <span className="text-gray-500">· {entry.note}</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Confirm actions */}
                {isDone && (
                  <div className="mt-4 p-3 bg-cactus-50 dark:bg-cactus-950 border border-cactus-100 dark:border-cactus-900 rounded-lg text-sm text-cactus-700 dark:text-cactus-300 font-medium text-center">
                    ✓ Action completed — removing from queue…
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Helper sub-component ──────────────────────────────────────
function Detail({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <span className="text-gray-400 dark:text-gray-500 flex-shrink-0">{label}</span>
      <span className={cn('text-gray-900 dark:text-white text-right', mono && 'font-mono text-xs bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded')}>
        {value}
      </span>
    </div>
  );
}