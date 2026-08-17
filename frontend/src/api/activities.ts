/**
 * CRM Activities API Client
 */

import { apiClient } from "../lib/apiClient";
import { Activity, PaginatedResponse, PaginationParams } from "../types";
import { normalizeActivity, normalizePaginatedResponse } from "./adapters";

export const activitiesApi = {
  getActivities: async (params: PaginationParams & { entityType?: string; entityId?: string } = {}): Promise<PaginatedResponse<Activity>> => {
    const query = new URLSearchParams();
    if (params.page) query.set("page", String(params.page));
    if (params.limit) query.set("limit", String(params.limit));
    if (params.entityType && params.entityId) {
      if (params.entityType === "lead") query.set("leadId", params.entityId);
      if (params.entityType === "account") query.set("customerId", params.entityId);
      if (params.entityType === "opportunity") query.set("dealId", params.entityId);
    }

    const queryString = query.toString() ? `?${query.toString()}` : "";
    const raw = await apiClient.get(`/api/v1/activities${queryString}`);
    return normalizePaginatedResponse(raw, normalizeActivity);
  },

  createActivity: async (payload: Partial<Activity>): Promise<Activity> => {
    const raw = await apiClient.post("/api/v1/activities", {
      ...payload,
      customerId: payload.accountId || payload.customerId,
      dealId: payload.opportunityId || payload.dealId,
    });
    return normalizeActivity(raw);
  }
};
