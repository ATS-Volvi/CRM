import { Request, Response } from "express";
import { Lead, User, Activity, sequelize } from "@nexus-crm/database";
import { assignLead } from "../services/assignmentEngine";
import { assignLeadToSalesperson } from "../services/leadAssignmentService";
import { routeChannelLead } from "../services/channelRoutingEngine";
import { Op } from "sequelize";

const WHITELIST_ROLES = ["sales_rep", "sales_manager", "admin", "director"];
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
function normalizeInboundPayload(rawBody: any) {
  const b = rawBody || {};
  const from = b.from || b.sender || b.From || b.Sender || "";
  const to = b.to || b.recipient || b.To || b.Recipient || "";
  const subject = b.subject || b.Subject || "No Subject";
  const text = b["stripped-text"] || b["body-plain"] || b.text || b.body || b.Body || "No message body provided.";
  return { from, to, subject, text };
}

export const receiveInboundEmail = async (req: Request, res: Response) => {
  try {
    // Security verification check
    const secret = process.env.INBOUND_EMAIL_SECRET;
    const tokenHeader = req.headers["x-inbound-secret"];
    const tokenQuery = req.query.auth_token;

    if (!secret) {
      console.error("CRITICAL: INBOUND_EMAIL_SECRET is not set — inbound email webhook is rejecting all requests until this is configured.");
      return res.status(401).json({ error: "Unauthorized: Invalid or missing INBOUND_EMAIL_SECRET" });
    }

    if (tokenHeader !== secret && tokenQuery !== secret) {
      return res.status(401).json({ error: "Unauthorized: Invalid or missing INBOUND_EMAIL_SECRET" });
    }

    // Normalize inbound payload fields
    const { from: rawFrom, to: rawTo, subject: emailSubject, text: emailBody } = normalizeInboundPayload(req.body);
    
    if (!rawFrom) {
      return res.status(400).json({ error: "Missing sender information ('from' or 'sender')" });
    }

    const { firstName, lastName, email } = parseSender(rawFrom);
    const recipientEmail = rawTo ? parseSender(rawTo).email : null;

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

    const lead = await Lead.create({
      firstName,
      lastName,
      email,
      phone: "",
      company: "",
      source: "email",
      status: "New Lead",
      subject: emailSubject,
      body: emailBody,
      assignedToId: null,
      recipientEmail,
      assignmentMethod
    });

    if (assignedToId) {
      await assignLeadToSalesperson(lead, assignedToId);
    }

    // If assigned via fuzzy name-match, log an activity entry for audit transparency
    if (isFuzzyNameMatch && (lead as any).id) {
      try {
        await Activity.create({
          type: "Assignment Flag",
          outcome: `Fuzzy Name Match: Assigned to '${matchedNameStr}' based on single name mention in email text. Please verify assignment.`,
          leadId: (lead as any).id,
          createdById: assignedToId,
          pinned: false,
          priority: "Medium"
        });
      } catch (actErr) {
        console.warn("Failed to create fuzzy match activity log:", actErr);
      }
    }

    res.status(201).json({
      message: "Inbound email ingested successfully",
      leadId: (lead as any).id,
      assignedToId,
      assignmentMethod
    });
  } catch (error: any) {
    console.error("Error in receiveInboundEmail webhook:", error);
    res.status(500).json({ error: "Failed to process inbound email" });
  }
};
