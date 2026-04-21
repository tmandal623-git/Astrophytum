import { useState } from 'react';
import { CactusCard } from '../components/cactus/CactusCard';
import { CactusFilters } from '../components/cactus/CactusFilters';
import { EmptyState } from '../components/ui/EmptyState';
import { Pagination } from '../components/ui/Pagination';
import { SkeletonGrid } from '../components/ui/LoadingSkeleton';
import { useCacti } from '../hooks/useCacti';

export function HomePage() {
  const [page,       setPage]       = useState(1);
  const [categoryId, setCategoryId] = useState<number | undefined>();
  const { data, loading, error } = useCacti(page, 12, categoryId);

  const handleCategoryChange = (id?: number) => {
    setCategoryId(id);
    setPage(1);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-display text-2xl">Our Collection</h2>
        <CactusFilters onCategoryChange={handleCategoryChange} selectedCategoryId={categoryId} />
      </div>

      {loading && <SkeletonGrid />}
      {error   && <div className="text-center text-red-500 py-10">{error}</div>}

      {!loading && !error && (
        <>
          {data?.items.length === 0
            ? <EmptyState icon="🏜️" title="No cacti found" description="Try a different category or check back soon." />
            : <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {data!.items.map((c) => <CactusCard key={c.id} cactus={c} />)}
              </div>
          }
          <Pagination
            currentPage={data?.page ?? 1}
            totalPages={data?.totalPages ?? 1}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
}