import { Request, Response } from "express";
import { randomUUID } from "crypto";
import { User, Activity, FlaggedLead, sequelize } from "@nexus-crm/database";
import { assignLead } from "../services/assignmentEngine";
import { routeChannelLead } from "../services/channelRoutingEngine";
import { ingestLead } from "../services/leadIngestion";
import { Op } from "sequelize";
import { extractEmailMetadata } from "../lead-security-layer/intentFilter/headerParser";
import { evaluateInboundEmail } from "../lead-security-layer/intentFilter";
import { attachEmailToLeadActivity } from "../lead-security-layer/intentFilter/attachActivity";
import { getSenderContext } from "../lead-security-layer/intentFilter/senderContext";
import { shouldSendClarificationAutoReply, sendClarificationAutoReply, handlePromoteOnReply } from "../lead-security-layer/intentFilter/autoReplyService";
import { processInboundIntakeEvent } from "../services/leadIntakeAutomationEngine";
import { detectAndFlagQuoteAcceptance } from "../services/quoteDeliveryService";

const WHITELIST_ROLES = ["sales_rep", "manager", "admin", "director"];
const TERMINAL_LEAD_STATUSES = ["Won", "Lost", "Closed", "Closed Won", "Closed Lost"];

// Helper to parse Name & Email from "First Last <email@domain.com>" format
function parseSender(fromStr: string) {
  const emailRegex = /<([^>]+)>/;
  const match = fromStr.match(emailRegex);
  
  if (match) {
    const email = match[1].trim();
    const namePart = fromStr.replace(emailRegex, "").trim();
    const nameParts = namePart.split(" ");
    const firstName = nameParts[0] || "Email";
    const lastName = nameParts.slice(1).join(" ") || "Query";
    return { firstName, lastName, email };
  }
  
  // Fallback if no bracket format
  const cleanEmail = fromStr.trim();
  const username = cleanEmail.split("@")[0] || "Email";
  return {
    firstName: username,
    lastName: "Query",
    email: cleanEmail
  };
}

// Extract plus tag from email address (e.g. face+saud@123.com -> saud)
function extractPlusTag(emailStr: string): string | null {
  const clean = emailStr.trim().toLowerCase();
  const atIdx = clean.indexOf("@");
  if (atIdx === -1) return null;
  const localPart = clean.substring(0, atIdx);
  const plusIdx = localPart.indexOf("+");
  if (plusIdx !== -1 && plusIdx < localPart.length - 1) {
    return localPart.substring(plusIdx + 1).trim();
  }
  return null;
}

// Extract explicit "Attn:" or "For:" prefix convention from subject or first line of body
function extractAttnName(subject: string, bodyText: string): string | null {
  const subjectMatch = subject ? subject.match(/\b(?:Attn|For)\s*:?\s*(.+)$/i) : null;
  if (subjectMatch && subjectMatch[1]) {
    return subjectMatch[1].trim().toLowerCase();
  }

  const firstLine = (bodyText || "").split(/\r?\n/)[0] || "";
  const bodyMatch = firstLine.match(/\b(?:Attn|For)\s*:?\s*(.+)$/i);
  if (bodyMatch && bodyMatch[1]) {
    return bodyMatch[1].trim().toLowerCase();
  }

  return null;
}

// Normalize different provider payload formats (SendGrid JSON, Mailgun multipart/form-data, URL encoded)
// Byte-identical to main: Does not call extractEmailMetadata here
function normalizeInboundPayload(rawBody: any) {
  const b = rawBody || {};
  const from = b.from || b.sender || b.From || b.Sender || "";
  const to = b.to || b.recipient || b.To || b.Recipient || "";
  const subject = b.subject || b.Subject || "No Subject";
  const text = b["stripped-text"] || b["body-plain"] || b.text || b.body || b.Body || "No message body provided.";
  return { from, to, subject, text };
}

import crypto from "crypto";

/**
 * Validates Mailgun webhook signature:
 * HMAC-SHA256 of timestamp + token with MAILGUN_WEBHOOK_SIGNING_KEY.
 * Verifies timestamp is within 300 seconds (5 minutes).
 * Uses constant-time comparison via crypto.timingSafeEqual on equal-length buffers.
 */
