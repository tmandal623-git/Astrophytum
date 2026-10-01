// src/context/CartContext.tsx
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  ReactNode,
} from 'react';
import { CactusListItem } from '../types';

// ── Types ──────────────────────────────────────────────────────
export interface CartItem {
  id:           number;
  name:         string;
  categoryName: string;
  price:        number;
  thumbnailUrl: string | null;
  quantity:     number;
}

interface CartState {
  items: CartItem[];
}

type CartAction =
  | { type: 'ADD';    payload: Omit<CartItem, 'quantity'> }
  | { type: 'REMOVE'; payload: { id: number } }
  | { type: 'UPDATE_QTY'; payload: { id: number; quantity: number } }
  | { type: 'CLEAR' }
  | { type: 'HYDRATE'; payload: CartItem[] };

// ── Reducer ────────────────────────────────────────────────────
function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'ADD': {
      const exists = state.items.find((i) => i.id === action.payload.id);
      if (exists) {
        return {
          items: state.items.map((i) =>
            i.id === action.payload.id ? { ...i, quantity: i.quantity + 1 } : i,
          ),
        };
      }
      return { items: [...state.items, { ...action.payload, quantity: 1 }] };
    }
    case 'REMOVE':
      return { items: state.items.filter((i) => i.id !== action.payload.id) };

    case 'UPDATE_QTY': {
      if (action.payload.quantity < 1)
        return { items: state.items.filter((i) => i.id !== action.payload.id) };
      return {
        items: state.items.map((i) =>
          i.id === action.payload.id ? { ...i, quantity: action.payload.quantity } : i,
        ),
      };
    }
    case 'CLEAR':
      return { items: [] };

    case 'HYDRATE':
      return { items: action.payload };

    default:
      return state;
  }
}

// ── Context ────────────────────────────────────────────────────
interface CartContextValue {
  items:        CartItem[];
  totalItems:   number;
  subtotal:     number;
  addToCart:    (cactus: CactusListItem | Omit<CartItem, 'quantity'>) => void;
  removeFromCart:(id: number) => void;
  updateQty:    (id: number, quantity: number) => void;
  clearCart:    () => void;
  isInCart:     (id: number) => boolean;
}

const CartContext = createContext<CartContextValue>({
  items: [], totalItems: 0, subtotal: 0,
  addToCart: () => {}, removeFromCart: () => {},
  updateQty: () => {}, clearCart: () => {}, isInCart: () => false,
});

// ── Provider ───────────────────────────────────────────────────
const STORAGE_KEY = 'cactusmart_cart';

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, { items: [] });

  // Hydrate from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) dispatch({ type: 'HYDRATE', payload: JSON.parse(saved) });
    } catch { /* ignore */ }
  }, []);

  // Persist to localStorage on every change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.items));
  }, [state.items]);

  const addToCart = useCallback((cactus: CactusListItem | Omit<CartItem, 'quantity'>) => {
    dispatch({
      type: 'ADD',
      payload: {
        id:           cactus.id,
        name:         cactus.name,
        categoryName: cactus.categoryName,
        price:        'basePrice' in cactus ? cactus.basePrice : (cactus as CartItem).price,
        thumbnailUrl: cactus.thumbnailUrl ?? null,
      },
    });
  }, []);

  const removeFromCart = useCallback((id: number) => {
    dispatch({ type: 'REMOVE', payload: { id } });
  }, []);

  const updateQty = useCallback((id: number, quantity: number) => {
    dispatch({ type: 'UPDATE_QTY', payload: { id, quantity } });
  }, []);

  const clearCart = useCallback(() => dispatch({ type: 'CLEAR' }), []);

  const isInCart = useCallback((id: number) => state.items.some((i) => i.id === id), [state.items]);

  const totalItems = state.items.reduce((s, i) => s + i.quantity, 0);
  const subtotal   = state.items.reduce((s, i) => s + i.price * i.quantity, 0);

  return (
    <CartContext.Provider value={{ items: state.items, totalItems, subtotal, addToCart, removeFromCart, updateQty, clearCart, isInCart }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
