import twilio from "twilio";
import dotenv from "dotenv";
import crypto from "crypto";
import { sequelize } from "@nexus-crm/database";
import { logWhatsAppEvent, getRemediationTip } from "./whatsappLogger";
dotenv.config();

export const normalizeWhatsAppRecipient = (rawPhone: string): string => {
  let cleaned = (rawPhone || "").replace(/\D/g, "");
  // Strip international exit code 00 (e.g. 0091... -> 91... or 00966... -> 966...)
  if (cleaned.startsWith("00")) {
    cleaned = cleaned.slice(2);
  }
  const trimmed = (rawPhone || "").trim();
  if (trimmed.startsWith("+") && !trimmed.startsWith("+00")) {
    return `+${cleaned}`;
  }
  // India mobile (10 digits starting with 6, 7, 8, 9)
  if (cleaned.length === 10 && /^[6-9]/.test(cleaned)) {
    return `+91${cleaned}`;
  }
  // Saudi Arabia mobile (9 digits starting with 5)
  if (cleaned.length === 9 && cleaned.startsWith("5")) {
    return `+966${cleaned}`;
  }
  // Saudi Arabia mobile (10 digits starting with 05)
  if (cleaned.length === 10 && cleaned.startsWith("05")) {
    return `+966${cleaned.slice(1)}`;
  }
  return `+${cleaned}`;
};

export const sendWhatsAppMessage = async (toPhone: string, text: string, mediaUrl?: string) => {
  const accountSid = (process.env.TWILIO_ACCOUNT_SID || "").trim();
  const authToken = (process.env.TWILIO_AUTH_TOKEN || "").trim();
  const twilioNumber = (process.env.TWILIO_WHATSAPP_NUMBER || process.env.TWILIO_PHONE_NUMBER || "whatsapp:+14155238886").trim();

  // Format the phone number with correct country code
  const recipientE164 = normalizeWhatsAppRecipient(toPhone);
  const formattedPhone = recipientE164.replace(/\D/g, "");

  // ── MOCK FALLBACK PATTERN (only if credentials are test dummy) ─────────────────
  if (!accountSid || !authToken || accountSid === "dummy_sid" || authToken === "dummy_token") {
    const simMsg = `[WhatsApp Service] Twilio not configured, simulating send to ${formattedPhone}`;
    console.warn(simMsg);
    await logWhatsAppEvent("WARN", "CONFIGURATION", "SIMULATION_MODE_OUTBOUND", simMsg, {
      formattedPhone,
      textLength: text.length,
      hasMedia: Boolean(mediaUrl),
      remediationTip: "Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in environment variables.",
    }, formattedPhone);

    return {
      messaging_product: "whatsapp",
      provider: "simulated",
      contacts: [{ input: formattedPhone, wa_id: formattedPhone }],
      messages: [{ id: `SM.simulated_${Date.now()}_${Math.random().toString(36).substring(2, 8)}` }],
      simulated: true,
    };
  }

  // ── TWILIO API DISPATCH ────────────────────────────────────────────────────
  const client = twilio(accountSid, authToken);
  const twilioTo = toPhone.startsWith("whatsapp:") 
    ? toPhone 
    : `whatsapp:${recipientE164}`;
  const twilioFrom = twilioNumber.startsWith("whatsapp:") ? twilioNumber : `whatsapp:${twilioNumber}`;

  const messageOptions: any = {
    from: twilioFrom,
    to: twilioTo,
    body: text,
  };
  if (mediaUrl) {
    messageOptions.mediaUrl = [mediaUrl];
  }

  const startTime = Date.now();
  try {
    const response = await client.messages.create(messageOptions);
    const latencyMs = Date.now() - startTime;

    await logWhatsAppEvent("INFO", "OUTBOUND_SEND", "MESSAGE_DISPATCHED", `Outbound Twilio WhatsApp message dispatched to ${recipientE164}`, {
      messageId: response.sid,
      latencyMs,
      toPhone: recipientE164,
      provider: "twilio",
      status: response.status,
    }, recipientE164, response.sid);

    return {
      messaging_product: "whatsapp",
      provider: "twilio",
      sid: response.sid,
      status: response.status,
      contacts: [{ input: recipientE164, wa_id: recipientE164 }],
      messages: [{ id: response.sid }],
    };
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;
    await logWhatsAppEvent("ERROR", "OUTBOUND_SEND", "TWILIO_API_REJECTED", `Outbound Twilio WhatsApp send failed: ${err.message}`, {
      twilioErrorCode: err.code,
      toPhone: recipientE164,
      latencyMs,
      stack: err.stack,
      remediationTip: "Check TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_WHATSAPP_NUMBER in backend .env.",
    }, recipientE164);

    if (err.code === 63015 || err.code === 21614 || err.code === 21608) {
      throw new Error(`WhatsApp Sandbox Opt-In Required: Recipient (${recipientE164}) has not joined the Twilio WhatsApp Sandbox. To receive messages, send "join typical-ball" to +1 415 523 8886 on WhatsApp.`);
    }

    throw new Error(`Twilio API Error (${err.code ? `Code ${err.code}` : "Failure"}): ${err.message}`);
  }
};

