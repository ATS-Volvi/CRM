/**
 * Canonical CRM Quote & Quote Line Item Types
 * Represents commercial proposals/versions belonging to an Opportunity.
 */

export type QuoteStatus =
  | "Draft"
  | "Pending Approval"
  | "Approved"
  | "Sent"
  | "Accepted"
  | "Superseded"
  | "Rejected"
  | "Cancelled";

export interface QuoteLineItem {
  id: string;
  quoteId: string;

  productServiceId?: string | null;
  productId?: string | null; // backend alias
  catalogItemId?: string | null; // backend alias

  product?: {
    id: string;
    name: string;
    itemCode?: string;
    unitPrice?: number;
  } | null;

  description: string;
  customDescription?: string | null;
  uom?: string; // unit of measure

  quantity: number;
  unitPrice: number;

  discount?: number; // discount percentage or fixed
  tax?: number; // tax percentage

  totalPrice?: number; // pre-tax, post-discount
  amount?: number; // alias for totalPrice

  sortOrder?: number;
  isOptional?: boolean;
  isCustom?: boolean;

  // Internal cost snapshot (only visible to privileged roles)
  internalCostSnapshot?: number | null;
}

export interface Quote {
  id: string;
  quoteNumber: string;

  opportunityId: string;
  dealId?: string; // compatibility alias

  accountId?: string;
  contactId?: string | null;

  version: number;
  previousQuoteId?: string | null;
  parentQuoteId?: string | null; // backend alias

  status: QuoteStatus;
  currency?: string;

  validUntil?: string | null;
  expirationDate?: string | null; // backend alias

  subtotal?: number;
  discount?: number;
  tax?: number;
  totalAmount: number;
  grandTotal?: number; // alias

  isFinalAgreed?: boolean;

  notes?: string | null;
  terms?: string | null;

  createdBy?: string;
  createdById?: string;

  // Multi-version & Approval timestamps
  submittedAt?: string | null;
  approvedAt?: string | null;
  sentAt?: string | null;
  acceptedAt?: string | null;

  // Relations
  QuoteLineItems?: QuoteLineItem[];
  items?: QuoteLineItem[]; // alias

  deal?: {
    id: string;
    name: string;
    accountId?: string;
    account?: {
      id: string;
      name?: string;
      displayName?: string;
    };
  };

  createdAt: string;
  updatedAt: string;
}
