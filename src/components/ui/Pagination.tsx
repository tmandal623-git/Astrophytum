// src/components/ui/Pagination.tsx
import { cn } from '../../utils/cn';

interface PaginationProps {
  currentPage:  number;
  totalPages:   number;
  totalCount:   number;
  pageSize:     number;
  onPageChange: (page: number) => void;
  itemLabel?:   string;
}

export function Pagination({
  currentPage,
  totalPages,
  totalCount,
  pageSize,
  onPageChange,
  itemLabel = 'cacti',
}: PaginationProps) {
  if (totalPages <= 1) return null;

  // Build visible page numbers with ellipsis
  const getPages = (): (number | '…')[] => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages: (number | '…')[] = [1];
    if (currentPage > 3)  pages.push('…');
    for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
      pages.push(i);
    }
    if (currentPage < totalPages - 2) pages.push('…');
    pages.push(totalPages);
    return pages;
  };

  const from = (currentPage - 1) * pageSize + 1;
  const to   = Math.min(currentPage * pageSize, totalCount);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-8 pt-6 border-t border-gray-100 dark:border-gray-800">

      {/* Record count */}
      <p className="text-sm text-gray-400 dark:text-gray-500 order-2 sm:order-1">
        Showing <span className="font-medium text-gray-600 dark:text-gray-300">{from}–{to}</span> of{' '}
        <span className="font-medium text-gray-600 dark:text-gray-300">{totalCount}</span> {itemLabel}
      </p>

      {/* Page buttons */}
      <div className="flex items-center gap-1 order-1 sm:order-2">
        {/* Prev */}
        <PageBtn
          label="←"
          disabled={currentPage === 1}
          onClick={() => onPageChange(currentPage - 1)}
          title="Previous page"
        />

        {getPages().map((p, i) =>
          p === '…' ? (
            <span key={`ellipsis-${i}`} className="w-9 text-center text-gray-400 select-none">…</span>
          ) : (
            <PageBtn
              key={p}
              label={String(p)}
              active={p === currentPage}
              onClick={() => onPageChange(p as number)}
            />
          ),
        )}

        {/* Next */}
        <PageBtn
          label="→"
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          title="Next page"
        />
      </div>
    </div>
  );
}

function PageBtn({
  label,
  active    = false,
  disabled  = false,
  onClick,
  title,
}: {
  label:     string;
  active?:   boolean;
  disabled?: boolean;
  onClick:   () => void;
  title?:    string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        'w-9 h-9 flex items-center justify-center rounded-lg text-sm font-medium border transition-all duration-150',
        active
          ? 'bg-cactus-600 border-cactus-600 text-white shadow-sm'
          : disabled
          ? 'border-gray-200 dark:border-gray-700 text-gray-300 dark:text-gray-600 cursor-not-allowed bg-transparent'
          : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-900 hover:border-cactus-400 hover:text-cactus-600 dark:hover:text-cactus-400',
      )}
    >
      {label}
    </button>
  );
}
