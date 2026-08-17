/**
 * CRM Marketing & Campaigns API Client
 */

import { apiClient } from "../lib/apiClient";
import {
  Campaign,
  CampaignAd,
  LeadSource,
  LeadAttribution,
  AttributionEvent,
  CampaignPerformance,
  SourcePerformance,
  AttributionTaxonomy,
  PaginatedResponse
} from "../types";
import { normalizePaginatedResponse } from "./adapters";

export interface CampaignFilterParams {
  page?: number;
  limit?: number;
  status?: string;
  channel?: string;
  search?: string;
}

export const campaignsApi = {
  getCampaigns: async (params?: CampaignFilterParams): Promise<PaginatedResponse<Campaign>> => {
    const query = new URLSearchParams();
    if (params?.page) query.set("page", String(params.page));
    if (params?.limit) query.set("limit", String(params.limit));
    if (params?.status) query.set("status", params.status);
    if (params?.channel) query.set("channel", params.channel);
    if (params?.search) query.set("search", params.search);

    const queryString = query.toString() ? `?${query.toString()}` : "";
    const raw = await apiClient.get(`/api/v1/campaigns${queryString}`);
    return normalizePaginatedResponse(raw, (c) => c);
  },

  getCampaignById: async (id: string): Promise<{ campaign: Campaign; performance: CampaignPerformance }> => {
    const raw = await apiClient.get(`/api/v1/campaigns/${id}`);
    return raw;
  },

  createCampaign: async (data: Partial<Campaign>): Promise<Campaign> => {
    const res = await apiClient("/api/v1/campaigns", {
      method: "POST",
      body: JSON.stringify(data)
    });
    return res.json();
  },

  updateCampaign: async (id: string, data: Partial<Campaign>): Promise<Campaign> => {
    const res = await apiClient(`/api/v1/campaigns/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data)
    });
    return res.json();
  },

  deleteCampaign: async (id: string): Promise<{ message: string }> => {
    const res = await apiClient(`/api/v1/campaigns/${id}`, {
      method: "DELETE"
    });
    return res.json();
  },

  createCampaignAd: async (campaignId: string, data: Partial<CampaignAd>): Promise<CampaignAd> => {
    const res = await apiClient(`/api/v1/campaigns/${campaignId}/ads`, {
      method: "POST",
      body: JSON.stringify(data)
    });
    return res.json();
  },

  getCampaignLeads: async (campaignId: string, params?: { page?: number; limit?: number }): Promise<PaginatedResponse<any>> => {
    const query = new URLSearchParams();
    if (params?.page) query.set("page", String(params.page));
    if (params?.limit) query.set("limit", String(params.limit));
    const queryString = query.toString() ? `?${query.toString()}` : "";

    const raw = await apiClient.get(`/api/v1/campaigns/${campaignId}/leads${queryString}`);
    return normalizePaginatedResponse(raw, (l) => l);
  },

  getCampaignOpportunities: async (campaignId: string): Promise<{ data: any[] }> => {
    const raw = await apiClient.get(`/api/v1/campaigns/${campaignId}/opportunities`);
    return raw;
  },

  getCampaignPerformance: async (campaignId: string): Promise<CampaignPerformance> => {
    const raw = await apiClient.get(`/api/v1/campaigns/${campaignId}/performance`);
    return raw;
  }
};

export const attributionApi = {
  getLeadAttribution: async (leadId: string): Promise<{
    leadId: string;
    channel: string;
    sourceType: string;
    sourceName?: string;
    campaign?: any;
    ad?: any;
    referringAccount?: any;
    firstTouchAttribution?: any;
    lastTouchAttribution?: any;
    touches: LeadAttribution[];
  }> => {
    const raw = await apiClient.get(`/api/v1/leads/${leadId}/attribution`);
    return raw;
  },

  getLeadAttributionHistory: async (leadId: string): Promise<{ leadId: string; events: AttributionEvent[] }> => {
    const raw = await apiClient.get(`/api/v1/leads/${leadId}/attribution-history`);
    return raw;
  },

  recordManualTouch: async (leadId: string, data: Partial<LeadAttribution>): Promise<any> => {
    const res = await apiClient(`/api/v1/leads/${leadId}/attribution`, {
      method: "POST",
      body: JSON.stringify(data)
    });
    return res.json();
  },

  getLeadSourceAnalytics: async (): Promise<SourcePerformance> => {
    const raw = await apiClient.get("/api/v1/analytics/lead-sources");
    return raw;
  },

  getCampaignsAnalytics: async (): Promise<{ data: CampaignPerformance[] }> => {
    const raw = await apiClient.get("/api/v1/analytics/campaigns");
    return raw;
  },

  getTaxonomy: async (): Promise<AttributionTaxonomy> => {
    const raw = await apiClient.get("/api/v1/lead-sources/taxonomy");
    return raw;
  },

  getLeadSources: async (): Promise<LeadSource[]> => {
    const raw = await apiClient.get("/api/v1/lead-sources");
    return Array.isArray(raw) ? raw : [];
  }
};

// Backward compatibility alias
export const marketingApi = {
  ...campaignsApi,
  ...attributionApi
};
