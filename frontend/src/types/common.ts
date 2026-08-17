/**
 * Canonical CRM Common & Shared Types
 */

export type EntityId = string;

export interface PaginatedResponse<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: "ASC" | "DESC" | "asc" | "desc";
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export type UserRole = "admin" | "sales_manager" | "senior_ae" | "sales_rep" | "viewer";

export interface RolePermissions {
  canViewInternalCost: boolean;
  canApproveQuotes: boolean;
  canEditDiscount: boolean;
  canManageSettings: boolean;
  canReassignLeads: boolean;
  canViewAllAccounts: boolean;
}

export const ROLE_PERMISSIONS: Record<UserRole, RolePermissions> = {
  admin: {
    canViewInternalCost: true,
    canApproveQuotes: true,
    canEditDiscount: true,
    canManageSettings: true,
    canReassignLeads: true,
    canViewAllAccounts: true,
  },
  sales_manager: {
    canViewInternalCost: true,
    canApproveQuotes: true,
    canEditDiscount: true,
    canManageSettings: false,
    canReassignLeads: true,
    canViewAllAccounts: true,
  },
  senior_ae: {
    canViewInternalCost: false,
    canApproveQuotes: true,
    canEditDiscount: true,
    canManageSettings: false,
    canReassignLeads: false,
    canViewAllAccounts: false,
  },
  sales_rep: {
    canViewInternalCost: false,
    canApproveQuotes: false,
    canEditDiscount: true,
    canManageSettings: false,
    canReassignLeads: false,
    canViewAllAccounts: false,
  },
  viewer: {
    canViewInternalCost: false,
    canApproveQuotes: false,
    canEditDiscount: false,
    canManageSettings: false,
    canReassignLeads: false,
    canViewAllAccounts: false,
  },
};
