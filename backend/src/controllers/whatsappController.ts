import { Request, Response } from "express";
import twilio from "twilio";
import { sequelize } from "@nexus-crm/database";
import { sendWhatsAppMessage, sendWhatsAppTemplateMessage } from "../services/whatsappService";
import { checkRecordAccess } from "../services/handoffAccessService";
import { assignLead } from "../services/assignmentEngine";
import { extractLeadDetailsFromText } from "../services/aiLeadExtraction";
import { handleInboundActivity } from "../services/leadTemperatureService";
import {
  logWhatsAppEvent,
  getWhatsAppHealthStatus,
  testWhatsAppConnection,
  testWhatsAppWebhookSimulation,
  getWhatsAppLogs,
  markLogResolved,
  clearLogs,
  getRemediationTip,
} from "../services/whatsappLogger";
import { Op } from "sequelize";
import crypto from "crypto";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Strip everything except digits from a phone number for loose matching */
function extractDigits(phone: string): string {
  return phone ? phone.replace(/\D/g, "") : "";
}

/** Last N digits of a phone number for LIKE-based DB matching */
function phoneKey(phone: string, digits = 10): string {
  return extractDigits(phone).slice(-digits);
}

/** Match phone numbers regardless of formatting (spaces, dashes, parens, country codes) */
function matchesPhoneNumber(storedPhone: string | null | undefined, inboundPhone: string): boolean {
  if (!storedPhone || !inboundPhone) return false;
  const storedDigits = extractDigits(storedPhone);
  const inboundDigits = extractDigits(inboundPhone);
  if (!storedDigits || !inboundDigits) return false;

  const keyStored = storedDigits.slice(-10);
  const keyInbound = inboundDigits.slice(-10);

  if (keyStored.length >= 7 && keyInbound.length >= 7) {
    return keyStored.endsWith(keyInbound) || keyInbound.endsWith(keyStored) || storedDigits === inboundDigits;
  }
  return storedDigits === inboundDigits;
}

/** Build a sequential lead number */
async function generateLeadNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const count = await sequelize.models.Lead.count();
  const seq = String(count + 1).padStart(5, "0");
  return `LD-${year}-${seq}`;
}

/** Get the first admin user id as a fallback creator */
async function getFirstAdminId(): Promise<string | null> {
  const admin = await sequelize.models.User.findOne({ where: { role: "admin" } });
  return admin ? (admin as any).id : null;
}

/** Create an in-app notification for the assigned rep */
async function createWhatsAppNotification(
  userId: string,
  leadId: string,
  leadName: string,
  messagePreview: string,
  isNewLead: boolean
): Promise<void> {
  try {
    await sequelize.models.Notification.create({
      id: crypto.randomUUID(),
      userId,
      type: "whatsapp_inbound",
      title: isNewLead
        ? `📲 New WhatsApp Lead: ${leadName}`
        : `💬 New WhatsApp Message from ${leadName}`,
      message: messagePreview.length > 120 ? messagePreview.slice(0, 117) + "…" : messagePreview,
      link: `/leads/${leadId}`,
      isRead: false,
    } as any);
  } catch (err) {
    console.error("[WhatsApp] Failed to create notification:", err);
  }
}

// ─── Rollout Guard ────────────────────────────────────────────────────────────
// Stub Content SIDs are seeded as placeholders and must NEVER be passed to Twilio.
// If a rep hits the template-required path while a stub is still in the DB, we
// return the admin-facing 400 instead of letting Twilio 400 with a cryptic error.
const STUB_SID_PATTERN = /^HX_.*_stub$/;

// ─── Send Message ─────────────────────────────────────────────────────────────

