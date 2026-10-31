import { apiClient } from "../lib/apiClient";
import {
  SiteBase,
  SiteFacility,
  SiteInspectionRecord,
  SiteInspectionGateResult,
} from "../lib/siteInspection";

export interface MasterDataResponse {
  bases: SiteBase[];
  facilities: SiteFacility[];
  roadConditions: ("Good" | "Fair" | "Poor")[];
  volumeUnits: ("L" | "m3" | "ton" | "loads")[];
  serviceTypes: ("SEWAGE" | "GENERAL" | "HAZARDOUS")[];
  storageDriver?: string;
}

export const siteInspectionApi = {
  async getMasterData(): Promise<MasterDataResponse> {
    return apiClient.get<MasterDataResponse>("/api/v1/site-inspections/master");
  },

  async getSiteManagers(): Promise<Array<{ id: string; name: string; email: string; role: string }>> {
    return apiClient.get<any[]>("/api/v1/site-inspections/site-managers");
  },

  async listInspections(params?: { status?: string; q?: string; mine?: boolean }): Promise<SiteInspectionRecord[]> {
    const query = new URLSearchParams();
    if (params?.status) query.set("status", params.status);
    if (params?.q) query.set("q", params.q);
    if (params?.mine) query.set("mine", "true");
    const qs = query.toString() ? `?${query.toString()}` : "";
    return apiClient.get<SiteInspectionRecord[]>(`/api/v1/site-inspections${qs}`);
  },

  async getInspection(id: string): Promise<SiteInspectionRecord> {
    return apiClient.get<SiteInspectionRecord>(`/api/v1/site-inspections/${id}`);
  },

  async saveDraft(id: string, data: Partial<SiteInspectionRecord>): Promise<SiteInspectionRecord> {
    return apiClient.put<SiteInspectionRecord>(`/api/v1/site-inspections/${id}`, data);
  },

  async checkCompleteness(id: string): Promise<{ valid: boolean; errors: string[] }> {
    return apiClient.get<{ valid: boolean; errors: string[] }>(`/api/v1/site-inspections/${id}/completeness`);
  },

  async submitInspection(id: string, data?: Partial<SiteInspectionRecord>): Promise<SiteInspectionRecord> {
    return apiClient.post<SiteInspectionRecord>(`/api/v1/site-inspections/${id}/submit`, data || {});
  },

  async reviewInspection(
    id: string,
    action: "APPROVE" | "REQUEST_CHANGES",
    comment?: string
  ): Promise<SiteInspectionRecord> {
    return apiClient.post<SiteInspectionRecord>(`/api/v1/site-inspections/${id}/review`, { action, comment });
  },

  async reassignInspection(id: string, assignedToId: string, reason?: string): Promise<SiteInspectionRecord> {
    return apiClient.post<SiteInspectionRecord>(`/api/v1/site-inspections/${id}/reassign`, { assignedToId, reason });
  },

  async presignAttachment(
    id: string,
    data: { fileName: string; mimeType: string; sizeBytes: number }
  ): Promise<{ uploadUrl: string; storageKey: string; expiresIn: number }> {
    const res = await apiClient(`/api/v1/site-inspections/${id}/attachments/presign`, {
      method: "POST",
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      let errText = "Failed to presign upload";
      try {
        const errJson = await res.json();
        errText = errJson.error || errText;
      } catch {}
      throw new Error(errText);
    }
    return res.json();
  },

  async completeAttachment(
    id: string,
    data: { storageKey: string; fileName: string; caption?: string; tag?: string }
  ): Promise<any> {
    const res = await apiClient(`/api/v1/site-inspections/${id}/attachments/complete`, {
      method: "POST",
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      let errText = "Failed to complete upload";
      try {
        const errJson = await res.json();
        errText = errJson.error || errText;
      } catch {}
      throw new Error(errText);
    }
    return res.json();
  },

  async uploadAttachments(id: string, formData: FormData): Promise<any[]> {
    const res = await apiClient(`/api/v1/site-inspections/${id}/attachments`, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) {
      let errText = "Upload failed";
      try {
        const errJson = await res.json();
        errText = errJson.error || errText;
      } catch {}
      throw new Error(errText);
    }
    return res.json();
  },

  async updateAttachment(
    id: string,
    attId: string,
    data: { caption?: string; tag?: string }
  ): Promise<any> {
    const res = await apiClient(`/api/v1/site-inspections/${id}/attachments/${attId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to update attachment");
    return res.json();
  },

  async deleteAttachment(id: string, attId: string): Promise<{ success: boolean }> {
    return apiClient.delete(`/api/v1/site-inspections/${id}/attachments/${attId}`);
  },

  async getLeadSiteInspection(leadId: string): Promise<{
    gate: SiteInspectionGateResult;
    inspection: SiteInspectionRecord | null;
  }> {
    return apiClient.get<{ gate: SiteInspectionGateResult; inspection: SiteInspectionRecord | null }>(
      `/api/v1/leads/${leadId}/site-inspection`
    );
  },

  async requestInspection(
    leadId: string,
    options?: {
      siteAreaName?: string;
      siteLatitudeHint?: number;
      siteLongitudeHint?: number;
      priority?: "LOW" | "NORMAL" | "URGENT";
      priorityReason?: string;
      requestedInspectorId?: string;
      requestedInspectorReason?: string;
      requiredCertifications?: string[];
      requestNote?: string;
    } | string
  ): Promise<SiteInspectionRecord> {
    const payload = typeof options === "string" ? { requestNote: options } : options || {};
    return apiClient.post<SiteInspectionRecord>(`/api/v1/leads/${leadId}/site-inspection/request`, payload);
  },

  // ─── Phase 2 Stage A: Settings, Holidays, Profiles, Audits ───────────────────
  async getSettings(): Promise<any> {
    return apiClient.get<any>("/api/v1/site-inspections/settings");
  },

  async updateSettings(data: any): Promise<{ message: string; settings: any; explanations: Record<string, string> }> {
    return apiClient.put<any>("/api/v1/site-inspections/settings", data);
  },

  async getHolidays(): Promise<any[]> {
    return apiClient.get<any[]>("/api/v1/site-inspections/holidays");
  },

  async addHoliday(data: { date: string; name: string; isRecurringYearly?: boolean; notes?: string }): Promise<any> {
    return apiClient.post<any>("/api/v1/site-inspections/holidays", data);
  },

  async updateHoliday(id: string, data: any): Promise<any> {
    return apiClient.put<any>(`/api/v1/site-inspections/holidays/${id}`, data);
  },

  async deleteHoliday(id: string): Promise<{ success: boolean }> {
    return apiClient.delete<any>(`/api/v1/site-inspections/holidays/${id}`);
  },

  async getInspectorProfiles(): Promise<any[]> {
    return apiClient.get<any[]>("/api/v1/site-inspections/inspectors");
  },

  async updateInspectorProfile(userId: string, data: any): Promise<any> {
    return apiClient.put<any>(`/api/v1/site-inspections/inspectors/${userId}`, data);
  },

  async getAuditLogs(params?: {
    inspectionId?: string;
    entityType?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ rows: any[]; count: number }> {
    const query = new URLSearchParams();
    if (params?.inspectionId) query.set("inspectionId", params.inspectionId);
    if (params?.entityType) query.set("entityType", params.entityType);
    if (params?.limit) query.set("limit", String(params.limit));
    if (params?.offset) query.set("offset", String(params.offset));
    const qs = query.toString() ? `?${query.toString()}` : "";
    return apiClient.get<any>(`/api/v1/site-inspections/audit-logs${qs}`);
  },

  async bulkAssign(data: {
    inspectionIds: string[];
    targetAssigneeId?: string | null;
    reason: string;
  }): Promise<{ assignedCount: number; errors: Array<{ id: string; error: string }> }> {
    return apiClient.post<any>("/api/v1/site-inspections/bulk-assign", data);
  },
};
