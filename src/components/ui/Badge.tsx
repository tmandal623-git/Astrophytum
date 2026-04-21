import { ReactNode } from 'react';
import { cn } from '../../utils/cn';

type BadgeVariant = 'default' | 'gold' | 'danger' | 'success' | 'info' | 'outline';

interface BadgeProps {
  children:  ReactNode;
  variant?:  BadgeVariant;
  pulse?:    boolean;           // animated live-dot for "Live Bid"
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-gray-100  dark:bg-gray-800  text-gray-700  dark:text-gray-300',
  gold:    'bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200',
  danger:  'bg-red-600                     text-white',
  success: 'bg-cactus-100 dark:bg-cactus-900 text-cactus-800 dark:text-cactus-200',
  info:    'bg-blue-100  dark:bg-blue-900  text-blue-800  dark:text-blue-200',
  outline: 'bg-transparent border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400',
};

export function Badge({ children, variant = 'default', pulse = false, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide',
        variantClasses[variant],
        className,
      )}
    >
      {pulse && (
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
        </span>
      )}
      {children}
    </span>
  );
}