export const sendMessage = async (req: Request, res: Response) => {
  try {
    const { leadId, customerId, phone, text, mediaUrl, contentSid, twilioContentSid, contentVariables, templateId } = req.body;

    let targetPhone = phone;
    let targetLeadId = leadId;
    let targetCustomerId = customerId;
    let leadObj: any = null;

    if (leadId) {
      leadObj = await sequelize.models.Lead.findByPk(leadId) as any;
      if (leadObj) {
        if (!targetPhone) targetPhone = leadObj.whatsappPhone || leadObj.phone;
      }
    } else if (phone) {
      // Find lead by phone number if leadId was not explicitly passed
      const cleanTargetDigits = extractDigits(phone).slice(-10);
      leadObj = await sequelize.models.Lead.findOne({
        where: {
          phone: { [Op.like]: `%${cleanTargetDigits}%` }
        }
      }) as any;
      if (leadObj) {
        targetLeadId = leadObj.id;
      }
    } else if (customerId) {
      const customer = await sequelize.models.Customer.findByPk(customerId) as any;
      if (customer) {
        if (!targetPhone) targetPhone = customer.phone;
      }
    }

    if (!targetPhone) {
      return res.status(400).json({ error: "Phone number or valid leadId/customerId with a phone number is required" });
    }

    const caller = (req as any).user;
    if (targetLeadId) {
      const access = await checkRecordAccess(caller?.id, caller?.role, { leadId: targetLeadId });
      if (!access.canWrite) {
        return res.status(403).json({
          error: access.reason || "Handed off — view only. This lead has been reassigned to another representative.",
          isViewOnly: true
        });
      }
    }

    // Determine 24-hour customer service session status (WhatsApp 24h window rule)
    let lastInbound = leadObj?.lastInboundAt ? new Date(leadObj.lastInboundAt).getTime() : 0;
    if (!lastInbound && targetCustomerId) {
      const recentInboundActivity: any = await sequelize.models.Activity.findOne({
        where: { customerId: targetCustomerId, direction: "inbound" },
        order: [["createdAt", "DESC"]]
      });
      if (recentInboundActivity?.createdAt) {
        lastInbound = new Date(recentInboundActivity.createdAt).getTime();
      }
    }
    const hasActiveSession = Boolean(lastInbound && (Date.now() - lastInbound) <= 24 * 60 * 60 * 1000);

    let apiResult: any = null;
    const activeContentSid = contentSid || twilioContentSid;

    if (hasActiveSession && !activeContentSid && !templateId) {
      // Inside active 24h session: free-text message dispatch is allowed
      if (!text) {
        return res.status(400).json({ error: "Message text is required" });
      }
      apiResult = await sendWhatsAppMessage(targetPhone, text, mediaUrl);
    } else {
      // Outside 24h session window: template compliance path via Twilio Content API
      let targetSid = activeContentSid;
      let targetVars = contentVariables;

      if (!targetSid && templateId) {
        const tmpl = await sequelize.models.MessageTemplate.findByPk(templateId) as any;
        if (tmpl && tmpl.twilioContentSid) {
          targetSid = tmpl.twilioContentSid;
          if (!targetVars && tmpl.contentVariables) targetVars = tmpl.contentVariables;
        }
      }

      if (!targetSid) {
        // Look up default active WhatsApp template matching lead language first, falling back to Arabic ("ar")
        const leadLang = leadObj?.language || leadObj?.preferredLanguage || "ar";
        let tmpl = await sequelize.models.MessageTemplate.findOne({
          where: {
            channel: "whatsapp",
            isActive: true,
            language: leadLang
          }
        }) as any;

        if (!tmpl && leadLang !== "ar") {
          tmpl = await sequelize.models.MessageTemplate.findOne({
            where: {
              channel: "whatsapp",
              isActive: true,
              language: "ar"
            }
          }) as any;
        }

        if (tmpl && tmpl.twilioContentSid) {
          targetSid = tmpl.twilioContentSid;
          if (!targetVars) {
            targetVars = {
              "1": leadObj ? `${leadObj.firstName || ""} ${leadObj.lastName || ""}`.trim() || "Valued Customer" : "Valued Customer",
              "2": text || "Call summary recap",
              "3": "Please contact your representative if you have any questions."
            };
          }
        }
      }

      if (!targetSid) {
        return res.status(400).json({
          error: "No active 24-hour customer session. WhatsApp Business requires sending via an approved Message Template when outside a 24-hour session window.",
          requiresTemplate: true,
          hasActiveSession: false
        });
      }

      // ── Rollout guard: block stub SIDs from reaching Twilio ───────────────────
      if (STUB_SID_PATTERN.test(targetSid)) {
        return res.status(400).json({
          error: "Template not yet approved — contact your admin to configure the Twilio Content SID via Master Data → Message Templates before this WhatsApp template can be used.",
          requiresTemplate: true,
          hasActiveSession: false,
          stubSid: true
        });
      }

      apiResult = await sendWhatsAppTemplateMessage(targetPhone, targetSid, targetVars);
    }

    let creatorId = (req as any).user?.id;
    if (!creatorId) {
      const adminUser = await sequelize.models.User.findOne({ where: { role: "admin" } }) as any;
      if (adminUser) creatorId = adminUser.id;
    }

    const activity = await sequelize.models.Activity.create({
      id: crypto.randomUUID(),
      leadId: targetLeadId || null,
      customerId: targetCustomerId || null,
      createdById: creatorId || null,
      type: "whatsapp_sms",
      notes: text || "WhatsApp Message (Template)",
      outcome: apiResult.simulated ? "sent (simulated)" : "sent",
      mediaUrl: mediaUrl || null,
      direction: "outbound"
    } as any);

    if (targetLeadId) {
      const { checkAndAutoAdvanceLead } = require("../services/leadStageAutomationService");
      await checkAndAutoAdvanceLead(targetLeadId, { userId: creatorId });
    }

    return res.status(200).json({
      success: true,
      message: "WhatsApp message dispatched successfully",
      apiResult,
      activity,
      hasActiveSession
    });
  } catch (error: any) {
    console.error("Error sending WhatsApp message:", error);
    return res.status(500).json({ error: error.message });
  }
};

