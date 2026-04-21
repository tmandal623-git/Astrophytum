// // src/services/categoryService.ts
// import api from './api';
// import type { Category } from '../types';

// export const categoryService = {
//   /** GET /categories — returns all categories ordered by name */
//   getAll: (): Promise<Category[]> =>
//     api.get<Category[]>('/categories').then((r) => r.data),

//   /** GET /categories/:id */
//   getById: (id: number): Promise<Category> =>
//     api.get<Category>(`/categories/${id}`).then((r) => r.data),
// };

import { MOCK_CATEGORIES } from '../mocks/data';
import { Category } from '../types';

const delay = (ms = 300) => new Promise((r) => setTimeout(r, ms));

export const categoryService = {
  getAll:   async (): Promise<Category[]>  => { await delay(); return MOCK_CATEGORIES; },
  getById:  async (id: number): Promise<Category> => { await delay(); return MOCK_CATEGORIES.find((c) => c.id === id)!; },
};