export const sendWhatsAppTemplateMessage = async (
  toPhone: string,
  contentSid: string,
  contentVariables?: Record<string, string> | string
) => {
  const accountSid = (process.env.TWILIO_ACCOUNT_SID || "").trim();
  const authToken = (process.env.TWILIO_AUTH_TOKEN || "").trim();
  const twilioNumber = (process.env.TWILIO_WHATSAPP_NUMBER || process.env.TWILIO_PHONE_NUMBER || "whatsapp:+14155238886").trim();

  const formattedPhone = toPhone.replace(/\D/g, "");

  // ── MOCK FALLBACK PATTERN ───────────────────────────────────────────────────
  if (!accountSid || !authToken) {
    const simMsg = `[WhatsApp Service] Twilio not configured, simulating template send (${contentSid}) to ${formattedPhone}`;
    console.warn(simMsg);
    await logWhatsAppEvent("WARN", "CONFIGURATION", "SIMULATION_MODE_OUTBOUND_TEMPLATE", simMsg, {
      formattedPhone,
      contentSid,
      contentVariables,
      remediationTip: "Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in environment variables.",
    }, formattedPhone);

    return {
      messaging_product: "whatsapp",
      provider: "simulated",
      contentSid,
      contacts: [{ input: formattedPhone, wa_id: formattedPhone }],
      messages: [{ id: `SM.simulated_tmpl_${Date.now()}_${Math.random().toString(36).substring(2, 8)}` }],
      simulated: true,
    };
  }

  // ── TWILIO CONTENT API DISPATCH ─────────────────────────────────────────────
  const client = twilio(accountSid, authToken);
  const recipientE164 = normalizeWhatsAppRecipient(toPhone);
  const twilioTo = toPhone.startsWith("whatsapp:")
    ? toPhone
    : `whatsapp:${recipientE164}`;
  const twilioFrom = twilioNumber.startsWith("whatsapp:") ? twilioNumber : `whatsapp:${twilioNumber}`;

  const messageOptions: any = {
    from: twilioFrom,
    to: twilioTo,
    contentSid: contentSid,
  };

  if (contentVariables) {
    messageOptions.contentVariables = typeof contentVariables === "string"
      ? contentVariables
      : JSON.stringify(contentVariables);
  }

  const startTime = Date.now();
  try {
    const response = await client.messages.create(messageOptions);
    const latencyMs = Date.now() - startTime;

    await logWhatsAppEvent("INFO", "OUTBOUND_SEND", "TEMPLATE_MESSAGE_DISPATCHED", `Outbound Twilio WhatsApp template message (${contentSid}) dispatched to ${formattedPhone}`, {
      messageId: response.sid,
      latencyMs,
      toPhone: formattedPhone,
      contentSid,
      provider: "twilio",
      status: response.status,
    }, formattedPhone, response.sid);

    return {
      messaging_product: "whatsapp",
      provider: "twilio",
      sid: response.sid,
      status: response.status,
      contentSid,
      contacts: [{ input: formattedPhone, wa_id: formattedPhone }],
      messages: [{ id: response.sid }],
    };
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;
    await logWhatsAppEvent("ERROR", "OUTBOUND_SEND", "TWILIO_TEMPLATE_API_REJECTED", `Outbound Twilio WhatsApp template send failed: ${err.message}`, {
      twilioErrorCode: err.code,
      toPhone: formattedPhone,
      contentSid,
      latencyMs,
      stack: err.stack,
      remediationTip: "Check TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and approved Content SID in Twilio console.",
    }, formattedPhone);

    throw new Error(`Twilio Template API Error (${err.code ? `Code ${err.code}` : "Failure"}): ${err.message}`);
  }
};

