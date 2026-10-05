import { sequelize } from "@nexus-crm/database";
import { Op } from "sequelize";
import crypto from "crypto";
import { sendEmail, getBaseHtmlTemplate } from "./emailService";
import { sendWhatsAppTemplateMessage } from "./whatsappService";

export interface AudienceFilter {
  leadStatus?: string[];
  minScore?: number;
  maxScore?: number;
  country?: string[] | string;
  territory?: string[] | string;
  industry?: string[] | string;
}

export interface ExcludedBreakdown {
  optedOut: number;
  invalidEmail: number;
  duplicate: number;
  closedStatus: number;
}

export interface AudiencePreviewResult {
  eligibleLeads: any[];
  excludedCount: number;
  excludedByReason: ExcludedBreakdown;
}

export interface WhatsAppExcludedBreakdown {
  noPhone: number;
  invalidPhone: number;
  noConsent: number;
  optedOut: number;
  duplicate: number;
  closedStatus: number;
}

export interface WhatsAppAudiencePreviewResult {
  eligibleLeads: any[];
  excludedCount: number;
  excludedByReason: WhatsAppExcludedBreakdown;
}

export interface MessageConfigResult {
  dryRun: boolean;
  maxRecipients: number;
  allowlistActive: boolean;
}

export interface WhatsAppConfigResult {
  dryRun: boolean;
  maxRecipients: number;
  allowlistActive: boolean;
  allowlist: string[];
  batchSize: number;
  batchDelayMs: number;
}

