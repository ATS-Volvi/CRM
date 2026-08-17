/**
 * CRM Query Key Contracts
 * Standardized hierarchical cache keys for frontend data querying and invalidation.
 */

export const queryKeys = {
  leads: {
    all: ["leads"] as const,
    lists: () => [...queryKeys.leads.all, "list"] as const,
    list: (params?: Record<string, any>) => [...queryKeys.leads.lists(), params] as const,
    details: () => [...queryKeys.leads.all, "detail"] as const,
    detail: (id: string) => [...queryKeys.leads.details(), id] as const,
    activities: (id: string) => [...queryKeys.leads.detail(id), "activities"] as const,
  },
  accounts: {
    all: ["accounts"] as const,
    lists: () => [...queryKeys.accounts.all, "list"] as const,
    list: (params?: Record<string, any>) => [...queryKeys.accounts.lists(), params] as const,
    details: () => [...queryKeys.accounts.all, "detail"] as const,
    detail: (id: string) => [...queryKeys.accounts.details(), id] as const,
    contacts: (id: string) => [...queryKeys.accounts.detail(id), "contacts"] as const,
    opportunities: (id: string) => [...queryKeys.accounts.detail(id), "opportunities"] as const,
    quotes: (id: string) => [...queryKeys.accounts.detail(id), "quotes"] as const,
    orders: (id: string) => [...queryKeys.accounts.detail(id), "orders"] as const,
    activities: (id: string) => [...queryKeys.accounts.detail(id), "activities"] as const,
  },
  contacts: {
    all: ["contacts"] as const,
    lists: () => [...queryKeys.contacts.all, "list"] as const,
    list: (params?: Record<string, any>) => [...queryKeys.contacts.lists(), params] as const,
    details: () => [...queryKeys.contacts.all, "detail"] as const,
    detail: (id: string) => [...queryKeys.contacts.details(), id] as const,
  },
  opportunities: {
    all: ["opportunities"] as const,
    lists: () => [...queryKeys.opportunities.all, "list"] as const,
    list: (params?: Record<string, any>) => [...queryKeys.opportunities.lists(), params] as const,
    details: () => [...queryKeys.opportunities.all, "detail"] as const,
    detail: (id: string) => [...queryKeys.opportunities.details(), id] as const,
    quotes: (id: string) => [...queryKeys.opportunities.detail(id), "quotes"] as const,
    activities: (id: string) => [...queryKeys.opportunities.detail(id), "activities"] as const,
  },
  quotes: {
    all: ["quotes"] as const,
    lists: () => [...queryKeys.quotes.all, "list"] as const,
    list: (params?: Record<string, any>) => [...queryKeys.quotes.lists(), params] as const,
    details: () => [...queryKeys.quotes.all, "detail"] as const,
    detail: (id: string) => [...queryKeys.quotes.details(), id] as const,
    revisions: (id: string) => [...queryKeys.quotes.detail(id), "revisions"] as const,
  },
  orders: {
    all: ["orders"] as const,
    lists: () => [...queryKeys.orders.all, "list"] as const,
    list: (params?: Record<string, any>) => [...queryKeys.orders.lists(), params] as const,
    details: () => [...queryKeys.orders.all, "detail"] as const,
    detail: (id: string) => [...queryKeys.orders.details(), id] as const,
  },
  activities: {
    all: ["activities"] as const,
    lists: () => [...queryKeys.activities.all, "list"] as const,
    list: (params?: Record<string, any>) => [...queryKeys.activities.lists(), params] as const,
    byEntity: (entityType: string, entityId: string) => [...queryKeys.activities.all, entityType, entityId] as const,
  },
  approvals: {
    all: ["approvals"] as const,
    lists: () => [...queryKeys.approvals.all, "list"] as const,
    list: (params?: Record<string, any>) => [...queryKeys.approvals.lists(), params] as const,
    pending: () => [...queryKeys.approvals.all, "pending"] as const,
    detail: (id: string) => [...queryKeys.approvals.all, "detail", id] as const,
  },
  marketing: {
    campaigns: () => ["marketing", "campaigns"] as const,
    leadSources: () => ["marketing", "lead-sources"] as const,
    attribution: (entityId?: string) => ["marketing", "attribution", entityId || "all"] as const,
  },
  fulfillments: {
    all: ["fulfillments"] as const,
    lists: () => [...queryKeys.fulfillments.all, "list"] as const,
    list: (params?: Record<string, any>) => [...queryKeys.fulfillments.lists(), params] as const,
    details: () => [...queryKeys.fulfillments.all, "detail"] as const,
    detail: (id: string) => [...queryKeys.fulfillments.details(), id] as const,
    byOrder: (orderId: string) => [...queryKeys.fulfillments.all, "by-order", orderId] as const,
  },
  assets: {
    all: ["assets"] as const,
    lists: () => [...queryKeys.assets.all, "list"] as const,
    list: (params?: Record<string, any>) => [...queryKeys.assets.lists(), params] as const,
    details: () => [...queryKeys.assets.all, "detail"] as const,
    detail: (id: string) => [...queryKeys.assets.details(), id] as const,
    byAccount: (accountId: string) => [...queryKeys.assets.all, "by-account", accountId] as const,
    byOrder: (orderId: string) => [...queryKeys.assets.all, "by-order", orderId] as const,
  },
};
