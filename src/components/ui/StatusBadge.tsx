import { cn } from '../../utils/cn';

// Order and payment statuses share one set of pill styles
const STATUS_STYLES: Record<string, { label: string; cls: string }> = {
  pending_verification: { label: 'Pending Verification', cls: 'bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800' },
  paid:                 { label: 'Paid',                 cls: 'bg-cactus-100 dark:bg-cactus-900 text-cactus-700 dark:text-cactus-300 border-cactus-200 dark:border-cactus-800' },
  rejected:             { label: 'Rejected',             cls: 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800' },
  confirmed:            { label: 'Confirmed',            cls: 'bg-cactus-100 dark:bg-cactus-900 text-cactus-700 dark:text-cactus-300 border-cactus-200 dark:border-cactus-800' },
  payment_failed:       { label: 'Payment Failed',       cls: 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800' },
  pending:              { label: 'Pending',              cls: 'bg-gray-100 dark:bg-gray-800 text-gray-500 border-gray-200 dark:border-gray-700' },
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  // Unknown statuses keep the neutral style but show their own name
  const c = STATUS_STYLES[status] ?? { ...STATUS_STYLES.pending, label: status.replace(/_/g, ' ') };
  return (
    <span className={cn('inline-block text-[11px] font-semibold px-2.5 py-1 rounded-full border capitalize', c.cls, className)}>
      {c.label}
    </span>
  );
}
