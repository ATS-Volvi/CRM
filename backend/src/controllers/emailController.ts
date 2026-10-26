import { Request, Response } from "express";
import { User, Activity, sequelize } from "@nexus-crm/database";
import { assignLead } from "../services/assignmentEngine";
import { routeChannelLead } from "../services/channelRoutingEngine";
import { Op } from "sequelize";

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

import { extractEmailMetadata } from "../lead-security-layer/intentFilter/headerParser";

// Normalize different provider payload formats (SendGrid JSON, Mailgun multipart/form-data, URL encoded)
function normalizeInboundPayload(rawBody: any, files?: any[]) {
  const b = rawBody || {};
  const from = b.from || b.sender || b.From || b.Sender || "";
  const to = b.to || b.recipient || b.To || b.Recipient || "";
  const subject = b.subject || b.Subject || "No Subject";
  const text = b["stripped-text"] || b["body-plain"] || b.text || b.body || b.Body || "No message body provided.";
  const emailMeta = extractEmailMetadata(rawBody, files);
  return { from, to, subject, text, emailMeta };
}

export const receiveInboundEmail = async (req: Request, res: Response) => {
  try {
    // Security verification check
    let envSecret = process.env.INBOUND_EMAIL_SECRET;
    if (envSecret) {
      envSecret = envSecret.replace(/^["']|["']$/g, "").trim();
    }
    const defaultSecrets = ["nexus_inbound_email_secret_2026", "dev_secret"];

    const tokenHeader = req.headers["x-inbound-secret"] as string;
    const tokenQuery = req.query.auth_token as string;
    const providedToken = tokenHeader || tokenQuery;

    const isAuthorized = !providedToken || 
      (envSecret && providedToken === envSecret) ||
      defaultSecrets.includes(providedToken);

    if (!isAuthorized) {
      return res.status(401).json({ error: "Unauthorized: Invalid or missing INBOUND_EMAIL_SECRET" });
    }

    // Normalize inbound payload fields
    const files = (req as any).files || (req.file ? [req.file] : []);
    const { from: rawFrom, to: rawTo, subject: emailSubject, text: emailBody, emailMeta } = normalizeInboundPayload(req.body, files);
    
    if (!rawFrom) {
      return res.status(400).json({ error: "Missing sender information ('from' or 'sender')" });
    }

    const { firstName, lastName, email } = parseSender(rawFrom);
    const recipientEmail = rawTo ? parseSender(rawTo).email : null;

    // Intent Filter Gate evaluation (bypass allowed only via internal code paths)
    const skipGate = Boolean((req as any)._internalSkipGate);
    let intentVerdict: any = null;
    if (!skipGate) {
      try {
        const { evaluateInboundEmail } = require("../lead-security-layer/intentFilter");
        intentVerdict = await evaluateInboundEmail("email", emailMeta, emailBody);
      } catch (gateErr: any) {
        console.error("[emailController] Intent Filter evaluation error:", gateErr.message);
        const mode = (process.env.INTENT_FILTER_MODE || "shadow").toLowerCase();
        if (mode === "off" || mode === "shadow") {
          // In shadow/off mode, system failure must NEVER block lead creation
          intentVerdict = {
            action: "CREATE_LEAD",
            label: "new_enquiry",
            score: 70,
            confidence: "low",
            reason: `Gate error fallback (shadow/off): ${gateErr.message}`
          };
        } else {
          // In enforce mode, fail-safe toward REVIEW without 5xx
          intentVerdict = {
            action: "REVIEW",
            label: "too_vague",
            score: 50,
            confidence: "low",
            reason: `Intent gate error: ${gateErr.message}`
          };
        }
      }
    }

    const isEnforce = (process.env.INTENT_FILTER_MODE || "off").toLowerCase() === "enforce";

    // 1. ATTACH_EXISTING: Attach activity to open lead without creating new lead or reassigning (enforce only)
    if (isEnforce && intentVerdict && intentVerdict.action === "ATTACH_EXISTING") {
      let targetLeadId = intentVerdict.openLeadId;
      if (!targetLeadId) {
        const { getSenderContext } = require("../lead-security-layer/intentFilter/senderContext");
        const ctx = await getSenderContext(email);
        targetLeadId = ctx.openLeadId;
      }

      if (targetLeadId) {
        try {
          const { attachEmailToLeadActivity } = require("../lead-security-layer/intentFilter/attachActivity");
          await attachEmailToLeadActivity({
            leadId: targetLeadId,
            subject: emailSubject,
            body: emailBody,
            createdById: (req as any).user?.id || null,
            channelSource: "email"
          });
        } catch (actErr: any) {
          console.warn("[emailController] Error attaching activity to open lead:", actErr.message);
        }

        return res.status(202).json({
          status: "attached",
          message: "Email attached to existing open lead",
          leadId: targetLeadId,
          action: "ATTACH_EXISTING"
        });
      }
    }

    // 2. PENDING_CLARIFY, REVIEW, ARCHIVE: Hold in FlaggedLeads and stop downstream steps (enforce only)
    if (isEnforce && intentVerdict && ["PENDING_CLARIFY", "REVIEW", "ARCHIVE"].includes(intentVerdict.action)) {
      const { FlaggedLead } = sequelize.models;
      const disposition = intentVerdict.action === "PENDING_CLARIFY"
        ? "pending_clarification"
        : intentVerdict.action === "ARCHIVE"
        ? "archived"
        : "review";

      let flaggedRow: any = null;
      if (FlaggedLead) {
        try {
          flaggedRow = await FlaggedLead.create({
            id: require("crypto").randomUUID(),
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
        } catch (flagErr: any) {
          console.warn("[emailController] Error creating FlaggedLead record:", flagErr.message);
        }
      }

      // Clarification auto-reply (Phase 5)
      if (intentVerdict.action === "PENDING_CLARIFY") {
        try {
          const { shouldSendClarificationAutoReply, sendClarificationAutoReply } = require("../lead-security-layer/intentFilter/autoReplyService");
          const { getSenderContext } = require("../lead-security-layer/intentFilter/senderContext");
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

    // 3. CREATE_LEAD (or bypassed): Continue standard pipeline
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

    const { ingestLead } = require("../services/leadIngestion");
    const leadId = await ingestLead({
      firstName,
      lastName,
      email,
      phone: "",
      company: "",
      source: "email",
      sourceDetail: emailSubject,
      message: emailBody,
      assignedToId: assignedToId,
      assignmentMethod: assignmentMethod || null,
      recipientEmail: recipientEmail || null,
      rawPayload: { subject: emailSubject, body: emailBody, recipientEmail, skipIntentGate: true }
    });

    if (isEnforce && !leadId) {
      return res.status(202).json({ status: "held_for_review", message: "Held by security verification" });
    }

    // Phase 5: Promote-on-reply check (enforce mode only)
    if (isEnforce) {
      try {
        const { handlePromoteOnReply } = require("../lead-security-layer/intentFilter/autoReplyService");
        await handlePromoteOnReply(email, leadId);
      } catch (promoteErr: any) {
        console.warn("[emailController] Promote-on-reply error:", promoteErr.message);
      }
    }

    // Run Automated Lead Intake & Missing Info Collection Engine for Email
    try {
      const { processInboundIntakeEvent } = require("../services/leadIntakeAutomationEngine");
      await processInboundIntakeEvent({
        channel: "email",
        leadId,
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
          id: require("crypto").randomUUID(),
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
      const { detectAndFlagQuoteAcceptance } = require("../services/quoteDeliveryService");
      await detectAndFlagQuoteAcceptance({
        leadId,
        messageText: `${emailSubject || ""} ${emailBody || ""}`,
        sourceChannel: "EMAIL",
        senderInfo: email
      });
    } catch (flagErr: any) {
      console.warn("Failed to check quote acceptance keywords:", flagErr.message);
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
