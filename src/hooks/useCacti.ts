import { useEffect, useState, useCallback } from 'react';
import { cactusService } from '../services/cactusService';
import type { CactusListItem, PagedResult } from '../types';

export function useCacti(page: number, pageSize: number, categoryId?: number) {
  const [data,    setData]    = useState<PagedResult<CactusListItem> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await cactusService.getAll(page, pageSize, categoryId);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load cacti.');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, categoryId]);

  useEffect(() => { load(); }, [load]);
  return { data, loading, error, refetch: load };
}
