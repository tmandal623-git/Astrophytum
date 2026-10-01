// src/components/cactus/CactusFilters.tsx
import { useCategories } from '../../hooks/useCategories';
import { cn } from '../../utils/cn';

interface CactusFiltersProps {
  selectedCategoryId?: number;
  onCategoryChange:    (id?: number) => void;
  search:              string;
  onSearchChange:      (value: string) => void;
}

export function CactusFilters({
  selectedCategoryId,
  onCategoryChange,
  search,
  onSearchChange,
}: CactusFiltersProps) {
  const { categories, loading } = useCategories();

  return (
    <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">

      {/* ── Search input ─────────────────────────────── */}
      <div className="relative w-full sm:w-auto">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search cacti…"
          className="pl-9 pr-4 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-cactus-500 w-full sm:w-48 transition-all duration-200 focus:w-full sm:focus:w-64"
        />
        {search && (
          <button
            onClick={() => onSearchChange('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
            aria-label="Clear search"
          >
            ✕
          </button>
        )}
      </div>

      {/* ── Category pills ────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* All pill */}
        <CategoryPill
          label="All"
          active={selectedCategoryId === undefined}
          onClick={() => onCategoryChange(undefined)}
        />

        {/* Loading skeleton pills */}
        {loading && !categories.length && (
          <>
            {[80, 64, 72, 88].map((w) => (
              <div
                key={w}
                className="h-8 rounded-full bg-gray-100 dark:bg-gray-800 animate-pulse"
                style={{ width: w }}
              />
            ))}
          </>
        )}

        {/* Real category pills */}
        {categories.map((cat) => (
          <CategoryPill
            key={cat.id}
            label={cat.name}
            active={selectedCategoryId === cat.id}
            onClick={() => onCategoryChange(cat.id)}
          />
        ))}
      </div>
    </div>
  );
}

function CategoryPill({
  label,
  active,
  onClick,
}: {
  label:   string;
  active:  boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-4 py-1.5 rounded-full text-sm font-medium border transition-all duration-200 whitespace-nowrap',
        active
          ? 'bg-cactus-600 border-cactus-600 text-white shadow-sm'
          : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-cactus-400 dark:hover:border-cactus-600 hover:text-cactus-700 dark:hover:text-cactus-400',
      )}
    >
      {label}
    </button>
  );
}
