// src/services/categoryService.ts
import api from './api';
import type { Category } from '../types';

export const categoryService = {
  /** GET /categories — returns all categories ordered by name */
  getAll: (): Promise<Category[]> =>
    api.get<Category[]>('/categories').then((r) => r.data),
  /** GET /categories/:id */
  getById: (id: number): Promise<Category> =>
    api.get<Category>(`/categories/${id}`).then((r) => r.data),
};

