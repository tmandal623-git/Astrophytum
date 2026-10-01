// src/hooks/useCacti.ts
// Fetches paginated cactus list from the real API.
// Replaces the old mock-based version entirely.

import { useCallback, useEffect, useRef, useState } from 'react';
import { cactusService } from '../services/cactusService';
import type { CactusListItem, PagedResult } from '../types';

interface UseCactiOptions {
  page:        number;
  pageSize?:   number;
  categoryId?: number;
  search?:     string;   // server-side search across the whole catalogue (debounced)
}

interface UseCactiResult {
  data:    PagedResult<CactusListItem> | null;
  loading: boolean;
  error:   string | null;
  refetch: () => void;
}

export function useCacti({
  page,
  pageSize   = 12,
  categoryId,
  search     = '',
}: UseCactiOptions): UseCactiResult {
  const [data,    setData]    = useState<PagedResult<CactusListItem> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  // Track the latest request so stale responses are ignored
  const reqId = useRef(0);

  // Debounce typing so we don't hit the API on every keystroke
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    reqId.current += 1;
    const thisReq = reqId.current;

    setLoading(true);
    setError(null);

    try {
      // Search runs in the DB so it covers every page and totalCount/totalPages stay correct
      const result = await cactusService.getAll(page, pageSize, categoryId, debouncedSearch);

      // Discard if a newer request has already fired
      if (thisReq !== reqId.current) return;

      setData(result);
    } catch (err) {
      if (thisReq !== reqId.current) return;
      setError(err instanceof Error ? err.message : 'Failed to load cacti.');
    } finally {
      if (thisReq === reqId.current) setLoading(false);
    }
  }, [page, pageSize, categoryId, debouncedSearch]);

  useEffect(() => { load(); }, [load]);

  return { data, loading, error, refetch: load };
}
