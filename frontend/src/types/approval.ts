/**
 * Canonical CRM Approval Request Types
 */

export type ApprovalLevel = "SALES_REP" | "TEAM_LEAD" | "ADMIN";

export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED" | "CHANGES_REQUESTED";

export interface ApprovalRequest {
  id: string;
  quoteId: string;

  approvalLevel: ApprovalLevel;
  status: ApprovalStatus;

  requiredLimit?: number | null;
  actualQuoteValue?: number | null;
  discount?: number | null;
  margin?: number | null;

  reason?: string | null;
  comment?: string | null;

  salesRepId?: string;
  salesRep?: {
    id: string;
    name: string;
    email: string;
  };

  requestedBy?: string;
  approverId?: string | null;
  approvedBy?: string | null;
  approver?: {
    id: string;
    name: string;
    email: string;
  } | null;

  decision?: "APPROVED" | "REJECTED" | "CHANGES_REQUESTED" | null;

  createdAt: string;
  updatedAt: string;
}
