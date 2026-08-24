import { sequelize } from "@nexus-crm/database";
import { Op } from "sequelize";

export interface RecordAccessResult {
  canRead: boolean;
  canWrite: boolean;
  isViewOnly: boolean;
  accessLevel: "full" | "view_only" | "none";
  reason?: string;
}

const ADMIN_ROLES = ["admin", "director", "manager", "sales_manager", "system"];

/**
 * Evaluates record access level for a Lead.
 */
export async function getLeadAccessLevel(
  userId: string | null | undefined,
  userRole: string | null | undefined,
  lead: any
): Promise<RecordAccessResult> {
  // Fail closed if userId or lead object is missing
  if (!userId) {
    return { canRead: false, canWrite: false, isViewOnly: false, accessLevel: "none", reason: "Unauthorized: User context missing" };
  }
  if (!lead) {
    return { canRead: false, canWrite: false, isViewOnly: false, accessLevel: "none", reason: "Invalid request: No lead specified" };
  }

  // Admin/Manager roles get full access
  if (userRole && ADMIN_ROLES.includes(userRole.toLowerCase())) {
    return { canRead: true, canWrite: true, isViewOnly: false, accessLevel: "full" };
  }

  // If user is current owner (assignedToId)
  if (lead && lead.assignedToId === userId) {
    return { canRead: true, canWrite: true, isViewOnly: false, accessLevel: "full" };
  }

  // Check prior ownership via LeadReassignmentHistory, LeadAssignmentAudit, or DealReassignmentHistory
  const leadId = lead?.id || (typeof lead === "string" ? lead : null);
  if (leadId) {
    const { LeadReassignmentHistory, LeadAssignmentAudit } = sequelize.models;

    if (LeadReassignmentHistory) {
      const priorHandoff = await LeadReassignmentHistory.findOne({
        where: {
          leadId,
          [Op.or]: [{ oldAssignedToId: userId }, { newAssignedToId: userId }]
        }
      });

      if (priorHandoff) {
        return {
          canRead: true,
          canWrite: false,
          isViewOnly: true,
          accessLevel: "view_only",
          reason: "Handed off — view only. This lead has been reassigned to another representative. You have permanent read-only access to historical records."
        };
      }
    }

    if (LeadAssignmentAudit) {
      const priorAudit = await LeadAssignmentAudit.findOne({
        where: {
          leadId,
          [Op.or]: [{ previousOwnerId: userId }, { assignedToId: userId }]
        }
      });
      if (priorAudit) {
        return {
          canRead: true,
          canWrite: false,
          isViewOnly: true,
          accessLevel: "view_only",
          reason: "Handed off — view only. This lead has been reassigned to another representative. You have permanent read-only access to historical records."
        };
      }
    }
  }

  // Otherwise, user is an unrelated sales rep
  return { canRead: false, canWrite: false, isViewOnly: false, accessLevel: "none" };
}

/**
 * Evaluates record access level for a Deal / Opportunity.
 */
export async function getDealAccessLevel(
  userId: string | null | undefined,
  userRole: string | null | undefined,
  deal: any
): Promise<RecordAccessResult> {
  // Fail closed if userId or deal object is missing
  if (!userId) {
    return { canRead: false, canWrite: false, isViewOnly: false, accessLevel: "none", reason: "Unauthorized: User context missing" };
  }
  if (!deal) {
    return { canRead: false, canWrite: false, isViewOnly: false, accessLevel: "none", reason: "Invalid request: No deal specified" };
  }

  // Admin/Manager roles get full access
  if (userRole && ADMIN_ROLES.includes(userRole.toLowerCase())) {
    return { canRead: true, canWrite: true, isViewOnly: false, accessLevel: "full" };
  }

  // If user is current deal owner
  if (deal && deal.ownerId === userId) {
    return { canRead: true, canWrite: true, isViewOnly: false, accessLevel: "full" };
  }

  const dealId = deal?.id || (typeof deal === "string" ? deal : null);
  const leadId = deal?.leadId;

  // Check DealReassignmentHistory
  if (dealId) {
    const { DealReassignmentHistory, DealOwner } = sequelize.models;

    if (DealReassignmentHistory) {
      const priorDealHandoff = await DealReassignmentHistory.findOne({
        where: {
          dealId,
          [Op.or]: [{ oldOwnerId: userId }, { newOwnerId: userId }]
        }
      });
      if (priorDealHandoff) {
        return {
          canRead: true,
          canWrite: false,
          isViewOnly: true,
          accessLevel: "view_only",
          reason: "Handed off — view only. This deal has been reassigned to another representative. You have permanent read-only access to historical records."
        };
      }
    }

    if (DealOwner) {
      const dealOwnerRow = await DealOwner.findOne({ where: { dealId, userId } });
      if (dealOwnerRow) {
        return {
          canRead: true,
          canWrite: false,
          isViewOnly: true,
          accessLevel: "view_only",
          reason: "Handed off — view only. You are a recorded split owner / past owner of this deal."
        };
      }
    }
  }

  // Also check lead reassignment history if deal is linked to a lead
  if (leadId) {
    const leadAccess = await getLeadAccessLevel(userId, userRole, { id: leadId, assignedToId: null });
    if (leadAccess.canRead) {
      return {
        canRead: true,
        canWrite: false,
        isViewOnly: true,
        accessLevel: "view_only",
        reason: "Handed off — view only. The parent lead for this deal was reassigned to another representative."
      };
    }
  }

  return { canRead: false, canWrite: false, isViewOnly: false, accessLevel: "none" };
}

/**
 * Unified helper to check record access given leadId, dealId, or accountId.
 */
export async function checkRecordAccess(
  userId: string | null | undefined,
  userRole: string | null | undefined,
  options: { leadId?: string | null; dealId?: string | null; accountId?: string | null }
): Promise<RecordAccessResult> {
  // Fail closed if userId missing
  if (!userId) {
    return { canRead: false, canWrite: false, isViewOnly: false, accessLevel: "none", reason: "Unauthorized: User context missing" };
  }

  if (userRole && ADMIN_ROLES.includes(userRole.toLowerCase())) {
    return { canRead: true, canWrite: true, isViewOnly: false, accessLevel: "full" };
  }

  if (options.dealId) {
    const { Deal } = sequelize.models;
    const deal = await Deal.findByPk(options.dealId);
    if (deal) {
      return getDealAccessLevel(userId, userRole, deal);
    }
  }

  if (options.leadId) {
    const { Lead } = sequelize.models;
    const lead = await Lead.findByPk(options.leadId);
    if (lead) {
      return getLeadAccessLevel(userId, userRole, lead);
    }
  }

  // Fail closed if no valid lead or deal specified/found
  return { canRead: false, canWrite: false, isViewOnly: false, accessLevel: "none", reason: "Invalid request: Target record not specified or not found" };
}
