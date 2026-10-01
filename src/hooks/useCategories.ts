// src/hooks/useCategories.ts
import { useEffect, useState } from 'react';
import { categoryService } from '../services/categoryService';
import type { Category } from '../types';

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    categoryService
      .getAll()
      .then(setCategories)
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'Failed to load categories'),
      )
      .finally(() => setLoading(false));
  }, []);

  return { categories, loading, error };
}
