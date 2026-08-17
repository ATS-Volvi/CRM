/**
 * Canonical CRM Opportunity Types
 * Represents a qualified commercial requirement and sales process.
 */

import { Quote } from "./quote";
import { Contact } from "./contact";

export type OpportunityStage =
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
  "Discovery",
  "Requirements",
  "Solution/Scope",
  "Quote Preparation",
  "Quote Sent",
  "Negotiation",
  "Agreed",
  "Won",
  "Lost",
];

export interface Opportunity {
  id: string;
  opportunityNumber?: string;

  name: string;
  description?: string | null;

  accountId: string;
  account?: {
    id: string;
    name?: string;
    displayName?: string;
    legalName?: string;
  } | null;

  primaryContactId?: string | null;
  primaryContact?: Contact | null;

  ownerId?: string | null;
  owner?: {
    id: string;
    name: string;
    email: string;
  } | null;

  originatingLeadId?: string | null;
  leadId?: string | null; // compatibility alias

  estimatedValue?: number | null;
  amount?: number | null; // compatibility alias
  currency?: string | null;

  probability?: number | null;
  priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT" | string | null;

  expectedCloseDate?: string | null;

  stage: OpportunityStage;
  stageId?: string; // pipeline stage UUID if relational

  competitors?: string | null;
  lossReason?: string | null;

  wonAt?: string | null;
  lostAt?: string | null;

  // Attached Quotes
  quotes?: Quote[];

  createdAt: string;
  updatedAt: string;
}

// Backward compatibility type alias
export type Deal = Opportunity;