export const getCampaignMessageConfig = (): MessageConfigResult => {
  const dryRunEnv = process.env.CAMPAIGN_EMAIL_DRY_RUN ?? "true";
  const dryRun = dryRunEnv.trim().toLowerCase() === "true" || dryRunEnv.trim() === "1";
  const maxRecipients = parseInt(process.env.CAMPAIGN_EMAIL_MAX_RECIPIENTS || "500", 10) || 500;
  const allowlist = (process.env.CAMPAIGN_EMAIL_TEST_ALLOWLIST || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const allowlistActive = allowlist.length > 0;

  return { dryRun, maxRecipients, allowlistActive };
};

export const normalizePhone = (phone: string | null | undefined): string => {
  if (!phone || typeof phone !== "string") return "";
  return phone.replace(/\D/g, "");
};

export const isValidPhone = (phone: string | null | undefined): boolean => {
  const digits = normalizePhone(phone);
  return digits.length >= 8 && digits.length <= 15;
};

export const maskPhone = (phone: string | null | undefined): string => {
  const digits = normalizePhone(phone);
  if (!digits) return "";
  if (digits.length <= 4) return digits;
  const last4 = digits.slice(-4);
  return `${"•".repeat(Math.max(digits.length - 4, 4))}${last4}`;
};

export const getCampaignWhatsAppConfig = (): WhatsAppConfigResult => {
  const dryRunEnv = process.env.CAMPAIGN_WHATSAPP_DRY_RUN;
  // Default is "true". Only if explicitly set to "false" (case-insensitive) is it false.
  const dryRun =
    dryRunEnv === undefined || dryRunEnv === null || dryRunEnv.trim() === ""
      ? true
      : dryRunEnv.trim().toLowerCase() !== "false";

  const maxRecipients = parseInt(process.env.CAMPAIGN_WHATSAPP_MAX_RECIPIENTS || "200", 10) || 200;
  const allowlist = (process.env.CAMPAIGN_WHATSAPP_TEST_ALLOWLIST || "")
    .split(",")
    .map(normalizePhone)
    .filter(Boolean);
  const allowlistActive = allowlist.length > 0;
  const batchSize = parseInt(process.env.CAMPAIGN_WHATSAPP_BATCH_SIZE || "10", 10) || 10;
  const batchDelayMs = parseInt(process.env.CAMPAIGN_WHATSAPP_BATCH_DELAY_MS || "3000", 10) || 3000;

  return { dryRun, maxRecipients, allowlistActive, allowlist, batchSize, batchDelayMs };
};

export const renderWhatsAppTemplateVariables = (
  templateVariables: Record<string, string> | string | null | undefined,
  lead: any,
  campaignName: string
): Record<string, string> => {
  let parsed: Record<string, any> = {};
  if (typeof templateVariables === "string") {
    try {
      parsed = JSON.parse(templateVariables);
    } catch {
      parsed = {};
    }
  } else if (templateVariables && typeof templateVariables === "object") {
    parsed = templateVariables;
  }

  const dataObj: Record<string, string> = {
    firstName: String(lead?.firstName || "").trim(),
    lastName: String(lead?.lastName || "").trim(),
    company: String(lead?.company || "").trim(),
    campaignName: String(campaignName || "").trim()
  };

  const rendered: Record<string, string> = {};
  const MAX_VAR_LENGTH = 1024;

  for (const [key, rawVal] of Object.entries(parsed)) {
    if (rawVal === undefined || rawVal === null) continue;
    let valStr = String(rawVal);
    for (const [phKey, phVal] of Object.entries(dataObj)) {
      const regex = new RegExp(`{{${phKey}}}`, "g");
      valStr = valStr.replace(regex, phVal);
    }
    valStr = valStr.trim();
    if (valStr.length > MAX_VAR_LENGTH) {
      valStr = valStr.slice(0, MAX_VAR_LENGTH);
    }
    rendered[key] = valStr;
  }

  return rendered;
};

export const isValidEmail = (email: string | null | undefined): boolean => {
  if (!email || typeof email !== "string") return false;
  const trimmed = email.trim();
  if (trimmed.length < 5 || trimmed.length > 254) return false;
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  return emailRegex.test(trimmed);
};

export const escapeHtml = (str: string | null | undefined): string => {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

export const renderTemplatePlaceholders = (
  templateString: string,
  dataObj: Record<string, string>
): string => {
  let rendered = templateString;
  for (const [key, value] of Object.entries(dataObj)) {
    const regex = new RegExp(`{{${key}}}`, "g");
    rendered = rendered.replace(regex, value);
  }
  return rendered;
};

export const renderEmailForLead = (
  bodyHtml: string,
  lead: any,
  campaignName: string,
  recipientId: string
): string => {
  const dataObj = {
    firstName: escapeHtml(lead?.firstName || ""),
    lastName: escapeHtml(lead?.lastName || ""),
    company: escapeHtml(lead?.company || ""),
    campaignName: escapeHtml(campaignName || "")
  };

  const renderedBody = renderTemplatePlaceholders(bodyHtml, dataObj);
  const baseHtml = getBaseHtmlTemplate(renderedBody, lead?.id);

  const rawBaseUrl = process.env.BASE_URL || "http://localhost:5506";
  const baseUrl = rawBaseUrl.replace(/\/+$/, "");
  const trackingPixel = `<img src="${baseUrl}/api/v1/campaign-messages/track/${recipientId}" width="1" height="1" alt="" style="display:none;" />`;

  if (baseHtml.includes("</body>")) {
    return baseHtml.replace("</body>", `${trackingPixel}</body>`);
  }
  return baseHtml + trackingPixel;
};

export const filterLeadsForAudience = (
  allLeads: any[],
  filter?: AudienceFilter | string | null
): AudiencePreviewResult => {
  let parsedFilter: AudienceFilter = {};
  if (typeof filter === "string") {
    try {
      parsedFilter = JSON.parse(filter);
    } catch {
      parsedFilter = {};
    }
  } else if (filter && typeof filter === "object") {
    parsedFilter = filter;
  }

  const excludedByReason: ExcludedBreakdown = {
    optedOut: 0,
    invalidEmail: 0,
    duplicate: 0,
    closedStatus: 0
  };

  const eligibleLeads: any[] = [];
  const seenEmails = new Set<string>();

  const filterStatuses = parsedFilter.leadStatus && Array.isArray(parsedFilter.leadStatus)
    ? parsedFilter.leadStatus.map((s) => s.toUpperCase())
    : [];

  const explicitlyIncludesClosed =
    filterStatuses.includes("CONVERTED") || filterStatuses.includes("CLOSED_LOST");

  for (const lead of allLeads) {
    const l = lead as any;
    const email = l.email ? String(l.email).trim() : "";
    const statusUpper = (l.status || "").toUpperCase();

    // Check filter criteria first (status, scores, industry, country/territory)
    if (filterStatuses.length > 0 && !filterStatuses.includes(statusUpper)) {
      continue;
    }

    if (parsedFilter.minScore !== undefined && parsedFilter.minScore !== null) {
      if ((l.leadScore ?? 0) < Number(parsedFilter.minScore)) {
        continue;
      }
    }

    if (parsedFilter.maxScore !== undefined && parsedFilter.maxScore !== null) {
      if ((l.leadScore ?? 0) > Number(parsedFilter.maxScore)) {
        continue;
      }
    }

    if (parsedFilter.industry) {
      const targetIndustries = Array.isArray(parsedFilter.industry)
        ? parsedFilter.industry.map((i) => i.toLowerCase().trim())
        : [parsedFilter.industry.toLowerCase().trim()];
      const leadInd = (l.industry || "").toLowerCase().trim();
      if (!targetIndustries.includes(leadInd)) {
        continue;
      }
    }

    if (parsedFilter.country || parsedFilter.territory) {
      const targetLocations = [
        ...(Array.isArray(parsedFilter.country) ? parsedFilter.country : [parsedFilter.country].filter(Boolean)),
        ...(Array.isArray(parsedFilter.territory) ? parsedFilter.territory : [parsedFilter.territory].filter(Boolean))
      ].map((loc) => String(loc).toLowerCase().trim());

      const leadCountry = (l.country || "").toLowerCase().trim();
      const leadTerritory = (l.territory || "").toLowerCase().trim();
      if (!targetLocations.includes(leadCountry) && !targetLocations.includes(leadTerritory)) {
        continue;
      }
    }

    // MANDATORY EXCLUSION 1: Proper Email Validation
    if (!isValidEmail(email)) {
      excludedByReason.invalidEmail++;
      continue;
    }

    // MANDATORY EXCLUSION 2: Opted out
    if (l.optedOutEmail === true) {
      excludedByReason.optedOut++;
      continue;
    }

    // MANDATORY EXCLUSION 3: Duplicate email in audience
    const emailKey = email.toLowerCase();
    if (seenEmails.has(emailKey)) {
      excludedByReason.duplicate++;
      continue;
    }

    // MANDATORY EXCLUSION 4: Closed status (CONVERTED or CLOSED_LOST unless explicitly included)
    if (!explicitlyIncludesClosed && (statusUpper === "CONVERTED" || statusUpper === "CLOSED_LOST")) {
      excludedByReason.closedStatus++;
      continue;
    }

    seenEmails.add(emailKey);
    eligibleLeads.push(l);
  }

  const excludedCount =
    excludedByReason.optedOut +
    excludedByReason.invalidEmail +
    excludedByReason.duplicate +
    excludedByReason.closedStatus;

  return { eligibleLeads, excludedCount, excludedByReason };
};

export const computeAudience = async (
  campaignId: string,
  filter?: AudienceFilter | string | null
): Promise<AudiencePreviewResult> => {
  // 1. Find leads matching the campaign directly or through LeadAttribution
  const attributions = await sequelize.models.LeadAttribution.findAll({
    where: { campaignId },
    attributes: ["leadId"]
  });
  const attributedLeadIds = attributions.map((a: any) => a.leadId).filter(Boolean);

  const orConditions: any[] = [{ campaignId }];
  if (attributedLeadIds.length > 0) {
    orConditions.push({ id: { [Op.in]: attributedLeadIds } });
  }

  const allLeads = await sequelize.models.Lead.findAll({
    where: { [Op.or]: orConditions },
    order: [["createdAt", "ASC"]]
  });

  return filterLeadsForAudience(allLeads, filter);
};

export const filterLeadsForWhatsAppAudience = (
  allLeads: any[],
  filter?: AudienceFilter | string | null
): WhatsAppAudiencePreviewResult => {
  let parsedFilter: AudienceFilter = {};
  if (typeof filter === "string") {
    try {
      parsedFilter = JSON.parse(filter);
    } catch {
      parsedFilter = {};
    }
  } else if (filter && typeof filter === "object") {
    parsedFilter = filter;
  }

  const excludedByReason: WhatsAppExcludedBreakdown = {
    noPhone: 0,
    invalidPhone: 0,
    noConsent: 0,
    optedOut: 0,
    duplicate: 0,
    closedStatus: 0
  };

  const eligibleLeads: any[] = [];
  const seenPhones = new Set<string>();

  const filterStatuses = parsedFilter.leadStatus && Array.isArray(parsedFilter.leadStatus)
    ? parsedFilter.leadStatus.map((s) => s.toUpperCase())
    : [];

  const explicitlyIncludesClosed =
    filterStatuses.includes("CONVERTED") || filterStatuses.includes("CLOSED_LOST");

  for (const lead of allLeads) {
    const l = lead as any;
    const rawPhone = l.phone ? String(l.phone).trim() : "";
    const statusUpper = (l.status || "").toUpperCase();

    // 1. Audience Filter Criteria (status, score, industry, territory)
    if (filterStatuses.length > 0 && !filterStatuses.includes(statusUpper)) {
      continue;
    }

    if (parsedFilter.minScore !== undefined && parsedFilter.minScore !== null) {
      if ((l.leadScore ?? 0) < Number(parsedFilter.minScore)) {
        continue;
      }
    }

    if (parsedFilter.maxScore !== undefined && parsedFilter.maxScore !== null) {
      if ((l.leadScore ?? 0) > Number(parsedFilter.maxScore)) {
        continue;
      }
    }

    if (parsedFilter.industry) {
      const targetIndustries = Array.isArray(parsedFilter.industry)
        ? parsedFilter.industry.map((i) => i.toLowerCase().trim())
        : [parsedFilter.industry.toLowerCase().trim()];
      const leadInd = (l.industry || "").toLowerCase().trim();
      if (!targetIndustries.includes(leadInd)) {
        continue;
      }
    }

    if (parsedFilter.country || parsedFilter.territory) {
      const targetLocations = [
        ...(Array.isArray(parsedFilter.country) ? parsedFilter.country : [parsedFilter.country].filter(Boolean)),
        ...(Array.isArray(parsedFilter.territory) ? parsedFilter.territory : [parsedFilter.territory].filter(Boolean))
      ].map((loc) => String(loc).toLowerCase().trim());

      const leadCountry = (l.country || "").toLowerCase().trim();
      const leadTerritory = (l.territory || "").toLowerCase().trim();
      if (!targetLocations.includes(leadCountry) && !targetLocations.includes(leadTerritory)) {
        continue;
      }
    }

    // 2. Closed Status Exclusion
    if (!explicitlyIncludesClosed && (statusUpper === "CONVERTED" || statusUpper === "CLOSED_LOST")) {
      excludedByReason.closedStatus++;
      continue;
    }

    // 3. MANDATORY EXCLUSION: No phone
    if (!rawPhone) {
      excludedByReason.noPhone++;
      continue;
    }

    // 4. MANDATORY EXCLUSION: Invalid phone (must normalize to digits, minimum 8 digits)
    const digits = normalizePhone(rawPhone);
    if (digits.length < 8) {
      excludedByReason.invalidPhone++;
      continue;
    }

    // 5. MANDATORY EXCLUSION: Opted out (optedOutWhatsapp === true or status OPTED_OUT)
    if (l.optedOutWhatsapp === true || l.whatsappConsentStatus === "OPTED_OUT") {
      excludedByReason.optedOut++;
      continue;
    }

    // 6. MANDATORY EXCLUSION: No WhatsApp Consent (must be OPTED_IN, covers UNSPECIFIED)
    if (l.whatsappConsentStatus !== "OPTED_IN") {
      excludedByReason.noConsent++;
      continue;
    }

    // 7. MANDATORY EXCLUSION: Duplicate phone in audience
    if (seenPhones.has(digits)) {
      excludedByReason.duplicate++;
      continue;
    }

    seenPhones.add(digits);
    eligibleLeads.push(l);
  }

  const excludedCount =
    excludedByReason.noPhone +
    excludedByReason.invalidPhone +
    excludedByReason.noConsent +
    excludedByReason.optedOut +
    excludedByReason.duplicate +
    excludedByReason.closedStatus;

  return { eligibleLeads, excludedCount, excludedByReason };
};

export const computeWhatsAppAudience = async (
  campaignId: string,
  filter?: AudienceFilter | string | null
): Promise<WhatsAppAudiencePreviewResult> => {
  const attributions = await sequelize.models.LeadAttribution.findAll({
    where: { campaignId },
    attributes: ["leadId"]
  });
  const attributedLeadIds = attributions.map((a: any) => a.leadId).filter(Boolean);

  const orConditions: any[] = [{ campaignId }];
  if (attributedLeadIds.length > 0) {
    orConditions.push({ id: { [Op.in]: attributedLeadIds } });
  }

  const allLeads = await sequelize.models.Lead.findAll({
    where: { [Op.or]: orConditions },
    order: [["createdAt", "ASC"]]
  });

  return filterLeadsForWhatsAppAudience(allLeads, filter);
};


export const handleTrackingPixel = async (recipientId: string): Promise<boolean> => {
  const recipient = (await sequelize.models.CampaignRecipient.findByPk(recipientId, {
    include: [{ model: sequelize.models.CampaignMessage, as: "message" }]
  })) as any;

  if (!recipient) return false;

  // Idempotent: only record first open
  if (!recipient.openedAt) {
    recipient.openedAt = new Date();
    await recipient.save();

    const campaignId = recipient.message?.campaignId || null;
    await sequelize.models.AttributionEvent.create({
      id: crypto.randomUUID(),
      leadId: recipient.leadId || null,
      opportunityId: null,
      channel: "EMAIL",
      sourceType: "CAMPAIGN_MESSAGE",
      sourceName: recipient.message?.name || "Email Campaign",
      campaignId: campaignId,
      adId: null,
      timestamp: new Date(),
      metadata: JSON.stringify({
        event: "EMAIL_OPENED",
        messageId: recipient.campaignMessageId,
        recipientId
      })
    });
  }

  return true;
};

export const getMessageStats = async (messageId: string) => {
  const recipients = (await sequelize.models.CampaignRecipient.findAll({
    where: { campaignMessageId: messageId }
  })) as any[];

  let queued = 0;
  let sent = 0;
  let failed = 0;
  let skipped = 0;
  let opened = 0;
  let unsubscribed = 0;
  let delivered = 0;
  let read = 0;

  for (const r of recipients) {
    if (r.status === "QUEUED" || r.status === "SENDING") queued++;
    if (r.status === "SENT") sent++;
    if (r.status === "FAILED") failed++;
    if (r.status === "SKIPPED") skipped++;
    if (r.openedAt) opened++;
    if (r.unsubscribedAt) unsubscribed++;
    if (r.deliveredAt) delivered++;
    if (r.readAt) read++;
  }

  const total = recipients.length;
  const openRatePct = sent > 0 ? Number(((opened / sent) * 100).toFixed(1)) : 0;
  const deliveryRatePct = sent > 0 ? Number(((delivered / sent) * 100).toFixed(1)) : 0;
  const readRatePct = sent > 0 ? Number(((read / sent) * 100).toFixed(1)) : 0;

  return {
    total,
    queued,
    sent,
    failed,
    skipped,
    opened,
    unsubscribed,
    delivered,
    read,
    openRatePct,
    deliveryRatePct,
    readRatePct
  };
};

export const executeMessageSend = async (
  campaignId: string,
  messageId: string,
  options?: { confirm?: boolean; isAlreadyClaimed?: boolean }
) => {
  // CHECK 1: Require explicit confirm
  if (options?.confirm !== true) {
    throw new Error("Explicit confirmation (confirm: true) is required to send campaign messages");
  }

  const message = (await sequelize.models.CampaignMessage.findOne({
    where: { id: messageId, campaignId }
  })) as any;

  if (!message) {
    throw new Error("Message not found");
  }

  // Strict check: only DRAFT or SCHEDULED
  if (message.status !== "DRAFT" && message.status !== "SCHEDULED") {
    throw new Error(`Only messages in DRAFT or SCHEDULED status can be sent (current: ${message.status})`);
  }

  const campaign = (await sequelize.models.Campaign.findByPk(campaignId)) as any;
  if (!campaign) {
    throw new Error("Campaign not found");
  }

  const channel = (message.channel || "EMAIL").toUpperCase();

  if (channel === "WHATSAPP") {
    if (!message.templateSid) {
      throw new Error("WhatsApp campaign messages require an approved templateSid");
    }

    const waConfig = getCampaignWhatsAppConfig();
    const audience = await computeWhatsAppAudience(campaignId, message.audienceFilter);

    // CHECK 2: Cap enforcement
    if (audience.eligibleLeads.length > waConfig.maxRecipients) {
      throw new Error(
        `Eligible audience (${audience.eligibleLeads.length}) exceeds maximum allowable recipients (${waConfig.maxRecipients})`
      );
    }

    if (audience.eligibleLeads.length === 0) {
      throw new Error("No eligible recipients found for this message");
    }

    // Clear any existing recipient records for this message before re-populating
    await sequelize.models.CampaignRecipient.destroy({
      where: { campaignMessageId: messageId }
    });

    const recipientsData = audience.eligibleLeads.map((lead: any) => ({
      id: crypto.randomUUID(),
      campaignMessageId: messageId,
      leadId: lead.id,
      email: lead.email || null,
      phone: normalizePhone(lead.phone),
      status: "QUEUED",
      createdAt: new Date()
    }));

    await sequelize.models.CampaignRecipient.bulkCreate(recipientsData);

    message.status = "SENDING";
    await message.save();

    setImmediate(async () => {
      try {
        await processAsyncWhatsAppDelivery(campaignId, messageId, campaign.name);
      } catch (err) {
        console.error("[CampaignMessageService] Error during async WhatsApp delivery:", err);
      }
    });

    return {
      recipientCount: audience.eligibleLeads.length,
      status: "SENDING"
    };
  }

  // Channel: EMAIL
  const config = getCampaignMessageConfig();

  // Fresh send: compute audience
  const audience = await computeAudience(campaignId, message.audienceFilter);

  // CHECK 2: Cap enforcement
  if (audience.eligibleLeads.length > config.maxRecipients) {
    throw new Error(
      `Eligible audience (${audience.eligibleLeads.length}) exceeds maximum allowable recipients (${config.maxRecipients})`
    );
  }

  if (audience.eligibleLeads.length === 0) {
    throw new Error("No eligible recipients found for this message");
  }

  // Clear any existing recipient records for this message before re-populating
  await sequelize.models.CampaignRecipient.destroy({
    where: { campaignMessageId: messageId }
  });

  // Create recipients in bulk with status QUEUED
  const recipientsData = audience.eligibleLeads.map((lead: any) => ({
    id: crypto.randomUUID(),
    campaignMessageId: messageId,
    leadId: lead.id,
    email: lead.email,
    status: "QUEUED",
    createdAt: new Date()
  }));

  await sequelize.models.CampaignRecipient.bulkCreate(recipientsData);

  message.status = "SENDING";
  await message.save();

  // Trigger non-blocking async delivery loop
  setImmediate(async () => {
    try {
      await processAsyncDelivery(campaignId, messageId, campaign.name);
    } catch (err) {
      console.error("[CampaignMessageService] Error during async delivery:", err);
    }
  });

  return {
    recipientCount: audience.eligibleLeads.length,
    status: "SENDING"
  };
};

/**
 * Executes a previously claimed message (status SENDING).
 * Called by the scheduler after an atomic claim (SCHEDULED -> SENDING),
 * skipping the DRAFT/SCHEDULED validation while retaining audience computation, cap enforcement, and delivery.
 */
export const runClaimedMessage = async (
  campaignId: string,
  messageId: string
) => {
  const message = (await sequelize.models.CampaignMessage.findOne({
    where: { id: messageId, campaignId }
  })) as any;

  if (!message) {
    throw new Error("Message not found");
  }

  const campaign = (await sequelize.models.Campaign.findByPk(campaignId)) as any;
  if (!campaign) {
    throw new Error("Campaign not found");
  }

  const channel = (message.channel || "EMAIL").toUpperCase();

  if (channel === "WHATSAPP") {
    if (!message.templateSid) {
      throw new Error("WhatsApp campaign messages require an approved templateSid");
    }

    const waConfig = getCampaignWhatsAppConfig();
    const audience = await computeWhatsAppAudience(campaignId, message.audienceFilter);

    if (audience.eligibleLeads.length > waConfig.maxRecipients) {
      throw new Error(
        `Eligible audience (${audience.eligibleLeads.length}) exceeds maximum allowable recipients (${waConfig.maxRecipients})`
      );
    }

    if (audience.eligibleLeads.length === 0) {
      throw new Error("No eligible recipients found for this message");
    }

    await sequelize.models.CampaignRecipient.destroy({
      where: { campaignMessageId: messageId }
    });

    const recipientsData = audience.eligibleLeads.map((lead: any) => ({
      id: crypto.randomUUID(),
      campaignMessageId: messageId,
      leadId: lead.id,
      email: lead.email || null,
      phone: normalizePhone(lead.phone),
      status: "QUEUED",
      createdAt: new Date()
    }));

    await sequelize.models.CampaignRecipient.bulkCreate(recipientsData);

    message.status = "SENDING";
    await message.save();

    await processAsyncWhatsAppDelivery(campaignId, messageId, campaign.name);

    return {
      recipientCount: audience.eligibleLeads.length,
      status: "SENDING"
    };
  }

  // EMAIL
  const config = getCampaignMessageConfig();

  // Fresh send: compute audience at send time
  const audience = await computeAudience(campaignId, message.audienceFilter);

  if (audience.eligibleLeads.length > config.maxRecipients) {
    throw new Error(
      `Eligible audience (${audience.eligibleLeads.length}) exceeds maximum allowable recipients (${config.maxRecipients})`
    );
  }

  if (audience.eligibleLeads.length === 0) {
    throw new Error("No eligible recipients found for this message");
  }

  // Clear any existing recipient records for this message before re-populating
  await sequelize.models.CampaignRecipient.destroy({
    where: { campaignMessageId: messageId }
  });

  // Create recipients in bulk with status QUEUED
  const recipientsData = audience.eligibleLeads.map((lead: any) => ({
    id: crypto.randomUUID(),
    campaignMessageId: messageId,
    leadId: lead.id,
    email: lead.email,
    status: "QUEUED",
    createdAt: new Date()
  }));

  await sequelize.models.CampaignRecipient.bulkCreate(recipientsData);

  message.status = "SENDING";
  await message.save();

  // Process delivery
  await processAsyncDelivery(campaignId, messageId, campaign.name);

  return {
    recipientCount: audience.eligibleLeads.length,
    status: "SENDING"
  };
};

export const resumeMessageSend = async (
  campaignId: string,
  messageId: string,
  options?: { confirm?: boolean }
) => {
  if (options?.confirm !== true) {
    throw new Error("Explicit confirmation (confirm: true) is required to resume campaign messages");
  }

  const message = (await sequelize.models.CampaignMessage.findOne({
    where: { id: messageId, campaignId }
  })) as any;

  if (!message) {
    throw new Error("Message not found");
  }

  // Strict check: only PARTIAL or FAILED
  if (message.status !== "PARTIAL" && message.status !== "FAILED") {
    throw new Error(`Only messages in PARTIAL or FAILED status can be resumed (current: ${message.status})`);
  }

  const campaign = (await sequelize.models.Campaign.findByPk(campaignId)) as any;
  if (!campaign) {
    throw new Error("Campaign not found");
  }

  // Reset any transient 'SENDING' recipients back to 'QUEUED'
  await sequelize.models.CampaignRecipient.update(
    { status: "QUEUED" },
    { where: { campaignMessageId: messageId, status: "SENDING" } }
  );

  // Resume NEVER creates new recipient rows; only counts remaining QUEUED rows
  const remainingCount = await sequelize.models.CampaignRecipient.count({
    where: { campaignMessageId: messageId, status: "QUEUED" }
  });

  if (remainingCount === 0) {
    message.status = "SENT";
    message.sentAt = new Date();
    await message.save();
    return { recipientCount: 0, status: "SENT" };
  }

  message.status = "SENDING";
  await message.save();

  const channel = (message.channel || "EMAIL").toUpperCase();

  setImmediate(async () => {
    try {
      if (channel === "WHATSAPP") {
        await processAsyncWhatsAppDelivery(campaignId, messageId, campaign.name);
      } else {
        await processAsyncDelivery(campaignId, messageId, campaign.name);
      }
    } catch (err) {
      console.error("[CampaignMessageService] Error during async delivery resume:", err);
    }
  });

  return {
    recipientCount: remainingCount,
    status: "SENDING"
  };
};

export const processAsyncDelivery = async (
  campaignId: string,
  messageId: string,
  campaignName: string
) => {
  const config = getCampaignMessageConfig();
  const allowlist = (process.env.CAMPAIGN_EMAIL_TEST_ALLOWLIST || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  const message = (await sequelize.models.CampaignMessage.findByPk(messageId)) as any;
  if (!message) return;

  // Query only pending QUEUED recipients
  const pendingRecipients = (await sequelize.models.CampaignRecipient.findAll({
    where: { campaignMessageId: messageId, status: "QUEUED" },
    order: [["createdAt", "ASC"]]
  })) as any[];

  if (pendingRecipients.length === 0) {
    message.status = "SENT";
    message.sentAt = new Date();
    await message.save();
    return;
  }

  // Fetch lead information
  const leadIds = pendingRecipients.map((r) => r.leadId).filter(Boolean);
  const leads = await sequelize.models.Lead.findAll({
    where: { id: { [Op.in]: leadIds } }
  });
  const leadMap = new Map<string, any>();
  for (const l of leads) {
    leadMap.set((l as any).id, l);
  }

  const BATCH_SIZE = 20;
  for (let i = 0; i < pendingRecipients.length; i += BATCH_SIZE) {
    // Check if message was cancelled or paused
    const currentMsg = (await sequelize.models.CampaignMessage.findByPk(messageId)) as any;
    if (currentMsg && currentMsg.status === "CANCELLED") {
      console.log(`[CampaignMessageService] Message ${messageId} was cancelled during delivery`);
      break;
    }

    const batch = pendingRecipients.slice(i, i + BATCH_SIZE);

    await Promise.all(
      batch.map(async (recipient) => {
        // DOUBLE-SENDING PREVENTION: Claim row atomically from QUEUED -> SENDING
        const [claimedRows] = await sequelize.models.CampaignRecipient.update(
          { status: "SENDING" },
          { where: { id: recipient.id, status: "QUEUED" } }
        );

        if (claimedRows === 0) {
          // Already claimed or sent by another process
          return;
        }

        // Re-check at delivery time: reload lead from DB immediately before sending
        const lead = recipient.leadId
          ? ((await sequelize.models.Lead.findByPk(recipient.leadId)) as any)
          : null;

        // Skip if lead does not exist or has opted out
        if (!lead || lead.optedOutEmail) {
          recipient.status = "SKIPPED";
          recipient.skipReason = "unsubscribed";
          await recipient.save();
          return;
        }

        const email = (recipient.email || lead.email || "").trim();
        if (!isValidEmail(email)) {
          recipient.status = "SKIPPED";
          recipient.skipReason = "invalid email";
          await recipient.save();
          return;
        }

        const emailLower = email.toLowerCase();
        // Check test allowlist
        if (allowlist.length > 0 && !allowlist.includes(emailLower)) {
          recipient.status = "SKIPPED";
          recipient.skipReason = "not in test allowlist";
          await recipient.save();
          return;
        }

        const renderedHtml = renderEmailForLead(message.bodyHtml, lead, campaignName, recipient.id);

        if (config.dryRun) {
          // Logging ONLY when dry run is active
          console.log(`[CAMPAIGN EMAIL DRY RUN] Rendered email for ${recipient.email}:\n${renderedHtml}`);
          recipient.status = "SENT";
          recipient.sentAt = new Date();
          recipient.skipReason = "dry run (not delivered)";
          await recipient.save();
          return;
        }

        try {
          await sendEmail(recipient.email, message.subject, renderedHtml);
          recipient.status = "SENT";
          recipient.sentAt = new Date();
          await recipient.save();
        } catch (err: any) {
          recipient.status = "FAILED";
          recipient.error = err.message || "Send failed";
          await recipient.save();
        }
      })
    );

    if (i + BATCH_SIZE < pendingRecipients.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  // Update final status if not cancelled
  const finalMsg = (await sequelize.models.CampaignMessage.findByPk(messageId)) as any;
  if (finalMsg && finalMsg.status === "SENDING") {
    // Check if any recipients remain in QUEUED/SENDING
    const remainingUnsent = await sequelize.models.CampaignRecipient.count({
      where: {
        campaignMessageId: messageId,
        status: { [Op.in]: ["QUEUED", "SENDING"] }
      }
    });

    finalMsg.status = remainingUnsent === 0 ? "SENT" : "PARTIAL";
    finalMsg.sentAt = new Date();
    await finalMsg.save();
  }
};

export const processAsyncWhatsAppDelivery = async (
  campaignId: string,
  messageId: string,
  campaignName: string
) => {
  const config = getCampaignWhatsAppConfig();

  const message = (await sequelize.models.CampaignMessage.findByPk(messageId)) as any;
  if (!message) return;

  const pendingRecipients = (await sequelize.models.CampaignRecipient.findAll({
    where: { campaignMessageId: messageId, status: "QUEUED" },
    order: [["createdAt", "ASC"]]
  })) as any[];

  if (pendingRecipients.length === 0) {
    message.status = "SENT";
    message.sentAt = new Date();
    await message.save();
    return;
  }

  const batchSize = config.batchSize || 10;
  const batchDelayMs = config.batchDelayMs || 3000;

  for (let i = 0; i < pendingRecipients.length; i += batchSize) {
    // Check if message was cancelled or paused
    const currentMsg = (await sequelize.models.CampaignMessage.findByPk(messageId)) as any;
    if (currentMsg && currentMsg.status === "CANCELLED") {
      console.log(`[CampaignMessageService] WhatsApp message ${messageId} was cancelled during delivery`);
      break;
    }

    const batch = pendingRecipients.slice(i, i + batchSize);

    await Promise.all(
      batch.map(async (recipient) => {
        // DOUBLE-SENDING PREVENTION: Claim row atomically from QUEUED -> SENDING
        const [claimedRows] = await sequelize.models.CampaignRecipient.update(
          { status: "SENDING" },
          { where: { id: recipient.id, status: "QUEUED" } }
        );

        if (claimedRows === 0) {
          // Already claimed or sent by another process
          return;
        }

        // Re-check at delivery time: reload lead from DB immediately before sending
        const lead = recipient.leadId
          ? ((await sequelize.models.Lead.findByPk(recipient.leadId)) as any)
          : null;

        // Skip if lead does not exist
        if (!lead) {
          recipient.status = "SKIPPED";
          recipient.skipReason = "lead not found";
          await recipient.save();
          return;
        }

        // RE-CHECK CONSENT AND OPT-OUT
        if (lead.whatsappConsentStatus !== "OPTED_IN" || lead.optedOutWhatsapp === true) {
          recipient.status = "SKIPPED";
          recipient.skipReason = lead.optedOutWhatsapp ? "opted out" : "no WhatsApp consent";
          await recipient.save();
          return;
        }

        const phone = normalizePhone(recipient.phone || lead.phone || "");
        if (!isValidPhone(phone)) {
          recipient.status = "SKIPPED";
          recipient.skipReason = "invalid phone";
          await recipient.save();
          return;
        }

        // Check test allowlist
        if (config.allowlist.length > 0 && !config.allowlist.includes(phone)) {
          recipient.status = "SKIPPED";
          recipient.skipReason = "not in test allowlist";
          await recipient.save();
          return;
        }

        const renderedVars = renderWhatsAppTemplateVariables(
          message.templateVariables,
          lead,
          campaignName
        );

        if (config.dryRun) {
          // Logging ONLY when dry run is active, masking phone for safety
          const masked = maskPhone(phone);
          console.log(`[CAMPAIGN WHATSAPP DRY RUN] Rendered template variables for recipient ${recipient.id} (phone: ${masked}):`, JSON.stringify(renderedVars));
          recipient.status = "SENT";
          recipient.sentAt = new Date();
          recipient.skipReason = "dry run (not delivered)";
          await recipient.save();
          return;
        }

        // Absolute safety guard: ensure no real send if dryRun is true
        if (config.dryRun) {
          throw new Error("SAFETY VIOLATION: sendWhatsAppTemplateMessage attempted while dryRun is true");
        }

        try {
          const apiResult = await sendWhatsAppTemplateMessage(
            phone,
            message.templateSid,
            renderedVars
          );
          recipient.status = "SENT";
          recipient.sentAt = new Date();
          recipient.providerMessageId = apiResult.sid || apiResult.messages?.[0]?.id || null;
          await recipient.save();
        } catch (err: any) {
          recipient.status = "FAILED";
          recipient.error = err.message || "WhatsApp send failed";
          await recipient.save();
        }
      })
    );

    if (i + batchSize < pendingRecipients.length) {
      await new Promise((resolve) => setTimeout(resolve, batchDelayMs));
    }
  }

  // Update final status if not cancelled
  const finalMsg = (await sequelize.models.CampaignMessage.findByPk(messageId)) as any;
  if (finalMsg && finalMsg.status === "SENDING") {
    // Check if any recipients remain in QUEUED/SENDING
    const remainingUnsent = await sequelize.models.CampaignRecipient.count({
      where: {
        campaignMessageId: messageId,
        status: { [Op.in]: ["QUEUED", "SENDING"] }
      }
    });

    finalMsg.status = remainingUnsent === 0 ? "SENT" : "PARTIAL";
    finalMsg.sentAt = new Date();
    await finalMsg.save();
  }
};

/**
 * Startup Recovery for Stuck Campaign Sends
 * Finds messages stuck in SENDING status on server restart,
 * resets in-flight SENDING recipients back to QUEUED,
 * and sets message status to PARTIAL so it can be cleanly resumed.
 */
export const recoverStuckCampaignSends = async () => {
  try {
    if (!sequelize.models.CampaignMessage || !sequelize.models.CampaignRecipient) return;

    const stuckMessages = (await sequelize.models.CampaignMessage.findAll({
      where: { status: "SENDING" }
    })) as any[];

    if (stuckMessages.length === 0) return;

    console.log(`[CampaignMessageService] Recovering ${stuckMessages.length} stuck campaign send(s)...`);

    for (const msg of stuckMessages) {
      // Reset any recipients stuck in intermediate 'SENDING' back to 'QUEUED'
      await sequelize.models.CampaignRecipient.update(
        { status: "QUEUED" },
        { where: { campaignMessageId: msg.id, status: "SENDING" } }
      );

      // Check if any recipients are QUEUED
      const queuedCount = await sequelize.models.CampaignRecipient.count({
        where: { campaignMessageId: msg.id, status: "QUEUED" }
      });

      const sentCount = await sequelize.models.CampaignRecipient.count({
        where: { campaignMessageId: msg.id, status: "SENT" }
      });

      if (queuedCount === 0 && sentCount > 0) {
        msg.status = "SENT";
      } else {
        msg.status = "PARTIAL";
      }
      await msg.save();
    }
    console.log("[CampaignMessageService] Stuck campaign send recovery complete.");
  } catch (err) {
    console.error("[CampaignMessageService] Error recovering stuck campaign sends:", err);
  }
};

export const cancelMessage = async (campaignId: string, messageId: string) => {
  const message = (await sequelize.models.CampaignMessage.findOne({
    where: { id: messageId, campaignId }
  })) as any;

  if (!message) {
    throw new Error("Message not found");
  }

  if (message.status === "SENT") {
    throw new Error("Cannot cancel a message that has already been sent");
  }

  message.status = "CANCELLED";
  await message.save();

  // Mark any QUEUED or SENDING recipients as SKIPPED
  await sequelize.models.CampaignRecipient.update(
    { status: "SKIPPED", skipReason: "Message cancelled" },
    { where: { campaignMessageId: messageId, status: { [Op.in]: ["QUEUED", "SENDING"] } } }
  );

  return message;
};

export const unscheduleMessage = async (campaignId: string, messageId: string) => {
  const message = (await sequelize.models.CampaignMessage.findOne({
    where: { id: messageId, campaignId }
  })) as any;

  if (!message) {
    throw new Error("Message not found in this campaign");
  }

  if (message.status !== "SCHEDULED") {
    throw new Error(`Only SCHEDULED messages can be unscheduled (current: ${message.status})`);
  }

  message.status = "DRAFT";
  message.scheduledAt = null;
  await message.save();

  const stats = await getMessageStats(message.id);
  return {
    ...message.toJSON(),
    stats
  };
};