// ─── Get Conversations ────────────────────────────────────────────────────────

export const getConversations = async (req: Request, res: Response) => {
  try {
    const activities = await sequelize.models.Activity.findAll({
      where: { type: ["whatsapp_sms", "instagram_dm"] },
      order: [["createdAt", "DESC"]],
      include: [
        { model: sequelize.models.Lead, as: "lead", required: false },
        { model: sequelize.models.Customer, as: "customer", required: false },
      ],
    });

    const conversationMap = new Map<string, any>();

    for (const act of activities as any[]) {
      const key = act.leadId || act.customerId || act.id;
      if (!conversationMap.has(key)) {
        const clientName = act.lead
          ? `${act.lead.firstName} ${act.lead.lastName}`
          : act.customer
          ? act.customer.name
          : "WhatsApp User";
        const companyName = act.lead?.company || act.customer?.industry || "Industrial Prospect";
        const phone = act.lead?.whatsappPhone || act.lead?.phone || act.customer?.phone || "";

        conversationMap.set(key, {
          id: key,
          leadId: act.leadId,
          customerId: act.customerId,
          clientName,
          companyName,
          phone,
          lastMessage: act.notes,
          channel: act.type === "instagram_dm" ? "instagram" : "whatsapp",
          time: new Date(act.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          unread: act.outcome === "message received",
          unreadCount: act.lead?.unreadWhatsappCount || 0,
          avatar: clientName.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase(),
          dealValue: "$250.0K",
        });
      }
    }

    const conversations = Array.from(conversationMap.values());
    return res.status(200).json(conversations);
  } catch (error: any) {
    console.error("Error fetching WhatsApp conversations:", error);
    return res.status(500).json({ error: error.message });
  }
};

// ─── Get Messages ─────────────────────────────────────────────────────────────

export const getMessages = async (req: Request, res: Response) => {
  try {
    const targetId = req.params.targetId || (req.query.leadId as string) || (req.query.targetId as string) || (req.query.customerId as string);

    if (!targetId) {
      return res.status(200).json([]);
    }

    const activities = await sequelize.models.Activity.findAll({
      where: {
        type: ["whatsapp_sms", "instagram_dm"],
        [Op.or]: [{ leadId: targetId }, { customerId: targetId }, { id: targetId }],
      },
      order: [["createdAt", "ASC"]],
    });

    const messages = (activities as any[]).map(a => ({
      id: a.id,
      sender: a.outcome === "message received" ? "Client" : "You",
      isMe: a.outcome !== "message received",
      text: a.notes,
      time: new Date(a.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      channel: a.type === "instagram_dm" ? "instagram" : "whatsapp",
      mediaUrl: a.mediaUrl,
    }));

    return res.status(200).json(messages);
  } catch (error: any) {
    console.error("Error fetching WhatsApp messages:", error);
    return res.status(500).json({ error: error.message });
  }
};

// ─── Verify Webhook (GET) ─────────────────────────────────────────────────────

export const verifyWebhook = (req: Request, res: Response) => {
  const challenge = req.query["hub.challenge"] || "OK";
  return res.status(200).send(challenge);
};

// ─── Handle Incoming Webhook (POST) ──────────────────────────────────────────

export const handleIncomingWebhook = async (req: Request, res: Response) => {
  console.log("=================================================");
  console.log("[WhatsApp Webhook HIT]", new Date().toISOString(), "Body:", JSON.stringify(req.body));
  console.log("=================================================");

  // ── TWILIO REQUEST SIGNATURE VALIDATION ────────────────────────────────────
  const twilioAuthToken = (process.env.TWILIO_AUTH_TOKEN || "").trim();
  const twilioSignature = (req.headers["x-twilio-signature"] as string) || "";

  const isPlaceholderToken = !twilioAuthToken || twilioAuthToken.includes("your_twilio_auth_token");

  if (twilioSignature && !isPlaceholderToken) {
    const host = (req.headers["x-forwarded-host"] as string) || req.headers.host;
    const path = req.originalUrl || req.url;

    // Build all candidate URLs that Twilio might have signed.
    // Render (and similar proxies) can mangle the Host header, so we also
    // try the explicit BASE_URL / RENDER_EXTERNAL_URL from the environment.
    const candidateUrls: string[] = [
      `https://${host}${path}`,
      `http://${host}${path}`,
    ];
    const baseUrl = (process.env.BASE_URL || process.env.RENDER_EXTERNAL_URL || "").replace(/\/$/, "");
    if (baseUrl && !candidateUrls.includes(`${baseUrl}${path}`)) {
      candidateUrls.push(`${baseUrl}${path}`);
    }

    const isValid = candidateUrls.some(url =>
      twilio.validateRequest(twilioAuthToken, twilioSignature, url, req.body || {})
    );

    if (!isValid) {
      console.warn(`[Twilio Webhook] Signature validation failed. Tried URLs: ${candidateUrls.join(" | ")}`);
      logWhatsAppEvent("WARN", "WEBHOOK_VERIFICATION", "TWILIO_INVALID_SIGNATURE", "Twilio webhook signature validation failed", {
        triedUrls: candidateUrls,
        ip: req.ip,
        remediationTip:
          "Ensure TWILIO_AUTH_TOKEN matches the Twilio Console Auth Token, " +
          "and set BASE_URL=https://<your-render-domain> in Render environment variables.",
      });
      // In production, reject; in dev/testing, log and continue
      if (process.env.NODE_ENV === "production") {
        return res.status(403).send("Express HTTP 403: Invalid Twilio Signature");
      }
    }
  }

  let webhookEventId: string | null = null;

  try {
    const body = req.body;

    // Log raw event for audit trail
    webhookEventId = crypto.randomUUID();
    await sequelize.models.WebhookEvent.create({
      id: webhookEventId,
      source: body.MessageSid || body.SmsSid ? "twilio" : "whatsapp",
      payload: JSON.stringify(body),
      status: "processing",
      retryCount: 0,
    } as any).catch(err => console.error("[WhatsApp] Failed to log WebhookEvent:", err));

    let metaMessageId: string = "";
    let from: string = "";
    let msgBody: string = "[Media Message]";
    let mediaUrl: string | null = null;
    let senderName: string = "";
    let msgTimestamp: Date = new Date();

    if (body.MessageSid || body.SmsSid || body.From) {
      // ── TWILIO PAYLOAD ──────────────────────────────────────────────────────
      metaMessageId = body.MessageSid || body.SmsSid || `twilio_${Date.now()}`;
      from = (body.From || "").replace(/^whatsapp:/i, "").replace(/\D/g, "");
      msgBody = body.Body || (body.MediaUrl0 ? "[Media Attachment]" : "[Incoming Message]");
      mediaUrl = body.MediaUrl0 || null;
      senderName = body.ProfileName || "";

      console.log(`[Twilio Inbound] From: ${from} | Name: "${senderName}" | MessageSid: ${metaMessageId} | body: "${msgBody.slice(0, 80)}"`);
    } else {
      // ── META PAYLOAD ────────────────────────────────────────────────────────
      if (!body.object) {
        logWhatsAppEvent("WARN", "INBOUND_PAYLOAD", "SKIPPED_NO_OBJECT", "Webhook payload missing object field or not whatsapp_business_account/twilio", {
          receivedObject: body.object,
          body,
        });
        return;
      }

      const entry = body.entry?.[0];
      const change = entry?.changes?.[0];
      const value = change?.value;
      const msg = value?.messages?.[0] || entry?.messaging?.[0];
      const contacts = value?.contacts || [];

      if (!msg) {
        console.log("[WhatsApp Webhook] Skipped: no message object found in payload");
        return;
      }

      metaMessageId = msg.id || `wamid.generated_${Date.now()}`;
      from = (msg.from || msg.sender?.id || "").replace(/\D/g, "");
      msgTimestamp = msg.timestamp ? new Date(parseInt(msg.timestamp, 10) * 1000) : new Date();

      if (msg.type === "text" || msg.text?.body) {
        msgBody = msg.text?.body || msg.body || "";
      } else if (msg.type === "image" || msg.type === "video" || msg.type === "document" || msg.type === "audio") {
        const media = msg[msg.type];
        mediaUrl = media?.link || media?.url || null;
        msgBody = media?.caption || `[${msg.type} Attachment]`;
      } else if (msg.body) {
        msgBody = msg.body;
      }

      const senderContact = contacts.find((c: any) => c.wa_id === from);
      senderName = senderContact?.profile?.name || "";

      console.log(`[WhatsApp Inbound] From: ${from} | Name: "${senderName}" | msgId: ${metaMessageId} | body: "${msgBody.slice(0, 80)}"`);
    }

    // ── IDEMPOTENCY CHECK ─────────────────────────────────────────────────────
    const existingActivity = await sequelize.models.Activity.findOne({
      where: { messageId: metaMessageId },
    });

    if (existingActivity) {
      console.log(`[WhatsApp Inbound] Duplicate detected for messageId=${metaMessageId}. Skipping.`);
      if (webhookEventId) {
        await sequelize.models.WebhookEvent.update(
          { status: "duplicate" },
          { where: { id: webhookEventId } }
        ).catch(() => {});
      }
      return;
    }

    // Run AI Requirement Extraction on inbound message
    const extractedAI = await extractLeadDetailsFromText(msgBody);

    const nameParts = senderName ? senderName.trim().split(" ") : [];
    const firstName = extractedAI.firstName && extractedAI.firstName !== "Voice" ? extractedAI.firstName : (nameParts[0] || "WhatsApp");
    const lastName = extractedAI.lastName && extractedAI.lastName !== "Lead" ? extractedAI.lastName : (nameParts.slice(1).join(" ") || `User ${from.slice(-4)}`);
    const uniqueEmail = extractedAI.email && !extractedAI.email.includes("voice.lead") ? extractedAI.email : `inbound-${from}@whatsapp.local`;

    // ── MATCH EXISTING LEAD / CONTACT / CUSTOMER BY PHONE ───────────────────
    const cleanDigits = phoneKey(from, 10);
    let targetLeadId: string | null = null;
    let targetCustomerId: string | null = null;
    let targetDealId: string | null = null;

    if (cleanDigits.length >= 7) {
      // 1. Search existing Lead by phone or whatsappPhone
      if (sequelize.models.Lead) {
        const matchingLead = await sequelize.models.Lead.findOne({
          where: {
            [Op.or]: [
              { phone: { [Op.like]: `%${cleanDigits}%` } },
              { whatsappPhone: { [Op.like]: `%${cleanDigits}%` } }
            ]
          }
        }) as any;

        if (matchingLead) {
          targetLeadId = matchingLead.id;
          targetCustomerId = matchingLead.customerId || null;
          await matchingLead.update({ updatedAt: new Date() }).catch(() => {});
        }
      }

      // 2. Search existing Contact / Account
      if (sequelize.models.Contact) {
        const matchingContact = await sequelize.models.Contact.findOne({
          where: { phone: { [Op.like]: `%${cleanDigits}%` } }
        }) as any;
        if (matchingContact && !targetCustomerId) {
          targetCustomerId = matchingContact.accountId;
        }
      }

      // 3. Search existing Deal linked to Lead or Customer
      if (sequelize.models.Deal && targetLeadId) {
        const matchingDeal = await sequelize.models.Deal.findOne({
          where: { leadId: targetLeadId }
        }) as any;
        if (matchingDeal) {
          targetDealId = matchingDeal.id;
        }
      }
    }

    // Process inbound WhatsApp intake event (Missing Info Engine & Conversational Collection)
    try {
      const { processInboundIntakeEvent } = require("../services/leadIntakeAutomationEngine");
      const intakeRes = await processInboundIntakeEvent({
        channel: "whatsapp",
        eventId: metaMessageId || webhookEventId || undefined,
        leadId: targetLeadId || undefined,
        senderPhone: from,
        senderName: senderName || undefined,
        message: msgBody,
        attribution: {
          source: "WhatsApp",
          sourceChannel: "whatsapp",
          sourceDetail: `WhatsApp Message ID: ${metaMessageId}`
        }
      });
      if (intakeRes.leadId) {
        targetLeadId = intakeRes.leadId;
      }
    } catch (intakeErr: any) {
      console.warn("Intake automation non-blocking fallback in WhatsApp controller:", intakeErr.message);
      if (!targetLeadId && !targetDealId) {
        const { ingestLead } = require("../services/leadIngestion");
        targetDealId = await ingestLead({
          firstName,
          lastName,
          email: uniqueEmail,
          phone: from,
          whatsappPhone: from,
          company: extractedAI.company || "Unknown WhatsApp Company",
          source: "WhatsApp",
          sourceDetail: `WhatsApp Message ID: ${metaMessageId}`,
          industry: extractedAI.industry || "General",
          budgetRange: extractedAI.budgetRange || "N/A",
          message: msgBody,
          rawPayload: { from, senderName, firstMessage: msgBody, metaMessageId, extractedAI }
        });
      }
    }

    // ── CREATE SPECIFIC WHATSAPP MEDIA ACTIVITY ───────────────────────────────
    const adminId = await getFirstAdminId();
    await sequelize.models.Activity.create({
      id: crypto.randomUUID(),
      leadId: targetLeadId || null,
      customerId: targetCustomerId || null,
      dealId: targetDealId || null,
      type: "whatsapp_sms",
      notes: msgBody,
      outcome: "message received",
      mediaUrl,
      messageId: metaMessageId,
      mentioned_user_ids: "[]",
      pinned: false,
      isCompleted: true,
      createdById: adminId,
      direction: "inbound"
    } as any);

    // Check for positive quote acceptance intent in inbound WhatsApp message
    try {
      const { detectAndFlagQuoteAcceptance } = require("../services/quoteDeliveryService");
      await detectAndFlagQuoteAcceptance({
        leadId: targetLeadId,
        dealId: targetDealId,
        messageText: msgBody,
        sourceChannel: "WHATSAPP",
        senderInfo: from
      });
    } catch (flagErr: any) {
      console.warn("Failed to check quote acceptance keywords in WhatsApp:", flagErr.message);
    }


    // ── MARK WEBHOOK EVENT PROCESSED ─────────────────────────────────────────
    if (webhookEventId) {
      await sequelize.models.WebhookEvent.update(
        { status: "processed" },
        { where: { id: webhookEventId } }
      ).catch(() => {});
    }

    console.log(`[WhatsApp Inbound] ✅ Processed messageId=${metaMessageId} → targetId=${targetDealId || targetLeadId}`);

    if (!res.headersSent) {
      return res.status(200).type("text/xml").send("<Response></Response>");
    }

  } catch (error: any) {
    console.error("[WhatsApp Webhook] Processing error:", error);

    await logWhatsAppEvent("ERROR", "INBOUND_PAYLOAD", "INBOUND_PROCESSING_FAILED", error.message, {
      stack: error.stack,
      remediationTip: "Check database connection, schema model fields, or lead assignment engine setup.",
    });

    if (webhookEventId) {
      await sequelize.models.WebhookEvent.update(
        { status: "failed", errorMessage: error.message },
        { where: { id: webhookEventId } }
      ).catch(() => {});
    }

    if (!res.headersSent) {
      return res.status(200).type("text/xml").send("<Response></Response>");
    }
  }
};

// ─── Diagnostic & Audit Log Endpoints ────────────────────────────────────────

export const getHealth = async (req: Request, res: Response) => {
  try {
    const health = await getWhatsAppHealthStatus();
    return res.status(200).json(health);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

export const getLogs = async (req: Request, res: Response) => {
  try {
    const { level, category, search, resolved, limit, offset } = req.query;
    const result = await getWhatsAppLogs({
      level: level as string,
      category: category as string,
      search: search as string,
      resolved: resolved === "true" ? true : resolved === "false" ? false : undefined,
      limit: limit ? parseInt(limit as string, 10) : 50,
      offset: offset ? parseInt(offset as string, 10) : 0,
    });
    return res.status(200).json(result);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

export const runTestConnection = async (req: Request, res: Response) => {
  try {
    const result = await testWhatsAppConnection();
    return res.status(200).json(result);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

export const runTestWebhookSimulation = async (req: Request, res: Response) => {
  try {
    const result = await testWhatsAppWebhookSimulation(req.body);
    return res.status(200).json(result);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

export const resolveLogEntry = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await markLogResolved(String(id));
    return res.status(200).json(result);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

export const clearLogHistory = async (req: Request, res: Response) => {
  try {
    const result = await clearLogs();
    return res.status(200).json(result);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};


