/**
 * CRM Orders API Client
 */

import { apiClient } from "../lib/apiClient";
import { Order, PaginatedResponse, PaginationParams } from "../types";
import { normalizeOrder, normalizePaginatedResponse } from "./adapters";

export const ordersApi = {
  getOrders: async (params: PaginationParams & { accountId?: string; status?: string } = {}): Promise<PaginatedResponse<Order>> => {
    const query = new URLSearchParams();
    if (params.page) query.set("page", String(params.page));
    if (params.limit) query.set("limit", String(params.limit));
    if (params.accountId) query.set("customerId", params.accountId);
    if (params.status) query.set("status", params.status);

    const queryString = query.toString() ? `?${query.toString()}` : "";
    const raw = await apiClient.get(`/api/v1/orders${queryString}`);
    return normalizePaginatedResponse(raw, normalizeOrder);
  },

  getOrderById: async (id: string): Promise<Order> => {
    const raw = await apiClient.get(`/api/v1/orders/${id}`);
    return normalizeOrder(raw);
  },

  createOrderFromQuote: async (quoteId: string): Promise<{ message: string; order: Order; orderNumber: string }> => {
    const res = await apiClient(`/api/v1/orders/from-quote/${quoteId}`, {
      method: "POST"
    });
    const raw = await res.json();
    return {
      message: raw.message,
      order: normalizeOrder(raw.order),
      orderNumber: raw.orderNumber
    };
  },

  updateOrderStatus: async (id: string, status: string): Promise<Order> => {
    const res = await apiClient(`/api/v1/purchase-orders/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status })
    });
    const raw = await res.json();
    return normalizeOrder(raw);
  }
};

// Backward compatibility alias
export const purchaseOrdersApi = ordersApi;
