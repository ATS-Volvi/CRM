import { SiteInspectionAuditLog, User } from "@nexus-crm/database";
import crypto from "crypto";

export interface LogAuditParams {
  inspectionId?: string | null;
  entityType: "INSPECTION" | "SETTING" | "PROFILE" | "HOLIDAY" | "ATTACHMENT" | "EXPORT";
  entityId?: string | null;
  action: string;
  actorId?: string | null;
  actorRole?: string | null;
  fromValue?: any;
  toValue?: any;
  reason?: string | null;
  ip?: string | null;
  transaction?: any;
}

/**
 * Appends an entry to the immutable, append-only SiteInspectionAuditLogs table.
 */
export async function logSiteInspectionAudit(params: LogAuditParams): Promise<any> {
  try {
    const serialize = (val: any): string | null => {
      if (val === undefined || val === null) return null;
      if (typeof val === "string") return val;
      try {
        return JSON.stringify(val);
      } catch {
        return String(val);
      }
    };

    return await SiteInspectionAuditLog.create(
      {
        id: crypto.randomUUID(),
        inspectionId: params.inspectionId || null,
        entityType: params.entityType,
        entityId: params.entityId || null,
        action: params.action,
        actorId: params.actorId || null,
        actorRole: params.actorRole || null,
        fromValue: serialize(params.fromValue),
        toValue: serialize(params.toValue),
        reason: params.reason || null,
        ip: params.ip || null,
      },
      params.transaction ? { transaction: params.transaction } : undefined
    );
  } catch (err: any) {
    console.error("[SiteInspectionAudit] Failed to write audit log:", err?.message || err);
    return null;
  }
}

/**
 * Retrieves audit logs with optional filtering and pagination.
 * Accessible to admin, director, and ops_manager.
 */
export async function getSiteInspectionAuditLogs(query: {
  inspectionId?: string;
  entityType?: string;
  action?: string;
  actorId?: string;
  limit?: number;
  offset?: number;
}): Promise<{ total: number; logs: any[] }> {
  const where: any = {};
  if (query.inspectionId) where.inspectionId = query.inspectionId;
  if (query.entityType) where.entityType = query.entityType;
  if (query.action) where.action = query.action;
  if (query.actorId) where.actorId = query.actorId;

  const limit = Math.min(Math.max(Number(query.limit) || 50, 1), 200);
  const offset = Math.max(Number(query.offset) || 0, 0);

  const { count, rows } = await SiteInspectionAuditLog.findAndCountAll({
    where,
    limit,
    offset,
    order: [["createdAt", "DESC"]],
    include: [
      {
        model: User,
        as: "actor",
        attributes: ["id", "name", "email", "role"],
      },
    ],
  });

  return { total: count, logs: rows };
}
