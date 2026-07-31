import { Request, Response } from "express";
import crypto from "crypto";
import { Lead, Activity } from "@nexus-crm/database";
import { assignLeadToSalesperson } from "../services/leadAssignmentService";
import { routeChannelLead } from "../services/channelRoutingEngine";

interface SenderProfile {
  name: string;
  username: string;
}

// Request-scoped / in-memory sender profile lookup helper
const profileCache = new Map<string, SenderProfile>();

async function fetchInstagramSenderProfile(senderId: string): Promise<SenderProfile> {
  if (profileCache.has(senderId)) {
    return profileCache.get(senderId)!;
  }

  const accessToken = process.env.META_ACCESS_TOKEN;
  if (accessToken && !accessToken.includes("your_")) {
    try {
      const url = `https://graph.facebook.com/v18.0/${senderId}?fields=name,username&access_token=${accessToken}`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        const profile: SenderProfile = {
          name: data.name || data.username || `IG User ${senderId}`,
          username: data.username || senderId
        };
        profileCache.set(senderId, profile);
        return profile;
      }
    } catch (err) {
      console.warn(`Failed to fetch Instagram profile for ${senderId}:`, err);
    }
  }

  const fallback: SenderProfile = {
    name: `Instagram User`,
    username: senderId
  };
  profileCache.set(senderId, fallback);
  return fallback;
}

/**
 * Webhook Verification Handler (GET /api/v1/instagram/webhook)
 */
export const verifyInstagramWebhook = async (req: Request, res: Response) => {
  const verifyToken = process.env.INSTAGRAM_VERIFY_TOKEN || "nexus_instagram_verify_secret_2026";
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === verifyToken) {
    return res.status(200).send(challenge);
  } else {
    return res.status(403).send("Forbidden: Invalid verify token or mode");
  }
};

interface NormalizedIgMessage {
  senderId: string;
  name: string;
  username: string;
  text: string;
  raw: any;
}

/**
 * Shared lead-creation pipeline used by both the raw-Meta path and the
 * gateway (Zapier / Make / ManyChat / MessageBird) path below, so routing,
 * assignment, and activity logging stay identical regardless of source.
 */
async function processInstagramMessage(msg: NormalizedIgMessage) {
  const nameParts = msg.name.split(" ").filter(Boolean);
  const firstName = nameParts[0] || "Instagram";
  const lastName = nameParts.slice(1).join(" ") || "User";

  const routingResult = await routeChannelLead({
    channel: "instagram",
    subject: msg.text,
    text: msg.text,
    recipientEmail: null,
    leadData: {
      firstName,
      lastName,
      email: null,
      phone: "",
      company: "",
      source: "instagram"
    }
  });

  const { assignedToId, assignmentMethod, isFuzzyNameMatch, matchedNameStr } = routingResult;

  const lead = await Lead.create({
    firstName,
    lastName,
    email: null,
    phone: "",
    company: "",
    source: "instagram",
    status: "New Lead",
    subject: msg.text,
    body: msg.text,
    sourceDetail: `@${msg.username}`,
    rawPayload: JSON.stringify(msg.raw),
    assignedToId: null,
    assignmentMethod
  });

  if (assignedToId) {
    await assignLeadToSalesperson(lead, assignedToId);
  }

  if (isFuzzyNameMatch && (lead as any).id) {
    try {
      await Activity.create({
        type: "Assignment Flag",
        outcome: `Fuzzy Name Match: Assigned to '${matchedNameStr}' based on single name mention in Instagram message. Please verify assignment.`,
        leadId: (lead as any).id,
        createdById: assignedToId,
        pinned: false,
        priority: "Medium"
      });
    } catch (actErr) {
      console.warn("Failed to create fuzzy match activity log:", actErr);
    }
  }

  // Create the actual Instagram DM activity record for the Communication Center
  try {
    await Activity.create({
      type: "instagram_dm",
      notes: msg.text,
      outcome: "received",
      leadId: (lead as any).id,
      createdById: assignedToId || null,
      pinned: false,
      priority: "Low"
    });
  } catch (err) {
    console.warn("Failed to create instagram_dm activity log:", err);
  }

  return {
    leadId: (lead as any).id,
    assignedToId,
    assignmentMethod
  };
}

/**
 * Verifies a raw Meta webhook POST via X-Hub-Signature-256.
 * Returns true/false; never throws.
 */
function isValidMetaSignature(req: Request): boolean {
  const appSecret = process.env.INSTAGRAM_APP_SECRET;
  if (!appSecret) return false;

  const signatureHeader = (req.headers["x-hub-signature-256"] as string) || "";
  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) return false;

  const expectedHashHex = signatureHeader.substring(7);
  const rawBody = (req as any).rawBody || Buffer.from(JSON.stringify(req.body || {}));

  const hmac = crypto.createHmac("sha256", appSecret);
  hmac.update(rawBody);
  const computedHashHex = hmac.digest("hex");

  const expectedBuf = Buffer.from(expectedHashHex, "hex");
  const computedBuf = Buffer.from(computedHashHex, "hex");

  return expectedBuf.length === computedBuf.length && crypto.timingSafeEqual(expectedBuf, computedBuf);
}

