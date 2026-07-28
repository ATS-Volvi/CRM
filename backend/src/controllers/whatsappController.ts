import { Request, Response } from "express";
import { sequelize } from "@nexus-crm/database";
import { sendWhatsAppMessage } from "../services/whatsappService";
import { assignLead } from "../services/assignmentEngine";
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

// ─── Send Message ─────────────────────────────────────────────────────────────

export const sendMessage = async (req: Request, res: Response) => {
  try {
    const { leadId, customerId, phone, text, mediaUrl } = req.body;

    if (!text) {
      return res.status(400).json({ error: "Message text is required" });
    }

    let targetPhone = phone;
    let targetLeadId = leadId;
    let targetCustomerId = customerId;

    if (leadId) {
      const lead = await sequelize.models.Lead.findByPk(leadId) as any;
      if (lead) {
        if (!targetPhone) targetPhone = lead.whatsappPhone || lead.phone;
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

    const apiResult = await sendWhatsAppMessage(targetPhone, text, mediaUrl);

    const activity = await sequelize.models.Activity.create({
      id: crypto.randomUUID(),
      leadId: targetLeadId || null,
      customerId: targetCustomerId || null,
      createdById: (req as any).user?.id || null,
      type: "whatsapp_sms",
      notes: text,
      outcome: apiResult.simulated ? "sent (simulated)" : "sent",
      mediaUrl: mediaUrl || null,
    } as any);

    return res.status(200).json({
      success: true,
      message: "WhatsApp message dispatched successfully",
      apiResult,
      activity,
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
    const { targetId } = req.params;

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
  const verify_token =
    process.env.WHATSAPP_VERIFY_TOKEN ||
    process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN ||
    "nexus_whatsapp_webhook_secret_2026";

  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode && token) {
    if (mode === "subscribe" && token === verify_token) {
      console.log("[WhatsApp Webhook] VERIFIED SUCCESSFULLY");
      return res.status(200).send(challenge);
    } else {
      console.warn("[WhatsApp Webhook Verification Failed] Invalid verify token");
      return res.sendStatus(403);
    }
  } else {
    return res.status(400).send("Missing hub.mode or hub.verify_token");
  }
};

// ─── Handle Incoming Webhook (POST) ──────────────────────────────────────────

export const handleIncomingWebhook = async (req: Request, res: Response) => {
  // Always respond 200 immediately to prevent Meta retries on slow processing
  res.sendStatus(200);

  console.log("=================================================");
  console.log("[WhatsApp Webhook HIT]", new Date().toISOString(), "Body:", JSON.stringify(req.body));
  console.log("=================================================");

  let webhookEventId: string | null = null;

  try {
    const body = req.body;

    // Only process whatsapp_business_account objects
    if (!body.object) {
      console.log("[WhatsApp Webhook] Skipped: no object field");
      return;
    }

    const entry = body.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;

    // Log raw event for audit trail
    webhookEventId = crypto.randomUUID();
    await sequelize.models.WebhookEvent.create({
      id: webhookEventId,
      source: "whatsapp",
      payload: JSON.stringify(body),
      status: "processing",
      retryCount: 0,
    } as any).catch(err => console.error("[WhatsApp] Failed to log WebhookEvent:", err));

    // Extract message object (supports value.messages, entry.messaging, or changes)
    let msg: any = null;
    let contacts: any[] = [];

    if (value?.messages?.[0]) {
      msg = value.messages[0];
      contacts = value.contacts || [];
    } else if (entry?.messaging?.[0]) {
      msg = entry.messaging[0];
    } else if (Array.isArray(change?.value?.statuses) && change.value.statuses.length > 0) {
      console.log("[WhatsApp Webhook] Received status update (sent/delivered/read receipt)");
      if (webhookEventId) {
        await sequelize.models.WebhookEvent.update(
          { status: "status_update" },
          { where: { id: webhookEventId } }
        ).catch(() => {});
      }
      return;
    }

    if (!msg) {
      console.log("[WhatsApp Webhook] Skipped: payload structure had no message object. Payload:", JSON.stringify(body));
      if (webhookEventId) {
        await sequelize.models.WebhookEvent.update(
          { status: "no_message_found" },
          { where: { id: webhookEventId } }
        ).catch(() => {});
      }
      return;
    }

    const metaMessageId: string = msg.id || `wamid.generated_${Date.now()}`;
    const from: string = msg.from || msg.sender?.id || "";
    const msgTimestamp = msg.timestamp
      ? new Date(parseInt(msg.timestamp, 10) * 1000)
      : new Date();

    // Extract message content (supports text, interactive, button, media, location)
    let msgBody = "[Media Message]";
    let mediaUrl: string | null = null;
    if (msg.type === "text" || msg.text?.body || msg.message?.text) {
      msgBody = msg.text?.body || msg.message?.text || "";
    } else if (msg.type === "interactive") {
      const interactive = msg.interactive;
      if (interactive?.type === "button_reply") {
        msgBody = interactive.button_reply?.title || interactive.button_reply?.id || "[Interactive Response]";
      } else if (interactive?.type === "list_reply") {
        msgBody = interactive.list_reply?.title || interactive.list_reply?.description || "[List Response]";
      } else {
        msgBody = "[Interactive Message]";
      }
    } else if (msg.type === "button") {
      msgBody = msg.button?.text || msg.button?.payload || "[Button Click]";
    } else if (msg.type === "image" || msg.type === "video" || msg.type === "document" || msg.type === "audio" || msg.type === "sticker") {
      const media = msg[msg.type];
      mediaUrl = media?.link || media?.url || null;
      msgBody = media?.caption || `[${msg.type.charAt(0).toUpperCase() + msg.type.slice(1)} Attachment]`;
    } else if (msg.type === "location") {
      msgBody = `[Location: ${msg.location?.latitude || ""}, ${msg.location?.longitude || ""}${msg.location?.name ? " - " + msg.location.name : ""}]`;
    } else if (msg.body) {
      msgBody = msg.body;
    }

    // Extract sender display name (from contacts array, if provided)
    if (!contacts.length) contacts = value.contacts || [];
    const senderContact = contacts.find((c: any) => c.wa_id === from);
    const senderName: string = senderContact?.profile?.name || "";

    console.log(`[WhatsApp Inbound] From: ${from} | Name: "${senderName}" | msgId: ${metaMessageId} | body: "${msgBody.slice(0, 80)}"`);

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

    // ── PHONE LOOKUP ──────────────────────────────────────────────────────────
    const cleanPhone = phoneKey(from, 10);

    // Try SQL query first
    let existingLead: any = null;
    if (cleanPhone.length >= 7) {
      existingLead = await sequelize.models.Lead.findOne({
        where: {
          [Op.or]: [
            { whatsappPhone: { [Op.like]: `%${cleanPhone}` } },
            { phone: { [Op.like]: `%${cleanPhone}` } },
          ],
        },
        include: [
          { model: sequelize.models.User, as: "assignedTo", attributes: ["id", "name", "email"] },
        ],
      });
    }

    // Fallback in-memory matching if SQL LIKE did not match formatted phone numbers
    if (!existingLead) {
      const candidateLeads = await sequelize.models.Lead.findAll({
        where: {
          [Op.or]: [
            { phone: { [Op.ne]: null } },
            { whatsappPhone: { [Op.ne]: null } },
          ],
        },
        include: [
          { model: sequelize.models.User, as: "assignedTo", attributes: ["id", "name", "email"] },
        ],
        order: [["updatedAt", "DESC"]],
        limit: 200,
      });

      for (const lead of candidateLeads as any[]) {
        if (matchesPhoneNumber(lead.whatsappPhone, from) || matchesPhoneNumber(lead.phone, from)) {
          existingLead = lead;
          break;
        }
      }
    }

    // Try Customer if no lead found
    let existingCustomer: any = null;
    if (!existingLead) {
      if (cleanPhone.length >= 7) {
        existingCustomer = await sequelize.models.Customer.findOne({
          where: { phone: { [Op.like]: `%${cleanPhone}` } },
        });
      }
      if (!existingCustomer) {
        const candidateCustomers = await sequelize.models.Customer.findAll({
          where: { phone: { [Op.ne]: null } },
          limit: 200,
        });
        for (const cust of candidateCustomers as any[]) {
          if (matchesPhoneNumber(cust.phone, from)) {
            existingCustomer = cust;
            break;
          }
        }
      }
    }

    let leadId: string;
    let assignedToId: string | null = null;
    let isNewLead = false;
    let leadDisplayName = senderName || `WhatsApp User ${from.slice(-4)}`;

    if (existingLead) {
      // ── EXISTING LEAD: Update & append activity ───────────────────────────
      leadId = existingLead.id;
      assignedToId = existingLead.assignedToId;
      leadDisplayName = `${existingLead.firstName} ${existingLead.lastName}`;

      await existingLead.update({
        lastWhatsappAt: msgTimestamp,
        unreadWhatsappCount: (existingLead.unreadWhatsappCount || 0) + 1,
        whatsappPhone: from, // ensure canonical format is stored
        communicationChannel: "whatsapp",
        body: msgBody,
      });

      console.log(`[WhatsApp Inbound] Appended to existing lead ${leadId} (${leadDisplayName})`);

    } else {
      // ── NEW LEAD: Create via assignment engine ────────────────────────────
      isNewLead = true;

      const nameParts = senderName ? senderName.trim().split(" ") : [];
      const firstName = nameParts[0] || "WhatsApp";
      const lastName = nameParts.slice(1).join(" ") || `User ${from.slice(-4)}`;
      leadDisplayName = `${firstName} ${lastName}`;

      // Generate a unique email per inbound lead to avoid UniqueConstraintError
      const uniqueEmail = `inbound-${extractDigits(from) || "user"}-${Date.now()}@whatsapp.local`;

      assignedToId = await assignLead({
        firstName,
        lastName,
        email: uniqueEmail,
        phone: from,
        source: "WhatsApp",
      });

      const leadNumber = await generateLeadNumber();
      leadId = crypto.randomUUID();

      await sequelize.models.Lead.create({
        id: leadId,
        firstName,
        lastName,
        email: uniqueEmail,
        phone: from,
        whatsappPhone: from,
        source: "WhatsApp",
        status: "New",
        communicationChannel: "whatsapp",
        leadScore: 65,
        subject: "Inbound WhatsApp Inquiry",
        body: msgBody,
        lastWhatsappAt: msgTimestamp,
        unreadWhatsappCount: 1,
        assignedToId,
        leadNumber,
        customerId: existingCustomer ? existingCustomer.id : null,
        rawPayload: JSON.stringify({ from, senderName, firstMessage: msgBody, metaMessageId }),
      } as any);

      console.log(`[WhatsApp Inbound] Created new lead ${leadId} (${leadDisplayName}) → assigned to ${assignedToId}`);
    }

    // ── CREATE ACTIVITY ───────────────────────────────────────────────────────
    const adminId = await getFirstAdminId();
    await sequelize.models.Activity.create({
      id: crypto.randomUUID(),
      leadId,
      type: "whatsapp_sms",
      notes: msgBody,
      outcome: "message received",
      mediaUrl,
      messageId: metaMessageId,
      mentioned_user_ids: "[]",
      pinned: false,
      isCompleted: true,
      createdById: adminId,
    } as any);

    // ── IN-APP NOTIFICATION ───────────────────────────────────────────────────
    if (assignedToId) {
      await createWhatsAppNotification(
        assignedToId,
        leadId,
        leadDisplayName,
        msgBody,
        isNewLead
      );
    }

    // ── MARK WEBHOOK EVENT PROCESSED ─────────────────────────────────────────
    if (webhookEventId) {
      await sequelize.models.WebhookEvent.update(
        { status: "processed" },
        { where: { id: webhookEventId } }
      ).catch(() => {});
    }

    console.log(`[WhatsApp Inbound] ✅ Processed messageId=${metaMessageId} → leadId=${leadId}`);

  } catch (error: any) {
    console.error("[WhatsApp Webhook] Processing error:", error);

    if (webhookEventId) {
      await sequelize.models.WebhookEvent.update(
        { status: "failed", errorMessage: error.message },
        { where: { id: webhookEventId } }
      ).catch(() => {});
    }
    // NOTE: HTTP 200 already sent — Meta won't retry
  }
};

