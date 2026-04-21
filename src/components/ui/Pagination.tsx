import { Button } from './Button';

interface PaginationProps {
  currentPage: number;
  totalPages:  number;
  onPageChange: (page: number) => void;
}

export function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

  return (
    <div className="flex items-center justify-center gap-2 mt-8">
      <Button variant="ghost" size="sm" disabled={currentPage === 1} onClick={() => onPageChange(currentPage - 1)}>
        ‹
      </Button>
      {pages.map((p) => (
        <Button
          key={p}
          size="sm"
          variant={p === currentPage ? 'primary' : 'ghost'}
          onClick={() => onPageChange(p)}
        >
          {p}
        </Button>
      ))}
      <Button variant="ghost" size="sm" disabled={currentPage === totalPages} onClick={() => onPageChange(currentPage + 1)}>
        ›
      </Button>
    </div>
  );
}
