import { apiClient } from "../lib/apiClient";
import { Asset, PaginatedResponse } from "../types";
import { normalizePaginatedResponse, normalizeAsset } from "./adapters";

export interface AssetFilterParams {
  page?: number;
  limit?: number;
  status?: string;
  type?: string;
  accountId?: string;
  customerId?: string;
  orderId?: string;
  search?: string;
}

export const assetsApi = {
  getAssets: async (params?: AssetFilterParams): Promise<PaginatedResponse<Asset>> => {
    const query = new URLSearchParams();
    if (params?.page) query.set("page", String(params.page));
    if (params?.limit) query.set("limit", String(params.limit));
    if (params?.status) query.set("status", params.status);
    if (params?.type) query.set("type", params.type);
    if (params?.accountId || params?.customerId) query.set("customerId", (params.accountId || params.customerId)!);
    if (params?.orderId) query.set("orderId", params.orderId);
    if (params?.search) query.set("search", params.search);

    const queryString = query.toString() ? `?${query.toString()}` : "";
    const raw = await apiClient.get(`/api/v1/assets${queryString}`);
    return normalizePaginatedResponse(raw, normalizeAsset);
  },

  getAssetById: async (id: string): Promise<Asset> => {
    const raw = await apiClient.get(`/api/v1/assets/${id}`);
    return normalizeAsset(raw);
  },

  createAsset: async (data: Partial<Asset>): Promise<Asset> => {
    const res = await apiClient("/api/v1/assets", {
      method: "POST",
      body: JSON.stringify(data)
    });
    const raw = await res.json();
    return normalizeAsset(raw);
  },

  updateAsset: async (id: string, data: Partial<Asset> & { statusChangeNotes?: string }): Promise<Asset> => {
    const res = await apiClient(`/api/v1/assets/${id}`, {
      method: "PUT",
      body: JSON.stringify(data)
    });
    const raw = await res.json();
    return normalizeAsset(raw);
  },

  deleteAsset: async (id: string): Promise<{ message: string; id: string }> => {
    const res = await apiClient(`/api/v1/assets/${id}`, {
      method: "DELETE"
    });
    return res.json();
  }
};
