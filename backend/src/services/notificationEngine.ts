import { sequelize } from "@nexus-crm/database";
import crypto from "crypto";
import { Op } from "sequelize";

export type Role = "SALES_REP" | "TEAM_LEAD" | "ADMIN";
export type Severity = "INFO" | "ACTION_REQUIRED" | "WARNING" | "CRITICAL";

export interface CreateNotificationInput {
  userId?: string | null;
  role?: Role | string;
  type: string;
  severity?: Severity;
  title: string;
  message: string;
  link?: string | null;
  actionUrl?: string | null;
  entityType?: "LEAD" | "QUOTE" | "APPROVAL" | "TASK" | "MEETING" | "DEAL" | "SYSTEM" | "INVOICE" | string;
  entityId?: string | null;
  source?: string | null;
  groupKey?: string | null;
  eventId?: string | null;
  metadata?: any;
}

/**
 * Core Idempotent Notification Dispatcher
 * Prevents duplicates by checking eventId / source+entityId+type combination
 */
export async function createNotification(input: CreateNotificationInput) {
  try {
    const eventId = input.eventId || (input.source && input.entityId && input.type ? `${input.source}_${input.entityId}_${input.type}` : null);

    // 1. Idempotency Check
    if (eventId) {
      const existing = await sequelize.models.Notification.findOne({
        where: {
          [Op.or]: [
            { eventId },
            {
              userId: input.userId || null,
              type: input.type,
              entityId: input.entityId || null
            }
          ]
        }
      });
      if (existing) {
        return existing; // Skip duplicate notification
      }
    }

    // 2. Generate Group Key if not provided (e.g. group-LEAD-2026-08-13-userId)
    const todayStr = new Date().toISOString().split("T")[0];
    const groupKey = input.groupKey || `group_${input.entityType || 'GENERAL'}_${todayStr}_${input.userId || input.role || 'all'}`;
    const actionUrl = input.actionUrl || input.link || (input.entityType && input.entityId ? getDeepLink(input.entityType, input.entityId) : "/home");

    const notification = await sequelize.models.Notification.create({
      id: crypto.randomUUID(),
      userId: input.userId || null,
      role: input.role || "SALES_REP",
      type: input.type,
      severity: input.severity || "INFO",
      title: input.title,
      message: input.message,
      link: actionUrl,
      actionUrl,
      entityType: input.entityType || null,
      entityId: input.entityId || null,
      source: input.source || "system",
      groupKey,
      eventId,
      metadata: input.metadata || null,
      isRead: false,
      readAt: null
    });

    return notification;
  } catch (error: any) {
    console.error("Failed to create notification:", error);
    return null;
  }
}

/**
 * Generate precise deep links for CRM entities
 */
export function getDeepLink(entityType: string, entityId: string): string {
  switch (entityType.toUpperCase()) {
    case "LEAD":
      return `/leads/${entityId}`;
    case "QUOTE":
      return `/quotes`;
    case "APPROVAL":
      return `/approvals`;
    case "TASK":
    case "MEETING":
      return `/activities`;
    case "DEAL":
      return `/pipeline`;
    case "INVOICE":
      return `/invoices`;
    case "SYSTEM":
      return `/settings`;
    default:
      return `/home`;
  }
}

/**
 * Helper: Find Team Lead for a Sales Rep
 */
export async function getTeamLeadIdForUser(repUserId: string): Promise<string | null> {
  try {
    const rep = await sequelize.models.User.findByPk(repUserId);
    if (!rep) return null;
    const r = rep as any;

    if (r.managerId) return r.managerId;

    // Fallback: search for sales_manager or director in same team/department
    const manager = await sequelize.models.User.findOne({
      where: {
        role: { [Op.in]: ["sales_manager", "team_lead", "director"] },
        [Op.or]: [
          { team: r.team || "General" },
          { department: r.department || "Sales" }
        ]
      }
    });

    return manager ? (manager as any).id : null;
  } catch (e) {
    return null;
  }
}

/**
 * Helper: Find all Admins
 */
