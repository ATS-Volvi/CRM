/**
 * CRM Accounts API Client
 */

import { apiClient } from "../lib/apiClient";
import { Account, Contact, Opportunity, Quote, Order, PaginatedResponse, PaginationParams } from "../types";
import { normalizeAccount, normalizeContact, normalizeOpportunity, normalizeQuote, normalizeOrder, normalizePaginatedResponse } from "./adapters";

export const accountsApi = {
  getAccounts: async (params: PaginationParams = {}): Promise<PaginatedResponse<Account>> => {
    const query = new URLSearchParams();
    if (params.page) query.set("page", String(params.page));
    if (params.limit) query.set("limit", String(params.limit));
    if (params.search) query.set("search", params.search);

    const queryString = query.toString() ? `?${query.toString()}` : "";
    const raw = await apiClient.get(`/api/v1/accounts${queryString}`);
    return normalizePaginatedResponse(raw, normalizeAccount);
  },

  getAccountById: async (id: string): Promise<Account> => {
    const raw = await apiClient.get(`/api/v1/accounts/${id}`);
    return normalizeAccount(raw);
  },

  createAccount: async (payload: Partial<Account>): Promise<Account> => {
    const raw = await apiClient.post("/api/v1/accounts", payload);
    return normalizeAccount(raw);
  },

  updateAccount: async (id: string, payload: Partial<Account>): Promise<Account> => {
    const res = await apiClient(`/api/v1/accounts/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload)
    });
    const raw = await res.json();
    return normalizeAccount(raw);
  },

  getAccountContacts: async (accountId: string): Promise<Contact[]> => {
    const raw = await apiClient.get(`/api/v1/accounts/${accountId}/contacts`);
    return Array.isArray(raw) ? raw.map(normalizeContact) : [];
  },

  getAccountOpportunities: async (accountId: string): Promise<Opportunity[]> => {
    const raw = await apiClient.get(`/api/v1/accounts/${accountId}/deals`);
    return Array.isArray(raw) ? raw.map(normalizeOpportunity) : [];
  },

  getAccountQuotes: async (accountId: string): Promise<Quote[]> => {
    const raw = await apiClient.get(`/api/v1/accounts/${accountId}/quotes`);
    return Array.isArray(raw) ? raw.map(normalizeQuote) : [];
  },

  getAccountOrders: async (accountId: string): Promise<Order[]> => {
    const raw = await apiClient.get(`/api/v1/accounts/${accountId}/orders`);
    return Array.isArray(raw) ? raw.map(normalizeOrder) : [];
  }
};
