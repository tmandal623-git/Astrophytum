// src/pages/CategoriesPage.tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { categoryService } from '../services/categoryService';
import { cactusService } from '../services/cactusService';
import { Category, CactusListItem } from '../types';
import { CactusCard } from '../components/cactus/CactusCard';
import { SkeletonCategoryGrid, SkeletonGrid } from '../components/ui/LoadingSkeleton';
import { EmptyState, NetworkErrorEmpty } from '../components/ui/EmptyState';
import { Badge } from '../components/ui/Badge';
import { cn } from '../utils/cn';

// ── Static metadata per category (icon + colour accent) ──────
const CATEGORY_META: Record<string, { icon: string; accent: string; bg: string; desc: string }> = {
  Indoor:    { icon: '🪴', accent: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-50  dark:bg-emerald-950',  desc: 'Low-light tolerant species perfect for windowsills, shelves, and office desks.' },
  Outdoor:   { icon: '🌵', accent: 'text-amber-700   dark:text-amber-400',   bg: 'bg-amber-50   dark:bg-amber-950',    desc: 'Hardy sun-lovers built for patios, gardens, and open landscapes.' },
  Rare:      { icon: '💎', accent: 'text-violet-700  dark:text-violet-400',  bg: 'bg-violet-50  dark:bg-violet-950',   desc: 'Collector-grade specimens with extraordinary forms — limited availability.' },
  Flowering: { icon: '🌸', accent: 'text-pink-700    dark:text-pink-400',    bg: 'bg-pink-50    dark:bg-pink-950',     desc: 'Spectacular bloomers that put on a show of colour at key points in the year.' },
};

const FALLBACK_META = { icon: '🌿', accent: 'text-cactus-700 dark:text-cactus-400', bg: 'bg-cactus-50 dark:bg-cactus-950', desc: 'A curated selection of remarkable cactus species.' };

// ── Component ─────────────────────────────────────────────────
export function CategoriesPage() {
  const navigate = useNavigate();

  const [categories,    setCategories]    = useState<Category[]>([]);
  const [catsLoading,   setCatsLoading]   = useState(true);
  const [catsError,     setCatsError]     = useState(false);

  const [selected,      setSelected]      = useState<Category | null>(null);
  const [cacti,         setCacti]         = useState<CactusListItem[]>([]);
  const [cactiLoading,  setCactiLoading]  = useState(false);
  const [cactiError,    setCactiError]    = useState(false);

  // ── Load categories ────────────────────────────────────────
  useEffect(() => {
    setCatsLoading(true);
    setCatsError(false);
    categoryService
      .getAll()
      .then((cats) => {
        setCategories(cats);
        if (cats.length > 0) setSelected(cats[0]); // auto-select first
      })
      .catch(() => setCatsError(true))
      .finally(() => setCatsLoading(false));
  }, []);

  // ── Load cacti whenever selected category changes ──────────
  useEffect(() => {
    if (!selected) return;
    setCactiLoading(true);
    setCactiError(false);
    cactusService
      .getAll(1, 50, selected.id)
      .then((paged) => setCacti(paged.items))
      .catch(() => setCactiError(true))
      .finally(() => setCactiLoading(false));
  }, [selected]);

  // ── Error state ────────────────────────────────────────────
  if (catsError) {
    return (
      <NetworkErrorEmpty onRetry={() => window.location.reload()} />
    );
  }

  return (
    <div className="max-w-6xl mx-auto">

      {/* Page heading */}
      <div className="mb-8">
        <h1 className="font-display text-3xl text-gray-900 dark:text-white mb-1">Categories</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Browse our collection by species type. Select a category to explore.
        </p>
      </div>

      {/* Category cards grid */}
      {catsLoading ? (
        <SkeletonCategoryGrid count={4} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
          {categories.map((cat) => {
            const meta    = CATEGORY_META[cat.name] ?? FALLBACK_META;
            const isActive = selected?.id === cat.id;

            return (
              <button
                key={cat.id}
                onClick={() => setSelected(cat)}
                className={cn(
                  'text-left rounded-xl border p-6 transition-all duration-200 group',
                  isActive
                    ? 'border-cactus-400 dark:border-cactus-600 bg-cactus-50 dark:bg-cactus-950 shadow-sm ring-2 ring-cactus-200 dark:ring-cactus-800'
                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-cactus-300 hover:shadow-sm',
                )}
              >
                {/* Icon */}
                <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center text-2xl mb-4', meta.bg)}>
                  {meta.icon}
                </div>

                {/* Name */}
                <h3 className={cn('font-display text-lg mb-1 transition-colors', isActive ? 'text-cactus-700 dark:text-cactus-300' : 'text-gray-900 dark:text-white')}>
                  {cat.name}
                </h3>

                {/* Description */}
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed mb-3 line-clamp-3">
                  {cat.description ?? meta.desc}
                </p>

                {/* Species count badge */}
                <span className={cn('text-[11px] font-semibold', meta.accent)}>
                  {isActive && !cactiLoading ? `${cacti.length} species` : 'View species →'}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Selected category section */}
      {selected && (
        <section>
          {/* Section header */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <span className="text-2xl">
                {(CATEGORY_META[selected.name] ?? FALLBACK_META).icon}
              </span>
              <div>
                <h2 className="font-display text-2xl text-gray-900 dark:text-white leading-tight">
                  {selected.name}
                </h2>
                {!cactiLoading && (
                  <p className="text-sm text-gray-400 dark:text-gray-500">
                    {cacti.length} {cacti.length === 1 ? 'species' : 'species'} available
                  </p>
                )}
              </div>
            </div>

            {/* Live auction indicator */}
            {!cactiLoading && cacti.some((c) => c.hasAuction) && (
              <Badge variant="danger" pulse>
                {cacti.filter((c) => c.hasAuction).length} live auction{cacti.filter((c) => c.hasAuction).length > 1 ? 's' : ''}
              </Badge>
            )}
          </div>

          {/* Divider */}
          <div className="border-t border-gray-100 dark:border-gray-800 mb-6" />

          {/* Cacti grid */}
          {cactiLoading ? (
            <SkeletonGrid count={3} />
          ) : cactiError ? (
            <NetworkErrorEmpty onRetry={() => setSelected({ ...selected })} />
          ) : cacti.length === 0 ? (
            <EmptyState
              icon={CATEGORY_META[selected.name]?.icon ?? '🌿'}
              title={`No ${selected.name.toLowerCase()} cacti yet`}
              description="This category is empty right now. New specimens are added regularly — check back soon!"
              action={{ label: 'Browse all categories', onClick: () => setSelected(categories[0] ?? null) }}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {cacti.map((c) => (
                <CactusCard key={c.id} cactus={c} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Empty categories state */}
      {!catsLoading && categories.length === 0 && (
        <EmptyState
          icon="🏷️"
          title="No categories found"
          description="Categories haven't been set up yet. Check back soon."
          action={{ label: 'Go home', onClick: () => navigate('/home') }}
        />
      )}
    </div>
  );
}
