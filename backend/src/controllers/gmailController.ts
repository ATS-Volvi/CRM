import { Request, Response } from "express";
import { getAuthUrl, exchangeCodeForTokens, encryptToken, decryptToken, fetchUnreadEmails } from "../services/gmailService";
import { ingestLead } from "../services/leadIngestion";
import { GmailConfig } from "@nexus-crm/database";

import { processGmailConnector } from "../services/leadIngestion";

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
      id: require("crypto").randomUUID(),
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

      for (const email of emails) {
        const { evaluateInboundEmail } = require("../lead-security-layer/intentFilter");
        const { extractEmailMetadata } = require("../lead-security-layer/intentFilter/headerParser");
        const { cleanEmailText } = require("../lead-security-layer/intentFilter/cleanText");
        const { handleDealInboundActivity } = require("../services/leadTemperatureService");
        const { handlePromoteOnReply } = require("../lead-security-layer/intentFilter/autoReplyService");
        const { Activity, Lead, FlaggedLead } = require("@nexus-crm/database");

        const emailMeta = email.emailMeta || extractEmailMetadata(email.rawPayload);
        let intentVerdict: any = null;
        try {
          intentVerdict = await evaluateInboundEmail("email", emailMeta, email.body);
        } catch (err: any) {
          console.error("[gmailController] Intent Filter evaluation error:", err.message);
          const mode = (process.env.INTENT_FILTER_MODE || "shadow").toLowerCase();
          if (mode === "off" || mode === "shadow") {
            intentVerdict = { action: "CREATE_LEAD", label: "new_enquiry", score: 70, reason: err.message };
          } else {
            intentVerdict = { action: "REVIEW", label: "too_vague", score: 50, reason: err.message };
          }
        }

        if (intentVerdict.action === "ATTACH_EXISTING") {
          const targetLeadId = intentVerdict.openLeadId;
          if (targetLeadId && Activity) {
            try {
              await Activity.create({
                id: require("crypto").randomUUID(),
                type: "Email Received",
                subject: email.subject || "Email Received",
                body: cleanEmailText(email.body) || email.body,
                outcome: `Gmail sync email attached: ${email.subject || "No Subject"}`,
                leadId: targetLeadId,
                pinned: false,
                priority: "Medium",
                direction: "inbound"
              });
              const openLead = await Lead.findByPk(targetLeadId);
              if (openLead) {
                (openLead as any).lastInboundAt = new Date();
                await openLead.save();
              }
              await handleDealInboundActivity(targetLeadId);
            } catch (actErr: any) {
              console.warn("[gmailController] Activity attach error:", actErr.message);
            }
          }
          continue;
        }

        if (["PENDING_CLARIFY", "REVIEW", "ARCHIVE"].includes(intentVerdict.action)) {
          if (FlaggedLead) {
            try {
              await FlaggedLead.create({
                id: require("crypto").randomUUID(),
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
            } catch (flagErr: any) {
              console.warn("[gmailController] FlaggedLead create error:", flagErr.message);
            }
          }
          continue;
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
          rawPayload: { ...(email.rawPayload || {}), skipIntentGate: true }
        });

        if (newLeadId) {
          ingestedCount++;
          try {
            await handlePromoteOnReply(email.senderEmail, newLeadId);
          } catch (e) {}
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
