import crypto from "crypto";
import { Op } from "sequelize";
import {
  sequelize,
  WorkOrder,
  WorkOrderLineItem,
  ServiceAppointment,
  ServiceResource,
  Contact,
  Account,
  Lead,
  User,
  WorkOrderNotification,
  WorkOrderFeedback,
  EmailSuppression,
  MessageTemplate,
} from "@nexus-crm/database";
import { sendEmail, renderTemplate, getBaseHtmlTemplate } from "./emailService";
import { createNotification } from "./notificationEngine";

/**
 * Generate a deterministic feedback token for a feedback record.
 * Token format: <feedbackId>.<version>.<hmacSignature>
 * Ensures that retries and poller reclaims produce the EXACT same token without needing in-memory storage.
 * When staff explicitly resends, version is incremented, deterministically invalidating the previous token.
 */
export function createFeedbackToken(feedbackId: string, version: number = 1): string {
  const secret = process.env.JWT_SECRET || "feedback-token-secret";
  const sig = crypto.createHmac("sha256", secret).update(`feedback:${feedbackId}:${version}`).digest("hex");
  return `${feedbackId}.${version}.${sig}`;
}

/**
 * Verify a feedback token and return { feedbackId, version } if signature is valid.
 */
export function verifyFeedbackToken(token: string): { feedbackId: string; version: number } | null {
  if (!token || typeof token !== "string" || !token.includes(".")) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [feedbackId, versionStr, sig] = parts;
  const version = parseInt(versionStr, 10);
  if (!feedbackId || isNaN(version) || !sig) return null;
  if (!/^[0-9a-fA-F]{64}$/.test(sig)) return null;
  try {
    const secret = process.env.JWT_SECRET || "feedback-token-secret";
    const expectedSig = crypto.createHmac("sha256", secret).update(`feedback:${feedbackId}:${version}`).digest("hex");
    const sigBuf = Buffer.from(sig, "hex");
    const expBuf = Buffer.from(expectedSig, "hex");
    if (sigBuf.length !== expBuf.length) return null;
    if (crypto.timingSafeEqual(sigBuf, expBuf)) {
      return { feedbackId, version };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Validate configuration on server startup.
 * Logs a clear error if neither COMPANY_SUPPORT_PHONE nor WORK_ORDER_REPLY_TO is configured when dry run is disabled.
 */
export function validateWorkOrderNotificationConfigOnStartup(): void {
  if (isWorkOrderEmailDryRun()) return;
  const supportPhone = process.env.COMPANY_SUPPORT_PHONE?.trim();
  const replyTo = process.env.WORK_ORDER_REPLY_TO?.trim();
  if (!supportPhone && !replyTo) {
    console.error(
      "[FATAL CONFIG ERROR] Work order emails cannot be dispatched: neither COMPANY_SUPPORT_PHONE nor WORK_ORDER_REPLY_TO is configured. Customers will have no valid contact route."
    );
  }
}

/**
 * HTML-escape any user/customer/technician provided strings
 */
export function escapeHtml(str: string | null | undefined): string {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Resolve COMPANY_TIMEZONE with logged warning fallback to Asia/Kolkata
 */
export function getCompanyTimezone(): string {
  const envTz = process.env.COMPANY_TIMEZONE;
  if (!envTz || envTz.trim() === "") {
    console.warn(
      "[WorkOrderNotification] COMPANY_TIMEZONE unset. Defaulting to 'Asia/Kolkata'."
    );
    return "Asia/Kolkata";
  }
  return envTz.trim();
}

/**
 * Format UTC Date in COMPANY_TIMEZONE
 */
export function formatDateInTz(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  const tz = getCompanyTimezone();
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(d);
  } catch (err) {
    console.warn(`[WorkOrderNotification] Invalid timeZone ${tz}, falling back to UTC:`, err);
    return new Intl.DateTimeFormat("en-US", {
      timeZone: "UTC",
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(d);
  }
}

/**
 * Format start and end window in COMPANY_TIMEZONE
 */
export function formatTimeWindowInTz(
  start: Date | string | null | undefined,
  end: Date | string | null | undefined
): string {
  if (!start) return "";
  const startDate = new Date(start);
  if (isNaN(startDate.getTime())) return "";
  const tz = getCompanyTimezone();

  const timeFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  const formattedStart = timeFormatter.format(startDate);
  if (!end) return formattedStart;

  const endDate = new Date(end);
  if (isNaN(endDate.getTime())) return formattedStart;

  const formattedEnd = timeFormatter.format(endDate);
  return `${formattedStart} - ${formattedEnd}`;
}

/**
 * Check if dry-run sending is active
 * Env WORK_ORDER_EMAIL_DRY_RUN: if unset or "true", dry-run. Only "false" sends real emails.
 */
export function isWorkOrderEmailDryRun(): boolean {
  const dryRunEnv = process.env.WORK_ORDER_EMAIL_DRY_RUN;
  if (dryRunEnv === undefined || dryRunEnv === null || dryRunEnv.trim() === "") {
    return true;
  }
  return dryRunEnv.trim().toLowerCase() !== "false";
}

/**
 * Get test allowlist for work order emails
 */
export function getWorkOrderEmailAllowlist(): string[] {
  const raw = process.env.WORK_ORDER_EMAIL_TEST_ALLOWLIST || "";
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Generate a signed HMAC token for email opt-out links
 */
export function createSignedOptOutToken(email: string): string {
  const normalized = email.trim().toLowerCase();
  const secret = process.env.JWT_SECRET || "email-optout-secret";
  const hmac = crypto.createHmac("sha256", secret).update(`optout:${normalized}`).digest("hex");
  const payload = Buffer.from(normalized).toString("base64url");
  return `${payload}.${hmac}`;
}

/**
 * Verify signed opt-out token and return the lowercase email if valid
 */
export function verifySignedOptOutToken(token: string): string | null {
  if (!token || typeof token !== "string" || !token.includes(".")) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  if (!payload || !sig) return null;
  if (!/^[0-9a-fA-F]{64}$/.test(sig)) return null;
  try {
    const email = Buffer.from(payload, "base64url").toString("utf8");
    const normalized = email.trim().toLowerCase();
    const secret = process.env.JWT_SECRET || "email-optout-secret";
    const expectedSig = crypto.createHmac("sha256", secret).update(`optout:${normalized}`).digest("hex");
    const sigBuf = Buffer.from(sig, "hex");
    const expBuf = Buffer.from(expectedSig, "hex");
    if (sigBuf.length !== expBuf.length) return null;
    if (crypto.timingSafeEqual(sigBuf, expBuf)) {
      return normalized;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Check if an email address is suppressed / opted out in the system
 * Strictly checks EmailSuppressions and Lead.optedOutEmail by email only (no notes parsing)
 */
export async function isEmailOptedOut(email: string | null | undefined): Promise<boolean> {
  if (!email || !email.trim()) return false;
  const normalized = email.trim().toLowerCase();
  try {
    const suppressed = await EmailSuppression.findOne({
      where: { email: normalized },
    });
    if (suppressed) return true;

    const optedLead = await Lead.findOne({
      where: {
        email: normalized,
        optedOutEmail: true,
      },
    });
    return Boolean(optedLead);
  } catch (err) {
    return false;
  }
}

/**
 * Helper to resolve customer recipient email (mirroring enrichWorkOrderPhone)
 */
export async function resolveWorkOrderRecipient(workOrderId: string): Promise<{
  recipientEmail: string | null;
  recipientSource: "contact" | "account" | "lead" | null;
  customerName: string;
  optedOutEmail: boolean;
}> {
  const wo = await WorkOrder.findByPk(workOrderId, {
    include: [
      { model: Contact, as: "contact" },
      { model: Account, as: "account" },
    ],
  });

  if (!wo) {
    return {
      recipientEmail: null,
      recipientSource: null,
      customerName: "Valued Customer",
      optedOutEmail: false,
    };
  }

  const woJson = wo.toJSON ? wo.toJSON() : (wo as any);

  // 1. Contact email
  if (woJson.contact && woJson.contact.email && woJson.contact.email.trim() !== "") {
    const contactName = `${woJson.contact.firstName || ""} ${woJson.contact.lastName || ""}`.trim();
    const email = woJson.contact.email.trim();
    const optedOutEmail = await isEmailOptedOut(email);
    return {
      recipientEmail: email,
      recipientSource: "contact",
      customerName: contactName || "Valued Customer",
      optedOutEmail,
    };
  }

  // 2. Account email
  if (woJson.account && woJson.account.email && woJson.account.email.trim() !== "") {
    const email = woJson.account.email.trim();
    const optedOutEmail = await isEmailOptedOut(email);
    return {
      recipientEmail: email,
      recipientSource: "account",
      customerName: woJson.account.primaryContactName || woJson.account.name || "Valued Customer",
      optedOutEmail,
    };
  }

  // 3. Fallback: query linked Lead for the account
  if (woJson.accountId) {
    try {
      const linkedLead = await Lead.findOne({
        where: {
          [Op.or]: [
            { accountId: woJson.accountId },
            { convertedAccountId: woJson.accountId },
          ],
          email: { [Op.ne]: null },
        },
        order: [["createdAt", "DESC"]],
      });

      if (linkedLead && (linkedLead as any).email && (linkedLead as any).email.trim() !== "") {
        const leadName = `${(linkedLead as any).firstName || ""} ${(linkedLead as any).lastName || ""}`.trim();
        return {
          recipientEmail: (linkedLead as any).email.trim(),
          recipientSource: "lead",
          customerName: leadName || "Valued Customer",
          optedOutEmail: Boolean((linkedLead as any).optedOutEmail),
        };
      }
    } catch (err) {
      console.warn("[WorkOrderNotification] Error resolving linked lead email:", err);
    }
  }

  return {
    recipientEmail: null,
    recipientSource: null,
    customerName: "Valued Customer",
    optedOutEmail: false,
  };
}

/**
 * Queue a Work Order Notification (idempotent via dedupeKey)
 */
export async function queueWorkOrderNotification(
  params: {
    workOrderId: string;
    appointmentId?: string | null;
    type: "VISIT_SCHEDULED" | "TECHNICIAN_ASSIGNED" | "VISIT_UPDATED" | "VISIT_CANCELLED" | "FEEDBACK_REQUEST";
    dedupeKey: string;
    notifyCustomer?: boolean;
    scheduledFor?: Date | null;
  },
  transaction?: any
): Promise<WorkOrderNotification> {
  const { workOrderId, appointmentId = null, type, dedupeKey, notifyCustomer = true, scheduledFor = null } = params;

  // 1. Resolve recipient
  const recipient = await resolveWorkOrderRecipient(workOrderId);

  let initialStatus: "Pending" | "Skipped" = "Pending";
  let skipReason: string | null = null;

  // 2. Customer notice control: if staff unchecked "Notify customer"
  if (notifyCustomer === false) {
    initialStatus = "Skipped";
    skipReason = "notification turned off by staff";
  } else if (!recipient.recipientEmail) {
    initialStatus = "Skipped";
    skipReason = "no customer email";
  } else if (type === "FEEDBACK_REQUEST" && recipient.optedOutEmail) {
    initialStatus = "Skipped";
    skipReason = "opted out of emails";
  }

  // 3. Insert or find existing notification (atomic idempotency)
  let notification: WorkOrderNotification;
  try {
    notification = await WorkOrderNotification.create(
      {
        id: crypto.randomUUID(),
        workOrderId,
        appointmentId,
        type,
        recipientEmail: recipient.recipientEmail,
        recipientSource: recipient.recipientSource,
        status: initialStatus,
        skipReason,
        dedupeKey,
        attempts: 0,
        scheduledFor,
      },
      { transaction }
    );
  } catch (err: any) {
    if (err.name === "SequelizeUniqueConstraintError") {
      const existing = await WorkOrderNotification.findOne({
        where: { dedupeKey },
        transaction,
      });
      if (existing) return existing;
    }
    throw err;
  }

  // 4. Send asynchronously if not skipped and scheduledFor is ready
  if (initialStatus === "Pending") {
    const isDueNow = !scheduledFor || new Date(scheduledFor).getTime() <= Date.now();
    if (isDueNow) {
      setImmediate(() => {
        deliverWorkOrderNotification(notification.id).catch((sendErr) => {
          console.error(
            `[WorkOrderNotification] Immediate send error for notification ${notification.id}:`,
            sendErr
          );
        });
      });
    }
  }

  return notification;
}

/**
 * Deliver a single queued notification
 */
export async function deliverWorkOrderNotification(notificationId: string): Promise<WorkOrderNotification | null> {
  const notification = await WorkOrderNotification.findByPk(notificationId, {
    include: [
      {
        model: WorkOrder,
        as: "workOrder",
        include: [
          { model: Contact, as: "contact" },
          { model: Account, as: "account" },
        ],
      },
      {
        model: ServiceAppointment,
        as: "appointment",
        include: [{ model: ServiceResource, as: "serviceResource" }],
      },
    ],
  });

  if (!notification) return null;
  if (notification.status !== "Pending" && (notification.status as string) !== "Processing") return notification;

  const recipientEmail = notification.recipientEmail;
  if (!recipientEmail) {
    notification.status = "Skipped";
    notification.skipReason = "no customer email";
    await notification.save();
    return notification;
  }

  // Allowlist verification
  const allowlist = getWorkOrderEmailAllowlist();
  if (allowlist.length > 0 && !allowlist.includes(recipientEmail.toLowerCase())) {
    notification.status = "Skipped";
    notification.skipReason = "not in allowlist";
    await notification.save();
    return notification;
  }

  // Build rendered email payload
  const wo = (notification as any).workOrder;
  const sa = (notification as any).appointment;
  const sr = sa?.serviceResource;

  const companyName = (process.env.COMPANY_NAME || "Nexus CRM").replace(/^["']|["']$/g, "").trim();
  const companySupportPhone = process.env.COMPANY_SUPPORT_PHONE || "";

  // Technician phone logic: ServiceResource.phone, else omitted if unset
  const techPhone = sr?.phone ? sr.phone.trim() : null;
  const techPhoneLine = techPhone ? `Technician Phone: ${techPhone}\n` : "";

  const scheduledDate = sa ? formatDateInTz(sa.scheduledStartTime) : "";
  const scheduledTimeWindow = sa ? formatTimeWindowInTz(sa.scheduledStartTime, sa.scheduledEndTime) : "";

  // Service address
  const addressParts = [
    sa?.street || wo?.street,
    sa?.city || wo?.city,
    sa?.state || wo?.state,
    sa?.postalCode || wo?.postalCode,
    sa?.country || wo?.country,
  ].filter(Boolean);
  const serviceAddress = addressParts.length > 0 ? addressParts.join(", ") : "Customer Address";

  // Customer Name
  const recipient = await resolveWorkOrderRecipient(notification.workOrderId);

  const hasTechnician = Boolean(sr?.name && String(sr.name).trim());
  const techName = hasTechnician ? String(sr?.name).trim() : "";

  // Fallback defaults
  const templateNameMap: Record<string, string> = {
    VISIT_SCHEDULED: "work_order_technician_assigned",
    TECHNICIAN_ASSIGNED: "work_order_technician_assigned",
    VISIT_UPDATED: "work_order_visit_updated",
    VISIT_CANCELLED: "work_order_visit_cancelled",
    FEEDBACK_REQUEST: "work_order_feedback_request",
  };

  const templateName = templateNameMap[notification.type] || "work_order_technician_assigned";
  let template = await MessageTemplate.findOne({
    where: { name: templateName, channel: "email" },
  });

  let rawSubject = (template as any)?.subject || "";
  let rawBody = (template as any)?.body || "";

  if (!rawBody) {
    // Built-in hardcoded fallback if template row is missing
    if (notification.type === "TECHNICIAN_ASSIGNED" || notification.type === "VISIT_SCHEDULED") {
      if (hasTechnician) {
        rawSubject = "Your Technician Appointment: {{technician_name}} will visit on {{scheduled_date}}";
        rawBody =
          "Hello {{customer_name}},\n\nAs per our phone conversation, your service appointment for Work Order #{{work_order_number}} has been confirmed.\n\nTechnician: {{technician_name}}\n{{technician_phone_line}}Visit Window: {{scheduled_date}} ({{scheduled_time_window}})\nAddress: {{service_address}}\n\nPlease ensure the following are arranged prior to technician arrival:\n• Site gate entry permit / access pass is arranged\n• Required utility / power hookup is accessible\n• Authorized representative is present on site\n\nNeed to make changes? Contact us at {{company_support_phone}} or reply to this email.\n\nBest regards,\n{{company_name}}";
      } else {
        rawSubject = "Your Service Appointment for Work Order #{{work_order_number}} on {{scheduled_date}}";
        rawBody =
          "Hello {{customer_name}},\n\nAs per our phone conversation, your service appointment for Work Order #{{work_order_number}} has been confirmed.\n\nA technician will be confirmed shortly prior to your visit.\nVisit Window: {{scheduled_date}} ({{scheduled_time_window}})\nAddress: {{service_address}}\n\nPlease ensure the following are arranged prior to technician arrival:\n• Site gate entry permit / access pass is arranged\n• Required utility / power hookup is accessible\n• Authorized representative is present on site\n\nNeed to make changes? Contact us at {{company_support_phone}} or reply to this email.\n\nBest regards,\n{{company_name}}";
      }
    } else if (notification.type === "VISIT_UPDATED") {
      if (hasTechnician) {
        rawSubject = "Update: Your Service Appointment for Work Order #{{work_order_number}}";
        rawBody =
          "Hello {{customer_name}},\n\nAs per our phone conversation, there is an update to your service appointment for Work Order #{{work_order_number}}.\n\nTechnician: {{technician_name}}\n{{technician_phone_line}}Visit Window: {{scheduled_date}} ({{scheduled_time_window}})\nAddress: {{service_address}}\n\nPlease ensure the following are arranged prior to technician arrival:\n• Site gate entry permit / access pass is arranged\n• Required utility / power hookup is accessible\n• Authorized representative is present on site\n\nIf you have questions, please reach out to {{company_support_phone}} or reply to this email.\n\nBest regards,\n{{company_name}}";
      } else {
        rawSubject = "Update: Your Service Appointment for Work Order #{{work_order_number}}";
        rawBody =
          "Hello {{customer_name}},\n\nAs per our phone conversation, there is an update to your service appointment for Work Order #{{work_order_number}}.\n\nA technician will be assigned shortly.\nVisit Window: {{scheduled_date}} ({{scheduled_time_window}})\nAddress: {{service_address}}\n\nPlease ensure the following are arranged prior to technician arrival:\n• Site gate entry permit / access pass is arranged\n• Required utility / power hookup is accessible\n• Authorized representative is present on site\n\nIf you have questions, please reach out to {{company_support_phone}} or reply to this email.\n\nBest regards,\n{{company_name}}";
      }
    } else if (notification.type === "VISIT_CANCELLED") {
      rawSubject = "Cancelled: Your Service Appointment for Work Order #{{work_order_number}}";
      rawBody =
        "Hello {{customer_name}},\n\nYour service appointment previously scheduled for {{scheduled_date}} for Work Order #{{work_order_number}} has been cancelled.\n\nIf you would like to reschedule, please contact us at {{company_support_phone}} or reply to this email.\n\nBest regards,\n{{company_name}}";
    } else if (notification.type === "FEEDBACK_REQUEST") {
      rawSubject = "How did we do? Rate your recent service for Work Order #{{work_order_number}}";
      if (hasTechnician) {
        rawBody =
          "Hello {{customer_name}},\n\nYour service request #{{work_order_number}} has been completed. We would love to hear your feedback on the service provided by {{technician_name}}.\n\nPlease rate your experience by clicking one of the links below:\n\n⭐ 1 - Poor: {{rating_link_1}}\n⭐ 2 - Fair: {{rating_link_2}}\n⭐ 3 - Good: {{rating_link_3}}\n⭐ 4 - Very Good: {{rating_link_4}}\n⭐ 5 - Excellent: {{rating_link_5}}\n\nIf you prefer not to receive service feedback requests, you can opt out: {{opt_out_link}}\n\nThank you for choosing {{company_name}}!";
      } else {
        rawBody =
          "Hello {{customer_name}},\n\nYour service request #{{work_order_number}} has been completed. We would love to hear your feedback on your recent service experience.\n\nPlease rate your experience by clicking one of the links below:\n\n⭐ 1 - Poor: {{rating_link_1}}\n⭐ 2 - Fair: {{rating_link_2}}\n⭐ 3 - Good: {{rating_link_3}}\n⭐ 4 - Very Good: {{rating_link_4}}\n⭐ 5 - Excellent: {{rating_link_5}}\n\nIf you prefer not to receive service feedback requests, you can opt out: {{opt_out_link}}\n\nThank you for choosing {{company_name}}!";
      }
    }
  }

  // If no technician assigned, adapt subject and body regardless of whether loaded from DB or fallback
  if (!hasTechnician) {
    if (notification.type === "TECHNICIAN_ASSIGNED" || notification.type === "VISIT_SCHEDULED") {
      rawSubject = rawSubject
        .replace(/Your Technician Appointment: .*? will visit on/gi, "Your Service Appointment for Work Order #{{work_order_number}} on")
        .replace(/: \{\{technician_name\}\} will visit on/gi, " on")
        .replace(/will visit/gi, "appointment scheduled");
      rawBody = rawBody
        .replace(/Technician:\s*\{\{technician_name\}\}\n?/gi, "A technician will be confirmed shortly prior to your visit.\n")
        .replace(/Technician:\s*[^\n]*\n?/gi, "A technician will be confirmed shortly prior to your visit.\n");
    } else if (notification.type === "FEEDBACK_REQUEST") {
      rawBody = rawBody
        .replace(/on the service provided by \{\{technician_name\}\}/gi, "on your recent service experience")
        .replace(/the service provided by \{\{technician_name\}\}/gi, "your recent service experience")
        .replace(/service provided by \{\{technician_name\}\}/gi, "your recent service experience")
        .replace(/service provided by A technician will be confirmed shortly/gi, "your recent service experience")
        .replace(/by \{\{technician_name\}\}/gi, "by our team");
    } else if (notification.type === "VISIT_UPDATED") {
      rawBody = rawBody
        .replace(/Technician:\s*\{\{technician_name\}\}\n?/gi, "A technician will be assigned shortly.\n")
        .replace(/Technician:\s*[^\n]*\n?/gi, "A technician will be assigned shortly.\n");
    }
  }

  // Remove "reply to this email" if WORK_ORDER_REPLY_TO is unset
  const workOrderReplyTo = process.env.WORK_ORDER_REPLY_TO;
  if (!workOrderReplyTo || !workOrderReplyTo.trim()) {
    rawBody = rawBody.replace(/\s*or reply to this email/gi, "");
  }

  // Omit the support line entirely if COMPANY_SUPPORT_PHONE is unset
  if (!companySupportPhone) {
    rawBody = rawBody
      .split("\n")
      .filter((line: string) => !line.includes("{{company_support_phone}}"))
      .join("\n")
      .replace(/\n{3,}/g, "\n\n");
  }

  // Construct rating links & opt-out link if FEEDBACK_REQUEST
  const baseUrl = (process.env.BASE_URL || "http://localhost:5506").replace(/\/+$/, "");
  let ratingLinks: Record<string, string> = {};
  let optOutLinks: Record<string, string> = {};
  if (notification.type === "FEEDBACK_REQUEST") {
    const signedToken = createSignedOptOutToken(recipientEmail);
    const optOutUrl = `${baseUrl}/api/v1/leads/unsubscribe/${signedToken}`;
    optOutLinks.opt_out_link = optOutUrl;

    if (!rawBody.includes("{{opt_out_link}}")) {
      rawBody = rawBody.replace(
        /Thank you for choosing/i,
        `If you prefer not to receive service feedback requests, you can opt out: ${optOutUrl}\n\nThank you for choosing`
      );
    }

    // Find linked feedback row by workOrderId
    const feedbackRecord = await WorkOrderFeedback.findOne({
      where: { workOrderId: notification.workOrderId },
      order: [["createdAt", "DESC"]],
    });

    if (feedbackRecord) {
      const version = (feedbackRecord as any).tokenVersion || 1;
      const token = createFeedbackToken(feedbackRecord.id, version);
      for (let n = 1; n <= 5; n++) {
        ratingLinks[`rating_link_${n}`] = `${baseUrl}/feedback/${token}?rating=${n}`;
      }
    }
  }

  // Plain text data object: values are strictly NOT escaped (e.g. "Smith & Sons" and "D'Souza")
  const plainDataObj: Record<string, string> = {
    customer_name: recipient.customerName,
    work_order_number: wo?.workOrderNumber || wo?.id || "N/A",
    technician_name: techName || (hasTechnician ? "A technician will be confirmed shortly" : ""),
    technician_phone_line: techPhoneLine,
    scheduled_date: scheduledDate,
    scheduled_time_window: scheduledTimeWindow,
    service_address: serviceAddress,
    company_support_phone: companySupportPhone || "",
    company_name: companyName,
    ...ratingLinks,
    ...optOutLinks,
  };

  // HTML data object: values are HTML-escaped ONLY for the HTML body
  const htmlDataObj: Record<string, string> = {
    customer_name: escapeHtml(recipient.customerName),
    work_order_number: escapeHtml(wo?.workOrderNumber || wo?.id || "N/A"),
    technician_name: escapeHtml(techName || (hasTechnician ? "A technician will be confirmed shortly" : "")),
    technician_phone_line: escapeHtml(techPhoneLine),
    scheduled_date: escapeHtml(scheduledDate),
    scheduled_time_window: escapeHtml(scheduledTimeWindow),
    service_address: escapeHtml(serviceAddress),
    company_support_phone: escapeHtml(companySupportPhone || ""),
    company_name: escapeHtml(companyName),
    ...ratingLinks,
    ...optOutLinks,
  };

  const renderedPlainSubject = renderTemplate(rawSubject, plainDataObj);
  const renderedPlainBody = renderTemplate(rawBody, plainDataObj);

  const renderedHtmlSubject = renderTemplate(rawSubject, htmlDataObj);
  const renderedHtmlBody = renderTemplate(rawBody, htmlDataObj);
  const htmlContent = getBaseHtmlTemplate(renderedHtmlBody.replace(/\n/g, "<br/>"));

  // Production / Real send guardrails
  if (!isWorkOrderEmailDryRun()) {
    // 1. Refuse to send if neither COMPANY_SUPPORT_PHONE nor WORK_ORDER_REPLY_TO is set
    const hasSupportPhone = Boolean(companySupportPhone && companySupportPhone.trim());
    const hasReplyTo = Boolean(workOrderReplyTo && workOrderReplyTo.trim());
    if (!hasSupportPhone && !hasReplyTo) {
      notification.status = "Failed";
      notification.lastError =
        "Refusing to send email: neither COMPANY_SUPPORT_PHONE nor WORK_ORDER_REPLY_TO is configured (no contact route for customer)";
      await notification.save();
      return notification;
    }

    // 2. Refuse to send any email containing localhost or 127.0.0.1 link
    const localhostRegex = /(?:https?:\/\/)?(?:localhost|127\.0\.0\.1)(?::\d+)?/i;
    if (localhostRegex.test(renderedPlainBody) || localhostRegex.test(htmlContent)) {
      notification.status = "Failed";
      notification.lastError =
        "Refusing to send email: message contains localhost or 127.0.0.1 links. A valid public BASE_URL must be configured.";
      await notification.save();
      return notification;
    }
  }

  notification.attempts += 1;

  // Dry-run handling
  if (isWorkOrderEmailDryRun()) {
    console.log(
      `[WorkOrderNotification - DryRun] Would send ${notification.type} to ${recipientEmail} with subject: "${renderedPlainSubject}"\nPlain Body:\n${renderedPlainBody}\nHTML Body:\n${htmlContent}`
    );
    notification.status = "DryRun";
    notification.sentAt = new Date();
    (notification as any)._plainSubject = renderedPlainSubject;
    (notification as any)._plainBody = renderedPlainBody;
    (notification as any)._htmlContent = htmlContent;
    await notification.save();
    return notification;
  }

  // Real send
  try {
    await sendEmail(recipientEmail, renderedPlainSubject, htmlContent, undefined, workOrderReplyTo?.trim());
    notification.status = "Sent";
    notification.sentAt = new Date();
    notification.lastError = null;
    (notification as any)._plainSubject = renderedPlainSubject;
    (notification as any)._plainBody = renderedPlainBody;
    (notification as any)._htmlContent = htmlContent;
    await notification.save();
  } catch (error: any) {
    console.error(`[WorkOrderNotification] Send failure for ${notificationId}:`, error);
    notification.lastError = error.message || String(error);
    notification.status = "Failed";
    await notification.save();
  }
  return notification;
}

/**
 * Poller processor for pending and failed work order notifications.
 * Claims rows atomically with status = 'Processing' and retries failed records (max 3 attempts) with backoff.
 */
export async function processPendingWorkOrderNotifications(): Promise<{
  processed: number;
  sent: number;
  dryRun: number;
  failed: number;
  skipped: number;
}> {
  const stats = { processed: 0, sent: 0, dryRun: 0, failed: 0, skipped: 0 };
  const now = new Date();

  // 0. Reclaim stale "Processing" rows stranded for > 5 minutes (e.g. server restart mid-send)
  // Single-instance assumption: The background poller assumes a single application/worker
  // process managing notification queues. Stale processing rows return to 'Pending' and
  // count as an attempt so a mid-send process crash cannot permanently lose an email.
  const STALE_PROCESSING_THRESHOLD_MS = 5 * 60 * 1000;
  const staleThreshold = new Date(now.getTime() - STALE_PROCESSING_THRESHOLD_MS);

  const staleRows = await WorkOrderNotification.findAll({
    where: {
      status: "Processing",
      updatedAt: { [Op.lte]: staleThreshold },
    },
  });

  for (const stale of staleRows) {
    const nextAttempts = (stale.attempts || 0) + 1;
    stale.status = nextAttempts >= 3 ? "Failed" : "Pending";
    stale.attempts = nextAttempts;
    stale.lastError = "Stale processing timeout (>5m) - returned to Pending";
    await stale.save();
  }

  // Find candidate notifications:
  // 1. Pending (initial or scheduled)
  // 2. Failed (attempts < 3, retrying with backoff)
  const candidates = await WorkOrderNotification.findAll({
    where: {
      status: { [Op.in]: ["Pending", "Failed"] },
      attempts: { [Op.lt]: 3 },
      [Op.or]: [
        { scheduledFor: null },
        { scheduledFor: { [Op.lte]: now } },
      ],
    },
    order: [["createdAt", "ASC"]],
    limit: 50,
  });

  for (const notif of candidates) {
    // Exponential backoff check for retries:
    // Attempt 1 failed -> wait at least 60s
    // Attempt 2 failed -> wait at least 120s
    if (notif.attempts > 0) {
      const backoffMs = Math.pow(2, notif.attempts - 1) * 60 * 1000;
      const lastUpdate = notif.updatedAt ? new Date(notif.updatedAt).getTime() : 0;
      if (now.getTime() - lastUpdate < backoffMs) {
        continue; // Backoff window has not elapsed yet
      }
    }

    // Atomic claim: update status to 'Processing'
    const [claimedRows] = await WorkOrderNotification.update(
      { status: "Processing" },
      {
        where: {
          id: notif.id,
          status: { [Op.in]: ["Pending", "Failed"] },
        },
      }
    );

    if (claimedRows === 0) {
      // Already claimed by another concurrent worker/poller tick
      continue;
    }

    stats.processed += 1;
    try {
      await deliverWorkOrderNotification(notif.id);
      const reloaded = await WorkOrderNotification.findByPk(notif.id);
      if (reloaded?.status === "Sent") stats.sent += 1;
      else if (reloaded?.status === "DryRun") stats.dryRun += 1;
      else if (reloaded?.status === "Skipped") stats.skipped += 1;
      else if (reloaded?.status === "Failed") stats.failed += 1;
    } catch (err: any) {
      stats.failed += 1;
      try {
        const reloaded = await WorkOrderNotification.findByPk(notif.id);
        if (reloaded && (reloaded.status as string) === "Processing") {
          reloaded.status = "Failed";
          reloaded.attempts += 1;
          reloaded.lastError = err.message || String(err);
          await reloaded.save();
        }
      } catch {}
    }
  }

  return stats;
}

let isSchedulerRunning = false;
let schedulerInterval: NodeJS.Timeout | null = null;

/**
 * Starts the 60-second interval poller for work order notifications (runs on startup).
 */
export function startWorkOrderNotificationScheduler() {
  console.log("[WorkOrderNotificationScheduler] Starting 60s interval poller...");

  const runTick = async () => {
    if (isSchedulerRunning) return;
    isSchedulerRunning = true;
    try {
      await processPendingWorkOrderNotifications();
    } catch (err: any) {
      console.error("[WorkOrderNotificationScheduler] Poller tick error:", err.message || err);
    } finally {
      isSchedulerRunning = false;
    }
  };

  // Run once immediately on startup
  runTick().catch((err) => {
    console.error("[WorkOrderNotificationScheduler] Startup error:", err.message || err);
  });

  // Schedule to run every 60 seconds
  schedulerInterval = setInterval(() => {
    runTick().catch((err) => {
      console.error("[WorkOrderNotificationScheduler] Interval error:", err.message || err);
    });
  }, 60 * 1000);

  console.log("[WorkOrderNotificationScheduler] Initialized (interval: 60s).");
}

export function stopWorkOrderNotificationScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
  }
}

/**
 * Handle appointment technician and status changes
 */
export async function handleAppointmentNoticeTrigger(
  appointmentId: string,
  options: {
    previousResourceId?: string | null;
    previousStartTime?: Date | string | null;
    previousStatus?: string | null;
    notifyCustomer?: boolean;
  } = {},
  transaction?: any
): Promise<void> {
  const appointment = await ServiceAppointment.findByPk(appointmentId, {
    include: [{ model: ServiceResource, as: "serviceResource" }],
    transaction,
  });

  if (!appointment || !appointment.workOrderId) return;

  const currentStatus = appointment.status;
  const currentResourceId = appointment.serviceResourceId;
  const currentStartTime = appointment.scheduledStartTime ? new Date(appointment.scheduledStartTime).toISOString() : "none";
  const { previousResourceId, previousStatus, notifyCustomer = true } = options;

  // Check if a notice was already sent or queued for this appointment
  const priorNotices = await WorkOrderNotification.findAll({
    where: {
      appointmentId,
      type: { [Op.in]: ["VISIT_SCHEDULED", "TECHNICIAN_ASSIGNED", "VISIT_UPDATED"] },
      status: { [Op.in]: ["Pending", "Sent", "DryRun"] },
    },
    transaction,
  });
  const noticeAlreadySent = priorNotices.length > 0;

  // 1. Visit Cancelled
  if (currentStatus === "Canceled") {
    if (noticeAlreadySent) {
      const dedupeKey = `CANCELLED:${appointmentId}`;
      await queueWorkOrderNotification(
        {
          workOrderId: appointment.workOrderId,
          appointmentId,
          type: "VISIT_CANCELLED",
          dedupeKey,
          notifyCustomer,
        },
        transaction
      );
    }
    return;
  }

  // If completed or new status is canceled, do not send assignment notices
  if (currentStatus === "Completed") return;

  // 2. Technician assigned or updated
  if (currentResourceId) {
    if (!noticeAlreadySent) {
      // First notice: VISIT_SCHEDULED
      const dedupeKey = `SCHEDULED:${appointmentId}:${currentResourceId}:${currentStartTime}`;
      await queueWorkOrderNotification(
        {
          workOrderId: appointment.workOrderId,
          appointmentId,
          type: "VISIT_SCHEDULED",
          dedupeKey,
          notifyCustomer,
        },
        transaction
      );

      // In-app alert for technician's user
      const appAny = appointment as any;
      if (appAny.serviceResource && appAny.serviceResource.userId) {
        try {
          await createNotification({
            userId: appAny.serviceResource.userId,
            type: "WORK_ORDER_ASSIGNED",
            title: "New Service Appointment Assigned",
            message: `You have been assigned to appointment ${appointment.appointmentNumber || appointment.id}`,
            entityType: "SYSTEM",
            entityId: appointment.id,
          });
        } catch (alertErr) {
          console.warn("[WorkOrderNotification] Failed to create in-app technician alert:", alertErr);
        }
      }
    } else {
      // Notice already sent earlier: send VISIT_UPDATED if resource or time changed
      const dedupeKey = `VISIT_UPDATED:${appointmentId}:${currentResourceId}:${currentStartTime}:${currentStatus}`;
      await queueWorkOrderNotification(
        {
          workOrderId: appointment.workOrderId,
          appointmentId,
          type: "VISIT_UPDATED",
          dedupeKey,
          notifyCustomer,
        },
        transaction
      );

      // If technician changed to a new user, alert the new technician
      const appAny = appointment as any;
      if (currentResourceId !== previousResourceId && appAny.serviceResource && appAny.serviceResource.userId) {
        try {
          await createNotification({
            userId: appAny.serviceResource.userId,
            type: "WORK_ORDER_ASSIGNED",
            title: "Service Appointment Reassigned",
            message: `You have been assigned to appointment ${appointment.appointmentNumber || appointment.id}`,
            entityType: "SYSTEM",
            entityId: appointment.id,
          });
        } catch (alertErr) {
          console.warn("[WorkOrderNotification] Failed to create in-app technician alert:", alertErr);
        }
      }
    }
  } else if (noticeAlreadySent && previousResourceId) {
    // Technician was removed after a notice was sent -> send VISIT_UPDATED stating technician will be confirmed shortly
    const dedupeKey = `VISIT_UPDATED:${appointmentId}:UNASSIGNED:${currentStartTime}`;
    await queueWorkOrderNotification(
      {
        workOrderId: appointment.workOrderId,
        appointmentId,
        type: "VISIT_UPDATED",
        dedupeKey,
        notifyCustomer,
      },
      transaction
    );
  }
}

/**
 * Handle WorkOrder status change (central trigger function)
 */
export async function handleWorkOrderStatusChange(
  workOrderId: string,
  newStatus: string,
  transaction?: any
): Promise<void> {
  const isCompletedOrClosed = newStatus === "Completed" || newStatus === "Closed";
  if (!isCompletedOrClosed) return;

  // 1. Check if feedback request was already queued/sent for this work order (once per work order)
  const existingFeedbackNotif = await WorkOrderNotification.findOne({
    where: {
      workOrderId,
      type: "FEEDBACK_REQUEST",
    },
    transaction,
  });

  if (existingFeedbackNotif) return;

  // 2. Guard: no line item is "Pending Approval"
  const pendingApprovalItem = await WorkOrderLineItem.findOne({
    where: {
      workOrderId,
      status: "Pending Approval",
    },
    transaction,
  });

  if (pendingApprovalItem) {
    // Skipped while a line item is Pending Approval
    const recipient = await resolveWorkOrderRecipient(workOrderId);
    const dedupeKey = `FEEDBACK:${workOrderId}`;
    await (WorkOrderNotification as any).findOrCreate({
      where: { dedupeKey },
      defaults: {
        id: crypto.randomUUID(),
        workOrderId,
        type: "FEEDBACK_REQUEST",
        recipientEmail: recipient.recipientEmail,
        recipientSource: recipient.recipientSource,
        status: "Skipped",
        skipReason: "line item pending approval",
        dedupeKey,
      },
      transaction,
    });
    return;
  }

  // 3. Guard: at least one appointment is Completed
  const completedAppointment = await ServiceAppointment.findOne({
    where: {
      workOrderId,
      status: "Completed",
    },
    transaction,
  });

  if (!completedAppointment) {
    return;
  }

  // 4. Generate feedback token and record WorkOrderFeedback row
  const feedbackId = crypto.randomUUID();
  const version = 1;
  const rawToken = createFeedbackToken(feedbackId, version);
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  const tokenExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  await WorkOrderFeedback.create(
    {
      id: feedbackId,
      workOrderId,
      appointmentId: completedAppointment.id,
      serviceResourceId: completedAppointment.serviceResourceId || null,
      tokenHash,
      tokenVersion: version,
      tokenExpiresAt,
    },
    { transaction }
  );

  // 5. Calculate scheduledFor delay (default: 0 minutes = immediately)
  const delayMinutes = parseInt(process.env.FEEDBACK_REQUEST_DELAY_MINUTES || "0", 10) || 0;
  const scheduledFor = delayMinutes > 0 ? new Date(Date.now() + delayMinutes * 60 * 1000) : null;

  const dedupeKey = `FEEDBACK:${workOrderId}`;
  const notification = await queueWorkOrderNotification(
    {
      workOrderId,
      appointmentId: completedAppointment.id,
      type: "FEEDBACK_REQUEST",
      dedupeKey,
      scheduledFor,
    },
    transaction
  );

  if (!scheduledFor || scheduledFor.getTime() <= Date.now()) {
    setImmediate(() => {
      deliverWorkOrderNotification(notification.id).catch((err) =>
        console.error("[WorkOrderNotification] Feedback delivery error:", err)
      );
    });
  }
}

/**
 * Resend a notification (creates explicit RESEND dedupe key)
 */
export async function resendWorkOrderNotification(
  notificationId: string
): Promise<WorkOrderNotification> {
  const original = await WorkOrderNotification.findByPk(notificationId);
  if (!original) {
    throw new Error("Notification not found");
  }

  const resendKey = `RESEND:${original.id}:${Date.now()}`;
  const freshNotification = await WorkOrderNotification.create({
    id: crypto.randomUUID(),
    workOrderId: original.workOrderId,
    appointmentId: original.appointmentId,
    type: original.type,
    recipientEmail: original.recipientEmail,
    recipientSource: original.recipientSource,
    status: "Pending",
    dedupeKey: resendKey,
    attempts: 0,
    scheduledFor: null,
  });

  // If this is a feedback request, increment tokenVersion so previous token is deterministically invalidated
  if (original.type === "FEEDBACK_REQUEST") {
    const feedbackRecord = await WorkOrderFeedback.findOne({
      where: { workOrderId: original.workOrderId },
      order: [["createdAt", "DESC"]],
    });
    if (feedbackRecord) {
      const nextVersion = ((feedbackRecord as any).tokenVersion || 1) + 1;
      feedbackRecord.tokenVersion = nextVersion;
      feedbackRecord.tokenExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const freshToken = createFeedbackToken(feedbackRecord.id, nextVersion);
      feedbackRecord.tokenHash = crypto.createHash("sha256").update(freshToken).digest("hex");
      await feedbackRecord.save();
    }
  }

  setImmediate(() => {
    deliverWorkOrderNotification(freshNotification.id).catch((err) => {
      console.error("[WorkOrderNotification] Resend delivery error:", err);
    });
  });

  return freshNotification;
}
