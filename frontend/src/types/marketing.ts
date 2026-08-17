/**
 * Canonical CRM Marketing & Attribution Types
 */

export interface LeadSource {
  id?: string;
  name?: string;
  channel?: string;
  sourceType?: string;
  sourceName?: string;
  isActive?: boolean;
}

export type Attribution = LeadAttribution;

export type CampaignStatus = "DRAFT" | "ACTIVE" | "PAUSED" | "COMPLETED" | "CANCELLED";

export interface CampaignAd {
  id: string;
  campaignId: string;
  name: string;
  externalId?: string | null;
  platform?: string | null;
  creativeType?: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface Campaign {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  channel: string;
  platform?: string | null;
  status: CampaignStatus;
  startDate?: string | null;
  endDate?: string | null;
  budget?: number | null;
  actualSpend?: number | null;
  currency?: string;
  ownerId?: string | null;
  targetAudience?: string | null;
  objective?: string | null;
  ads?: CampaignAd[];
  createdAt: string;
  updatedAt: string;
}

export interface LeadAttribution {
  id: string;
  leadId: string;
  channel: string;
  sourceType: string;
  sourceName?: string | null;
  sourceEntityId?: string | null;
  referringAccountId?: string | null;
  campaignId?: string | null;
  adId?: string | null;
  landingPage?: string | null;
  referrer?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmTerm?: string | null;
  utmContent?: string | null;
  clickId?: string | null;
  touchType: "FIRST_TOUCH" | "LAST_TOUCH" | "INTERMEDIATE" | string;
  firstTouchAt?: string | null;
  lastTouchAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AttributionEvent {
  id: string;
  leadId?: string | null;
  opportunityId?: string | null;
  channel: string;
  sourceType: string;
  sourceName?: string | null;
  campaignId?: string | null;
  adId?: string | null;
  timestamp: string;
  metadata?: string | Record<string, any> | null;
  createdAt: string;
}

export interface CampaignMetrics {
  totalLeads: number;
  qualifiedLeads: number;
  totalOpportunities: number;
  wonDealsCount: number;
  wonOrdersCount: number;
  totalRevenue: number;
  conversionRateLeadToQual: number;
  conversionRateQualToOpp: number;
  conversionRateOppToWon: number;
  costPerLead: number | null;
  costPerQualifiedLead: number | null;
  costPerOpportunity: number | null;
  costPerWonDeal: number | null;
  roas: number | null;
  roiPct: number | null;
}

export interface CampaignPerformance {
  campaign: {
    id: string;
    name: string;
    code: string;
    channel: string;
    platform?: string | null;
    status: string;
    startDate?: string | null;
    endDate?: string | null;
    budget: number;
    actualSpend: number | null;
    currency: string;
    adsCount: number;
  };
  metrics: CampaignMetrics;
}

export interface SourcePerformance {
  byChannel: Array<{
    channel: string;
    leads: number;
    qualified: number;
    opportunities: number;
    won: number;
    revenue: number;
    leadToQualRate: number;
    oppToWonRate: number;
  }>;
  bySourceType: Array<{
    sourceType: string;
    leads: number;
    qualified: number;
    opportunities: number;
    won: number;
    revenue: number;
    leadToQualRate: number;
    oppToWonRate: number;
  }>;
}

export interface AttributionTaxonomy {
  channels: string[];
  sourceTypes: string[];
  customLeadSources: LeadSource[];
}
