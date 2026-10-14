// Auction scheduling helpers. Times are stored as UTC instants (timestamptz) and
// shown in the viewer's own time zone.

// True while a scheduled auction hasn't opened for bidding yet
export function isAuctionScheduled(startsAt: string | null | undefined, now = Date.now()): boolean {
  return !!startsAt && new Date(startsAt).getTime() > now;
}

// "19 October at 11:00 AM" (year added when it isn't the current year); weekday optional
export function formatAuctionStart(iso: string, { weekday = false } = {}): string {
  const d       = new Date(iso);
  const sameYr  = d.getFullYear() === new Date().getFullYear();
  const date    = d.toLocaleDateString('en-GB', {
    ...(weekday ? { weekday: 'long' as const } : {}),
    day: 'numeric', month: 'long', ...(sameYr ? {} : { year: 'numeric' as const }),
  });
  const time    = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${date} at ${time}`;
}

// ISO instant → value for <input type="datetime-local"> in local time ("2026-10-19T11:00")
export function toDateTimeLocalValue(iso: string): string {
  const d   = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Re-render once when a scheduled start passes (setTimeout caps at ~24.8 days)
export const MAX_TIMER_MS = 2_147_483_647;
