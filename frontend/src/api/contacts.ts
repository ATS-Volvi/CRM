/**
 * CRM Contacts API Client
 */

import { apiClient } from "../lib/apiClient";
import { Contact, PaginatedResponse, PaginationParams } from "../types";
import { normalizeContact, normalizePaginatedResponse } from "./adapters";

export const contactsApi = {
  getContacts: async (params: PaginationParams & { accountId?: string } = {}): Promise<PaginatedResponse<Contact>> => {
    const query = new URLSearchParams();
    if (params.page) query.set("page", String(params.page));
    if (params.limit) query.set("limit", String(params.limit));
    if (params.search) query.set("search", params.search);
    if (params.accountId) query.set("accountId", params.accountId);

    const queryString = query.toString() ? `?${query.toString()}` : "";
    const raw = await apiClient.get(`/api/v1/contacts${queryString}`);
    return normalizePaginatedResponse(raw, normalizeContact);
  },

  getContactById: async (id: string): Promise<Contact> => {
    const raw = await apiClient.get(`/api/v1/contacts/${id}`);
    return normalizeContact(raw);
  },

  createContact: async (payload: Partial<Contact>): Promise<Contact> => {
    const raw = await apiClient.post("/api/v1/contacts", payload);
    return normalizeContact(raw);
  },

  updateContact: async (id: string, payload: Partial<Contact>): Promise<Contact> => {
    const res = await apiClient(`/api/v1/contacts/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload)
    });
    const raw = await res.json();
    return normalizeContact(raw);
  }
};
