import { apiClient } from "../lib/apiClient";

export interface FlaggedEmailItem {
  id: string;
  source: string;
  channel?: string;
  disposition?: 'review' | 'pending_clarification' | 'archived' | 'promoted' | 'rejected';
  intentLabel?: string;
  intentScore?: number;
  explanation?: string;
  reason?: string;
  reasons?: string[];
  senderEmail?: string;
  subject?: string;
  payload?: any;
  promotedLeadId?: string;
  reviewedById?: string;
  reviewedBy?: { id: string; name: string; email: string };
  promotedLead?: { id: string; firstName: string; lastName: string; email: string; leadNumber: string };
  reviewedAt?: string;
  autoReplySentAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ShadowLogItem {
  id: string;
  channel: string;
  senderEmail: string;
  subject: string;
  label: string;
  leadScore: number;
  confidence: string;
  action: string;
  reason: string;
  language: string;
  wouldHaveBlocked: boolean;
  enforced: boolean;
  leadId?: string;
  createdAt: string;
}

export interface SenderRuleItem {
  id: string;
  type: 'allow' | 'block';
  matchType: 'email' | 'domain';
  value: string;
  note?: string;
  createdById?: string;
  createdBy?: { id: string; name: string; email: string };
  createdAt: string;
}

export interface FilterStats {
  mode: string;
  totalDecisions: number;
  wouldHaveBlockedCount: number;
  heldToday: number;
  archivedToday: number;
  promotedAfterHold: number;
  needsReviewCount: number;
  waitingReplyCount: number;
  actions: Record<string, number>;
  labels: Record<string, number>;
}

export const leadFilterApi = {
  getHeldEmails: async (params: {
    disposition?: string;
    channel?: string;
    page?: number;
    limit?: number;
    search?: string;
  } = {}): Promise<{ items: FlaggedEmailItem[]; total: number; page: number; limit: number; totalPages: number }> => {
    const query = new URLSearchParams();
    if (params.disposition) query.set('disposition', params.disposition);
    if (params.channel) query.set('channel', params.channel);
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    if (params.search) query.set('search', params.search);

    const queryString = query.toString() ? `?${query.toString()}` : '';
    return await apiClient.get(`/api/v1/lead-filter/held${queryString}`);
  },

  promoteHeldEmail: async (id: string, addSenderToAllowlist: boolean = false): Promise<any> => {
    return await apiClient.post(`/api/v1/lead-filter/held/${id}/promote`, { addSenderToAllowlist });
  },

  rejectHeldEmail: async (
    id: string,
    options: { blockSender?: boolean; blockDomain?: boolean } = {}
  ): Promise<any> => {
    return await apiClient.post(`/api/v1/lead-filter/held/${id}/reject`, options);
  },

  getFilterStats: async (): Promise<FilterStats> => {
    return await apiClient.get('/api/v1/lead-filter/stats');
  },

  getShadowLogs: async (params: { page?: number; limit?: number } = {}): Promise<{
    items: ShadowLogItem[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> => {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    const queryString = query.toString() ? `?${query.toString()}` : '';
    return await apiClient.get(`/api/v1/lead-filter/shadow-logs${queryString}`);
  },

  getSenderRules: async (): Promise<SenderRuleItem[]> => {
    return await apiClient.get('/api/v1/lead-filter/sender-rules');
  },

  createSenderRule: async (data: {
    type: 'allow' | 'block';
    matchType: 'email' | 'domain';
    value: string;
    note?: string;
  }): Promise<SenderRuleItem> => {
    return await apiClient.post('/api/v1/lead-filter/sender-rules', data);
  },

  deleteSenderRule: async (id: string): Promise<{ success: boolean }> => {
    return await apiClient.delete(`/api/v1/lead-filter/sender-rules/${id}`);
  },
};
