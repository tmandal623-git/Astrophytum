// src/services/orderService.ts
import api from './api';
import { CartItem } from '../context/CartContext';

// ── Types ──────────────────────────────────────────────────────
export interface OrderAddress {
  firstName: string;
  lastName:  string;
  email:     string;
  phone?:    string;
  line1:     string;
  line2?:    string;
  city:      string;
  state:     string;
  zip:       string;
  country:   string;
}

export interface CreateOrderPayload {
  userId:         string;
  items:          { cactusId: number; quantity: number; unitPrice: number }[];
  address:        OrderAddress;
  paymentMethod:  string;
  subtotal:       number;
  shipping:       number;
  tax:            number;
  total:          number;
  promoCode?:     string;
  discountAmount?: number;
}

export interface OrderCreatedResponse {
  id:          number;
  orderNumber: string;
  status:      string;
}

export interface OrderItem {
  cactusId:    number;
  quantity:    number;
  unitPrice:   number;
  name:        string;
  thumbnailUrl: string | null;
}

export interface Order {
  id:            number;
  userId:        string;
  status:        string;
  subtotal:      number;
  shipping:      number;
  tax:           number;
  total:         number;
  paymentMethod: string;
  promoCode:     string | null;
  discountAmount:number;
  createdAt:     string;
  firstName:     string;
  lastName:      string;
  email:         string;
  phone:         string | null;
  addressLine1:  string;
  addressLine2:  string | null;
  city:          string;
  state:         string;
  zip:           string;
  country:       string;
  items:         OrderItem[];
}

// ── Helpers ────────────────────────────────────────────────────

/** Convert CartItems to the API items format */
export function cartItemsToPayload(
  items: CartItem[],
): CreateOrderPayload['items'] {
  return items.map((item) => ({
    cactusId:  item.id,
    quantity:  item.quantity,
    unitPrice: item.price,
  }));
}

// ── Service ────────────────────────────────────────────────────
export const orderService = {

  // ── POST /api/orders ──────────────────────────────────────
  create: (payload: CreateOrderPayload): Promise<OrderCreatedResponse> =>
    api
      .post<OrderCreatedResponse>('/api/orders', payload)
      .then((r) => r.data),

  // ── GET /api/orders?userId=xxx ────────────────────────────
  getForUser: (userId: string): Promise<Order[]> =>
    api
      .get<Order[]>('/api/orders', { params: { userId } })
      .then((r) => r.data),

  // ── GET /api/orders/:id ───────────────────────────────────
  getById: (id: number): Promise<Order> =>
    api
      .get<Order>(`/api/orders/${id}`)
      .then((r) => r.data),
};
