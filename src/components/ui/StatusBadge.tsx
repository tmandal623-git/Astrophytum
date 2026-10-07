import { cn } from '../../utils/cn';

// Order / payment status pill (payment_status and order_status values)
const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  pending_verification: { label: 'Pending Verification', cls: 'bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800' },
  paid:                 { label: 'Paid',                 cls: 'bg-cactus-100 dark:bg-cactus-900 text-cactus-700 dark:text-cactus-300 border-cactus-200 dark:border-cactus-800' },
  rejected:             { label: 'Rejected',             cls: 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800' },
  confirmed:            { label: 'Confirmed',            cls: 'bg-cactus-100 dark:bg-cactus-900 text-cactus-700 dark:text-cactus-300 border-cactus-200 dark:border-cactus-800' },
  payment_failed:       { label: 'Payment Failed',       cls: 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800' },
  pending:              { label: 'Pending',              cls: 'bg-gray-100 dark:bg-gray-800 text-gray-500 border-gray-200 dark:border-gray-700' },
  // Shipment / tracking statuses
  payment_pending:      { label: 'Payment Pending',      cls: 'bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800' },
  payment_verified:     { label: 'Payment Verified',     cls: 'bg-cactus-100 dark:bg-cactus-900 text-cactus-700 dark:text-cactus-300 border-cactus-200 dark:border-cactus-800' },
  processing:           { label: 'Processing',           cls: 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800' },
  dispatched:           { label: 'Dispatched',           cls: 'bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800' },
  in_transit:           { label: 'In Transit',           cls: 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800' },
  delivered:            { label: 'Delivered',            cls: 'bg-cactus-600 text-white border-cactus-600' },
  cancelled:            { label: 'Cancelled',            cls: 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800' },
};

export function StatusBadge({ status }: { status: string }) {
  const c = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  return (
    <span className={cn('inline-block text-[11px] font-semibold px-2.5 py-1 rounded-full border', c.cls)}>
      {c.label}
    </span>
  );
}
