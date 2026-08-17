import { apiClient } from "../lib/apiClient";
import { Fulfillment, FulfillmentItem, PaginatedResponse } from "../types";
import { normalizePaginatedResponse } from "./adapters";

export interface FulfillmentFilterParams {
  page?: number;
  limit?: number;
  status?: string;
  priority?: string;
  assignedUserId?: string;
  search?: string;
}

export const fulfillmentsApi = {
  getFulfillments: async (params?: FulfillmentFilterParams): Promise<PaginatedResponse<Fulfillment>> => {
    const query = new URLSearchParams();
    if (params?.page) query.set("page", String(params.page));
    if (params?.limit) query.set("limit", String(params.limit));
    if (params?.status) query.set("status", params.status);
    if (params?.priority) query.set("priority", params.priority);
    if (params?.assignedUserId) query.set("assignedUserId", params.assignedUserId);
    if (params?.search) query.set("search", params.search);

    const queryString = query.toString() ? `?${query.toString()}` : "";
    const raw = await apiClient.get(`/api/v1/fulfillments${queryString}`);
    return normalizePaginatedResponse(raw, (f) => f);
  },

  getFulfillmentById: async (id: string): Promise<Fulfillment> => {
    const raw = await apiClient.get(`/api/v1/fulfillments/${id}`);
    return raw;
  },

  getFulfillmentByOrderId: async (orderId: string): Promise<Fulfillment> => {
    const raw = await apiClient.get(`/api/v1/orders/${orderId}/fulfillment`);
    return raw;
  },

  updateFulfillmentStatus: async (
    id: string,
    status: string,
    updates?: {
      assignedUserId?: string;
      plannedStartDate?: string;
      plannedCompletionDate?: string;
      actualStartDate?: string;
      actualCompletionDate?: string;
      dispatchReference?: string;
      carrier?: string;
      actualDeliveryDate?: string;
      notes?: string;
      reason?: string;
    }
  ): Promise<{ fulfillment: Fulfillment; previousStatus: string; newStatus: string; createdAssets?: any[] }> => {
    const res = await apiClient(`/api/v1/fulfillments/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status, updates })
    });
    return res.json();
  },

  updateFulfillmentItem: async (
    itemId: string,
    updates: {
      quantityPlanned?: number;
      quantityAllocated?: number;
      quantityInProduction?: number;
      quantityReady?: number;
      quantityDispatched?: number;
      quantityDelivered?: number;
      status?: string;
    }
  ): Promise<{ message: string; item: FulfillmentItem }> => {
    const res = await apiClient(`/api/v1/fulfillments/items/${itemId}`, {
      method: "PATCH",
      body: JSON.stringify(updates)
    });
    return res.json();
  }
};
