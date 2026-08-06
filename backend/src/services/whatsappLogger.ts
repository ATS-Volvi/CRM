import { sequelize } from "@nexus-crm/database";
import { Op } from "sequelize";
import crypto from "crypto";

export type LogLevel = "ERROR" | "WARN" | "INFO" | "DEBUG";
export type LogCategory = 
  | "CONFIGURATION" 
  | "WEBHOOK_VERIFICATION" 
  | "INBOUND_PAYLOAD" 
  | "OUTBOUND_SEND" 
  | "DELIVERY_STATUS" 
  | "LEAD_ASSOCIATION" 
  | "API_ERROR";

export interface LogDetails {
  statusCode?: number;
  metaErrorCode?: number;
  metaErrorSubcode?: number;
  metaErrorType?: string;
  fbTraceId?: string;
  remediationTip?: string;
  rawPayload?: any;
  stack?: string;
  endpoint?: string;
  [key: string]: any;
}

// ─── Meta Error Catalog & Guidance ──────────────────────────────────────────

const META_ERROR_CATALOG: Record<number, { title: string; diagnosis: string; remediation: string }> = {
  190: {
    title: "Access Token Invalid or Expired",
    diagnosis: "The Meta OAuth Access Token is invalid, expired, or revoked.",
    remediation: "Regenerate a Permanent System User Access Token in Meta Business Manager and set WHATSAPP_TOKEN in your environment variables.",
  },
  100: {
    title: "Invalid Parameter / Phone ID Mismatch",
    diagnosis: "The Phone Number ID specified does not exist or does not belong to the authenticated Meta WABA account.",
    remediation: "Verify WHATSAPP_PHONE_NUMBER_ID in your .env file against your Phone Number ID in Meta Developer Portal -> WhatsApp -> API Setup.",
  },
  131030: {
    title: "Recipient Phone Not in Test List",
    diagnosis: "In Meta Development/Sandbox mode, you can only send messages to test phone numbers explicitly registered in Meta Dashboard.",
    remediation: "Add the recipient phone number to the 'To' phone number dropdown in Meta Developer Portal -> WhatsApp -> API Setup, or switch your Meta App to Production mode.",
  },
  131026: {
    title: "24-Hour Customer Service Window Expired",
    diagnosis: "More than 24 hours have passed since the customer last sent a message. Standard text messages cannot be sent outside this window.",
    remediation: "You must send a pre-approved Meta Message Template to re-open the conversation window with this customer.",
  },
  131047: {
    title: "Re-engagement Window Expired",
    diagnosis: "More than 24 hours have elapsed without user activity. Standard free-form messages are blocked by Meta Policy.",
    remediation: "Send an approved WhatsApp Business Template message (e.g. Utility/Marketing template) to re-engage the customer.",
  },
  132001: {
    title: "Template Does Not Exist",
    diagnosis: "The requested Message Template name or language code does not match any approved template in your Meta Business Account.",
    remediation: "Check Meta Business Manager -> WhatsApp Manager -> Message Templates for the exact template name and language code.",
  },
  10: {
    title: "Permission Denied",
    diagnosis: "The access token lacks necessary permissions (e.g., whatsapp_business_messaging).",
    remediation: "In Meta Business Manager, edit your System User token permissions and grant `whatsapp_business_messaging` & `whatsapp_business_management`.",
  },
  131009: {
    title: "Parameter Value Invalid",
    diagnosis: "One or more message parameters (phone format, media URL, text body) violate Meta format rules.",
    remediation: "Ensure phone numbers include country code with no + symbol (e.g. 966500000000) and media URLs are publicly accessible via HTTP/HTTPS.",
  },
};

/** Get diagnostic tip for a Meta Error Code or general issue */
export function getRemediationTip(code?: number, category?: string): string {
  if (code && META_ERROR_CATALOG[code]) {
    return META_ERROR_CATALOG[code].remediation;
  }
  switch (category) {
    case "CONFIGURATION":
      return "Ensure WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID, and WHATSAPP_VERIFY_TOKEN are set in backend .env and restart server.";
    case "WEBHOOK_VERIFICATION":
      return "Check that Meta Webhook Verify Token in Meta Developer Console matches WHATSAPP_VERIFY_TOKEN (default: nexus_whatsapp_webhook_secret_2026).";
    case "INBOUND_PAYLOAD":
      return "Verify Meta Webhook subscription settings under WhatsApp -> Webhook fields: enable 'messages'.";
    case "DELIVERY_STATUS":
      return "Check recipient phone number formatting and Meta Account health status under Meta WhatsApp Manager.";
    default:
      return "Review error details and check server logs. Ensure WhatsApp Business API setup is complete in Meta Developer Console.";
  }
}

