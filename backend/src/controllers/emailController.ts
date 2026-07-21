import { Request, Response } from "express";
import { Lead, User, Activity, sequelize } from "@nexus-crm/database";
import { assignLead } from "../services/assignmentEngine";
import { assignLeadToSalesperson } from "../services/leadAssignmentService";
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
  const firstLine = (bodyText || "").split(/\r?\n/)[0] || "";
  const combined = `${subject || ""} ${firstLine}`;
  
  // Look for "Attn: <Name>" or "For <Name>"
  const regex = /\b(?:Attn|For)\s*:?\s*([A-Za-z0-9._-]+)/i;
  const match = combined.match(regex);
  if (match && match[1]) {
    return match[1].trim().toLowerCase();
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
    if (secret) {
      const tokenHeader = req.headers["x-inbound-secret"];
      const tokenQuery = req.query.auth_token;
      if (tokenHeader !== secret && tokenQuery !== secret) {
        return res.status(401).json({ error: "Unauthorized: Invalid or missing INBOUND_EMAIL_SECRET" });
      }
    }

    // Normalize inbound payload fields
    const { from: rawFrom, to: rawTo, subject: emailSubject, text: emailBody } = normalizeInboundPayload(req.body);
    
    if (!rawFrom) {
      return res.status(400).json({ error: "Missing sender information ('from' or 'sender')" });
    }

    const { firstName, lastName, email } = parseSender(rawFrom);
    let assignedToId: string | null = null;
    let recipientEmail: string | null = null;
    let assignmentMethod: string | null = null;
    let isFuzzyNameMatch = false;
    let matchedNameStr = "";

    // Fetch all active whitelisted users once
    const activeUsers = (await User.findAll({
      where: {
        role: { [Op.in]: WHITELIST_ROLES }
      }
    })) as any[];

    if (rawTo) {
      const parsedRecipient = parseSender(rawTo);
      recipientEmail = parsedRecipient.email;

      // -------------------------------------------------------------
      // Check 0: Direct to-address matching (legacy/per-salesperson)
      // -------------------------------------------------------------
      const matchedDirectUser = activeUsers.find(
        (u) => u.email && u.email.toLowerCase() === recipientEmail?.toLowerCase()
      );
      if (matchedDirectUser) {
        assignedToId = matchedDirectUser.id;
        assignmentMethod = "direct-address";
      }

      // -------------------------------------------------------------
      // Check 1: Plus-addressing tag (e.g. face+saud@123.com)
      // -------------------------------------------------------------
      if (!assignedToId) {
        const plusTag = extractPlusTag(recipientEmail || rawTo);
        if (plusTag) {
          const matchedPlusUser = activeUsers.find((u) => {
            if (u.emailAlias && u.emailAlias.toLowerCase() === plusTag) return true;
            const firstName = u.name.split(" ")[0].toLowerCase();
            const fullNameNoSpaces = u.name.replace(/\s+/g, "").toLowerCase();
            return plusTag === firstName || plusTag === fullNameNoSpaces;
          });

          if (matchedPlusUser) {
            assignedToId = matchedPlusUser.id;
            assignmentMethod = "plus-tag";
          }
        }
      }
    }

    // -------------------------------------------------------------
    // Check 2: Explicit "Attn:" / "For:" convention
    // -------------------------------------------------------------
    if (!assignedToId) {
      const attnTarget = extractAttnName(emailSubject, emailBody);
      if (attnTarget) {
        const matchedAttnUser = activeUsers.find((u) => {
          const uFirst = u.name.split(" ")[0].toLowerCase();
          const uFull = u.name.toLowerCase();
          const uAlias = (u.emailAlias || "").toLowerCase();
          return attnTarget === uFirst || attnTarget === uFull || (uAlias && attnTarget === uAlias);
        });

        if (matchedAttnUser) {
          assignedToId = matchedAttnUser.id;
          assignmentMethod = "attn-tag";
        }
      }
    }

    // -------------------------------------------------------------
    // Check 3: Whole-word case-insensitive name mention scan
    // -------------------------------------------------------------
    if (!assignedToId) {
      const combinedText = `${emailSubject} ${emailBody}`;
      const nameMatches: any[] = [];

      for (const u of activeUsers) {
        const firstName = u.name.split(" ")[0];
        const fullName = u.name;

        // Whole word regex matching
        const firstNameRegex = new RegExp(`\\b${firstName}\\b`, "i");
        const fullNameRegex = new RegExp(`\\b${fullName}\\b`, "i");

        if (firstNameRegex.test(combinedText) || fullNameRegex.test(combinedText)) {
          if (!nameMatches.some((m) => m.id === u.id)) {
            nameMatches.push(u);
          }
        }
      }

      if (nameMatches.length === 1) {
        // Exactly one confident match
        assignedToId = nameMatches[0].id;
        assignmentMethod = "name-match";
        isFuzzyNameMatch = true;
        matchedNameStr = nameMatches[0].name;
      }
      // If nameMatches.length > 1, treat as ambiguous and fall through to Check 4
    }

    // -------------------------------------------------------------
    // Check 4: Genuine Least-Workload Fallback
    // -------------------------------------------------------------
    if (!assignedToId) {
      // Respect isAvailable: true for least-workload distribution
      const availableCandidates = activeUsers.filter((u) => u.isAvailable !== false);

      if (availableCandidates.length > 0) {
        const candidateWorkloads: { user: any; openCount: number }[] = [];

        for (const candidate of availableCandidates) {
          const openCount = await Lead.count({
            where: {
              assignedToId: candidate.id,
              status: { [Op.notIn]: TERMINAL_LEAD_STATUSES }
            }
          });
          candidateWorkloads.push({ user: candidate, openCount });
        }

        // Sort by openCount ASC, break ties deterministically by ID ASC
        candidateWorkloads.sort((a, b) => {
          if (a.openCount !== b.openCount) {
            return a.openCount - b.openCount;
          }
          return a.user.id.localeCompare(b.user.id);
        });

        assignedToId = candidateWorkloads[0].user.id;
        assignmentMethod = "least-workload";
      }
    }

    // -------------------------------------------------------------
    // Check 5: Emergency Legacy Assignment Engine Fallback
    // -------------------------------------------------------------
    if (!assignedToId) {
      assignedToId = await assignLead({
        firstName,
        lastName,
        email,
        phone: "",
        company: "",
        source: "email"
      });
      if (assignedToId) {
        assignmentMethod = "legacy-rules";
      }
    }

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