/**
 * Verifies a gateway (Zapier / Make / ManyChat / MessageBird) POST via a
 * shared secret, since these platforms don't sign requests the way Meta does.
 * Accepted as either a header or a query-string token, mirroring the
 * INBOUND_EMAIL_SECRET pattern used for the Mailgun inbound-email webhook.
 */
function isValidGatewaySecret(req: Request): boolean {
  const secret = process.env.INSTAGRAM_GATEWAY_SECRET || "nexus_instagram_gateway_secret_2026";

  const tokenHeader = req.headers["x-instagram-gateway-secret"];
  const tokenQuery = req.query.auth_token;

  return tokenHeader === secret || tokenQuery === secret;
}

/**
 * Normalizes a gateway payload (Zapier "Instagram Business - New Message",
 * Make.com's Instagram module, ManyChat's External Request action, or
 * MessageBird/Sunshine Conversations) into a common shape.
 *
 * Different gateways use different field names for the same data, so this
 * checks several common variants rather than assuming one exact schema.
 * Returns null if the payload doesn't contain enough to create a lead.
 */
function normalizeGatewayMessage(body: any): NormalizedIgMessage | null {
  const senderId =
    body.senderId ??
    body.sender_id ??
    body.igsid ??
    body.contactId ??
    body.contact_id ??
    body.userId ??
    body.psid ??
    body.sender?.id ??
    body.from?.id ??
    (typeof body.from === "string" ? body.from : body.from?.id);

  const text =
    body.text ??
    body.message ??
    body.messageText ??
    body.message_text ??
    body.body ??
    body.content ??
    body.caption ??
    (typeof body.message === "object" ? body.message?.text : undefined) ??
    body.data?.text;

  if (!senderId || !text) return null;

  const name =
    body.senderName ??
    body.sender_name ??
    body.name ??
    body.fullName ??
    body.full_name ??
    body.from?.name ??
    body.sender?.name ??
    `Instagram User`;

  const username =
    body.username ??
    body.senderUsername ??
    body.sender_username ??
    body.instagramUsername ??
    body.from?.username ??
    body.sender?.username ??
    String(senderId);

  return {
    senderId: String(senderId),
    name: String(name),
    username: String(username),
    text: String(text),
    raw: body
  };
}

/**
 * Message Webhook Handler (POST /api/v1/instagram/webhook)
 *
 * Accepts two shapes of request:
 *  1. Raw Meta webhook payloads (entry[].messaging[]), authenticated via
 *     X-Hub-Signature-256 or INSTAGRAM_GATEWAY_SECRET.
 *  2. Normalized single-message payloads from a third-party gateway
 *     (Zapier, Make.com, ManyChat, MessageBird), authenticated via a shared
 *     secret (INSTAGRAM_GATEWAY_SECRET) in a header or query param.
 */
export const receiveInstagramMessage = async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const looksLikeMetaPayload = Array.isArray(body.entry);

    if (looksLikeMetaPayload) {
      const isMetaAuthed = isValidMetaSignature(req);
      const isGatewayAuthed = isValidGatewaySecret(req);

      if (!isMetaAuthed && !isGatewayAuthed) {
        return res.status(401).json({ error: "Unauthorized: Invalid or missing Meta signature" });
      }

      const entries = body.entry || [];
      const createdLeads: any[] = [];

      for (const entry of entries) {
        const messagingItems = entry.messaging || [];
        for (const item of messagingItems) {
          const senderId = item.sender?.id;
          const messageText = item.message?.text;
          if (!senderId || !messageText) continue;

          const profile = await fetchInstagramSenderProfile(senderId);
          const result = await processInstagramMessage({
            senderId,
            name: profile.name,
            username: profile.username,
            text: messageText,
            raw: item
          });
          createdLeads.push(result);
        }
      }

      return res.status(200).json({
        success: true,
        message: "Instagram webhook processed successfully",
        processedCount: createdLeads.length,
        leads: createdLeads
      });
    }

    // Gateway path (Zapier / Make / ManyChat / MessageBird)
    if (!isValidGatewaySecret(req)) {
      return res.status(401).json({ error: "Unauthorized: Invalid or missing gateway secret" });
    }

    const normalized = normalizeGatewayMessage(body);
    if (!normalized) {
      return res.status(400).json({ error: "Bad Request: payload missing sender id or message text" });
    }

    const result = await processInstagramMessage(normalized);

    return res.status(200).json({
      success: true,
      message: "Instagram webhook processed successfully",
      processedCount: 1,
      leads: [result]
    });
  } catch (error: any) {
    console.error("Error in receiveInstagramMessage webhook:", error);
    return res.status(500).json({ error: "Failed to process Instagram webhook" });
  }
};