// ─── Logger Function ─────────────────────────────────────────────────────────

export async function logWhatsAppEvent(
  level: LogLevel,
  category: LogCategory,
  event: string,
  message: string,
  details: LogDetails = {},
  phone?: string | null,
  messageId?: string | null
): Promise<any> {
  const consolePrefix = `[WhatsApp Audit Log - ${level}] [${category}:${event}]`;
  if (level === "ERROR") {
    console.error(consolePrefix, message, details);
  } else if (level === "WARN") {
    console.warn(consolePrefix, message, details);
  } else {
    console.log(consolePrefix, message);
  }

  // Enforce remediation tip if meta error code present
  if (details.metaErrorCode && !details.remediationTip) {
    details.remediationTip = getRemediationTip(details.metaErrorCode, category);
  } else if (!details.remediationTip) {
    details.remediationTip = getRemediationTip(undefined, category);
  }

  try {
    const logEntry = await (sequelize.models.WhatsAppLog as any).create({
      id: crypto.randomUUID(),
      timestamp: new Date(),
      level,
      category,
      event,
      message,
      details: JSON.stringify(details),
      phone: phone || null,
      messageId: messageId || null,
      resolved: false,
    } as any);
    return logEntry;
  } catch (err) {
    console.error("[WhatsApp Logger] Failed to persist log entry to database:", err);
    return null;
  }
}

// ─── Health Check & Diagnostics ──────────────────────────────────────────────

