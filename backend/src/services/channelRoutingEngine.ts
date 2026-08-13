import { Deal, User } from "@nexus-crm/database";
import { Op } from "sequelize";
import { assignLead } from "./assignmentEngine";

const WHITELIST_ROLES = ["sales_rep", "sales_manager", "admin", "director"];
const TERMINAL_LEAD_STATUSES = ["Won", "Lost", "Closed", "Closed Won", "Closed Lost"];

// Extract explicit "Attn:" or "For:" prefix convention from subject or first line of body
export function extractAttnName(subject?: string | null, bodyText?: string | null): string | null {
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

// Extract plus tag from email address (e.g. face+saud@123.com -> saud)
export function extractPlusTag(emailStr?: string | null): string | null {
  if (!emailStr) return null;
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

export interface RoutingInput {
  channel: "email" | "instagram" | string;
  subject?: string | null;
  text?: string | null;
  recipientEmail?: string | null;
  leadData: {
    firstName: string;
    lastName: string;
    email?: string | null;
    phone?: string | null;
    company?: string | null;
    source: string;
  };
}

export interface RoutingResult {
  assignedToId: string | null;
  assignmentMethod: string | null;
  isFuzzyNameMatch: boolean;
  matchedNameStr: string;
}

/**
 * Shared channel-agnostic routing engine used by both Email and Instagram channels.
 */
export async function routeChannelLead(input: RoutingInput): Promise<RoutingResult> {
  const { channel, subject = "", text = "", recipientEmail = null, leadData } = input;
  const combinedText = `${subject || ""} ${text || ""}`.trim();

  let assignedToId: string | null = null;
  let assignmentMethod: string | null = null;
  let isFuzzyNameMatch = false;
  let matchedNameStr = "";

  // Fetch all active whitelisted users once
  const activeUsers = (await User.findAll({
    where: {
      role: { [Op.in]: WHITELIST_ROLES }
    }
  })) as any[];

  // -------------------------------------------------------------
  // Priority 0 & 1: Direct-address & Plus-tag matching (EMAIL ONLY)
  // -------------------------------------------------------------
  if (channel === "email" && recipientEmail) {
    // Check 0: Direct to-address matching
    const matchedDirectUser = activeUsers.find(
      (u) => u.email && u.email.toLowerCase() === recipientEmail.toLowerCase()
    );
    if (matchedDirectUser) {
      assignedToId = matchedDirectUser.id;
      assignmentMethod = "direct-address";
    }

    // Check 1: Plus-addressing tag (e.g. face+saud@123.com)
    if (!assignedToId) {
      const plusTag = extractPlusTag(recipientEmail);
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
  // Priority 2: Explicit "Attn:" / "For:" convention
  // -------------------------------------------------------------
  if (!assignedToId) {
    const attnTarget = extractAttnName(subject, text);
    if (attnTarget) {
      const matchedAttnUser = activeUsers.find((u) => {
        const uFirst = u.name.split(" ")[0].toLowerCase();
        const uFull = u.name.toLowerCase();
        const uAlias = (u.emailAlias || "").toLowerCase();
        const uEmail = (u.email || "").toLowerCase();
        return (
          attnTarget === uFirst ||
          attnTarget === uFull ||
          attnTarget === uEmail ||
          (uAlias && attnTarget === uAlias) ||
          attnTarget.startsWith(uFirst) ||
          attnTarget.startsWith(uFull)
        );
      });

      if (matchedAttnUser) {
        assignedToId = matchedAttnUser.id;
        assignmentMethod = "attn-tag";
      }
    }
  }

  // -------------------------------------------------------------
  // Priority 2b: Email address scan in subject/body (EMAIL ONLY)
  // -------------------------------------------------------------
  if (!assignedToId && channel === "email") {
    const emailMentionRegex = /\b([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})\b/g;
    let match;
    while ((match = emailMentionRegex.exec(combinedText)) !== null) {
      const mentionedEmail = match[1].toLowerCase();
      const foundUser = activeUsers.find(
        (u) => u.email && u.email.toLowerCase() === mentionedEmail
      );
      if (foundUser) {
        assignedToId = foundUser.id;
        assignmentMethod = "attn-tag";
        break;
      }
    }
  }

  // -------------------------------------------------------------
  // Priority 3: Whole-word case-insensitive name mention scan
  // -------------------------------------------------------------
  if (!assignedToId) {
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
    // If nameMatches.length > 1, treat as ambiguous and fall through
  }

  // -------------------------------------------------------------
  // Priority 4: Criteria-Based Assignment Rules Engine
  // -------------------------------------------------------------
  if (!assignedToId) {
    const rulesRes = await assignLead({
      firstName: leadData.firstName,
      lastName: leadData.lastName,
      email: leadData.email || "",
      phone: leadData.phone || "",
      company: leadData.company || "",
      source: leadData.source
    });
    if (rulesRes.assignedToId) {
      assignedToId = rulesRes.assignedToId;
      assignmentMethod = "assignment-rules";
    }
  }

  // -------------------------------------------------------------
  // Priority 5: Least-Workload Fallback
  // -------------------------------------------------------------
  if (!assignedToId) {
    const availableCandidates = activeUsers.filter((u) => u.isAvailable !== false);

    if (availableCandidates.length > 0) {
      const candidateWorkloads: { user: any; openCount: number }[] = [];

      for (const candidate of availableCandidates) {
        const openCount = await Deal.count({
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

  return {
    assignedToId,
    assignmentMethod,
    isFuzzyNameMatch,
    matchedNameStr
  };
}
