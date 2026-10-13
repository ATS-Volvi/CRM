import twilio from "twilio";
import dotenv from "dotenv";
dotenv.config();

export type WhatsAppApprovalStatus =
  | "approved"
  | "pending"
  | "received"
  | "rejected"
  | "paused"
  | "disabled"
  | "unsubmitted";

export interface WhatsAppTemplate {
  sid: string;
  friendlyName: string;
  language: string;
  body: string;
  contentType: string;
  variables: string[];
  sampleValues: Record<string, string>;
  approvalStatus: WhatsAppApprovalStatus;
  category?: string;
  rejectionReason?: string | null;
  usable: boolean;
  dateUpdated: string;
  simulated?: boolean;
}

export interface WhatsAppTemplateListResponse {
  templates: WhatsAppTemplate[];
  simulated: boolean;
  cached?: boolean;
}

/**
 * Extracts ordered variable placeholder keys from a template body (e.g. {{1}}, {{name}}),
 * deduplicating and unioning with any keys in Twilio's variables map.
 */
export const extractTemplateVariables = (
  body: string,
  twilioVariables?: Record<string, any>
): string[] => {
  const vars: string[] = [];
  const seen = new Set<string>();

  if (body) {
    const regex = /{{\s*([a-zA-Z0-9_-]+)\s*}}/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(body)) !== null) {
      const key = match[1];
      if (!seen.has(key)) {
        seen.add(key);
        vars.push(key);
      }
    }
  }

  if (twilioVariables && typeof twilioVariables === "object") {
    for (const key of Object.keys(twilioVariables)) {
      if (!seen.has(key)) {
        seen.add(key);
        vars.push(key);
      }
    }
  }

  return vars;
};

/**
 * Auto-suggests a default placeholder mapping (e.g. {{firstName}}, {{company}}, {{campaignName}})
 * by analyzing words preceding the variable in bodyText or inspecting the variable key / sample value.
 */
export const suggestDefaultVariableValue = (
  variableKey: string,
  bodyText: string,
  sampleValue?: string
): string => {
  const cleanBody = String(bodyText || "");
  const cleanSample = String(sampleValue || "").toLowerCase();
  const cleanKey = String(variableKey || "").toLowerCase();

  const escapedKey = variableKey.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`\\{\\{\\s*${escapedKey}\\s*\\}\\}`, "i");
  const match = regex.exec(cleanBody);
  const keyIndex = match ? match.index : -1;
  const matchLen = match ? match[0].length : 0;

  const textBefore = keyIndex > 0 ? cleanBody.slice(Math.max(0, keyIndex - 60), keyIndex).toLowerCase() : "";
  const textAfter = keyIndex >= 0 ? cleanBody.slice(keyIndex + matchLen, keyIndex + matchLen + 60).toLowerCase() : "";

  // 1. Check for last name / honorifics (Mr., Ms., Dr., surname) or key explicitly naming surname/last name
  if (
    cleanKey.includes("last") ||
    cleanKey.includes("surname") ||
    cleanSample.includes("last") ||
    cleanSample.includes("surname") ||
    /\b(?:mr\.?|ms\.?|mrs\.?|dr\.?|surname|family|last name)\b/i.test(textBefore)
  ) {
    return "{{lastName}}";
  }

  // 2. Check for company / organization indications (from {{x}}, at {{x}}, welcome to {{x}})
  if (
    /\b(?:from|at|with|welcome to|colleagues at|team at|company|organization|firm|business|employed at)\b/i.test(
      textBefore
    )
  ) {
    return "{{company}}";
  }

  // 3. Check for campaign / promotion indications (either in text before, text after, or key)
  if (
    /\b(?:campaign|offer|promo|promotion|event|webinar|discount)\b/i.test(textBefore) ||
    /\b(?:campaign|offer|promo|promotion|event|webinar|discount)\b/i.test(textAfter) ||
    cleanKey.includes("promo") ||
    cleanKey.includes("campaign")
  ) {
    return "{{campaignName}}";
  }

  // 4. Check for first name / greeting indications
  if (/\b(?:hi|hello|dear|hey|greetings|hola)\b/i.test(textBefore)) {
    return "{{firstName}}";
  }

  // 5. Check sample value or key name hints
  if (
    cleanSample.includes("first") ||
    cleanSample.includes("name") ||
    cleanSample.includes("alex") ||
    cleanSample.includes("john") ||
    cleanKey.includes("first") ||
    cleanKey.includes("name")
  ) {
    return "{{firstName}}";
  }

  if (cleanSample.includes("last") || cleanSample.includes("surname") || cleanKey.includes("last") || cleanKey.includes("surname")) {
    return "{{lastName}}";
  }

  if (
    cleanSample.includes("company") ||
    cleanSample.includes("corp") ||
    cleanSample.includes("inc") ||
    cleanKey.includes("company") ||
    cleanKey.includes("org")
  ) {
    return "{{company}}";
  }

  if (cleanSample.includes("campaign") || cleanSample.includes("offer") || cleanSample.includes("promo")) {
    return "{{campaignName}}";
  }

  // 6. Positional fallbacks
  if (variableKey === "1") return "{{firstName}}";
  if (variableKey === "2") return "{{company}}";
  if (variableKey === "3") return "{{campaignName}}";

  return "{{firstName}}";
};

