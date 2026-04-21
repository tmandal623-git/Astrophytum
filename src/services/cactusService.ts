// import api from './api';
// import type { CactusListItem, CactusDetail, PagedResult } from '../types';

// export const cactusService = {
//   getAll: (page = 1, pageSize = 12, categoryId?: number) =>
//     api.get<PagedResult<CactusListItem>>('/cactus', {
//       params: { page, pageSize, ...(categoryId ? { categoryId } : {}) },
//     }).then((r) => r.data),

//   getById: (id: number) =>
//     api.get<CactusDetail>(`/cactus/${id}`).then((r) => r.data),

//   create: (payload: { name: string; description?: string; categoryId: number; basePrice: number }) =>
//     api.post<CactusDetail>('/cactus', payload).then((r) => r.data),

//   update: (id: number, payload: { name: string; description?: string; categoryId: number; basePrice: number }) =>
//     api.put<CactusDetail>(`/cactus/${id}`, payload).then((r) => r.data),

//   delete: (id: number) => api.delete(`/cactus/${id}`),
// };
import { MOCK_CACTI, MOCK_CACTUS_DETAIL } from '../mocks/data';
import { CactusListItem, CactusDetail, PagedResult } from '../types';

const delay = (ms = 400) => new Promise((r) => setTimeout(r, ms));

export const cactusService = {
  getAll: async (page = 1, pageSize = 12, categoryId?: number): Promise<PagedResult<CactusListItem>> => {
    await delay();
    const filtered = categoryId
      ? MOCK_CACTI.filter((c) => {
          const catMap: Record<number, string> = { 1: 'Indoor', 2: 'Outdoor', 3: 'Rare', 4: 'Flowering' };
          return c.categoryName === catMap[categoryId];
        })
      : MOCK_CACTI;
    const start = (page - 1) * pageSize;
    const items = filtered.slice(start, start + pageSize);
    return { items, totalCount: filtered.length, page, pageSize, totalPages: Math.ceil(filtered.length / pageSize) };
  },

  getById: async (id: number): Promise<CactusDetail> => {
    await delay();
    const detail = MOCK_CACTUS_DETAIL[id];
    if (!detail) throw new Error('Not found');
    return detail;
  },

  create: async (payload: any): Promise<CactusDetail> => {
    await delay(600);
    return { id: 99, ...payload, categoryName: 'Indoor', createdAt: new Date().toISOString(), media: [], auction: null };
  },

  update: async (id: number, payload: any): Promise<CactusDetail> => {
    await delay(600);
    return { ...MOCK_CACTUS_DETAIL[id], ...payload };
  },

  delete: async (_id: number): Promise<void> => { await delay(400); },
};