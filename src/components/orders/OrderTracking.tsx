// src/components/orders/OrderTracking.tsx
// Shipment progress, courier details and status history — shared by the
// customer Order Details page and the admin Shipments section.
import type { ReactNode } from 'react';
import { cn } from '../../utils/cn';
import { StatusBadge } from '../ui/StatusBadge';
import {
  Shipment, StatusHistoryEntry, TrackingStatus, TRACKING_STEPS, formatDateOnly,
} from '../../utils/orderTracking';

// ── Progress tracker ──────────────────────────────────────────
// Vertical on phones, horizontal from `sm` up.
export function TrackingProgress({ status }: { status: TrackingStatus }) {
  if (status === 'cancelled' || status === 'payment_failed') {
    return (
      <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
        <StatusBadge status={status} />
        <span>{status === 'cancelled' ? 'This order has been cancelled.' : 'Payment for this order was not verified.'}</span>
      </div>
    );
  }

  const current = TRACKING_STEPS.findIndex(s => s.status === status);

  return (
    <ol className="flex flex-col sm:flex-row sm:items-start gap-0 sm:gap-0">
      {TRACKING_STEPS.map((step, i) => {
        const done   = i <= current;
        const active = i === current;
        const last   = i === TRACKING_STEPS.length - 1;
        return (
          <li key={step.status} className="flex sm:flex-col sm:flex-1 items-start sm:items-center gap-3 sm:gap-2 relative">
            {/* Connector to the next step */}
            {!last && (
              <span
                aria-hidden
                className={cn(
                  'absolute left-[11px] top-6 h-[calc(100%-12px)] w-0.5 sm:left-1/2 sm:top-[11px] sm:h-0.5 sm:w-full',
                  i < current ? 'bg-cactus-500' : 'bg-gray-200 dark:bg-gray-700',
                )}
              />
            )}
            <span
              className={cn(
                'relative z-10 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 border-2',
                done
                  ? 'bg-cactus-600 border-cactus-600 text-white'
                  : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-400',
                active && 'ring-4 ring-cactus-100 dark:ring-cactus-900',
              )}
            >
              {done ? '✓' : i + 1}
            </span>
            <span
              className={cn(
                'text-xs pb-5 sm:pb-0 sm:text-center leading-tight',
                active ? 'font-semibold text-gray-900 dark:text-white'
                  : done ? 'text-gray-600 dark:text-gray-300' : 'text-gray-400',
              )}
            >
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

// ── Courier details ───────────────────────────────────────────
export function ShipmentDetails({ shipment }: { shipment: Shipment }) {
  const rows: { label: string; value: ReactNode }[] = [
    { label: 'Courier',            value: shipment.courierName ?? '—' },
    { label: 'Tracking / AWB No.', value: shipment.trackingNumber
        ? <span className="font-mono">{shipment.trackingNumber}</span> : '—' },
    { label: 'Dispatch Date',      value: formatDateOnly(shipment.dispatchDate) },
    { label: 'Estimated Delivery', value: formatDateOnly(shipment.estimatedDeliveryDate) },
  ];

  return (
    <div className="flex flex-col gap-3">
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
        {rows.map(({ label, value }) => (
          <div key={label} className="flex justify-between sm:flex-col sm:justify-start gap-2 sm:gap-0.5">
            <dt className="text-xs text-gray-400">{label}</dt>
            <dd className="text-gray-800 dark:text-gray-200 text-right sm:text-left break-all">{value}</dd>
          </div>
        ))}
      </dl>
      {shipment.trackingUrl && (
        <a
          href={shipment.trackingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="self-start inline-flex items-center gap-1.5 px-4 py-2 bg-cactus-600 hover:bg-cactus-700 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          🚚 Track Order
        </a>
      )}
    </div>
  );
}

// ── Status history ────────────────────────────────────────────
export function StatusTimeline({ history }: { history: StatusHistoryEntry[] }) {
  if (!history.length) return <p className="text-sm text-gray-400">No status updates yet.</p>;

  // Newest first
  const entries = [...history].reverse();
  return (
    <ol className="flex flex-col">
      {entries.map((entry, i) => (
        <li key={entry.id} className="flex gap-3">
          <div className="flex flex-col items-center">
            <span className={cn('w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0', i === 0 ? 'bg-cactus-500' : 'bg-gray-300 dark:bg-gray-600')} />
            {i < entries.length - 1 && <span className="w-0.5 flex-1 bg-gray-100 dark:bg-gray-800 my-1" />}
          </div>
          <div className="pb-4 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={entry.status} />
              <span className="text-xs text-gray-400">{new Date(entry.createdAt).toLocaleString()}</span>
            </div>
            {entry.note && <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 break-words">{entry.note}</p>}
            {entry.changedBy && <p className="text-[11px] text-gray-400 mt-0.5">by {entry.changedBy}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}
