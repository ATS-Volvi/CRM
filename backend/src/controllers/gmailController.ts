import { Request, Response } from "express";
import { randomUUID } from "crypto";
import { getAuthUrl, exchangeCodeForTokens, encryptToken, decryptToken, fetchUnreadEmails } from "../services/gmailService";
import { ingestLead, processGmailConnector } from "../services/leadIngestion";
import { GmailConfig, FlaggedLead } from "@nexus-crm/database";
import { evaluateInboundEmail } from "../lead-security-layer/intentFilter";
import { extractEmailMetadata } from "../lead-security-layer/intentFilter/headerParser";
import { handlePromoteOnReply } from "../lead-security-layer/intentFilter/autoReplyService";
import { attachEmailToLeadActivity } from "../lead-security-layer/intentFilter/attachActivity";
import { getSenderContext } from "../lead-security-layer/intentFilter/senderContext";

export const getGmailAuthUrl = async (req: Request, res: Response) => {
  try {
    const clientId = process.env.GMAIL_CLIENT_ID;
    const clientSecret = process.env.GMAIL_CLIENT_SECRET;

    if (!clientId || !clientSecret || clientId.includes("your_") || clientSecret.includes("your_")) {
      // In demo mode with placeholder keys, return MOCK_CLIENT_ID URL so frontend mock flow triggers seamlessly
      return res.json({ url: "https://accounts.google.com/o/oauth2/v2/auth?client_id=MOCK_CLIENT_ID" });
    }

    const url = getAuthUrl();
    res.json({ url });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const connectGmail = async (req: Request, res: Response) => {
  try {
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ error: "Code is required" });
    }

    const { email, refreshToken } = await exchangeCodeForTokens(code);
    if (!refreshToken) {
      return res.status(400).json({ error: "Consent not completed (no refresh token returned). Re-authenticate and check permissions." });
    }

    const encrypted = encryptToken(refreshToken);

    // Save configuration
    await GmailConfig.destroy({ where: {} }); // only support single Gmail integration for simplicity
    await GmailConfig.create({
      id: randomUUID(),
      connectedEmail: email,
      encryptedRefreshToken: encrypted,
      lastSyncedAt: new Date()
    });

    res.json({ success: true, email });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getGmailStatus = async (req: Request, res: Response) => {
  try {
    const config = await GmailConfig.findOne();
    if (!config) {
      return res.json({ connected: false });
    }
    res.json({
      connected: true,
      email: config.connectedEmail,
      lastSyncedAt: config.lastSyncedAt
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const disconnectGmail = async (req: Request, res: Response) => {
  try {
    await GmailConfig.destroy({ where: {} });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const syncGmail = async (req: Request, res: Response) => {
  try {
    const config = await GmailConfig.findOne();
    if (!config) {
      return res.status(400).json({ error: "Gmail is not connected" });
    }

    let ingestedCount = 0;

    if (config.encryptedRefreshToken.includes("mock_")) {
      // In Demo mode: run simulated lead ingestion
      const leadId = await processGmailConnector();
      ingestedCount = leadId ? 1 : 0;
    } else {
      const decrypted = decryptToken(config.encryptedRefreshToken);
      const emails = await fetchUnreadEmails(decrypted);
      const mode = (process.env.INTENT_FILTER_MODE || "off").toLowerCase();

      if (mode === "off") {
        // Mode OFF: Skip gate completely (no evaluateInboundEmail, no extractEmailMetadata, no DB/AI calls)
        // Loop is identical to main
        for (const email of emails) {
          await ingestLead({
            firstName: email.senderName.split(" ")[0] || "Unknown",
            lastName: email.senderName.split(" ").slice(1).join(" ") || "Sender",
            email: email.senderEmail,
            phone: email.phone,
            company: email.senderName + " Org",
            source: "Gmail Connector",
            sourceDetail: `Email Subject: ${email.subject}`,
            message: email.body,
            rawPayload: email.rawPayload
          });
          ingestedCount++;
        }
      } else if (mode === "shadow") {
        // Mode SHADOW: Wrap metadata extraction, evaluation and logging in one try/catch
        // Ingestion always runs identically to main
        for (const email of emails) {
          try {
            const emailMeta = email.emailMeta || extractEmailMetadata(email.rawPayload);
            await evaluateInboundEmail("email", emailMeta, email.body);
          } catch (gateErr: any) {
            console.warn("[gmailController] Shadow gate error:", gateErr.message);
          }

          await ingestLead({
            firstName: email.senderName.split(" ")[0] || "Unknown",
            lastName: email.senderName.split(" ").slice(1).join(" ") || "Sender",
            email: email.senderEmail,
            phone: email.phone,
            company: email.senderName + " Org",
            source: "Gmail Connector",
            sourceDetail: `Email Subject: ${email.subject}`,
            message: email.body,
            rawPayload: email.rawPayload
          });
          ingestedCount++;
        }
      } else {
        // Mode ENFORCE: Gate runs before ingestion
        for (const email of emails) {
          let intentVerdict: any = null;
          try {
            const emailMeta = email.emailMeta || extractEmailMetadata(email.rawPayload);
            intentVerdict = await evaluateInboundEmail("email", emailMeta, email.body);
          } catch (err: any) {
            console.error("[gmailController] Intent Filter evaluation error:", err.message);
            intentVerdict = { action: "REVIEW", label: "too_vague", score: 50, reason: err.message };
          }

          if (intentVerdict && intentVerdict.action === "ATTACH_EXISTING") {
            let targetLeadId = intentVerdict.openLeadId;
            if (!targetLeadId) {
              try {
                const ctx = await getSenderContext(email.senderEmail);
                targetLeadId = ctx.openLeadId;
              } catch (ctxErr: any) {
                console.warn("[gmailController] Failed to get sender context fallback:", ctxErr?.message);
              }
            }

            let attachedSuccessfully = false;
            if (targetLeadId) {
              try {
                await attachEmailToLeadActivity({
                  leadId: targetLeadId,
                  subject: email.subject || "Email Received",
                  body: email.body,
                  createdById: null,
                  channelSource: "gmail"
                });
                attachedSuccessfully = true;
              } catch (actErr: any) {
                console.warn("[gmailController] Activity attach error:", actErr.message);
              }
            }

            if (attachedSuccessfully) {
              continue;
            }
            // On attach failure (missing leadId or attach threw), do NOT continue; create the lead instead!
          }

          if (intentVerdict && ["PENDING_CLARIFY", "REVIEW", "ARCHIVE"].includes(intentVerdict.action)) {
            let holdWritten = false;
            if (FlaggedLead) {
              try {
                await FlaggedLead.create({
                  id: randomUUID(),
                  payload: email.rawPayload,
                  source: "Gmail Connector",
                  channel: "email",
                  reason: intentVerdict.reason,
                  disposition: intentVerdict.action === "PENDING_CLARIFY"
                    ? "pending_clarification"
                    : intentVerdict.action === "ARCHIVE"
                    ? "archived"
                    : "review",
                  intentLabel: intentVerdict.label,
                  intentScore: intentVerdict.score,
                  explanation: intentVerdict.reason,
                  senderEmail: email.senderEmail,
                  subject: email.subject,
                  reviewed: false
                });
                holdWritten = true;
              } catch (flagErr: any) {
                console.warn("[gmailController] FlaggedLead create error:", flagErr.message);
              }
            }

            if (holdWritten) {
              continue;
            }
            // On hold failure (FlaggedLead write threw or missing), do NOT continue; create the lead instead!
          }

          const newLeadId = await ingestLead({
            firstName: email.senderName.split(" ")[0] || "Unknown",
            lastName: email.senderName.split(" ").slice(1).join(" ") || "Sender",
            email: email.senderEmail,
            phone: email.phone,
            company: email.senderName + " Org",
            source: "Gmail Connector",
            sourceDetail: `Email Subject: ${email.subject}`,
            message: email.body,
            rawPayload: email.rawPayload
          });

          ingestedCount++;

          if (newLeadId) {
            try {
              await handlePromoteOnReply(email.senderEmail, newLeadId);
            } catch (e) {}
          }
        }
      }
    }

    config.lastSyncedAt = new Date();
    await config.save();

    res.json({ success: true, ingestedCount });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
