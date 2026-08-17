/**
 * Canonical CRM Order & Order Item Types
 * Represents a confirmed commercial transaction created from the final agreed Quote.
 */

import { Quote } from "./quote";

export type OrderStatus =
  | "Draft"
  | "Pending"
  | "Confirmed"
  | "In Production"
  | "Shipped"
  | "Delivered"
  | "Completed"
  | "Cancelled";

export interface OrderItem {
  id: string;
  orderId: string;

  productServiceId?: string | null;
  productId?: string | null;
  quoteLineItemId?: string | null;

  description: string;
  uom?: string;

  quantity: number;
  unitPrice: number;

  discount?: number;
  tax?: number;

  totalPrice?: number;
  amount?: number;

  fulfillmentStatus?: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  poNumber?: string; // compatibility alias

  accountId: string;
  opportunityId?: string;
  dealId?: string; // compatibility alias

  sourceQuoteId?: string;
  quoteId?: string; // compatibility alias
  quote?: Quote | null;

  status: OrderStatus;
  currency?: string;

  subtotal?: number;
  discount?: number;
  tax?: number;
  totalAmount?: number;
  grandTotal?: number;
  amount?: number; // compatibility alias

  confirmedAt?: string | null;
  deliveryDate?: string | null;
  notes?: string | null;

  items?: OrderItem[];

  createdAt: string;
  updatedAt: string;
}

// Backward compatibility type alias
export type PurchaseOrder = Order;
