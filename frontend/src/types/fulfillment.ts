/**
 * Canonical CRM Fulfillment Types
 * Represents operational supply & fulfillment processes for confirmed Orders.
 */

export type FulfillmentStatus =
  | "PENDING"
  | "PLANNING"
  | "PROCUREMENT"
  | "IN_PRODUCTION"
  | "READY"
  | "DISPATCHED"
  | "DELIVERED"
  | "COMPLETED"
  | "ON_HOLD"
  | "CANCELLED";

export interface FulfillmentItem {
  id: string;
  fulfillmentId: string;
  quoteLineItemId?: string | null;
  productServiceId?: string | null;
  description: string;
  quantityPlanned: number;
  quantityAllocated: number;
  quantityInProduction: number;
  quantityReady: number;
  quantityDispatched: number;
  quantityDelivered: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface Fulfillment {
  id: string;
  orderId: string;

  status: FulfillmentStatus;

  assignedTeam?: string | null;
  assignedUserId?: string | null;
  priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT" | null;

  plannedStartDate?: string | null;
  plannedCompletionDate?: string | null;
  actualStartDate?: string | null;
  actualCompletionDate?: string | null;
  requestedDeliveryDate?: string | null;
  actualDeliveryDate?: string | null;
  deliveryAddress?: string | null;

  dispatchReference?: string | null;
  carrier?: string | null;
  notes?: string | null;

  items?: FulfillmentItem[];
  order?: any;

  createdAt: string;
  updatedAt: string;
}
