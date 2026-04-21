import { BidHistory as BidHistoryType } from '../../types';
import { cn } from '../../utils/cn';

interface BidHistoryProps {
  bids:    BidHistoryType[];
  loading?: boolean;
}

/** Format an ISO timestamp to a relative string like "2 min ago" */
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60_000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs  < 24) return `${hrs} hr ago`;
  return `${Math.floor(hrs / 24)} day ago`;
}

/** Generate a deterministic 2-letter avatar and color from a username */
function avatarProps(username: string): { initials: string; colorClass: string } {
  const initials = username
    .split(/[\s._-]/)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .slice(0, 2)
    .join('');

  const colors = [
    'bg-violet-100 dark:bg-violet-900 text-violet-700 dark:text-violet-300',
    'bg-sky-100    dark:bg-sky-900    text-sky-700    dark:text-sky-300',
    'bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300',
    'bg-amber-100  dark:bg-amber-900  text-amber-700  dark:text-amber-300',
    'bg-rose-100   dark:bg-rose-900   text-rose-700   dark:text-rose-300',
  ];
  const colorClass = colors[username.charCodeAt(0) % colors.length];

  return { initials, colorClass };
}

export function BidHistory({ bids, loading }: BidHistoryProps) {
  return (
    <div className="mt-5 border-t border-gray-200 dark:border-gray-700 pt-5">
      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-3">
        Bid History
      </p>

      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 animate-pulse">
              <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-24 bg-gray-100 dark:bg-gray-800 rounded" />
                <div className="h-2 w-16 bg-gray-100 dark:bg-gray-800 rounded" />
              </div>
              <div className="h-4 w-14 bg-gray-100 dark:bg-gray-800 rounded" />
            </div>
          ))}
        </div>
      )}

      {!loading && bids.length === 0 && (
        <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">
          No bids yet — be the first!
        </p>
      )}

      {!loading && bids.length > 0 && (
        <ul className="divide-y divide-gray-100 dark:divide-gray-800">
          {bids.map((bid, index) => {
            const { initials, colorClass } = avatarProps(bid.username);
            const isHighest = index === 0;

            return (
              <li
                key={bid.id}
                className={cn(
                  'flex items-center gap-3 py-2.5',
                  isHighest && 'py-3',
                )}
              >
                {/* Avatar */}
                <div
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0',
                    colorClass,
                  )}
                >
                  {initials || '?'}
                </div>

                {/* Username + time */}
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    'text-sm font-medium text-gray-800 dark:text-gray-100 truncate',
                    isHighest && 'text-cactus-700 dark:text-cactus-400',
                  )}>
                    {bid.username}
                    {isHighest && (
                      <span className="ml-2 text-[10px] font-semibold bg-cactus-100 dark:bg-cactus-900 text-cactus-700 dark:text-cactus-300 px-1.5 py-0.5 rounded">
                        HIGHEST
                      </span>
                    )}
                  </p>
                  <p className="text-[11px] text-gray-400 dark:text-gray-500">
                    {timeAgo(bid.placedAt)}
                  </p>
                </div>

                {/* Amount */}
                <span className={cn(
                  'text-sm font-semibold flex-shrink-0',
                  isHighest ? 'text-red-500' : 'text-gray-700 dark:text-gray-300',
                )}>
                  ${bid.amount.toFixed(2)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
