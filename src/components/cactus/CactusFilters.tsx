import { useEffect, useState } from 'react';
import { categoryService } from '../../services/categoryService';
import { Category } from '../../types';
import { cn } from '../../utils/cn';

interface CactusFiltersProps {
  selectedCategoryId?: number;
  onCategoryChange:    (id?: number) => void;
}

export function CactusFilters({ selectedCategoryId, onCategoryChange }: CactusFiltersProps) {
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    categoryService.getAll().then(setCategories).catch(() => {});
  }, []);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* "All" pill */}
      <FilterPill
        label="All"
        active={selectedCategoryId === undefined}
        onClick={() => onCategoryChange(undefined)}
      />

      {categories.map((cat) => (
        <FilterPill
          key={cat.id}
          label={cat.name}
          active={selectedCategoryId === cat.id}
          onClick={() => onCategoryChange(cat.id)}
        />
      ))}
    </div>
  );
}

function FilterPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-4 py-1.5 rounded-full text-sm font-medium border transition-all duration-200',
        active
          ? 'bg-cactus-600 border-cactus-600 text-white shadow-sm'
          : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-cactus-400 hover:text-cactus-600 dark:hover:text-cactus-400',
      )}
    >
      {label}
    </button>
  );
}
