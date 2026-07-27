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
  const verifyToken = process.env.INSTAGRAM_VERIFY_TOKEN;
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (!verifyToken) {
    console.error("CRITICAL: INSTAGRAM_VERIFY_TOKEN is not set — webhook verification rejecting requests.");
    return res.status(403).send("Forbidden: INSTAGRAM_VERIFY_TOKEN is not configured");
  }

  if (mode === "subscribe" && token === verifyToken) {
    return res.status(200).send(challenge);
  } else {
    return res.status(403).send("Forbidden: Invalid verify token or mode");
  }
};

/**
 * Message Webhook Handler (POST /api/v1/instagram/webhook)
 */
export const receiveInstagramMessage = async (req: Request, res: Response) => {
  try {
    const appSecret = process.env.INSTAGRAM_APP_SECRET;

    // Signature verification must fail closed if INSTAGRAM_APP_SECRET is unset
    if (!appSecret) {
      console.error("CRITICAL: INSTAGRAM_APP_SECRET is not set — rejecting webhook POST.");
      return res.status(401).json({ error: "Unauthorized: Invalid or missing INSTAGRAM_APP_SECRET" });
    }

    const signatureHeader = (req.headers["x-hub-signature-256"] as string) || "";
    if (!signatureHeader || !signatureHeader.startsWith("sha256=")) {
      return res.status(401).json({ error: "Unauthorized: Missing or invalid signature header" });
    }

    const expectedHashHex = signatureHeader.substring(7);
    const rawBody = (req as any).rawBody || Buffer.from(JSON.stringify(req.body || {}));

    const hmac = crypto.createHmac("sha256", appSecret);
    hmac.update(rawBody);
    const computedHashHex = hmac.digest("hex");

    const expectedBuf = Buffer.from(expectedHashHex, "hex");
    const computedBuf = Buffer.from(computedHashHex, "hex");

    if (expectedBuf.length !== computedBuf.length || !crypto.timingSafeEqual(expectedBuf, computedBuf)) {
      return res.status(401).json({ error: "Unauthorized: Invalid signature" });
    }

    // Signature verified. Now process payload.
    const body = req.body || {};
    const entries = body.entry || [];
    const createdLeads: any[] = [];

    for (const entry of entries) {
      const messagingItems = entry.messaging || [];
      for (const item of messagingItems) {
        const senderId = item.sender?.id;
        const messageText = item.message?.text;

        if (!senderId || !messageText) {
          continue;
        }

        const profile = await fetchInstagramSenderProfile(senderId);
        const nameParts = profile.name.split(" ");
        const firstName = nameParts[0] || "Instagram";
        const lastName = nameParts.slice(1).join(" ") || "User";

        const routingResult = await routeChannelLead({
          channel: "instagram",
          subject: messageText,
          text: messageText,
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
          subject: messageText,
          body: messageText,
          sourceDetail: `@${profile.username}`,
          rawPayload: JSON.stringify(item),
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

        createdLeads.push({
          leadId: (lead as any).id,
          assignedToId,
          assignmentMethod
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: "Instagram webhook processed successfully",
      processedCount: createdLeads.length,
      leads: createdLeads
    });
  } catch (error: any) {
    console.error("Error in receiveInstagramMessage webhook:", error);
    return res.status(500).json({ error: "Failed to process Instagram webhook" });
  }
};
