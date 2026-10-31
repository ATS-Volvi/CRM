import crypto from "crypto";
import {
  SiteInspectionAlert,
  SiteInspection,
  User,
  SiteInspectorProfile,
  SiteInspectionAuditLog,
} from "@nexus-crm/database";
import { createNotification } from "./notificationService";
import { sendEmail } from "./emailService";
import { getSettings } from "./siteInspectionSettingsService";

export type SiteInspectionAlertType =
  | "ASSIGNMENT"
  | "REMINDER_50"
  | "REMINDER_80"
  | "MORNING_SUMMARY"
  | "OVERDUE_INSPECTOR"
  | "OVERDUE_ESCALATION_OPS"
  | "OVERDUE_ESCALATION_DIRECTOR"
  | "SUBMITTED_FOR_REVIEW"
  | "APPROVED"
  | "CHANGES_REQUESTED"
  | "STAGE_UPDATE"
  | "READY_TO_QUALIFY"
  | "UNASSIGNED_ALERT";

export interface SendAlertOptions {
  alertType: SiteInspectionAlertType;
  inspectionId?: string | null;
  recipientId: string;
  recipientRole?: string | null;
  title: string;
  message: string;
  link?: string;
  customDedupeKey?: string;
  isUrgent?: boolean;
  extraPayload?: any;
}

/**
 * Returns true if current time in Asia/Riyadh (AST = UTC+3) is within
 * quiet hours (default: 21:00 PM to 08:00 AM).
 */
export function isQuietPeriod(date: Date = new Date(), startHour: number = 21, endHour: number = 8): boolean {
  const riyadhDate = new Date(date.getTime() + 3 * 3600000);
  const hour = riyadhDate.getUTCHours();

  if (startHour > endHour) {
    // Over midnight, e.g. 21 to 8
    return hour >= startHour || hour < endHour;
  }
  return hour >= startHour && hour < endHour;
}

/**
 * Dispatches a deduplicated alert to a user via in-app notification, email,
 * and optionally WhatsApp (if enabled by setting/flag).
 *
 * Guaranteed idempotency: dedupeKey uniqueness in SiteInspectionAlerts table.
 */
