export type OrderTimelineEventType =
  | "ORDER_RECEIVED"
  | "PAYMENT_WAITING"
  | "PAYMENT_PARTIAL"
  | "PAYMENT_FULL"
  | "ESTIMATE_SET"
  | "ESTIMATE_UPDATED"
  | "SHIPPED"
  | "IN_TRANSIT"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "CANCELLED"
  | "NOTE"
  | "STATUS_CHANGED"
  | "OTHER";

export interface OrderTimelineEvent {
  eventId: string;
  orderId: number;
  type: OrderTimelineEventType | string;
  timestamp: string;
  actor?: string | null;
  amount?: number | null;
  currency?: string | null;
  paymentMethod?: string | null;
  remainingAmount?: number | null;
  estimateDate?: string | null;
  statusFrom?: string | null;
  statusTo?: string | null;
  message?: string | null;
  metadata?: Record<string, unknown> | string | null;
}

export interface OrderTimelineOrderSnapshot {
  id: number;
  customerId?: number | null;
  statusId?: number | null;
  status?: string | null;
  statusLabel?: string | null;
  paymentStatus?: string | null;
  paymentStatusLabel?: string | null;
  paymentStatusColor?: string | null;
  paymentStatusBadgeColor?: string | null;
  fulfillmentStatus?: string | null;
  fulfillmentStatusLabel?: string | null;
  createdAt: string;
  updatedAt: string;
  date: string;
  grandTotal: number;
  orderCurrency?: string | null;
  estimatedMin?: number | null;
  estimatedMax?: number | null;
}

export interface OrderTimelineResponse {
  order: OrderTimelineOrderSnapshot;
  events: OrderTimelineEvent[];
}
