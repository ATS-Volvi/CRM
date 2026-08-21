import twilio from "twilio";
import dotenv from "dotenv";
import { logWhatsAppEvent, getRemediationTip } from "./whatsappLogger";
dotenv.config();

export const sendWhatsAppMessage = async (toPhone: string, text: string, mediaUrl?: string) => {
  const accountSid = (process.env.TWILIO_ACCOUNT_SID || "").trim();
  const authToken = (process.env.TWILIO_AUTH_TOKEN || "").trim();
  const twilioNumber = (process.env.TWILIO_WHATSAPP_NUMBER || process.env.TWILIO_PHONE_NUMBER || "whatsapp:+14155238886").trim();

  // Format the phone number (digits only for canonical matching)
  const formattedPhone = toPhone.replace(/\D/g, "");

  // ── MOCK FALLBACK PATTERN ───────────────────────────────────────────────────
  if (!accountSid || !authToken) {
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
    : toPhone.startsWith("+") 
    ? `whatsapp:${toPhone}` 
    : `whatsapp:+${formattedPhone}`;
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

    await logWhatsAppEvent("INFO", "OUTBOUND_SEND", "MESSAGE_DISPATCHED", `Outbound Twilio WhatsApp message dispatched to ${formattedPhone}`, {
      messageId: response.sid,
      latencyMs,
      toPhone: formattedPhone,
      provider: "twilio",
      status: response.status,
    }, formattedPhone, response.sid);

    return {
      messaging_product: "whatsapp",
      provider: "twilio",
      sid: response.sid,
      status: response.status,
      contacts: [{ input: formattedPhone, wa_id: formattedPhone }],
      messages: [{ id: response.sid }],
    };
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;
    await logWhatsAppEvent("ERROR", "OUTBOUND_SEND", "TWILIO_API_REJECTED", `Outbound Twilio WhatsApp send failed: ${err.message}`, {
      twilioErrorCode: err.code,
      toPhone: formattedPhone,
      latencyMs,
      stack: err.stack,
      remediationTip: "Check TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_WHATSAPP_NUMBER in backend .env.",
    }, formattedPhone);

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
  const twilioTo = toPhone.startsWith("whatsapp:")
    ? toPhone
    : toPhone.startsWith("+")
    ? `whatsapp:${toPhone}`
    : `whatsapp:+${formattedPhone}`;
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
