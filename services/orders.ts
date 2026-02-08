import { apiFetch } from '@/lib/api-client';

export type OrderStatus = 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
export type PaymentStatus = 'unpaid' | 'paid' | 'refunded';

export interface OrderItem {
  product_id: number;
  quantity: number;
  price: number;
}

export interface Order {
  id: number;
  business_id: number;
  contact_id: number;
  items: OrderItem[];
  total_amount: number;
  currency: string;
  status: OrderStatus;
  payment_status: PaymentStatus;
  created_at: string;
  updated_at: string;
}

export interface OrderCreatePayload {
  contact_id?: number;
  lead_id?: number;
  items: OrderItem[];
  total_amount: number;
  currency?: string;
  status?: OrderStatus;
  payment_status?: PaymentStatus;
}

export interface OrderUpdatePayload {
  contact_id?: number;
  items?: OrderItem[];
  total_amount?: number;
  currency?: string;
  status?: OrderStatus;
  payment_status?: PaymentStatus;
}

export interface ListOrdersParams {
  status?: OrderStatus;
  payment_status?: PaymentStatus;
  contact_id?: number;
}

export async function listOrders(params: ListOrdersParams = {}): Promise<Order[]> {
  const search = new URLSearchParams();
  if (params.status) search.set('status', params.status);
  if (params.payment_status) search.set('payment_status', params.payment_status);
  if (params.contact_id) search.set('contact_id', String(params.contact_id));

  const qs = search.toString();
  const path = qs ? `/orders/?${qs}` : '/orders/';
  return apiFetch<Order[]>(path, { method: 'GET' });
}

export async function getOrder(id: number | string): Promise<Order> {
  const orderId = Number(id);
  return apiFetch<Order>(`/orders/${orderId}`, { method: 'GET' });
}

export async function createOrder(payload: OrderCreatePayload): Promise<Order> {
  return apiFetch<Order>('/orders/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateOrder(id: number | string, payload: OrderUpdatePayload): Promise<Order> {
  const orderId = Number(id);
  return apiFetch<Order>(`/orders/${orderId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function deleteOrder(id: number | string): Promise<void> {
  const orderId = Number(id);
  await apiFetch(`/orders/${orderId}`, {
    method: 'DELETE',
  });
}