export async function getWhatsAppHealthStatus() {
  const token = process.env.WHATSAPP_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || "nexus_whatsapp_webhook_secret_2026";
  const wabaId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;

  // Twilio credentials (primary provider for this deployment)
  const twilioSid = (process.env.TWILIO_ACCOUNT_SID || "").trim();
  const twilioToken = (process.env.TWILIO_AUTH_TOKEN || "").trim();
  const twilioNumber = (process.env.TWILIO_WHATSAPP_NUMBER || process.env.TWILIO_PHONE_NUMBER || "").trim();
  const isTwilioConfigured = Boolean(
    twilioSid && !twilioSid.includes("your_") &&
    twilioToken && !twilioToken.includes("your_") &&
    twilioNumber
  );

  const isMetaConfigured = Boolean(token && phoneId);
  // System is NOT simulated if either Twilio OR Meta is configured
  const isSimulation = !isMetaConfigured && !isTwilioConfigured;

  // Count errors in last 24h
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  let errorCount24h = 0;
  let warnCount24h = 0;
  let totalLogs24h = 0;

  try {
    errorCount24h = await (sequelize.models.WhatsAppLog as any).count({
      where: {
        level: "ERROR",
        timestamp: { [Op.gte]: twentyFourHoursAgo },
      },
    });
    warnCount24h = await (sequelize.models.WhatsAppLog as any).count({
      where: {
        level: "WARN",
        timestamp: { [Op.gte]: twentyFourHoursAgo },
      },
    });
    totalLogs24h = await (sequelize.models.WhatsAppLog as any).count({
      where: {
        timestamp: { [Op.gte]: twentyFourHoursAgo },
      },
    });
  } catch (err) {
    // If table not created yet
  }

  // Ping Meta API only if Meta credentials exist (separate from Twilio)
  let metaApiReachable = false;
  let metaApiLatencyMs = 0;
  let metaApiDetails: any = null;

  if (isMetaConfigured) {
    const startTime = Date.now();
    try {
      const response = await fetch(`https://graph.facebook.com/v18.0/${phoneId}?access_token=${token}`);
      metaApiLatencyMs = Date.now() - startTime;
      const data = await response.json();
      if (response.ok) {
        metaApiReachable = true;
        metaApiDetails = {
          display_phone_number: data.display_phone_number || "Verified Number",
          verified_name: data.verified_name || "Nexus CRM Business",
          quality_rating: data.quality_rating || "GREEN",
          id: data.id,
        };
      } else {
        metaApiDetails = {
          error: data.error || data,
          status: response.status,
          remediation: getRemediationTip(data?.error?.code, "API_ERROR"),
        };
      }
    } catch (err: any) {
      metaApiLatencyMs = Date.now() - startTime;
      metaApiDetails = { error: err.message };
    }
  }

  // Calculate overall health state
  // Twilio is the primary active provider; Meta Cloud API is optional/secondary
  let state: "healthy" | "degraded" | "error" | "simulation" = "healthy";
  if (isSimulation) {
    state = "simulation";
  } else if (isTwilioConfigured && !isMetaConfigured) {
    // Twilio-only deployment: healthy if no recent errors, degraded otherwise
    state = errorCount24h > 10 ? "error" : errorCount24h > 0 ? "degraded" : "healthy";
  } else if (!metaApiReachable || errorCount24h > 10) {
    state = "error";
  } else if (errorCount24h > 0 || warnCount24h > 5) {
    state = "degraded";
  }

  const checklist = [
    // ── Twilio (Primary Provider) ──────────────────────────────────────────────
    {
      key: "TWILIO_SID",
      title: "Twilio Account SID",
      configured: isTwilioConfigured,
      value: twilioSid ? `Present (${twilioSid.slice(0, 6)}...${twilioSid.slice(-4)})` : "Missing",
      status: isTwilioConfigured ? "ok" : "warning",
    },
    {
      key: "TWILIO_TOKEN",
      title: "Twilio Auth Token",
      configured: isTwilioConfigured,
      value: twilioToken ? "Configured (hidden)" : "Missing",
      status: isTwilioConfigured ? "ok" : "warning",
    },
    {
      key: "TWILIO_NUMBER",
      title: "Twilio WhatsApp Number",
      configured: Boolean(twilioNumber),
      value: twilioNumber || "Missing",
      status: twilioNumber ? "ok" : "warning",
    },
    // ── Meta Cloud API (Optional / Secondary) ──────────────────────────────────
    {
      key: "TOKEN",
      title: "Meta WhatsApp Access Token",
      configured: Boolean(token),
      value: token ? `Present (${token.slice(0, 8)}...${token.slice(-4)})` : "Not configured (optional if using Twilio)",
      status: token ? "ok" : "info",
    },
    {
      key: "PHONE_ID",
      title: "Meta Phone Number ID",
      configured: Boolean(phoneId),
      value: phoneId || "Not configured (optional if using Twilio)",
      status: phoneId ? "ok" : "info",
    },
    {
      key: "VERIFY_TOKEN",
      title: "Webhook Verify Token",
      configured: Boolean(verifyToken),
      value: verifyToken,
      status: "ok",
    },
    {
      key: "WABA_ID",
      title: "Business Account ID (WABA)",
      configured: Boolean(wabaId),
      value: wabaId || "Optional (Not set)",
      status: wabaId ? "ok" : "info",
    },
    {
      key: "META_GRAPH",
      title: "Meta Cloud API Connectivity",
      configured: isMetaConfigured,
      value: metaApiReachable
        ? `Connected (${metaApiLatencyMs}ms)`
        : isSimulation
        ? "Simulated Mode"
        : isMetaConfigured
        ? `Connection Failed (${metaApiLatencyMs}ms)`
        : "Not configured (using Twilio)",
      status: metaApiReachable ? "ok" : isMetaConfigured ? "error" : "info",
    },
  ];

  return {
    state,
    isSimulation,
    errorCount24h,
    warnCount24h,
    totalLogs24h,
    metaApiReachable,
    metaApiLatencyMs,
    metaApiDetails,
    checklist,
    webhookEndpoint: "/api/v1/whatsapp/webhook",
  };
}

// ─── Connection Test ─────────────────────────────────────────────────────────

