/**
 * Canonical CRM Opportunity Types
 * Represents a qualified commercial requirement and sales closing process.
 */

import { Quote } from "./quote";
import { Contact } from "./contact";

export type OpportunityStatus = "OPEN" | "WON" | "LOST";

export type OpportunityStage =
  | "OPEN"
  | "WON"
  | "LOST"
  | "Discovery"
  | "Requirements"
  | "Solution/Scope"
  | "Quote Preparation"
  | "Quote Sent"
  | "Negotiation"
  | "Agreed"
  | "Won"
  | "Lost";

export const CANONICAL_OPPORTUNITY_STAGES: OpportunityStage[] = [
  "OPEN",
  "WON",
  "LOST"
];

export interface Opportunity {
  id: string;
  opportunityNumber?: string;

  name: string;
  description?: string | null;

  // Account & Contact Relationships
  accountId: string;
  account?: {
    id: string;
    name?: string;
    displayName?: string;
    legalName?: string;
    ownerId?: string | null;
  } | null;

  primaryContactId?: string | null;
  primaryContact?: Contact | null;

  // Explicit Two-Tier Ownership Architecture
  ownerId?: string | null; // Opportunity Closer Owner
  opportunityOwnerId?: string | null; // Canonical alias for Closer
  closerId?: string | null; // Canonical alias for Closer
  assignedToId?: string | null;
  owner?: {
    id: string;
    name: string;
    email: string;
    role?: string;
  } | null;

  originatingLeadId?: string | null;
  originatingRepId?: string | null; // Lead Qualification Rep
  qualifyingRepId?: string | null; // Lead Qualification Rep
  leadId?: string | null; // compatibility alias
  lead?: any;

  estimatedValue?: number | null;
  amount?: number | null; // compatibility alias
  currency?: string | null;

  probability?: number | null;
  priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT" | string | null;

  expectedCloseDate?: string | null;

  status?: OpportunityStatus | string;
  stage?: OpportunityStage | string;
  stageId?: string; // pipeline stage UUID if relational

  competitors?: string | null;
  lossReason?: string | null;

  wonAt?: string | null;
  lostAt?: string | null;

  // Attached Quotes & Activity
  quotes?: Quote[];
  lastCustomerActivityAt?: string | null;
  nextAction?: string | null;
  nextActionDue?: string | null;

  createdAt: string;
  updatedAt: string;
}

// Backward compatibility type alias
export type Deal = Opportunity;

