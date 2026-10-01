import api from './api';
import type { CactusListItem, CactusDetail, PagedResult } from '../types';

export interface AdminStats {
  totalSpecies: number;
  liveAuctions: number;
  bidsToday: number;
  bidsTodayValue: number;
  registeredBidders: number;
}
export interface ChartDataPoint {
  day: string;
  value: number;
  pct: number;
}

export const cactusService = {



  // // 1. Fetch the list of cacti
  // async getAll(page = 1, pageSize = 10, categoryId): Promise<PagedResult<CactusDetail>> {
  //   const { data } = await api.get<PagedResult<CactusDetail>>('/cactus', {
  //     params: { page, limit: pageSize ,categoryId}
  //   });
  //   return data;
  // },

  // // 2. Create a new cactus
  // async create(formData: FormData): Promise<CactusDetail> {
  //   const { data } = await api.post<CactusDetail>('/cactus', formData, {
  //     headers: { 'Content-Type': 'multipart/form-data' }
  //   });
  //   return data;
  // },

  // // 3. Update existing cactus
  // async update(id: number, formData: FormData): Promise<CactusDetail> {
  //   const { data } = await api.put<CactusDetail>(`/cactus/${id}`, formData, {
  //     headers: { 'Content-Type': 'multipart/form-data' }
  //   });
  //   return data;
  // },

  // // 4. Delete a cactus
  // async delete(id: number): Promise<void> {
  //   await api.delete(`/cactus/${id}`);
  // },

  // // 5. Get admin stats (no separate service needed!)
  // async getStats(): Promise<AdminStats> {
  //   const { data } = await api.get<AdminStats>('/admin/stats');
  //   return data;
  // },

  // // 6. Get weekly revenue data
  // async getWeeklyRevenue(): Promise<ChartDataPoint[]> {
  //   const { data } = await api.get<ChartDataPoint[]>('/admin/revenue');
  //   return data;
  // }  

  // ── GET /api/cactus ────────────────────────────────────────
  // Supports: page, limit (pageSize), categoryId, search
  getAll: (
    page = 1,
    pageSize = 12,
    categoryId?: number,
    search?: string,
  ): Promise<PagedResult<CactusListItem>> =>
    api
      .get<PagedResult<CactusListItem>>('/cactus', {
        params: {
          page,
          limit: pageSize,
          ...(categoryId ? { categoryId } : {}),
          ...(search?.trim() ? { search: search.trim() } : {}),
        },
      })
      .then((r) => r.data),

  // ── GET /api/cactus/:id ────────────────────────────────────
  getById: (id: number): Promise<CactusDetail> =>
    api.get<CactusDetail>(`/cactus/${id}`).then((r) => r.data),

  // ── POST /api/cactus  (multipart/form-data with images) ───
  create: (formData: FormData): Promise<{ id: number; success: boolean }> =>
    api
      .post<{ id: number; success: boolean }>('/api/cactus', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data),

  // ── PUT /api/cactus/:id  (multipart/form-data) ────────────
  update: (
    id: number,
    formData: FormData,
  ): Promise<{ message: string }> =>
    api
      .put<{ message: string }>(`/cactus/${id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data),

  // ── DELETE /api/cactus/:id ────────────────────────────────
  delete: (id: number): Promise<{ message: string }> =>
    api
      .delete<{ message: string }>(`/cactus/${id}`)
      .then((r) => r.data),

};