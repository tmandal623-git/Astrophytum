// src/context/CartContext.tsx
// ── Behaviour ──────────────────────────────────────────────────
//  Logged IN  → all cart ops hit /api/cart (PostgreSQL)
//  Guest      → cart lives in localStorage (unchanged UX)
//  On login   → guest cart is merged into DB cart automatically

import {
  createContext, useCallback, useContext,
  useEffect, useReducer, useState, ReactNode,
} from 'react';
import { useAuth } from './AuthContext';

// ── Types ──────────────────────────────────────────────────────
export interface CartItem {
  id:           number;   // cactusId
  name:         string;
  categoryName: string;
  price:        number;
  thumbnailUrl: string | null;
  quantity:     number;
  stock?:       number;   // units available; undefined = unknown (e.g. old guest cart)
}

type CartAction =
  | { type: 'SET';        payload: CartItem[] }
  | { type: 'ADD';        payload: Omit<CartItem, 'quantity'>; quantity: number }
  | { type: 'REMOVE';     payload: { id: number } }
  | { type: 'UPDATE_QTY'; payload: { id: number; quantity: number } }
  | { type: 'CLEAR' };

function cartReducer(items: CartItem[], action: CartAction): CartItem[] {
  switch (action.type) {
    case 'SET': return action.payload;
    case 'ADD': {
      const ex = items.find(i => i.id === action.payload.id);
      return ex
        ? items.map(i => i.id === action.payload.id ? { ...i, ...action.payload, quantity: i.quantity + action.quantity } : i)
        : [...items, { ...action.payload, quantity: action.quantity }];
    }
    case 'REMOVE': return items.filter(i => i.id !== action.payload.id);
    case 'UPDATE_QTY':
      return action.payload.quantity < 1
        ? items.filter(i => i.id !== action.payload.id)
        : items.map(i => i.id === action.payload.id ? { ...i, quantity: action.payload.quantity } : i);
    case 'CLEAR': return [];
    default: return items;
  }
}

// ── Context ────────────────────────────────────────────────────
interface CartContextValue {
  items:         CartItem[];
  totalItems:    number;
  subtotal:      number;
  cartLoading:   boolean;
  addToCart:     (item: Omit<CartItem, 'quantity'>, qty?: number) => Promise<void>;
  removeFromCart:(id: number) => Promise<void>;
  updateQty:     (id: number, qty: number) => Promise<void>;
  clearCart:     () => Promise<void>;
  isInCart:      (id: number) => boolean;
}

const CartContext = createContext<CartContextValue>({
  items: [], totalItems: 0, subtotal: 0, cartLoading: false,
  addToCart: async () => {}, removeFromCart: async () => {},
  updateQty: async () => {}, clearCart: async () => {},
  isInCart: () => false,
});

// ── localStorage helpers ───────────────────────────────────────
const LS_KEY = 'cactusmart_cart';
function lsGet(): CartItem[] {
  try { return JSON.parse(localStorage.getItem(LS_KEY) ?? '[]'); } catch { return []; }
}
function lsSet(items: CartItem[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(items));
}