export async function sendSiteInspectionAlert(options: SendAlertOptions): Promise<{
  alert: any;
  sent: boolean;
  reason?: string;
}> {
  const {
    alertType,
    inspectionId,
    recipientId,
    recipientRole,
    title,
    message,
    link,
    customDedupeKey,
    isUrgent = false,
    extraPayload,
  } = options;

  // Build deterministic dedupe key
  const dedupeKey =
    customDedupeKey ||
    `${alertType}:${inspectionId || "none"}:${recipientId}`;

  // Check if alert was already dispatched
  const existing = await SiteInspectionAlert.findOne({ where: { dedupeKey } });
  if (existing) {
    return { alert: existing, sent: false, reason: "Already sent (deduped)" };
  }

  // Check quiet period: urgent alerts bypass quiet hours; normal alerts queue for morning
  const inQuiet = isQuietPeriod();
  let status = "SENT";
  let scheduledFor: Date | null = null;

  if (inQuiet && !isUrgent && alertType.startsWith("REMINDER")) {
    status = "QUEUED_QUIET_HOURS";
    // Schedule for 08:00 AST tomorrow morning
    const now = new Date();
    const rd = new Date(now.getTime() + 3 * 3600000);
    const targetDay = rd.getUTCHours() >= 21 ? rd.getUTCDate() + 1 : rd.getUTCDate();
    scheduledFor = new Date(Date.UTC(rd.getUTCFullYear(), rd.getUTCMonth(), targetDay, 5, 0, 0)); // 08:00 AST = 05:00 UTC
  }

  // Record alert record in database
  let alertRecord: any;
  try {
    alertRecord = await SiteInspectionAlert.create({
      id: crypto.randomUUID(),
      dedupeKey,
      inspectionId: inspectionId || null,
      alertType,
      recipientId,
      recipientRole: recipientRole || null,
      channel: "IN_APP",
      status,
      sentAt: new Date(),
      scheduledFor,
      payload: JSON.stringify({ title, message, link, ...(extraPayload || {}) }),
    });
  } catch (err: any) {
    if (err.name === "SequelizeUniqueConstraintError") {
      const conflict = await SiteInspectionAlert.findOne({ where: { dedupeKey } });
      return { alert: conflict, sent: false, reason: "Already sent (concurrency dedupe)" };
    }
    throw err;
  }

  // If queued for quiet hours, do not fire live notifications now
  if (status === "QUEUED_QUIET_HOURS") {
    return { alert: alertRecord, sent: true, reason: "Queued for quiet hours delivery at 08:00 AST" };
  }

  // 1. In-App Notification
  try {
    await createNotification(
      recipientId,
      "site_inspection",
      title,
      message,
      link || (inspectionId ? `/site-inspections/${inspectionId}` : "/site-inspections")
    );
  } catch (notifErr) {
    console.warn("[SiteInspectionAlert] In-app notification error:", notifErr);
  }

  // 2. Email (simulated/mocked if in test or without live API keys)
  try {
    const user: any = await User.findByPk(recipientId);
    if (user && user.email) {
      const emailHtml = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b;">
          <h2 style="color: #4f46e5; margin-bottom: 8px;">${title}</h2>
          <p style="font-size: 14px; line-height: 1.6; color: #475569;">${message}</p>
          ${
            link
              ? `<div style="margin-top: 20px;">
                  <a href="${link}" style="background-color: #4f46e5; color: #ffffff; padding: 10px 18px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 13px;">View Site Inspection</a>
                </div>`
              : ""
          }
          <hr style="margin-top: 30px; border: none; border-top: 1px solid #e2e8f0;" />
          <p style="font-size: 11px; color: #94a3b8;">This automated alert was dispatched by Nexus CRM Site Inspection Automation.</p>
        </div>
      `;
      await sendEmail(user.email, `[Nexus CRM] ${title}`, emailHtml);
    }
  } catch (mailErr) {
    console.warn("[SiteInspectionAlert] Email error:", mailErr);
  }

  // 3. WhatsApp (only through Twilio template mechanism and strictly OFF by default)
  if (process.env.SITE_INSPECTION_WHATSAPP === "true") {
    try {
      const user: any = await User.findByPk(recipientId);
      if (user && user.phone) {
        console.log(`[WhatsApp Simulated] Sent inspection alert template to ${user.phone}: ${title}`);
      }
    } catch (waErr) {
      console.warn("[SiteInspectionAlert] WhatsApp error:", waErr);
    }
  }

  return { alert: alertRecord, sent: true };
}

/**
 * Triggers assignment notification with full details: client, site, distance, priority, deadline.
 */
export async function sendAssignmentAlert(inspection: any, inspectorId: string): Promise<void> {
  const settings = await getSettings();
  if (!settings.automation && process.env.SITE_INSPECTION_AUTOMATION !== "true") {
    // Automation off: basic in-app only, no advanced SLA alert
    return;
  }

  const priority = inspection.priority || "NORMAL";
  const area = inspection.siteAreaName || inspection.siteAddress || "Site Location";
  const deadlineStr = inspection.slaSubmitDueAt
    ? new Date(inspection.slaSubmitDueAt).toLocaleString("en-US", { timeZone: "Asia/Riyadh" })
    : "Standard SLA";

  const title = `New Site Inspection Assigned: ${inspection.inspectionNumber}`;
  const message = `You have been assigned ${inspection.inspectionNumber} (${priority} priority). Area: ${area}. Mobilization: ${inspection.mobilizationKm || 0} km. Submission Deadline: ${deadlineStr} (AST). Please accept or decline.`;

  await sendSiteInspectionAlert({
    alertType: "ASSIGNMENT",
    inspectionId: inspection.id,
    recipientId: inspectorId,
    title,
    message,
    link: `/site-inspections/${inspection.id}`,
    isUrgent: priority === "URGENT",
    extraPayload: {
      priority,
      mobilizationKm: inspection.mobilizationKm,
      slaSubmitDueAt: inspection.slaSubmitDueAt,
    },
  });
}