export function verifyMailgunWebhookSignature(body: any, signingKey?: string): boolean {
  const key = (signingKey ?? process.env.MAILGUN_WEBHOOK_SIGNING_KEY)?.replace(/^["']|["']$/g, "").trim();
  if (!key || !body) {
    return false;
  }

  const timestamp = body.timestamp ?? body.signature?.timestamp;
  const token = body.token ?? body.signature?.token;
  const signature = typeof body.signature === "string" ? body.signature : body.signature?.signature;

  if (!timestamp || !token || !signature || typeof signature !== "string") {
    return false;
  }

  const numericTimestamp = Number(timestamp);
  if (isNaN(numericTimestamp) || numericTimestamp <= 0) {
    return false;
  }

  const timestampSec = numericTimestamp > 1e11 ? Math.floor(numericTimestamp / 1000) : Math.floor(numericTimestamp);
  const currentSec = Math.floor(Date.now() / 1000);
  if (Math.abs(currentSec - timestampSec) > 300) {
    return false;
  }

  const hmac = crypto.createHmac("sha256", key);
  hmac.update(`${timestamp}${token}`);
  const expectedSignatureHex = hmac.digest("hex");

  const sigBuf = Buffer.from(signature.toLowerCase(), "utf8");
  const expBuf = Buffer.from(expectedSignatureHex.toLowerCase(), "utf8");

  if (sigBuf.length !== expBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(sigBuf, expBuf);
}

/**
 * Validates shared inbound email secret against INBOUND_EMAIL_SECRET using crypto.timingSafeEqual.
 */
export function verifyInboundSharedSecret(providedSecret?: string, expectedSecret?: string): boolean {
  const expected = (expectedSecret ?? process.env.INBOUND_EMAIL_SECRET)?.replace(/^["']|["']$/g, "").trim();
  if (!expected || !providedSecret) {
    return false;
  }

  const provBuf = Buffer.from(providedSecret, "utf8");
  const expBuf = Buffer.from(expected, "utf8");

  if (provBuf.length !== expBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(provBuf, expBuf);
}

/**
 * Extracts secret from query param auth_token, x-inbound-secret header, or authorization bearer header.
 */
export function extractProvidedSecret(req: Request): string | undefined {
  const tokenHeader = req.headers["x-inbound-secret"];
  if (typeof tokenHeader === "string" && tokenHeader.trim()) {
    return tokenHeader.trim();
  }

  const authHeader = req.headers["authorization"];
  if (typeof authHeader === "string" && authHeader.trim()) {
    return authHeader.replace(/^Bearer\s+/i, "").trim();
  }

  const tokenQuery = req.query.auth_token;
  if (typeof tokenQuery === "string" && tokenQuery.trim()) {
    return tokenQuery.trim();
  }

  return undefined;
}

let inboundAuthWarned = false;
export function logInboundAuthStartupWarning(): void {
  if (inboundAuthWarned) return;
  if (process.env.NODE_ENV === "test") return;

  const hasSecret = !!(process.env.INBOUND_EMAIL_SECRET?.replace(/^["']|["']$/g, "").trim());
  const hasMailgunKey = !!(process.env.MAILGUN_WEBHOOK_SIGNING_KEY?.replace(/^["']|["']$/g, "").trim());

  if (!hasSecret && !hasMailgunKey) {
    inboundAuthWarned = true;
    console.warn(
      "[Inbound Email Auth] WARNING: Neither INBOUND_EMAIL_SECRET nor MAILGUN_WEBHOOK_SIGNING_KEY is configured. All inbound email webhook requests will be rejected (fail closed)."
    );
  }
}
logInboundAuthStartupWarning();

export const receiveInboundEmail = async (req: Request, res: Response) => {
  try {
    // Security verification check: require either valid Mailgun webhook signature OR valid INBOUND_EMAIL_SECRET
    const providedSecret = extractProvidedSecret(req);
    const isSecretAuthed = verifyInboundSharedSecret(providedSecret);
    const isMailgunAuthed = verifyMailgunWebhookSignature(req.body);

    if (!isSecretAuthed && !isMailgunAuthed) {
      return res.status(401).json({ error: "Unauthorized: Invalid or missing INBOUND_EMAIL_SECRET" });
    }

    // Normalize inbound payload fields
    const { from: rawFrom, to: rawTo, subject: emailSubject, text: emailBody } = normalizeInboundPayload(req.body);
    
    if (!rawFrom) {
      return res.status(400).json({ error: "Missing sender information ('from' or 'sender')" });
    }

    const { firstName, lastName, email } = parseSender(rawFrom);
    const recipientEmail = rawTo ? parseSender(rawTo).email : null;

    const mode = (process.env.INTENT_FILTER_MODE || "off").toLowerCase();

    // In mode=off, do NOT call extractEmailMetadata at all.
    // In shadow/enforce, extract metadata wrapped in try/catch returning undefined on error.
    let emailMeta: any = undefined;
    if (mode === "shadow" || mode === "enforce") {
      try {
        const files = (req as any).files || (req.file ? [req.file] : []);
        emailMeta = extractEmailMetadata(req.body, files);
      } catch (err: any) {
        console.warn("[emailController] Failed to extract email metadata, proceeding without it:", err?.message || err);
        emailMeta = undefined;
      }
    }

    // In mode=enforce: Intent Filter Gate runs before ingestion
    if (mode === "enforce") {
      const skipGate = Boolean((req as any)._internalSkipGate);
      let intentVerdict: any = null;
      if (!skipGate) {
        try {
          intentVerdict = await evaluateInboundEmail("email", emailMeta, emailBody);
        } catch (gateErr: any) {
          console.error("[emailController] Intent Filter evaluation error:", gateErr.message);
          intentVerdict = {
            action: "REVIEW",
            label: "too_vague",
            score: 50,
            confidence: "low",
            reason: `Intent gate error: ${gateErr.message}`
          };
        }
      }

      // 1. ATTACH_EXISTING: Attach activity to open lead without creating new lead or reassigning
      if (intentVerdict && intentVerdict.action === "ATTACH_EXISTING") {
        let targetLeadId = intentVerdict.openLeadId;
        if (!targetLeadId) {
          try {
            const ctx = await getSenderContext(email);
            targetLeadId = ctx.openLeadId;
          } catch (ctxErr: any) {
            console.warn("[emailController] Failed to get sender context fallback:", ctxErr?.message);
          }
        }

        let attachedSuccessfully = false;
        if (targetLeadId) {
          try {
            await attachEmailToLeadActivity({
              leadId: targetLeadId,
              subject: emailSubject,
              body: emailBody,
              createdById: (req as any).user?.id || null,
              channelSource: "email"
            });
            attachedSuccessfully = true;
          } catch (actErr: any) {
            console.warn("[emailController] Error attaching activity to open lead:", actErr.message);
          }
        }

        if (attachedSuccessfully) {
          return res.status(202).json({
            status: "attached",
            message: "Email attached to existing open lead",
            leadId: targetLeadId,
            action: "ATTACH_EXISTING"
          });
        }
        // Fall through to normal lead creation if targetLeadId is missing or attach threw
      }

      // 2. PENDING_CLARIFY, REVIEW, ARCHIVE: Hold in FlaggedLeads and stop downstream steps
      if (intentVerdict && ["PENDING_CLARIFY", "REVIEW", "ARCHIVE"].includes(intentVerdict.action)) {
        const disposition = intentVerdict.action === "PENDING_CLARIFY"
          ? "pending_clarification"
          : intentVerdict.action === "ARCHIVE"
          ? "archived"
          : "review";

        let flaggedRow: any = null;
        let holdWritten = false;
        if (FlaggedLead) {
          try {
            flaggedRow = await FlaggedLead.create({
              id: randomUUID(),
              payload: req.body,
              source: "email",
              channel: "email",
              ip: req.ip || null,
              reason: intentVerdict.reason,
              disposition,
              intentLabel: intentVerdict.label,
              intentScore: intentVerdict.score,
              explanation: intentVerdict.reason,
              senderEmail: email,
              subject: emailSubject,
              reviewed: false
            });
            holdWritten = true;
          } catch (flagErr: any) {
            console.warn("[emailController] Error creating FlaggedLead record:", flagErr.message);
          }
        }

        if (holdWritten) {
          // Clarification auto-reply (Phase 5)
          if (intentVerdict.action === "PENDING_CLARIFY") {
            try {
              const senderCtx = await getSenderContext(email);
              const shouldReply = await shouldSendClarificationAutoReply(emailMeta, senderCtx);
              if (shouldReply) {
                await sendClarificationAutoReply(email, flaggedRow?.id);
              }
            } catch (replyErr: any) {
              console.warn("[emailController] Auto-reply error:", replyErr.message);
            }
          }

          return res.status(202).json({
            status: intentVerdict.action === "ARCHIVE" ? "archived" : "held",
            message: `Inbound email filtered: ${intentVerdict.action}`,
            action: intentVerdict.action,
            reason: intentVerdict.reason,
            disposition
          });
        }
        // Fall through to normal lead creation if FlaggedLead is missing or write threw
      }
    }

    // In mode=off, mode=shadow (or unheld in enforce mode): Run pipeline directly
    const routingResult = await routeChannelLead({
      channel: "email",
      subject: emailSubject,
      text: emailBody,
      recipientEmail,
      leadData: {
        firstName,
        lastName,
        email,
        phone: "",
        company: "",
        source: "email"
      }
    });

    const { assignedToId, assignmentMethod, isFuzzyNameMatch, matchedNameStr } = routingResult;

    // Scan file attachments through Lead Security Layer (fail-closed ClamAV & MIME inspection)
    const rawFiles = ((req.files as Express.Multer.File[]) || (req.file ? [req.file] : []));
    const safeAttachments: any[] = [];
    const rejectedAttachments: Array<{ filename: string; reason: string }> = [];

    if (rawFiles.length > 0) {
      const { scanAttachments } = require("../lead-security-layer/fileScan");
      for (const file of rawFiles) {
        const scanRes = await scanAttachments([{
          buffer: file.buffer,
          filename: file.originalname || file.fieldname || "attachment"
        }]);

        if (scanRes.clean && scanRes.safeAttachments?.length) {
          safeAttachments.push(scanRes.safeAttachments[0]);
        } else {
          rejectedAttachments.push({
            filename: file.originalname || file.fieldname || "attachment",
            reason: scanRes.reason || "unknown_scan_error"
          });
        }
      }
    }

    const leadId = await ingestLead({
      firstName,
      lastName,
      email,
      phone: "",
      company: "",
      source: "email",
      sourceDetail: emailSubject,
      message: emailBody,
      assignedToId: assignedToId || undefined,
      assignmentMethod: assignmentMethod || undefined,
      recipientEmail: recipientEmail || undefined,
      rawPayload: mode === "enforce"
        ? { subject: emailSubject, body: emailBody, recipientEmail, attachments: safeAttachments, skipIntentGate: true }
        : { subject: emailSubject, body: emailBody, recipientEmail, attachments: safeAttachments }
    });

    // If any attachment was rejected/quarantined, log a high-priority Activity on the lead for operational awareness
    if (leadId && rejectedAttachments.length > 0) {
      try {
        for (const rejected of rejectedAttachments) {
          await Activity.create({
            id: randomUUID(),
            type: "Security Alert",
            outcome: `Attachment Quarantined: File "${rejected.filename}" was blocked by security scan (${rejected.reason}).`,
            leadId: leadId,
            createdById: assignedToId || null,
            pinned: true,
            priority: "High",
            direction: "internal"
          });
        }
      } catch (actErr) {
        console.warn("Failed to log attachment quarantine activity:", actErr);
      }
    }

    if (mode === "enforce" && !leadId) {
      return res.status(202).json({ status: "held_for_review", message: "Held by security verification" });
    }

    // Promote-on-reply check (enforce mode only)
    if (mode === "enforce" && leadId) {
      try {
        await handlePromoteOnReply(email, leadId);
      } catch (promoteErr: any) {
        console.warn("[emailController] Promote-on-reply error:", promoteErr.message);
      }
    }

    // Run Automated Lead Intake & Missing Info Collection Engine for Email
    try {
      await processInboundIntakeEvent({
        channel: "email",
        leadId: leadId || undefined,
        senderEmail: email,
        senderName: `${firstName} ${lastName}`.trim(),
        subject: emailSubject,
        message: emailBody,
        attribution: {
          source: "email",
          sourceChannel: "email",
          sourceDetail: emailSubject
        }
      });
    } catch (intakeErr: any) {
      console.warn("Non-blocking lead intake automation error in emailController:", intakeErr.message);
    }

    // If assigned via fuzzy name-match, log an activity entry for audit transparency
    if (isFuzzyNameMatch && leadId) {
      try {
        await Activity.create({
          id: randomUUID(),
          type: "Assignment Flag",
          outcome: `Fuzzy Name Match: Assigned to '${matchedNameStr}' based on single name mention in email text. Please verify assignment.`,
          leadId: leadId,
          createdById: assignedToId,
          pinned: false,
          priority: "Medium",
          direction: "internal"
        });
      } catch (actErr) {
        console.warn("Failed to create fuzzy match activity log:", actErr);
      }
    }

    // Check for positive quote acceptance intent in inbound email
    try {
      await detectAndFlagQuoteAcceptance({
        leadId: leadId || undefined,
        messageText: `${emailSubject || ""} ${emailBody || ""}`,
        sourceChannel: "EMAIL",
        senderInfo: email
      });
    } catch (flagErr: any) {
      console.warn("Failed to check quote acceptance keywords:", flagErr.message);
    }

    // In mode=shadow: Evaluate gate asynchronously in the background, never delaying or altering the response,
    // and linking the IntentDecisions row to the created leadId
    if (mode === "shadow") {
      setImmediate(async () => {
        try {
          await evaluateInboundEmail("email", emailMeta, emailBody, leadId);
        } catch (gateErr: any) {
          console.warn("[emailController] Shadow gate error:", gateErr.message);
        }
      });
    }

    res.status(201).json({
      message: "Inbound email ingested successfully",
      leadId: leadId,
      dealId: leadId,
      assignedToId,
      assignmentMethod
    });
  } catch (error: any) {
    console.error("Error in receiveInboundEmail webhook:", error);
    res.status(500).json({ error: "Failed to process inbound email" });
  }
};
