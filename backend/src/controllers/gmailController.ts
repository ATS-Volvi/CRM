import { Request, Response } from "express";
import { getAuthUrl, exchangeCodeForTokens, encryptToken, decryptToken, fetchUnreadEmails } from "../services/gmailService";
import { ingestLead } from "../services/leadIngestion";
import { GmailConfig } from "@nexus-crm/database";

export const getGmailAuthUrl = async (req: Request, res: Response) => {
  try {
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

    const decrypted = decryptToken(config.encryptedRefreshToken);
    const emails = await fetchUnreadEmails(decrypted);

    let ingestedCount = 0;
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

    config.lastSyncedAt = new Date();
    await config.save();

    res.json({ success: true, ingestedCount });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