export async function testWhatsAppConnection() {
  const token = process.env.WHATSAPP_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneId) {
    const msg = "WHATSAPP_TOKEN or WHATSAPP_PHONE_NUMBER_ID environment variable is missing.";
    await logWhatsAppEvent("WARN", "CONFIGURATION", "TEST_CONNECTION_SIMULATED", msg, {
      remediationTip: getRemediationTip(undefined, "CONFIGURATION"),
    });
    return {
      success: false,
      isSimulation: true,
      message: "Running in Simulation Mode - missing live Meta credentials.",
      details: {
        WHATSAPP_TOKEN: token ? "Configured" : "MISSING",
        WHATSAPP_PHONE_NUMBER_ID: phoneId ? "Configured" : "MISSING",
        remediation: getRemediationTip(undefined, "CONFIGURATION"),
      },
    };
  }

  const startTime = Date.now();
  try {
    const response = await fetch(`https://graph.facebook.com/v18.0/${phoneId}?access_token=${token}`);
    const latencyMs = Date.now() - startTime;
    const body = await response.json();

    if (response.ok) {
      await logWhatsAppEvent("INFO", "CONFIGURATION", "TEST_CONNECTION_SUCCESS", "Meta Graph API connection test passed.", {
        statusCode: response.status,
        latencyMs,
        phoneDetails: body,
      });
      return {
        success: true,
        isSimulation: false,
        latencyMs,
        message: "Successfully connected to Meta WhatsApp Cloud API!",
        phoneDetails: {
          id: body.id,
          display_phone_number: body.display_phone_number,
          verified_name: body.verified_name,
          quality_rating: body.quality_rating,
        },
      };
    } else {
      const errorCode = body?.error?.code;
      const subcode = body?.error?.error_subcode;
      const errorMsg = body?.error?.message || "Unknown Meta API error";
      const catalog = errorCode ? META_ERROR_CATALOG[errorCode] : null;

      const details: LogDetails = {
        statusCode: response.status,
        metaErrorCode: errorCode,
        metaErrorSubcode: subcode,
        metaErrorType: body?.error?.type,
        fbTraceId: body?.error?.fbtrace_id,
        rawPayload: body,
        remediationTip: catalog ? catalog.remediation : getRemediationTip(errorCode, "API_ERROR"),
      };

      await logWhatsAppEvent(
        "ERROR",
        "API_ERROR",
        "TEST_CONNECTION_FAILED",
        `Meta API returned HTTP ${response.status}: ${errorMsg}`,
        details
      );

      return {
        success: false,
        isSimulation: false,
        statusCode: response.status,
        latencyMs,
        error: errorMsg,
        metaErrorCode: errorCode,
        metaErrorSubcode: subcode,
        diagnosis: catalog?.diagnosis || "Meta API request was rejected.",
        remediation: details.remediationTip,
        rawError: body,
      };
    }
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;
    await logWhatsAppEvent("ERROR", "API_ERROR", "TEST_CONNECTION_NETWORK_ERROR", err.message, {
      stack: err.stack,
      remediationTip: "Check server network connectivity and DNS resolution for graph.facebook.com.",
    });

    return {
      success: false,
      isSimulation: false,
      latencyMs,
      error: `Network Error: ${err.message}`,
      remediation: "Ensure your server can reach graph.facebook.com over HTTPS (port 443).",
    };
  }
}

// ─── Webhook Simulation ──────────────────────────────────────────────────────

