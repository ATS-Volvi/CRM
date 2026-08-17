/**
 * Canonical CRM Asset Types (Contract only for Phase 3)
 * Represents delivered and deployed physical/digital equipment owned by an Account.
 */

export type AssetStatus =
  | "IN_STOCK"
  | "DEPLOYED"
  | "UNDER_MAINTENANCE"
  | "RETURNED"
  | "DECOMMISSIONED";

export interface Asset {
  id: string;
  assetNumber?: string;
  name?: string;

  accountId: string;
  customerId?: string; // compatibility alias

  orderId?: string | null;
  dealId?: string | null; // compatibility alias
  orderItemId?: string | null;

  productServiceId?: string | null;
  serialNumber?: string | null;

  type?: string | null;
  condition?: "NEW" | "GOOD" | "FAIR" | "POOR" | "DAMAGED" | string | null;

  installationDate?: string | null;
  deployedAt?: string | null; // compatibility alias
  commissionDate?: string | null;

  warrantyStart?: string | null;
  warrantyEnd?: string | null;
  expectedReturnDate?: string | null;

  location?: string | null;
  status?: AssetStatus | string;
  notes?: string | null;

  createdAt?: string;
  updatedAt?: string;
}
