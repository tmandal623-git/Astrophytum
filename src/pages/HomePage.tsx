// src/pages/HomePage.tsx
// Clean browse page — cards show image, name, description only.
// Price / Add to Cart / Buy Now all live on the detail page.
// Categories page removed — filter pills still work inline.

import { useCallback, useState } from 'react';
import { useNavigate }           from 'react-router-dom';
import { useCacti }              from '../hooks/useCacti';
import { useCart }               from '../context/CartContext';
import { CactusCard }            from '../components/cactus/CactusCard';
import { CactusFilters }         from '../components/cactus/CactusFilters';
import { Pagination }            from '../components/ui/Pagination';
import { SkeletonGrid }          from '../components/ui/LoadingSkeleton';
import { EmptyState, NetworkErrorEmpty } from '../components/ui/EmptyState';

const PAGE_SIZE = 8;

export function HomePage() {
  const navigate       = useNavigate();
  const { totalItems } = useCart();

  const [page,       setPage]       = useState(1);
  const [categoryId, setCategoryId] = useState<number | undefined>();
  const [search,     setSearch]     = useState('');

  const { data, loading, error, refetch } = useCacti({
    page,
    pageSize:   PAGE_SIZE,
    categoryId,
    search,
  });

  const handleCategoryChange = useCallback((id?: number) => {
    setCategoryId(id);
    setPage(1);
    setSearch('');
  }, []);

  const handleSearchChange = useCallback((val: string) => {
    setSearch(val);
    setPage(1);
  }, []);

  const handlePageChange = useCallback((p: number) => {
    setPage(p);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const liveCount = data?.items.filter((c) => c.hasAuction).length ?? 0;

  return (
    <div className="max-w-7xl mx-auto">

      {/* ── Page header ──────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-3xl text-gray-900 dark:text-white">
            Browse Cactus
          </h1>
          {data && !loading && (
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">
              {data.totalCount} {data.totalCount === 1 ? 'species' : 'species'} available
              {liveCount > 0 && (
                <span className="ml-2 text-red-500 font-medium">
                  · {liveCount} live auction{liveCount > 1 ? 's' : ''}
                </span>
              )}
            </p>
          )}
        </div>

        {/* Cart shortcut — only shown when cart has items */}
        {totalItems > 0 && (
          <button
            onClick={() => navigate('/my-cart')}
            className="relative flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 rounded-lg hover:border-cactus-400 hover:text-cactus-700 dark:hover:text-cactus-400 transition-colors self-start"
          >
            🛒 My Cart
            <span className="w-5 h-5 bg-cactus-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {totalItems > 9 ? '9+' : totalItems}
            </span>
          </button>
        )}
      </div>

      {/* ── Filters (search + category pills) ────────────── */}
      <div className="mb-6">
        <CactusFilters
          selectedCategoryId={categoryId}
          onCategoryChange={handleCategoryChange}
          search={search}
          onSearchChange={handleSearchChange}
        />
      </div>

      {/* ── Active filter chips ───────────────────────────── */}
      {(categoryId !== undefined || search) && !loading && data && (
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <span className="text-xs text-gray-400">Filtered:</span>
          {categoryId !== undefined && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-cactus-50 dark:bg-cactus-950 text-cactus-700 dark:text-cactus-300 text-xs font-medium rounded-full border border-cactus-100 dark:border-cactus-800">
              Category
              <button onClick={() => handleCategoryChange(undefined)} className="hover:text-red-500 transition-colors">✕</button>
            </span>
          )}
          {search && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-cactus-50 dark:bg-cactus-950 text-cactus-700 dark:text-cactus-300 text-xs font-medium rounded-full border border-cactus-100 dark:border-cactus-800">
              "{search}"
              <button onClick={() => handleSearchChange('')} className="hover:text-red-500 transition-colors">✕</button>
            </span>
          )}
          <span className="text-xs text-gray-400">
            — {data.totalCount} result{data.totalCount !== 1 ? 's' : ''}
          </span>
        </div>
      )}

      {/* ── States ───────────────────────────────────────── */}
      {error && !loading && <NetworkErrorEmpty onRetry={refetch} />}
      {loading && <SkeletonGrid count={PAGE_SIZE} />}

      {!loading && !error && data?.items.length === 0 && (
        <EmptyState
          icon="🏜️"
          title={search ? 'No results found' : 'No cacti in this category'}
          description={
            search
              ? `Nothing matched "${search}". Try a different search or clear the filter.`
              : 'Nothing here yet — check back soon!'
          }
          action={
            search || categoryId !== undefined
              ? { label: 'Clear filters', onClick: () => { setCategoryId(undefined); setSearch(''); setPage(1); } }
              : { label: 'Refresh', onClick: refetch }
          }
        />
      )}

      {/* ── Card grid ─────────────────────────────────────── */}
      {!loading && !error && data && data.items.length > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {data.items.map((cactus) => (
              <CactusCard key={cactus.id} cactus={cactus} />
            ))}
          </div>

          <Pagination
            currentPage={data.page}
            totalPages={data.totalPages}
            totalCount={data.totalCount}
            pageSize={PAGE_SIZE}
            onPageChange={handlePageChange}
          />
        </>
      )}

      {/* ── Floating cart bar ─────────────────────────────── */}
      {totalItems > 0 && (
        <div className="fixed bottom-4 sm:bottom-6 inset-x-0 px-4 flex justify-center z-40 pointer-events-none">
          <div className="pointer-events-auto max-w-full flex items-center gap-2 sm:gap-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-4 sm:px-5 py-3 rounded-2xl shadow-2xl border border-gray-800 dark:border-gray-200">
            <span className="text-lg hidden sm:inline">🛒</span>
            <span className="text-sm font-medium whitespace-nowrap">
              {totalItems} item{totalItems !== 1 ? 's' : ''} in cart
            </span>
            <button
              onClick={() => navigate('/my-cart')}
              className="ml-1 px-3 py-1.5 bg-cactus-600 hover:bg-cactus-700 text-white rounded-lg text-xs font-semibold transition-colors"
            >
              View Cart →
            </button>
            <button
              onClick={() => navigate('/checkout')}
              className="px-3 py-1.5 bg-white/10 dark:bg-gray-900/10 hover:bg-white/20 border border-white/20 dark:border-gray-900/20 text-white dark:text-gray-900 rounded-lg text-xs font-semibold transition-colors"
            >
              Checkout
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