export async function testWhatsAppWebhookSimulation(customPayload?: any) {
  const traceLogs: Array<{ step: string; status: "success" | "warn" | "error" | "info"; message: string; details?: any }> = [];

  const payload = customPayload || {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "100987654321",
        changes: [
          {
            value: {
              messaging_product: "whatsapp",
              metadata: {
                display_phone_number: "+966501234567",
                phone_number_id: "109876543210",
              },
              contacts: [
                {
                  profile: { name: "Diagnostic Test User" },
                  wa_id: "966509998877",
                },
              ],
              messages: [
                {
                  from: "966509998877",
                  id: `wamid.test_sim_${Date.now()}`,
                  timestamp: String(Math.floor(Date.now() / 1000)),
                  text: { body: "Hello! This is an automated diagnostic test message." },
                  type: "text",
                },
              ],
            },
            field: "messages",
          },
        ],
      },
    ],
  };

  traceLogs.push({ step: "1. Payload Received", status: "info", message: "Inspecting top-level structure", details: { object: payload.object } });

  if (payload.object !== "whatsapp_business_account") {
    traceLogs.push({
      step: "2. Validate Object Field",
      status: "error",
      message: `Invalid object field: "${payload.object}". Expected "whatsapp_business_account".`,
      details: { recommendation: "Meta Webhook must send object='whatsapp_business_account'." },
    });
    return { success: false, traceLogs };
  }
  traceLogs.push({ step: "2. Validate Object Field", status: "success", message: "Object field valid: 'whatsapp_business_account'" });

  const entry = payload.entry?.[0];
  const change = entry?.changes?.[0];
  const value = change?.value;
  const msg = value?.messages?.[0] || entry?.messaging?.[0];

  if (!msg) {
    traceLogs.push({
      step: "3. Extract Message",
      status: "warn",
      message: "No message object found in payload (might be a status receipt).",
      details: { value },
    });
    return { success: true, isStatusReceipt: true, traceLogs };
  }

  const metaMessageId = msg.id || `wamid.generated_${Date.now()}`;
  const from = msg.from || msg.sender?.id || "";
  const msgBody = msg.text?.body || msg.body || "[Media]";

  traceLogs.push({
    step: "3. Extract Message Content",
    status: "success",
    message: `Extracted from: ${from}, messageId: ${metaMessageId}`,
    details: { from, metaMessageId, bodySnippet: msgBody.slice(0, 60) },
  });

  // Check duplicate
  try {
    const existingActivity = await (sequelize.models.Activity as any).findOne({ where: { messageId: metaMessageId } });
    if (existingActivity) {
      traceLogs.push({ step: "4. Idempotency Check", status: "warn", message: `Duplicate messageId detected (${metaMessageId}). Processing skipped.` });
      return { success: true, isDuplicate: true, traceLogs };
    }
    traceLogs.push({ step: "4. Idempotency Check", status: "success", message: "Unique messageId verified." });
  } catch (err: any) {
    traceLogs.push({ step: "4. Idempotency Check", status: "error", message: `Database error during duplicate check: ${err.message}` });
  }

  // Check Phone Matching
  traceLogs.push({ step: "5. Lead/Customer Lookup", status: "info", message: `Searching DB for phone digits ending with ${from.slice(-7)}` });

  await logWhatsAppEvent("INFO", "INBOUND_PAYLOAD", "SIMULATION_TEST_COMPLETED", `Dry-run simulation completed successfully for message from ${from}`, {
    from,
    metaMessageId,
    msgBody,
  });

  return {
    success: true,
    simulatedLeadName: "Diagnostic Test User",
    from,
    metaMessageId,
    msgBody,
    traceLogs,
  };
}

// ─── Query Logs ──────────────────────────────────────────────────────────────

export async function getWhatsAppLogs(filters: {
  level?: string;
  category?: string;
  search?: string;
  resolved?: boolean;
  limit?: number;
  offset?: number;
}) {
  const where: any = {};
  if (filters.level && filters.level !== "ALL") {
    where.level = filters.level;
  }
  if (filters.category && filters.category !== "ALL") {
    where.category = filters.category;
  }
  if (typeof filters.resolved === "boolean") {
    where.resolved = filters.resolved;
  }
  if (filters.search) {
    where[Op.or] = [
      { message: { [Op.like]: `%${filters.search}%` } },
      { event: { [Op.like]: `%${filters.search}%` } },
      { phone: { [Op.like]: `%${filters.search}%` } },
      { details: { [Op.like]: `%${filters.search}%` } },
    ];
  }

  const limit = Math.min(filters.limit || 50, 200);
  const offset = filters.offset || 0;

  try {
    const { count, rows } = await (sequelize.models.WhatsAppLog as any).findAndCountAll({
      where,
      order: [["timestamp", "DESC"]],
      limit,
      offset,
    });

    const parsedRows = rows.map((r: any) => {
      let detailsObj: any = null;
      try {
        if (r.details) detailsObj = JSON.parse(r.details);
      } catch (e) {
        detailsObj = { raw: r.details };
      }
      return {
        id: r.id,
        timestamp: r.timestamp,
        level: r.level,
        category: r.category,
        event: r.event,
        message: r.message,
        details: detailsObj,
        phone: r.phone,
        messageId: r.messageId,
        resolved: r.resolved,
      };
    });

    return { total: count, limit, offset, logs: parsedRows };
  } catch (err: any) {
    console.error("[WhatsApp Logger] Failed to fetch logs:", err);
    return { total: 0, limit, offset, logs: [] };
  }
}

export async function markLogResolved(id: string) {
  try {
    await (sequelize.models.WhatsAppLog as any).update(
      { resolved: true },
      { where: { id } }
    );
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function clearLogs() {
  try {
    await (sequelize.models.WhatsAppLog as any).destroy({ where: {} });
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
