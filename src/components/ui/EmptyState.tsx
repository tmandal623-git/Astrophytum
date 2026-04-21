// src/components/ui/EmptyState.tsx
import { ReactNode } from 'react';
import { Button } from './Button';

interface Action {
  label:   string;
  onClick: () => void;
}

interface EmptyStateProps {
  /** Large emoji or icon rendered above the title */
  icon:        ReactNode;
  title:       string;
  description: string;
  /** Optional primary CTA button */
  action?:     Action;
  /** Optional secondary CTA (e.g. "Clear filters") */
  secondaryAction?: Action;
  /** Extra Tailwind classes for the wrapper */
  className?:  string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  className = '',
}: EmptyStateProps) {
  return (
    <div
      className={`
        flex flex-col items-center justify-center
        py-16 px-6 text-center
        ${className}
      `}
    >
      {/* Icon */}
      <div className="text-5xl mb-4 opacity-40 select-none">{icon}</div>

      {/* Title */}
      <h3 className="font-display text-xl text-gray-700 dark:text-gray-300 mb-2">
        {title}
      </h3>

      {/* Description */}
      <p className="text-sm text-gray-400 dark:text-gray-500 max-w-xs leading-relaxed mb-6">
        {description}
      </p>

      {/* Actions */}
      {(action || secondaryAction) && (
        <div className="flex items-center gap-3 flex-wrap justify-center">
          {action && (
            <Button onClick={action.onClick}>
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button variant="secondary" onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Preset variants for common scenarios ──────────────────────

export function NoResultsEmpty({ onClear }: { onClear?: () => void }) {
  return (
    <EmptyState
      icon="🔍"
      title="No results found"
      description="Try adjusting your search or filter to find what you're looking for."
      action={onClear ? { label: 'Clear filters', onClick: onClear } : undefined}
    />
  );
}

export function NoAuctionsEmpty({ onBrowse }: { onBrowse: () => void }) {
  return (
    <EmptyState
      icon="🔨"
      title="No live auctions"
      description="There are no active auctions right now. Check back soon or browse the full collection."
      action={{ label: 'Browse Collection', onClick: onBrowse }}
    />
  );
}

export function NoBidsEmpty({ onBrowse }: { onBrowse: () => void }) {
  return (
    <EmptyState
      icon="📋"
      title="No bids yet"
      description="You haven't placed any bids. Find a cactus you love and jump in!"
      action={{ label: 'Browse Auctions', onClick: onBrowse }}
    />
  );
}

export function NetworkErrorEmpty({ onRetry }: { onRetry: () => void }) {
  return (
    <EmptyState
      icon="📡"
      title="Couldn't load data"
      description="There was a problem connecting to the server. Please check your connection and try again."
      action={{ label: 'Try again', onClick: onRetry }}
    />
  );
}
