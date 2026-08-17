/**
 * Canonical CRM Lead Types
 * Represents early enquiry / initial pre-opportunity sales conversation.
 */

export type LeadStatus = "NEW" | "CONTACTED" | "QUALIFIED" | "CONVERTED" | "NOT_CONVERTED";

export type LeadPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export type LeadSourceChannel =
  | "Website"
  | "WhatsApp"
  | "Email"
  | "Phone"
  | "LinkedIn"
  | "Facebook"
  | "Google Ads"
  | "Referral"
  | "Trade Show"
  | "Direct"
  | "Other";

import type { LeadAttribution } from "./marketing";
export type { LeadAttribution };

export type LeadSourceType = "INBOUND_ORGANIC" | "INBOUND_PAID" | "OUTBOUND" | "REFERRAL" | "PARTNER" | string;

export interface LeadAttributionSnapshot {
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmContent?: string | null;
  referrer?: string | null;
  landingPage?: string | null;
  adId?: string | null;
}

export interface LeadQualificationData {
  requirement?: string;
  estimatedValue?: number;
  budget?: string;
  timeline?: string;
  decisionMaker?: string;
  notes?: string;
  [key: string]: unknown;
}

export interface LeadContactSummary {
  id: string;
  firstName: string;
  lastName?: string;
  email?: string;
  phone?: string;
  role?: string;
  sourceChannel?: string;
  createdAt: string;
}

export interface Lead {
  id: string;
  leadNumber?: string;

  firstName?: string;
  lastName?: string;
  companyName?: string;
  company?: string; // alias

  email?: string;
  phone?: string;

  sourceChannel?: LeadSourceChannel | string;
  source?: string; // alias
  sourceDetail?: string | null;
  sourceType?: LeadSourceType;
  campaignId?: string | null;
  campaign?: string | null;
  attribution?: LeadAttribution | null;

  industry?: string | null;
  estimatedValue?: number | null;
  currency?: string | null;
  budgetRange?: string | null;

  leadScore?: number | null;
  priority?: LeadPriority;
  temperature?: "Cold" | "Warm" | "Hot";

  ownerId?: string | null;
  assignedToId?: string | null; // backend alias
  assignedTo?: {
    id: string;
    name: string;
    email: string;
    role?: string;
  } | null;

  status: LeadStatus;
  body?: string | null;
  notes?: string | null;
  nextAction?: string | null;
  nextActionDue?: string | null;

  // Conversion tracking metadata
  convertedAt?: string | null;
  convertedAccountId?: string | null;
  convertedContactId?: string | null;
  convertedOpportunityId?: string | null;

  // Related contacts (if captured before conversion)
  contacts?: LeadContactSummary[];

  createdAt: string;
  updatedAt: string;
}
