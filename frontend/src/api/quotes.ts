/**
 * CRM Quotes API Client
 */

import { apiClient } from "../lib/apiClient";
import { Quote, PaginatedResponse, PaginationParams } from "../types";
import { normalizeQuote, normalizePaginatedResponse } from "./adapters";

export const quotesApi = {
  getQuotes: async (params: PaginationParams & { opportunityId?: string; status?: string } = {}): Promise<PaginatedResponse<Quote>> => {
    const query = new URLSearchParams();
    if (params.page) query.set("page", String(params.page));
    if (params.limit) query.set("limit", String(params.limit));
    if (params.opportunityId) query.set("dealId", params.opportunityId);
    if (params.status) query.set("status", params.status);

    const queryString = query.toString() ? `?${query.toString()}` : "";
    const raw = await apiClient.get(`/api/v1/quotes${queryString}`);
    return normalizePaginatedResponse(raw, normalizeQuote);
  },

  getQuoteById: async (id: string): Promise<Quote> => {
    const raw = await apiClient.get(`/api/v1/quotes/${id}`);
    return normalizeQuote(raw);
  },

  createQuote: async (payload: Partial<Quote> & { items?: any[] }): Promise<Quote> => {
    const raw = await apiClient.post("/api/v1/quotes", payload);
    return normalizeQuote(raw);
  },

  createQuoteRevision: async (id: string, payload: { items?: any[]; notes?: string; discountOverride?: number } = {}): Promise<Quote> => {
    const res = await apiClient(`/api/v1/quotes/${id}/create-revision`, {
      method: "POST",
      body: JSON.stringify(payload)
    });
    const raw = await res.json();
    return normalizeQuote(raw);
  },

  acceptQuote: async (id: string): Promise<{ message: string; quote: Quote; deal: any }> => {
    const res = await apiClient(`/api/v1/quotes/${id}/accept`, {
      method: "POST"
    });
    const raw = await res.json();
    return {
      message: raw.message,
      quote: normalizeQuote(raw.quote),
      deal: raw.deal
    };
  },

  updateQuote: async (id: string, payload: Partial<Quote>): Promise<Quote> => {
    const res = await apiClient(`/api/v1/quotes/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload)
    });
    const raw = await res.json();
    return normalizeQuote(raw);
  }
};