// ── API helpers ────────────────────────────────────────────────
async function apiFetch(url: string, opts?: RequestInit) {
  const res = await fetch(url, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

// ── Map DB row → CartItem ──────────────────────────────────────
function dbRowToCartItem(row: any): CartItem {
  return {
    id:           row.cactusId,
    name:         row.name,
    categoryName: row.categoryName,
    price:        row.price,
    thumbnailUrl: row.thumbnailUrl ?? null,
    quantity:     row.quantity,
    stock:        row.stock,
  };
}

// ── Provider ───────────────────────────────────────────────────
export function CartProvider({ children }: { children: ReactNode }) {
  const { isLoggedIn, user } = useAuth();
  const [items, dispatch]    = useReducer(cartReducer, []);
  const [cartLoading, setCartLoading] = useState(false);

  // ── Load cart when auth state changes ─────────────────────
  useEffect(() => {
    if (isLoggedIn) {
      loadDbCart();
    } else {
      // Guest: hydrate from localStorage
      dispatch({ type: 'SET', payload: lsGet() });
    }
  }, [isLoggedIn]);

  // ── Persist guest cart to localStorage ─────────────────────
  useEffect(() => {
    if (!isLoggedIn) lsSet(items);
  }, [items, isLoggedIn]);

  // ── Merge guest cart into DB on login ─────────────────────
  useEffect(() => {
    if (!isLoggedIn) return;
    const guestItems = lsGet();
    if (guestItems.length === 0) return;

    // Add each guest item to DB (server upserts on conflict)
    Promise.all(
      guestItems.map(item =>
        apiFetch('/api/cart', {
          method: 'POST',
          body: JSON.stringify({ cactusId: item.id, quantity: item.quantity }),
        }).catch(() => null),
      ),
    ).then(() => {
      localStorage.removeItem(LS_KEY); // clear guest cart
      loadDbCart();                    // reload merged cart from DB
    });
  }, [isLoggedIn]);

  // ── DB operations ──────────────────────────────────────────
  const loadDbCart = async () => {
    setCartLoading(true);
    try {
      const rows = await apiFetch('/api/cart');
      dispatch({ type: 'SET', payload: rows.map(dbRowToCartItem) });
    } catch {
      dispatch({ type: 'SET', payload: [] });
    } finally {
      setCartLoading(false);
    }
  };

  // ── addToCart ─────────────────────────────────────────────
  const addToCart = useCallback(async (item: Omit<CartItem, 'quantity'>, qty = 1) => {
    if (!Number.isInteger(qty) || qty < 1) throw new Error('Choose a quantity of at least 1');
    const prevQty = items.find(i => i.id === item.id)?.quantity ?? 0;
    if (item.stock !== undefined && prevQty + qty > item.stock) {
      throw new Error(item.stock <= 0
        ? 'This cactus is sold out'
        : `Only ${item.stock} available${prevQty ? ` — you already have ${prevQty} in your cart` : ''}`);
    }

    // Optimistic update immediately
    dispatch({ type: 'ADD', payload: item, quantity: qty });

    if (isLoggedIn) {
      try {
        await apiFetch('/api/cart', {
          method: 'POST',
          body: JSON.stringify({ cactusId: item.id, quantity: qty }),
        });
      } catch (err) {
        // Rollback on failure
        dispatch({ type: 'UPDATE_QTY', payload: { id: item.id, quantity: prevQty } });
        throw err instanceof Error ? err : new Error('Failed to add to cart');
      }
    }
  }, [isLoggedIn, items]);

  // ── removeFromCart ────────────────────────────────────────
  const removeFromCart = useCallback(async (id: number) => {
    const prev = items.find(i => i.id === id);
    dispatch({ type: 'REMOVE', payload: { id } });

    if (isLoggedIn) {
      try {
        await apiFetch(`/api/cart/${id}`, { method: 'DELETE' });
      } catch {
        if (prev) dispatch({ type: 'ADD', payload: prev, quantity: prev.quantity });
      }
    }
  }, [isLoggedIn, items]);

  // ── updateQty ─────────────────────────────────────────────
  const updateQty = useCallback(async (id: number, qty: number) => {
    // Never go above what's in stock
    const stock = items.find(i => i.id === id)?.stock;
    if (stock !== undefined && qty > stock) qty = stock;
    dispatch({ type: 'UPDATE_QTY', payload: { id, quantity: qty } });

    if (isLoggedIn) {
      try {
        if (qty < 1) {
          await apiFetch(`/api/cart/${id}`, { method: 'DELETE' });
        } else {
          await apiFetch(`/api/cart/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ quantity: qty }),
          });
        }
      } catch {
        // Server refused (e.g. stock changed) — resync with the DB cart and its latest stock
        await loadDbCart();
      }
    }
  }, [isLoggedIn, items]);

  // ── clearCart ─────────────────────────────────────────────
  const clearCart = useCallback(async () => {
    dispatch({ type: 'CLEAR' });

    if (isLoggedIn) {
      await apiFetch('/api/cart', { method: 'DELETE' }).catch(() => null);
    } else {
      localStorage.removeItem(LS_KEY);
    }
  }, [isLoggedIn]);

  const isInCart    = useCallback((id: number) => items.some(i => i.id === id), [items]);
  const totalItems  = items.reduce((s, i) => s + i.quantity, 0);
  const subtotal    = items.reduce((s, i) => s + i.price * i.quantity, 0);

  return (
    <CartContext.Provider value={{
      items, totalItems, subtotal, cartLoading,
      addToCart, removeFromCart, updateQty, clearCart, isInCart,
    }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);