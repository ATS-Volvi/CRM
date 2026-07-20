import { google } from "googleapis";
import crypto from "crypto";
import { GmailConfig } from "@nexus-crm/database";

const getEncryptionKey = (): Buffer => {
  const secret = process.env.GMAIL_ENCRYPTION_KEY || "nexus_crm_default_encryption_key_2026";
  return crypto.createHash("sha256").update(secret).digest();
};

export const encryptToken = (token: string): string => {
  const iv = crypto.randomBytes(12);
  const key = getEncryptionKey();
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  let encrypted = cipher.update(token, "utf8", "hex");
  encrypted += cipher.final("hex");
  const tag = cipher.getAuthTag().toString("hex");
  return JSON.stringify({
    iv: iv.toString("hex"),
    tag,
    encrypted
  });
};

export const decryptToken = (encryptedJson: string): string => {
  try {
    const { iv, tag, encrypted } = JSON.parse(encryptedJson);
    const key = getEncryptionKey();
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(iv, "hex")
    );
    decipher.setAuthTag(Buffer.from(tag, "hex"));
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (err) {
    throw new Error("Failed to decrypt Google refresh token: " + (err as Error).message);
  }
};

const getOAuthClient = () => {
  const client = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID || "MOCK_CLIENT_ID",
    process.env.GMAIL_CLIENT_SECRET || "MOCK_CLIENT_SECRET",
    process.env.GMAIL_REDIRECT_URI || "http://localhost:5173/settings"
  );
  return client;
};

export const getAuthUrl = (): string => {
  const oauth2Client = getOAuthClient();
  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: [
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/userinfo.email"
    ],
    prompt: "consent"
  });
};

export const exchangeCodeForTokens = async (code: string) => {
  const oauth2Client = getOAuthClient();
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);

  // Retrieve user email
  const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
  const userInfo = await oauth2.userinfo.get();

  return {
    email: userInfo.data.email || "",
    refreshToken: tokens.refresh_token || ""
  };
};

export interface GmailMessage {
  id: string;
  senderName: string;
  senderEmail: string;
  phone: string;
  subject: string;
  body: string;
  date: Date;
  rawPayload: any;
}

export const fetchUnreadEmails = async (refreshToken: string): Promise<GmailMessage[]> => {
  if (!refreshToken) return [];
  const oauth2Client = getOAuthClient();
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  const gmail = google.gmail({ version: "v1", auth: oauth2Client });

  // Find unread messages
  const listRes = await gmail.users.messages.list({
    userId: "me",
    q: "is:unread"
  });

  const messages = listRes.data.messages || [];
  const parsedMessages: GmailMessage[] = [];

  for (const msgInfo of messages) {
    if (!msgInfo.id) continue;
    const msgRes = await gmail.users.messages.get({
      userId: "me",
      id: msgInfo.id,
      format: "full"
    });

    const msg = msgRes.data;
    const headers = msg.payload?.headers || [];
    const fromHeader = headers.find((h: any) => h.name?.toLowerCase() === "from")?.value || "";
    const subject = headers.find((h: any) => h.name?.toLowerCase() === "subject")?.value || "No Subject";
    
    // Parse sender e.g. "John Doe <john@example.com>" or "john@example.com"
    let senderName = "";
    let senderEmail = "";
    const emailMatch = fromHeader.match(/<([^>]+)>/);
    if (emailMatch) {
      senderEmail = emailMatch[1];
      senderName = fromHeader.replace(/<[^>]+>/, "").trim().replace(/^"|"$/g, "");
    } else {
      senderEmail = fromHeader.trim();
      senderName = fromHeader.split("@")[0];
    }

    // Extract body text
    let body = "";
    if (msg.payload?.parts) {
      const textPart = msg.payload.parts.find((p: any) => p.mimeType === "text/plain");
      const htmlPart = msg.payload.parts.find((p: any) => p.mimeType === "text/html");
      const base64Body = textPart?.body?.data || htmlPart?.body?.data || "";
      if (base64Body) {
        body = Buffer.from(base64Body, "base64").toString("utf8");
      }
    } else if (msg.payload?.body?.data) {
      body = Buffer.from(msg.payload.body.data, "base64").toString("utf8");
    }

    // Simple phone match in body
    const phoneMatch = body.match(/[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}/);
    const phone = phoneMatch ? phoneMatch[0] : "";

    parsedMessages.push({
      id: msgInfo.id,
      senderName,
      senderEmail,
      phone,
      subject,
      body,
      date: msg.internalDate ? new Date(parseInt(msg.internalDate)) : new Date(),
      rawPayload: msg
    });

    // Mark message as read
    await gmail.users.messages.modify({
      userId: "me",
      id: msgInfo.id,
      requestBody: {
        removeLabelIds: ["UNREAD"]
      }
    });
  }

  return parsedMessages;
};
