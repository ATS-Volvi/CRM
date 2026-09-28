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

export interface TimeseriesBucket {
  period: string;
  label: string;
  leads: number;
  opportunities: number;
  wonOrders: number;
}

export interface CampaignTimeseriesResponse {
  campaignId: string;
  granularity: "day" | "week";
  totalEvents: number;
  data: TimeseriesBucket[];
}

/**
 * Downloads a CSV blob from an authenticated endpoint
 */
export async function downloadCsvBlob(path: string, fallbackFilename: string): Promise<void> {
  const res = await apiClient(path, { method: "GET" });
  if (!res.ok) {
    let errorMsg = `Export failed (${res.status})`;
    try {
      const err = await res.json();
      if (err?.error || err?.message) errorMsg = err.error || err.message;
    } catch {}
    throw new Error(errorMsg);
  }

  const blob = await res.blob();
  const contentDisposition = res.headers.get("Content-Disposition");
  let filename = fallbackFilename;
  if (contentDisposition) {
    const match = contentDisposition.match(/filename=["']?([^"';]+)["']?/i);
    if (match && match[1]) {
      filename = match[1].trim();
    }
  }

  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
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

  exportCampaignsCsv: async (params?: { status?: string; channel?: string; search?: string }): Promise<void> => {
    const query = new URLSearchParams();
    if (params?.status && params.status !== "ALL") query.set("status", params.status);
    if (params?.channel && params.channel !== "ALL") query.set("channel", params.channel);
    if (params?.search) query.set("search", params.search);
    const queryString = query.toString() ? `?${query.toString()}` : "";
    await downloadCsvBlob(`/api/v1/campaigns/export${queryString}`, `campaigns_export_${Date.now()}.csv`);
  },

  exportCampaignLeadsCsv: async (campaignId: string, campaignCode?: string): Promise<void> => {
    const safeCode = (campaignCode || campaignId).replace(/[^a-zA-Z0-9-_]/g, "_");
    const fallbackName = `campaign_${safeCode}_leads.csv`;
    await downloadCsvBlob(`/api/v1/campaigns/${campaignId}/leads/export`, fallbackName);
  },

  getCampaignTimeseries: async (
    campaignId: string,
    granularity: "day" | "week" = "day"
  ): Promise<CampaignTimeseriesResponse> => {
    const raw = await apiClient.get(`/api/v1/campaigns/${campaignId}/timeseries?granularity=${granularity}`);
    return raw;
  },

  createCampaign: async (data: Partial<Campaign>): Promise<Campaign> => {
    const res = await apiClient("/api/v1/campaigns", {
      method: "POST",
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || err.message || `Failed to create campaign (${res.status})`);
    }
    return res.json();
  },

  updateCampaign: async (id: string, data: Partial<Campaign>): Promise<Campaign> => {
    const res = await apiClient(`/api/v1/campaigns/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || err.message || `Failed to update campaign (${res.status})`);
    }
    return res.json();
  },

  deleteCampaign: async (id: string): Promise<{ message: string }> => {
    const res = await apiClient(`/api/v1/campaigns/${id}`, {
      method: "DELETE"
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || err.message || `Failed to delete campaign (${res.status})`);
    }
    return res.json();
  },

  createCampaignAd: async (campaignId: string, data: Partial<CampaignAd>): Promise<CampaignAd> => {
    const res = await apiClient(`/api/v1/campaigns/${campaignId}/ads`, {
      method: "POST",
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || err.message || `Failed to create campaign ad (${res.status})`);
    }
    return res.json();
  },

  updateCampaignAd: async (campaignId: string, adId: string, data: Partial<CampaignAd>): Promise<CampaignAd> => {
    const res = await apiClient(`/api/v1/campaigns/${campaignId}/ads/${adId}`, {
      method: "PATCH",
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || err.message || `Failed to update campaign ad (${res.status})`);
    }
    return res.json();
  },

  deleteCampaignAd: async (campaignId: string, adId: string): Promise<{ message: string }> => {
    const res = await apiClient(`/api/v1/campaigns/${campaignId}/ads/${adId}`, {
      method: "DELETE"
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || err.message || `Failed to delete campaign ad (${res.status})`);
    }
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