// ─── 3 CLEARLY LABELLED SIMULATED SAMPLE TEMPLATES ───────────────────────────
const SIMULATED_SAMPLE_TEMPLATES: WhatsAppTemplate[] = [
  {
    sid: "HX_sample_welcome_onboarding",
    friendlyName: "[Sample] Customer Welcome & Onboarding",
    language: "en",
    body: "Hi {{1}}, welcome to {{2}}! We're thrilled to partner with you on your upcoming project. Let us know if you have any questions.",
    contentType: "twilio/text",
    variables: ["1", "2"],
    sampleValues: { "1": "Alex", "2": "FACE Contracting Co." },
    approvalStatus: "approved",
    category: "MARKETING",
    rejectionReason: null,
    usable: true,
    dateUpdated: new Date(Date.now() - 3600000).toISOString(),
    simulated: true
  },
  {
    sid: "HX_sample_promo_discount",
    friendlyName: "[Sample] Exclusive Promotion & Offer",
    language: "en",
    body: "Hello {{1}}, thank you for reaching out to {{2}}. We have prepared a special offer for your {{3}} inquiry from {{4}}!",
    contentType: "twilio/text",
    variables: ["1", "2", "3", "4"],
    sampleValues: {
      "1": "Sarah",
      "2": "FACE Contracting Co.",
      "3": "Commercial Renovation",
      "4": "Sales Team"
    },
    approvalStatus: "approved",
    category: "MARKETING",
    rejectionReason: null,
    usable: true,
    dateUpdated: new Date(Date.now() - 7200000).toISOString(),
    simulated: true
  },
  {
    sid: "HX_sample_quote_update_pending",
    friendlyName: "[Sample] Quotation Status (Pending Review)",
    language: "en",
    body: "Dear {{1}}, your formal proposal from {{2}} is currently being generated.",
    contentType: "twilio/text",
    variables: ["1", "2"],
    sampleValues: { "1": "Customer", "2": "FACE Contracting Co." },
    approvalStatus: "pending",
    category: "UTILITY",
    rejectionReason: null,
    usable: false,
    dateUpdated: new Date(Date.now() - 86400000).toISOString(),
    simulated: true
  }
];

// In-memory cache
interface CacheEntry {
  data: WhatsAppTemplate[];
  timestamp: number;
}

let memoryCache: CacheEntry | null = null;
const CACHE_TTL_MS = 60 * 1000; // 60 seconds

export const clearWhatsAppTemplateCache = () => {
  memoryCache = null;
};

/**
 * Lists Twilio Content Templates with approval status for WhatsApp.
 * - In-memory cache of 60 seconds (bypass with forceRefresh)
 * - Sorts approved first, then newest first
 * - Falls back to simulated samples if Twilio credentials are missing
 */
