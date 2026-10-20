// src/services/addressService.ts
// The logged-in user's saved delivery addresses (address book).
// Uses fetch() with credentials:'include' like the other /api/auth calls, so the auth cookie is sent.
import { AddressInput, SavedAddress } from '../types';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/auth/addresses${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `Server error ${res.status}`);
  return body as T;
}

export const addressService = {
  list:       ()                                                      => request<SavedAddress[]>(''),
  create:     (address: AddressInput, isDefault = false)              => request<SavedAddress>('', { method: 'POST', body: JSON.stringify({ ...address, isDefault }) }),
  update:     (id: number, address: AddressInput, isDefault = false)  => request<SavedAddress>(`/${id}`, { method: 'PUT', body: JSON.stringify({ ...address, isDefault }) }),
  setDefault: (id: number)                                            => request<{ ok: true }>(`/${id}/default`, { method: 'PUT' }),
  remove:     (id: number)                                            => request<void>(`/${id}`, { method: 'DELETE' }),
};
