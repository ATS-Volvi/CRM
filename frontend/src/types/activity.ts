/**
 * Canonical CRM Activity Types
 * Represents interactions attached across Lead, Account, Contact, Opportunity, Quote, or Order.
 */

export type ActivityType =
  | "call"
  | "meeting"
  | "email"
  | "whatsapp"
  | "note"
  | "task"
  | "stage_change"
  | "status_change";

export interface Activity {
  id: string;
  type: ActivityType | string;

  // Universal polymorphic entity linkages
  leadId?: string | null;
  accountId?: string | null;
  customerId?: string | null; // compatibility alias
  contactId?: string | null;
  opportunityId?: string | null;
  dealId?: string | null; // compatibility alias
  quoteId?: string | null;
  orderId?: string | null;

  subject?: string;
  outcome?: string | null;
  description?: string | null;

  direction?: "inbound" | "outbound" | null;
  duration?: number | null; // in seconds
  pinned?: boolean;
  isCompleted?: boolean;

  createdBy?: string;
  createdById?: string;
  creator?: {
    id: string;
    name: string;
    email: string;
  } | null;

  createdAt: string;
  updatedAt: string;
}
