/**
 * CRM Leads API Client
 */

import { apiClient } from "../lib/apiClient";
import { Lead, Activity, PaginatedResponse, PaginationParams } from "../types";
import { normalizeLead, normalizeActivity, normalizePaginatedResponse } from "./adapters";

export const leadsApi = {
  getLeads: async (params: PaginationParams & { status?: string; search?: string } = {}): Promise<PaginatedResponse<Lead>> => {
    const query = new URLSearchParams();
    if (params.page) query.set("page", String(params.page));
    if (params.limit) query.set("limit", String(params.limit));
    if (params.status) query.set("status", params.status);
    if (params.search) query.set("search", params.search);

    const queryString = query.toString() ? `?${query.toString()}` : "";
    const raw = await apiClient.get(`/api/v1/leads${queryString}`);
    return normalizePaginatedResponse(raw, normalizeLead);
  },

  getLeadById: async (id: string): Promise<Lead> => {
    const raw = await apiClient.get(`/api/v1/leads/${id}`);
    return normalizeLead(raw);
  },

  createLead: async (payload: Partial<Lead>): Promise<Lead> => {
    const raw = await apiClient.post("/api/v1/leads", payload);
    return normalizeLead(raw);
  },

  updateLead: async (id: string, payload: Partial<Lead>): Promise<Lead> => {
    const res = await apiClient(`/api/v1/leads/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload)
    });
    const raw = await res.json();
    return normalizeLead(raw);
  },

  convertLead: async (
    id: string,
    qualificationData?: Record<string, any>
  ): Promise<{ account: any; contact: any; opportunity: any; lead: Lead }> => {
    const res = await apiClient(`/api/v1/leads/${id}/convert`, {
      method: "POST",
      body: JSON.stringify(qualificationData || {})
    });
    const raw = await res.json();
    return {
      account: raw.account,
      contact: raw.contact,
      opportunity: raw.opportunity || raw.deal,
      lead: normalizeLead(raw.lead)
    };
  },

  markNotConverted: async (id: string, reason?: string): Promise<{ message: string; lead: Lead }> => {
    const res = await apiClient(`/api/v1/leads/${id}/not-converted`, {
      method: "POST",
      body: JSON.stringify({ reason })
    });
    const raw = await res.json();
    return {
      message: raw.message,
      lead: normalizeLead(raw.lead)
    };
  },

  getLeadActivities: async (leadId: string): Promise<Activity[]> => {
    const raw = await apiClient.get(`/api/v1/leads/${leadId}/activities`);
    return Array.isArray(raw) ? raw.map(normalizeActivity) : [];
  }
};
