/**
 * CRM Approvals API Client
 */

import { apiClient } from "../lib/apiClient";
import { ApprovalRequest, PaginatedResponse, PaginationParams } from "../types";
import { normalizeApproval, normalizePaginatedResponse } from "./adapters";

export const approvalsApi = {
  getApprovals: async (params: PaginationParams & { status?: string } = {}): Promise<PaginatedResponse<ApprovalRequest>> => {
    const query = new URLSearchParams();
    if (params.page) query.set("page", String(params.page));
    if (params.limit) query.set("limit", String(params.limit));
    if (params.status) query.set("status", params.status);

    const queryString = query.toString() ? `?${query.toString()}` : "";
    const raw = await apiClient.get(`/api/v1/approvals${queryString}`);
    return normalizePaginatedResponse(raw, normalizeApproval);
  },

  getApprovalById: async (id: string): Promise<ApprovalRequest> => {
    const raw = await apiClient.get(`/api/v1/approvals/${id}`);
    return normalizeApproval(raw);
  },

  decideApproval: async (id: string, decision: "APPROVED" | "REJECTED" | "CHANGES_REQUESTED", comment?: string): Promise<ApprovalRequest> => {
    const res = await apiClient(`/api/v1/approvals/${id}/decision`, {
      method: "POST",
      body: JSON.stringify({ decision, comment })
    });
    const raw = await res.json();
    return normalizeApproval(raw);
  }
};
