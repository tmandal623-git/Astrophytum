// src/components/ui/LoadingSkeleton.tsx
// ─────────────────────────────────────────────────────────────
// Collection of skeleton loaders for every major content block.
// All use Tailwind's animate-pulse. Import only what you need.
// ─────────────────────────────────────────────────────────────

// ── Base pulse block ──────────────────────────────────────────
function Pulse({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-gray-100 dark:bg-gray-800 rounded animate-pulse ${className}`} />
  );
}

// ─────────────────────────────────────────────────────────────
// CACTUS CARD skeleton  (used on HomePage grid)
// ─────────────────────────────────────────────────────────────
export function CactusCardSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
      {/* Image area */}
      <Pulse className="h-48 rounded-none" />

      <div className="p-4 space-y-3">
        {/* Category label */}
        <Pulse className="h-2.5 w-16" />
        {/* Name */}
        <Pulse className="h-5 w-3/4" />
        {/* Description lines */}
        <Pulse className="h-3 w-full" />
        <Pulse className="h-3 w-2/3" />

        {/* Price + button row */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-800">
          <Pulse className="h-6 w-16" />
          <Pulse className="h-8 w-20 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

/** Grid of card skeletons — drop-in replacement while fetching cactus list */
export function SkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {Array.from({ length: count }).map((_, i) => (
        <CactusCardSkeleton key={i} />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// CATEGORY CARD skeleton  (used on CategoriesPage)
// ─────────────────────────────────────────────────────────────
export function CategoryCardSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-6 space-y-3">
      <Pulse className="h-12 w-12 rounded-xl" />
      <Pulse className="h-5 w-32" />
      <Pulse className="h-3 w-full" />
      <Pulse className="h-3 w-3/4" />
      <Pulse className="h-3 w-20" />
    </div>
  );
}

export function SkeletonCategoryGrid({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
      {Array.from({ length: count }).map((_, i) => (
        <CategoryCardSkeleton key={i} />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// AUCTION CARD skeleton  (used on AuctionsPage)
// ─────────────────────────────────────────────────────────────
export function AuctionCardSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-5 flex gap-4">
      {/* Emoji / thumbnail */}
      <Pulse className="w-20 h-20 rounded-xl flex-shrink-0" />

      <div className="flex-1 space-y-2.5">
        <Pulse className="h-3 w-24" />
        <Pulse className="h-5 w-40" />
        <Pulse className="h-6 w-28" />
        <Pulse className="h-3 w-20" />
        <div className="flex gap-2 pt-1">
          <Pulse className="h-8 flex-1 rounded-lg" />
          <Pulse className="h-8 w-24 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

export function SkeletonAuctionGrid({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {Array.from({ length: count }).map((_, i) => (
        <AuctionCardSkeleton key={i} />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// DETAIL PAGE skeleton  (used on CactusDetailPage)
// ─────────────────────────────────────────────────────────────
export function CactusDetailSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Left — gallery */}
      <div className="space-y-3">
        <Pulse className="w-full aspect-[4/3] rounded-xl" />
        <div className="grid grid-cols-4 gap-2">
          {[0, 1, 2, 3].map((i) => (
            <Pulse key={i} className="aspect-square rounded-lg" />
          ))}
        </div>
        <Pulse className="h-14 w-full rounded-xl" />
      </div>

      {/* Right — info */}
      <div className="space-y-4">
        <div className="flex gap-2">
          <Pulse className="h-6 w-20 rounded-full" />
          <Pulse className="h-6 w-12 rounded-full" />
        </div>
        <Pulse className="h-9 w-3/4" />
        <Pulse className="h-3 w-full" />
        <Pulse className="h-3 w-5/6" />
        <Pulse className="h-3 w-4/5" />
        <Pulse className="h-8 w-32" />

        {/* Auction panel placeholder */}
        <div className="border border-gray-100 dark:border-gray-800 rounded-xl p-5 space-y-4 mt-2">
          <Pulse className="h-3 w-24" />
          <div className="grid grid-cols-2 gap-3">
            <Pulse className="h-16 rounded-lg" />
            <Pulse className="h-16 rounded-lg" />
          </div>
          <Pulse className="h-10 w-full rounded-xl" />
          <Pulse className="h-12 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// TABLE ROW skeleton  (used on AdminPage / MyBidsPage)
// ─────────────────────────────────────────────────────────────
export function TableRowSkeleton({ cols = 5 }: { cols?: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <Pulse className={`h-4 ${i === 0 ? 'w-40' : i === cols - 1 ? 'w-20' : 'w-24'}`} />
        </td>
      ))}
    </tr>
  );
}

export function SkeletonTable({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <TableRowSkeleton key={i} cols={cols} />
      ))}
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// STAT CARD skeleton  (used on AdminPage)
// ─────────────────────────────────────────────────────────────
export function StatCardSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <Pulse className="h-3 w-24" />
        <Pulse className="h-6 w-6 rounded-md" />
      </div>
      <Pulse className="h-9 w-16" />
      <Pulse className="h-2.5 w-28" />
    </div>
  );
}

export function SkeletonStatGrid({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <StatCardSkeleton key={i} />
      ))}
    </div>
  );
}