/**
 * On-demand Twilio WhatsApp Inbound Sync.
 * Polls Twilio Messages API for any unrecorded customer replies and ingests them into Activity.
 * Provides a foolproof fallback when Twilio webhooks are delayed, unconfigured, or failing.
 */
export const syncInboundWhatsAppMessages = async (leadId?: string, customerPhone?: string) => {
  const accountSid = (process.env.TWILIO_ACCOUNT_SID || "").trim();
  const authToken = (process.env.TWILIO_AUTH_TOKEN || "").trim();
  const twilioNumber = (process.env.TWILIO_WHATSAPP_NUMBER || process.env.TWILIO_PHONE_NUMBER || "whatsapp:+14155238886").trim();

  if (!accountSid || !authToken) return [];

  const { Activity, Lead } = sequelize.models;
  let targetLead: any = null;
  if (leadId) {
    targetLead = await Lead.findByPk(leadId);
  }

  const phoneRaw = customerPhone || targetLead?.whatsappPhone || targetLead?.phone;
  if (!phoneRaw) return [];

  const recipientE164 = normalizeWhatsAppRecipient(phoneRaw);
  const twilioFrom = recipientE164.startsWith("whatsapp:") ? recipientE164 : `whatsapp:${recipientE164}`;
  const twilioTo = twilioNumber.startsWith("whatsapp:") ? twilioNumber : `whatsapp:${twilioNumber}`;

  try {
    const client = twilio(accountSid, authToken);
    const messages = await client.messages.list({
      to: twilioTo,
      from: twilioFrom,
      limit: 10,
    });

    const newActivities = [];
    for (const msg of messages) {
      if (!msg.body || !msg.body.trim()) continue;
      // Skip system opt-in keywords from customer conversation timeline
      const lower = msg.body.trim().toLowerCase();
      if (lower.startsWith("join ") || lower === "join" || lower === "stop" || lower === "start") {
        continue;
      }

      const existing = await Activity.findOne({
        where: { messageId: msg.sid },
      });

      if (!existing && targetLead) {
        const adminId = targetLead.assignedToId || null;
        const created = await Activity.create({
          id: crypto.randomUUID(),
          leadId: targetLead.id,
          customerId: targetLead.customerId || null,
          type: "whatsapp_sms",
          notes: msg.body,
          outcome: "message received",
          messageId: msg.sid,
          direction: "inbound",
          pinned: false,
          createdById: adminId,
          createdAt: msg.dateCreated || new Date(),
          updatedAt: msg.dateCreated || new Date(),
        } as any);
        newActivities.push(created);

        await targetLead.update({
          lastInboundAt: new Date(),
          updatedAt: new Date(),
        }).catch(() => {});
      }
    }

    return newActivities;
  } catch (err: any) {
    console.warn("[whatsappService] Error syncing inbound messages from Twilio:", err.message);
    return [];
  }
};
