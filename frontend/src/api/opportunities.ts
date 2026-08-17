/**
 * CRM Opportunities API Client
 */

import { apiClient } from "../lib/apiClient";
import { Opportunity, Quote, PaginatedResponse, PaginationParams } from "../types";
import { normalizeOpportunity, normalizeQuote, normalizePaginatedResponse } from "./adapters";

export const opportunitiesApi = {
  getOpportunities: async (params: PaginationParams & { stage?: string; accountId?: string } = {}): Promise<PaginatedResponse<Opportunity>> => {
    const query = new URLSearchParams();
    if (params.page) query.set("page", String(params.page));
    if (params.limit) query.set("limit", String(params.limit));
    if (params.stage) query.set("stage", params.stage);
    if (params.accountId) query.set("accountId", params.accountId);
    if (params.search) query.set("search", params.search);

    const queryString = query.toString() ? `?${query.toString()}` : "";
    const raw = await apiClient.get(`/api/v1/opportunities${queryString}`);
    return normalizePaginatedResponse(raw, normalizeOpportunity);
  },

  getOpportunityById: async (id: string): Promise<Opportunity> => {
    const raw = await apiClient.get(`/api/v1/opportunities/${id}`);
    return normalizeOpportunity(raw);
  },

  createOpportunity: async (payload: Partial<Opportunity>): Promise<Opportunity> => {
    const raw = await apiClient.post("/api/v1/opportunities", {
      ...payload,
      accountId: payload.accountId,
      name: payload.name,
      amount: payload.estimatedValue || payload.amount || 0,
      stageId: payload.stageId
    });
    return normalizeOpportunity(raw);
  },

  updateOpportunity: async (id: string, payload: Partial<Opportunity>): Promise<Opportunity> => {
    const res = await apiClient(`/api/v1/opportunities/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload)
    });
    const raw = await res.json();
    return normalizeOpportunity(raw);
  },

  moveOpportunityStage: async (id: string, stageId: string, metadata?: Record<string, any>): Promise<Opportunity> => {
    const res = await apiClient(`/api/v1/opportunities/${id}/stage`, {
      method: "POST",
      body: JSON.stringify({ stageId, ...metadata })
    });
    const raw = await res.json();
    return normalizeOpportunity(raw);
  },

  getOpportunityQuotes: async (opportunityId: string): Promise<Quote[]> => {
    const raw = await apiClient.get(`/api/v1/opportunities/${opportunityId}/quotes`);
    return Array.isArray(raw) ? raw.map(normalizeQuote) : [];
  },

  createOpportunityQuote: async (opportunityId: string, quotePayload: any): Promise<Quote> => {
    const res = await apiClient(`/api/v1/opportunities/${opportunityId}/quotes`, {
      method: "POST",
      body: JSON.stringify(quotePayload)
    });
    const raw = await res.json();
    return normalizeQuote(raw);
  }
};

// Backward compatibility alias
export const dealsApi = opportunitiesApi;