export const listWhatsAppTemplates = async (
  forceRefresh: boolean = false
): Promise<WhatsAppTemplateListResponse> => {
  const accountSid = (process.env.TWILIO_ACCOUNT_SID || "").trim();
  const authToken = (process.env.TWILIO_AUTH_TOKEN || "").trim();

  // 1. Simulation Mode if Twilio is not configured
  if (!accountSid || !authToken) {
    return {
      templates: SIMULATED_SAMPLE_TEMPLATES,
      simulated: true,
      cached: false
    };
  }

  // 2. Check In-Memory Cache (unless forceRefresh is requested)
  if (!forceRefresh && memoryCache && Date.now() - memoryCache.timestamp < CACHE_TTL_MS) {
    return {
      templates: memoryCache.data,
      simulated: false,
      cached: true
    };
  }

  // 3. Fetch from Twilio Content API
  const client = twilio(accountSid, authToken);
  const items = await client.content.v1.contentAndApprovals.list({ limit: 500, pageSize: 100 });

  const templates: WhatsAppTemplate[] = (items || []).map((item: any) => {
    const sid = String(item.sid || "");
    const friendlyName = String(item.friendlyName || item.friendly_name || sid);
    const language = String(item.language || "en");

    // Extract body and content type from first types[*].body
    let body = "";
    let contentType = "";
    const types = item.types || {};
    if (types && typeof types === "object") {
      for (const [tKey, tVal] of Object.entries(types)) {
        if (tVal && typeof tVal === "object") {
          const valObj = tVal as any;
          if (typeof valObj.body === "string" && valObj.body.trim()) {
            body = valObj.body.trim();
            contentType = tKey;
            break;
          }
          if (!body && typeof valObj.text === "string" && valObj.text.trim()) {
            body = valObj.text.trim();
            contentType = tKey;
          }
        }
      }
      if (!contentType && Object.keys(types).length > 0) {
        contentType = Object.keys(types)[0];
      }
    }

    // Twilio sample values / variables
    const rawTwilioVars = item.variables && typeof item.variables === "object" ? item.variables : {};
    const sampleValues: Record<string, string> = {};
    for (const [k, v] of Object.entries(rawTwilioVars)) {
      if (v !== undefined && v !== null) {
        sampleValues[k] = String(v);
      }
    }

    // Ordered variables from body unioned with twilioVariables
    const variables = extractTemplateVariables(body, rawTwilioVars);

    // Approval status from approval_requests.whatsapp.status
    const rawApprovals = item.approvalRequests || item.approval_requests || {};
    const waApproval = rawApprovals.whatsapp || rawApprovals.WhatsApp || {};
    const rawStatus = String(waApproval.status || waApproval.approval_status || "").trim().toLowerCase();

    let approvalStatus: WhatsAppApprovalStatus = "unsubmitted";
    if (rawStatus === "approved") {
      approvalStatus = "approved";
    } else if (rawStatus === "pending") {
      approvalStatus = "pending";
    } else if (rawStatus === "received") {
      approvalStatus = "received";
    } else if (rawStatus === "rejected") {
      approvalStatus = "rejected";
    } else if (rawStatus === "paused") {
      approvalStatus = "paused";
    } else if (rawStatus === "disabled") {
      approvalStatus = "disabled";
    } else if (rawStatus === "unsubmitted" || !rawStatus) {
      approvalStatus = "unsubmitted";
    }

    const category = String(waApproval.category || item.category || "").trim();
    const rejectionReason = waApproval.rejection_reason || waApproval.rejectionReason || null;
    const usable = approvalStatus === "approved";
    const dateUpdated =
      item.dateUpdated instanceof Date
        ? item.dateUpdated.toISOString()
        : item.date_updated
        ? new Date(item.date_updated).toISOString()
        : new Date().toISOString();

    return {
      sid,
      friendlyName,
      language,
      body,
      contentType: contentType || "twilio/text",
      variables,
      sampleValues,
      approvalStatus,
      category,
      rejectionReason: rejectionReason ? String(rejectionReason) : null,
      usable,
      dateUpdated,
      simulated: false
    };
  });

  // 4. Sort: approved first, then newest first
  templates.sort((a, b) => {
    if (a.usable && !b.usable) return -1;
    if (!a.usable && b.usable) return 1;
    const timeA = new Date(a.dateUpdated || 0).getTime();
    const timeB = new Date(b.dateUpdated || 0).getTime();
    return timeB - timeA;
  });

  // Store in memory cache
  memoryCache = {
    data: templates,
    timestamp: Date.now()
  };

  return {
    templates,
    simulated: false,
    cached: false
  };
};