export async function getAdminUserIds(): Promise<string[]> {
  try {
    const admins = await sequelize.models.User.findAll({
      where: { role: { [Op.in]: ["admin", "director", "super_admin"] } },
      attributes: ["id"]
    });
    return admins.map((a: any) => a.id);
  } catch (e) {
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ROLE-SPECIFIC WORKFLOW EVENT TRIGGERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * EVENT 1: New Lead Assigned
 * - Sales Rep: INFO ("New lead assigned: Michael Hill")
 * - Team Lead: INFO if high-value ("High-value lead assigned to Rahul")
 */
export async function triggerLeadAssignedNotifications(lead: any, assignedUser: any) {
  if (!lead || !assignedUser) return;
  const isHighValue = (lead.leadScore || 50) >= 80 || (lead.leadScore ? lead.leadScore * 10000 : 0) >= 5000000;
  const isHighPriority = lead.temperature === "Hot" || lead.isStrategic;

  // 1. Notify Sales Rep (Operational)
  await createNotification({
    userId: assignedUser.id,
    role: "SALES_REP",
    type: "LEAD_ASSIGNED",
    severity: isHighValue ? "ACTION_REQUIRED" : "INFO",
    title: isHighValue ? "🔥 High-Value Lead Assigned to You" : "New Lead Assigned",
    message: `${lead.company || `${lead.firstName} ${lead.lastName}`} (${lead.source || 'Inbound'}) needs response.`,
    entityType: "LEAD",
    entityId: lead.id,
    source: lead.source || "ingestion",
    eventId: `lead_assigned_${lead.id}_${assignedUser.id}`
  });

  // 2. Notify Team Lead ONLY if High Value / High Priority
  if (isHighValue || isHighPriority) {
    const teamLeadId = await getTeamLeadIdForUser(assignedUser.id);
    if (teamLeadId) {
      await createNotification({
        userId: teamLeadId,
        role: "TEAM_LEAD",
        type: "TEAM_HIGH_VALUE_LEAD",
        severity: "INFO",
        title: "High-Value Lead Assigned to Team",
        message: `High-value lead (${lead.company || lead.firstName}) assigned to ${assignedUser.name}.`,
        entityType: "LEAD",
        entityId: lead.id,
        source: "assignment_engine",
        eventId: `lead_tl_assigned_${lead.id}_${teamLeadId}`
      });
    }
  }
}

/**
 * EVENT 2: Quote Approval Required (Hierarchical Routing)
 * - Amount <= ₹10L: Rep Authority (auto-approved)
 * - ₹10L < Amount <= ₹50L: Team Lead Limit ➔ Notify Team Lead ONLY
 * - Amount > ₹50L: Admin Limit ➔ Notify Admin ONLY
 */
export async function triggerQuoteApprovalNotifications(quote: any, deal: any, repUser: any) {
  if (!quote) return;
  const amount = Number(quote.totalAmount || deal?.amount || 0);

  const repLimit = Number(process.env.APPROVAL_LIMIT_REP || 1000000);        // ₹10 Lakhs
  const tlLimit = Number(process.env.APPROVAL_LIMIT_TEAM_LEAD || 5000000);   // ₹50 Lakhs

  if (amount <= repLimit) {
    // Within rep limit — auto-approve
    await quote.update({ status: "Approved" });
    await createNotification({
      userId: repUser?.id,
      role: "SALES_REP",
      type: "QUOTE_AUTO_APPROVED",
      severity: "INFO",
      title: "Quote Auto-Approved",
      message: `Quote ${quote.quoteNumber || quote.id.slice(0, 8)} (${formatCurrencyInr(amount)}) is within your limit & ready to send.`,
      entityType: "QUOTE",
      entityId: quote.id,
      source: "approval_engine",
      eventId: `quote_auto_approved_${quote.id}`
    });
    return;
  }

  if (amount > repLimit && amount <= tlLimit) {
    // Requires Team Lead Approval
    await quote.update({ status: "Pending Approval" });
    const teamLeadId = repUser ? await getTeamLeadIdForUser(repUser.id) : null;
    
    if (teamLeadId) {
      await createNotification({
        userId: teamLeadId,
        role: "TEAM_LEAD",
        type: "QUOTE_APPROVAL_REQUIRED",
        severity: "ACTION_REQUIRED",
        title: "Quote Awaiting Your Approval",
        message: `Quote ${quote.quoteNumber || 'QT-360'} (${formatCurrencyInr(amount)}) from ${repUser?.name || 'Rep'} exceeds rep limit and requires approval.`,
        entityType: "APPROVAL",
        entityId: quote.id,
        source: "approval_workflow",
        eventId: `quote_tl_approval_${quote.id}`
      });
    }

    // Notify Rep that quote is waiting for Team Lead
    if (repUser) {
      await createNotification({
        userId: repUser.id,
        role: "SALES_REP",
        type: "QUOTE_SUBMITTED_FOR_APPROVAL",
        severity: "INFO",
        title: "Quote Submitted for Team Lead Approval",
        message: `Quote ${quote.quoteNumber || 'QT-360'} submitted to Team Lead for review.`,
        entityType: "QUOTE",
        entityId: quote.id,
        source: "approval_workflow",
        eventId: `quote_rep_pending_${quote.id}`
      });
    }
    return;
  }

  // Amount > ₹50L ➔ Requires Admin Approval
  await quote.update({ status: "Pending Admin Approval" });
  const adminIds = await getAdminUserIds();

  for (const adminId of adminIds) {
    await createNotification({
      userId: adminId,
      role: "ADMIN",
      type: "ADMIN_APPROVAL_REQUIRED",
      severity: "ACTION_REQUIRED",
      title: "Enterprise Deal Approval Required (>₹50L)",
      message: `Quote ${quote.quoteNumber || 'QT-360'} (${formatCurrencyInr(amount)}) exceeds Team Lead limits and requires Admin approval.`,
      entityType: "APPROVAL",
      entityId: quote.id,
      source: "approval_workflow",
      eventId: `quote_admin_approval_${quote.id}_${adminId}`
    });
  }

  if (repUser) {
    await createNotification({
      userId: repUser.id,
      role: "SALES_REP",
      type: "QUOTE_SUBMITTED_FOR_ADMIN",
      severity: "INFO",
      title: "Quote Submitted for Admin Review",
      message: `Quote ${quote.quoteNumber || 'QT-360'} exceeds ₹50L and has been routed to Admin.`,
      entityType: "QUOTE",
      entityId: quote.id,
      source: "approval_workflow",
      eventId: `quote_rep_admin_pending_${quote.id}`
    });
  }
}

/**
 * EVENT 3: Lead SLA Breach
 * - Rep: CRITICAL ("Lead SLA breached!")
 * - Team Lead: WARNING ("Rahul's lead SLA has been breached")
 */
export async function triggerSlaBreachNotification(lead: any) {
  if (!lead || !lead.assignedToId) return;

  // 1. Notify Rep
  await createNotification({
    userId: lead.assignedToId,
    role: "SALES_REP",
    type: "SLA_BREACHED",
    severity: "CRITICAL",
    title: "🚨 Lead Response SLA Breached!",
    message: `SLA response deadline passed for ${lead.company || lead.firstName}. Please respond immediately.`,
    entityType: "LEAD",
    entityId: lead.id,
    source: "sla_scheduler",
    eventId: `sla_breached_rep_${lead.id}`
  });

  // 2. Notify Team Lead
  const teamLeadId = await getTeamLeadIdForUser(lead.assignedToId);
  if (teamLeadId) {
    const rep = await sequelize.models.User.findByPk(lead.assignedToId);
    const repName = rep ? (rep as any).name : "Rep";

    await createNotification({
      userId: teamLeadId,
      role: "TEAM_LEAD",
      type: "TEAM_SLA_BREACHED",
      severity: "WARNING",
      title: "Team Lead Alert: SLA Breached",
      message: `${repName}'s lead (${lead.company || lead.firstName}) breached the response SLA.`,
      entityType: "LEAD",
      entityId: lead.id,
      source: "sla_scheduler",
      eventId: `sla_breached_tl_${lead.id}`
    });
  }
}

/**
 * EVENT 4: System / Integration Exception
 * - Admin ONLY: CRITICAL ("WhatsApp Webhook Failure", "Integration Disconnected")
 */
export async function triggerSystemFailureNotification(source: string, title: string, errorMessage: string) {
  const adminIds = await getAdminUserIds();

  for (const adminId of adminIds) {
    await createNotification({
      userId: adminId,
      role: "ADMIN",
      type: "SYSTEM_FAILURE",
      severity: "CRITICAL",
      title: `⚙️ System Alert: ${title}`,
      message: `Failure in ${source}: ${errorMessage}`,
      entityType: "SYSTEM",
      entityId: source,
      source,
      actionUrl: "/settings",
      eventId: `sys_fail_${source}_${Date.now()}`
    });
  }
}

function formatCurrencyInr(val: number): string {
  if (val >= 10000000) return `₹${(val / 10000000).toFixed(1)} Cr`;
  if (val >= 100000) return `₹${(val / 100000).toFixed(1)} Lakhs`;
  return `₹${val.toLocaleString('en-IN')}`;
}
