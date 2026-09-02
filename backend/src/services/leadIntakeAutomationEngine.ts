import { sequelize } from "@nexus-crm/database";
import { Op } from "sequelize";
import crypto from "crypto";
import { assignDeal } from "./assignmentEngine";
import { createNotification } from "./notificationService";
import { sendWhatsAppMessage } from "./whatsappService";
import { sendCustomEmail } from "./emailService";

export interface IntakeEvent {
  channel: "whatsapp" | "email" | "website";
  eventId?: string;
  leadId?: string;
  senderPhone?: string;
  senderEmail?: string;
  senderName?: string;
  message?: string;
  subject?: string;
  formData?: {
    firstName?: string;
    lastName?: string;
    company?: string;
    email?: string;
    phone?: string;
    requirement?: string;
    preferredCommunicationChannel?: string;
  };
  attribution?: {
    source?: string;
    sourceType?: string;
    sourceChannel?: string;
    sourceName?: string;
    sourceDetail?: string;
    campaign?: string;
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    utmTerm?: string;
    utmContent?: string;
    referrer?: string;
    landingPage?: string;
  };
}

export interface MissingInfoResult {
  isComplete: boolean;
  missing: ("name" | "company" | "email" | "phone" | "requirement")[];
  known: {
    name?: string;
    company?: string;
    email?: string;
    phone?: string;
    requirement?: string;
  };
  verified: {
    email: boolean;
    phone: boolean;
    whatsapp: boolean;
  };
}

export interface ParsedResponse {
  firstName?: string;
  lastName?: string;
  companyName?: string;
  email?: string;
  phone?: string;
  requirement?: string;
  quantity?: number;
  context?: string;
}

/**
 * Standard required contact information checker.
 * Evaluates whether required fields are present on Lead and linked Contact/Account.
 */
export async function getMissingLeadInformation(leadOrId: any): Promise<MissingInfoResult> {
  const { Lead, Contact, Account } = sequelize.models;
  let lead: any = null;

  if (typeof leadOrId === "string") {
    lead = await Lead.findByPk(leadOrId);
  } else if (leadOrId && leadOrId.id) {
    lead = leadOrId;
  } else {
    lead = leadOrId || {};
  }

  // Also check linked contact if available
  let contact: any = null;
  if (lead && lead.email && Contact) {
    contact = await Contact.findOne({
      where: {
        [Op.or]: [
          { email: { [Op.like]: lead.email } },
          ...(lead.phone ? [{ phone: { [Op.like]: `%${lead.phone.replace(/\D/g, "").slice(-10)}%` } }] : [])
        ]
      }
    });
  }

  const known: MissingInfoResult["known"] = {};
  const verified: MissingInfoResult["verified"] = {
    email: Boolean(contact?.emailVerified || lead?.emailVerified),
    phone: Boolean(contact?.phoneVerified || lead?.phoneVerified),
    whatsapp: Boolean(contact?.whatsappVerified || lead?.whatsappVerified)
  };

  // 1. Name Check
  const firstName = lead?.firstName || contact?.firstName || "";
  const lastName = lead?.lastName || contact?.lastName || "";
  const fullName = `${firstName} ${lastName}`.trim();
  const isGenericName = !fullName || /^(unknown|lead|contact|customer|whatsapp user|whatsapp lead|whatsapp|new lead|individual prospect)$/i.test(fullName);
  if (!isGenericName && firstName && lastName && !/^(whatsapp|lead|new)$/i.test(firstName)) {
    known.name = fullName;
  } else if (!isGenericName && firstName && !/^(whatsapp|lead|new)$/i.test(firstName)) {
    known.name = firstName;
  } else if (lead?.company && !/^(pending|pending identification|unknown|general)$/i.test(lead.company) && (lead?.email || contact?.email) && (lead?.phone || lead?.whatsappPhone || contact?.phone)) {
    known.name = `${lead.company} Contact`;
  }

  // 2. Company Check
  const company = lead?.company || contact?.companyName || "";
  const isGenericCompany = !company || /^(unknown|general|tbd|n\/a|none|pending|pending identification)$/i.test(company.trim());
  if (!isGenericCompany) {
    known.company = company.trim();
  }

  // 3. Email Check
  const email = lead?.email || contact?.email || "";
  const isPlaceholderEmail = !email || email.includes("unknown_wa_") || email.includes("@nexus-temp.com") || !email.includes("@");
  if (!isPlaceholderEmail) {
    known.email = email.trim().toLowerCase();
  }

  // 4. Phone / WhatsApp Check
  const phone = lead?.phone || lead?.whatsappPhone || contact?.phone || contact?.whatsappNumber || "";
  const cleanPhone = phone.replace(/\D/g, "");
  if (cleanPhone.length >= 7) {
    known.phone = phone.trim();
  }

  // 5. Requirement Check
  const rawReq = lead?.extractedRequirement || lead?.message || lead?.body || lead?.subject || "";
  const reqStr = typeof rawReq === "string" ? rawReq : (rawReq.item || rawReq.requirement || JSON.stringify(rawReq));
  if (reqStr && reqStr.trim().length > 3 && !/^(hi|hello|hey|test)$/i.test(reqStr.trim())) {
    known.requirement = typeof rawReq === "object" ? rawReq.item || reqStr : reqStr.trim();
  }

  const missing: MissingInfoResult["missing"] = [];
  if (!known.name) missing.push("name");
  if (!known.company) missing.push("company");
  if (!known.email) missing.push("email");
  if (!known.phone) missing.push("phone");
  if (!known.requirement) missing.push("requirement");

  return {
    isComplete: missing.length === 0,
    missing,
    known,
    verified
  };
}

const NAME_STOPLIST = new Set([
  "interested", "looking", "needing", "wanting", "contacting", "reaching",
  "hello", "hi", "hey", "services", "help", "information", "quote", "pricing",
  "inquiry", "enquiry", "user", "lead", "new", "prospect", "whatsapp",
  "customer", "client", "thanks", "thank", "please", "regarding", "inbound",
  "option", "options", "details", "contact", "support"
]);

function isSanitizedNamePart(word: string): boolean {
  if (!word || word.length < 2) return false;
  return !NAME_STOPLIST.has(word.toLowerCase());
}

function sanitizeGreetingName(name?: string): string | null {
  if (!name) return null;
  const trimmed = name.trim();
  if (!trimmed || trimmed.length === 0) return null;

  const words = trimmed.split(/\s+/);
  if (words.length > 3) return null;
  if (trimmed === trimmed.toLowerCase() && trimmed.length > 3) return null;
  if (words.some(w => NAME_STOPLIST.has(w.toLowerCase()))) return null;
  if (/^(whatsapp|lead|new|customer|unknown|whatsapp lead|user)$/i.test(trimmed)) return null;

  return words[0];
}

/**
 * Natural language conversational generator for missing fields.
 * Asks ONLY for what is currently missing without repeated redundant requests.
 */
export function generateCollectionMessage(
  missingFields: ("name" | "company" | "email" | "phone" | "requirement")[],
  channel: "whatsapp" | "email" | "website",
  contactName?: string
): string {
  const cleanName = sanitizeGreetingName(contactName);
  const greeting = cleanName ? `Hi ${cleanName}!` : "Hi!";

  const needsEmail = missingFields.includes("email");
  const needsPhone = missingFields.includes("phone");

  // Format list of missing human-readable field labels
  const fieldLabels: Record<string, string> = {
    email: "email address",
    phone: "phone number",
    name: "full name",
    company: "company name",
    requirement: "requirements"
  };

  // Ensure email and phone are ordered first
  const sortedMissing = [...missingFields].sort((a, b) => {
    const priority = { email: 1, phone: 2, name: 3, company: 4, requirement: 5 };
    return (priority[a] || 99) - (priority[b] || 99);
  });

  const labels = sortedMissing.map(f => fieldLabels[f] || f);

  let formattedList = "";
  if (labels.length === 1) {
    formattedList = `your ${labels[0]}`;
  } else if (labels.length === 2) {
    formattedList = `your ${labels[0]} and ${labels[1]}`;
  } else {
    const allButLast = labels.slice(0, -1).join(", ");
    formattedList = `your ${allButLast}, and ${labels[labels.length - 1]}`;
  }

  if (channel === "whatsapp") {
    if (needsEmail) {
      return `${greeting} Thanks for contacting Nexus. All quotations and proposals are delivered via email. Could you please share your email address and phone number (as well as ${labels.filter(l => l !== "email address" && l !== "phone number").join(" and ") || "your requirements"}) so we can send your quote?`;
    }
    if (missingFields.length === 1 && missingFields[0] === "requirement") {
      return `${greeting} Thanks for reaching out. Could you share what product or service requirements you are looking for so we can connect you with the right specialist?`;
    }
    return `${greeting} Thanks for contacting us. To help us process your quotation and connect you with a specialist, could you please share ${formattedList}?`;
  }

  if (channel === "email") {
    if (needsPhone) {
      return `${greeting} Thanks for contacting us. To help our sales team process your quotation and reach you quickly, could you please share your phone number and contact details?`;
    }
    return `${greeting} Thanks for reaching out. To help our team assist you with your enquiry, could you please provide ${formattedList}?`;
  }

  // Website prompt
  return `Please share your email address and phone number so our team can send your quotation and assist you quickly.`;
}

/**
 * Generates automated acknowledgement message once all details are complete.
 */
export function generateAcknowledgementMessage(
  channel: "whatsapp" | "email" | "website",
  contactName?: string
): { subject?: string; body: string } {
  const cleanName = sanitizeGreetingName(contactName);
  const namePart = cleanName ? `, ${cleanName}` : "";

  if (channel === "whatsapp") {
    return {
      body: `Thanks${namePart}! We've received your enquiry. A sales specialist will get back to you shortly.`
    };
  }

  if (channel === "email") {
    return {
      subject: "We've received your enquiry",
      body: `Thank you for contacting us${namePart}. We've received your enquiry and our sales team will review it shortly.`
    };
  }

  return {
    body: `Hi${namePart}, thanks for contacting Nexus Automation Systems. We've received your enquiry and our sales team will get back to you shortly.`
  };
}

/**
 * Natural language parser for extracting customer contact and requirement details.
 */
export function parseInboundCustomerResponse(text: string, channel?: string): ParsedResponse {
  if (!text) return {};

  const clean = text.trim();
  const result: ParsedResponse = {};

  // 1. Email extraction (handles standard email, labeled formats, and common variations)
  const labeledEmailMatch = clean.match(/(?:email\s*(?:is|:)?\s*|mail\s*[:\-])\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
  if (labeledEmailMatch) {
    result.email = labeledEmailMatch[1].toLowerCase().trim();
  } else {
    const standardEmailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i;
    const emailMatch = clean.match(standardEmailRegex);
    if (emailMatch) {
      result.email = emailMatch[1].toLowerCase().trim();
    } else {
      // Obfuscated email fallback: user at domain dot com or user[at]domain[dot]com
      const obfuscatedMatch = clean.match(/([a-zA-Z0-9._%+-]+)\s*(?:@|\[at\]|\bat\b)\s*([a-zA-Z0-9.-]+)\s*(?:\.|\bdot\b|\[dot\])\s*([a-zA-Z]{2,})/i);
      if (obfuscatedMatch) {
        result.email = `${obfuscatedMatch[1]}@${obfuscatedMatch[2]}.${obfuscatedMatch[3]}`.toLowerCase().trim();
      }
    }
  }

  // 2. Phone extraction
  const phoneRegex = /(?:\+?\d{1,3}[\s-]?)?\(?\d{2,4}\)?[\s.-]?\d{3,5}[\s.-]?\d{3,5}/g;
  const phoneMatches = clean.match(phoneRegex);
  if (phoneMatches) {
    for (const pm of phoneMatches) {
      const digits = pm.replace(/\D/g, "");
      if (digits.length >= 7 && digits.length <= 15 && (!result.email || !result.email.includes(digits))) {
        result.phone = pm.trim();
        break;
      }
    }
  }

  // 3. Name extraction patterns (strict self-identification & stoplist validation)
  const namePatterns = [
    /(?:my name is|this is|i am|i'm|name\s*[:\-])\s*([A-Za-z]+(?:\s+[A-Za-z]+)?)/i,
    /^([A-Za-z]+(?:\s+[A-Za-z]+)?)\s*,\s*(?:i work at|from|at)\b/i
  ];
  for (const pat of namePatterns) {
    const match = clean.match(pat);
    if (match && match[1]) {
      const parts = match[1].trim().split(/\s+/);
      if (parts.every(isSanitizedNamePart)) {
        result.firstName = parts[0];
        if (parts.length > 1) {
          result.lastName = parts.slice(1).join(" ");
        }
        break;
      }
    }
  }

  // 4. Company extraction patterns
  const companyPatterns = [
    /(?:my\s+company\s+(?:is|name\s+is)?|our\s+company\s+(?:is|name\s+is)?|company\s+name\s*(?:is|:)?|company\s*(?:is|:|\-)?)\s*([A-Za-z0-9&.,' -]+?)(?:\s*[\.\,\;\!\n]|\s+and\s+my|\s+my\s+|\s+email|\s+phone|\s+i\s+need|\s*$)/i,
    /(?:work\s+at|employed\s+at|representing|from)\s+([A-Z0-9][A-Za-z0-9&.,' -]+?)(?:\s*[\.\,\;\!\n]|\s+and\s+my|\s+my\s+|\s+email|\s+phone|\s+i\s+need|\s*$)/i
  ];
  for (const cpat of companyPatterns) {
    const cmatch = clean.match(cpat);
    if (cmatch && cmatch[1]) {
      let compCandidate = cmatch[1].trim().replace(/[\.\,\;\!\-]+$/, "").trim();
      if (compCandidate && !/^(the|a|an|home|office|work|my|our|email|phone|requirement|services|information|pricing|quote)$/i.test(compCandidate) && compCandidate.length > 2) {
        result.companyName = compCandidate;
        break;
      }
    }
  }

  // 5. Requirement, Quantity & Context Extraction
  const qtyMatch = clean.match(/(\d+)\s*(?:[A-Za-z0-9_-]+\s+)?(?:units?|pcs?|panels?|licenses?|sets?|items?|sensors?|switches?|nodes?)/i);
  if (qtyMatch) {
    result.quantity = parseInt(qtyMatch[1], 10);
  }

  const contextMatch = clean.match(/(?:for\s+(?:our|the|a)?\s*)([A-Za-z0-9\s]+?(?:plant\s+expansion|expansion|plant|factory|warehouse|project|office|facility|datacenter|deployment))/i);
  if (contextMatch) {
    result.context = contextMatch[1].trim();
  }

  const reqMatch = clean.match(/(?:need|looking for|require|quote for|pricing for|interested in)\s+([A-Za-z0-9\s,.-]+?)(?:\s+for\s+|\s*\.|\s*$)/i);
  if (reqMatch && reqMatch[1]) {
    result.requirement = reqMatch[1].trim();
  } else if (!result.requirement && clean.length > 10 && !result.firstName && !result.email) {
    result.requirement = clean;
  }

  return result;
}

/**
 * Main cross-channel Automated Lead Intake & Missing Info Collection Engine.
 */
export async function processInboundIntakeEvent(event: IntakeEvent): Promise<{
  leadId: string;
  intakeStatus: string;
  isComplete: boolean;
  assignedToId?: string | null;
  messageSent?: string | null;
  isDuplicateEvent?: boolean;
}> {
  const { Lead, Contact, Account, Activity } = sequelize.models;

  // 1. Idempotency Check
  if (event.eventId) {
    const existingProcessedLead = await Lead.findOne({
      where: { lastProcessedEventId: event.eventId }
    }) as any;
    if (existingProcessedLead) {
      return {
        leadId: existingProcessedLead.id,
        intakeStatus: existingProcessedLead.intakeStatus || "ASSIGNED",
        isComplete: existingProcessedLead.intakeStatus !== "INCOMPLETE" && existingProcessedLead.intakeStatus !== "COLLECTING_DETAILS",
        assignedToId: existingProcessedLead.assignedToId,
        isDuplicateEvent: true
      };
    }
  }

  // 2. Parse Incoming Payload or Text
  const parsed = parseInboundCustomerResponse(event.message || "", event.channel);

  // Merge with any structured formData
  const effectiveFirstName = event.formData?.firstName || parsed.firstName || event.senderName?.split(" ")[0] || "";
  const effectiveLastName = event.formData?.lastName || parsed.lastName || (event.senderName?.includes(" ") ? event.senderName.split(" ").slice(1).join(" ") : "") || "";
  const effectiveEmail = event.formData?.email || parsed.email || event.senderEmail || "";
  const effectivePhone = event.formData?.phone || parsed.phone || event.senderPhone || "";
  const effectiveCompany = event.formData?.company || parsed.companyName || "";
  const effectiveRequirement = event.formData?.requirement || parsed.requirement || event.message || "";

  // 3. Identity Resolution (Find existing Contact & Account)
  let contact: any = null;
  let account: any = null;
  const cleanPhone = effectivePhone.replace(/\D/g, "");

  if (Contact) {
    if (effectiveEmail && effectiveEmail.includes("@")) {
      contact = await Contact.findOne({
        where: { email: { [Op.like]: effectiveEmail.trim() } }
      });
    }
    if (!contact && cleanPhone.length >= 7) {
      contact = await Contact.findOne({
        where: {
          [Op.or]: [
            { phone: { [Op.like]: `%${cleanPhone.slice(-10)}%` } },
            { whatsappNumber: { [Op.like]: `%${cleanPhone.slice(-10)}%` } }
          ]
        }
      });
    }
  }

  // Account resolution
  if (Account) {
    if (effectiveCompany) {
      account = await Account.findOne({
        where: { name: { [Op.like]: effectiveCompany.trim() } }
      });
    } else if (contact && contact.accountId) {
      account = await Account.findByPk(contact.accountId);
    }
  }

  // 4. Find or Create Lead
  let lead: any = null;

  if (event.leadId) {
    lead = await Lead.findByPk(event.leadId);
  }

  if (!lead && contact) {
    // Search open lead for this contact
    lead = await Lead.findOne({
      where: {
        [Op.or]: [
          ...(contact.email ? [{ email: contact.email }] : []),
          ...(contact.phone ? [{ phone: contact.phone }] : [])
        ],
        status: { [Op.in]: ["NEW", "CONTACTED"] }
      },
      order: [["createdAt", "DESC"]]
    });
  }

  if (!lead && cleanPhone.length >= 7) {
    lead = await Lead.findOne({
      where: {
        [Op.or]: [
          { phone: { [Op.like]: `%${cleanPhone.slice(-10)}%` } },
          { whatsappPhone: { [Op.like]: `%${cleanPhone.slice(-10)}%` } }
        ],
        status: { [Op.in]: ["NEW", "CONTACTED"] }
      },
      order: [["createdAt", "DESC"]]
    });
  }

  const generatedLeadNumber = `LD-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 90000) + 10000)}`;

  if (!lead) {
    // Create new Lead with INCOMPLETE status
    lead = await Lead.create({
      id: crypto.randomUUID(),
      leadNumber: generatedLeadNumber,
      firstName: effectiveFirstName || (event.channel === "whatsapp" ? "WhatsApp" : "New"),
      lastName: effectiveLastName || "Lead",
      company: effectiveCompany || account?.name || "Pending Identification",
      email: effectiveEmail || (event.channel === "whatsapp" && cleanPhone ? `wa_${cleanPhone}@nexus-temp.com` : null),
      phone: effectivePhone || null,
      whatsappPhone: event.channel === "whatsapp" ? effectivePhone : null,
      communicationChannel: event.channel,
      source: event.attribution?.source || (event.channel === "whatsapp" ? "WhatsApp" : event.channel === "email" ? "Email" : "Website"),
      sourceType: event.attribution?.sourceType || event.channel,
      sourceChannel: event.attribution?.sourceChannel || event.channel,
      sourceName: event.attribution?.sourceName || null,
      sourceDetail: event.attribution?.sourceDetail || (event.subject ? `Subject: ${event.subject}` : null),
      campaign: event.attribution?.campaign || null,
      utmSource: event.attribution?.utmSource || null,
      utmMedium: event.attribution?.utmMedium || null,
      utmCampaign: event.attribution?.utmCampaign || null,
      referrer: event.attribution?.referrer || null,
      landingPage: event.attribution?.landingPage || null,
      message: effectiveRequirement || event.message || null,
      status: "NEW",
      intakeStatus: "INCOMPLETE",
      intakeMessageCount: 0,
      lastProcessedEventId: event.eventId || null,
      extractedRequirement: {
        item: parsed.requirement || effectiveRequirement,
        quantity: parsed.quantity || 1,
        context: parsed.context || null
      }
    });
  } else {
    // Update existing Lead with freshly parsed information without overwriting verified data
    const updates: any = {
      lastProcessedEventId: event.eventId || lead.lastProcessedEventId
    };

    if (effectiveFirstName && (/^(unknown|new|whatsapp)$/i.test(lead.firstName) || !lead.firstName)) {
      updates.firstName = effectiveFirstName;
    }
    if (effectiveLastName && (/^(lead|user)$/i.test(lead.lastName) || !lead.lastName)) {
      updates.lastName = effectiveLastName;
    }
    if (effectiveCompany && (/^(pending identification|unknown|general)$/i.test(lead.company) || !lead.company)) {
      updates.company = effectiveCompany;
    }
    if (effectiveEmail && (!lead.email || lead.email.includes("@nexus-temp.com") || !lead.emailVerified)) {
      updates.email = effectiveEmail;
      updates.emailVerified = true;
    }
    if (effectivePhone && !lead.phone) {
      updates.phone = effectivePhone;
    }
    if (parsed.requirement) {
      updates.extractedRequirement = {
        item: parsed.requirement,
        quantity: parsed.quantity || 1,
        context: parsed.context || null
      };
    }

    await lead.update(updates);
  }

  // 5. Update or Create Contact / Account
  if (!account && Account) {
    const accountName = effectiveCompany || `${effectiveFirstName || 'Customer'} ${effectiveLastName || 'Enterprise'}`.trim() || 'General Enterprise';
    account = await Account.create({
      id: crypto.randomUUID(),
      name: accountName,
      primaryContactName: `${effectiveFirstName} ${effectiveLastName}`.trim() || null,
      email: effectiveEmail && !effectiveEmail.includes("@nexus-temp.com") ? effectiveEmail : null,
      phone: effectivePhone || null
    });
  } else if (account && effectiveCompany && (/^(customer enterprise|general enterprise|lead enterprise)$/i.test(account.name) || !account.name)) {
    await account.update({ name: effectiveCompany });
  }

  if (Contact) {
    if (!contact && (effectiveEmail || cleanPhone)) {
      contact = await Contact.create({
        id: crypto.randomUUID(),
        accountId: account?.id || crypto.randomUUID(),
        firstName: effectiveFirstName || "Lead",
        lastName: effectiveLastName || "Contact",
        email: effectiveEmail && !effectiveEmail.includes("@nexus-temp.com") ? effectiveEmail : null,
        phone: effectivePhone || null,
        preferredCommunicationChannel: "EMAIL",
        emailVerified: Boolean(effectiveEmail && !effectiveEmail.includes("@nexus-temp.com")),
        whatsappVerified: event.channel === "whatsapp"
      });
    } else if (contact) {
      // Update contact with non-empty fields without overwriting verified values
      const contactUpdates: any = {};
      if (effectiveFirstName && (!contact.firstName || /^(lead|whatsapp|new|customer|unknown)$/i.test(contact.firstName.trim()))) {
        contactUpdates.firstName = effectiveFirstName;
      }
      if (effectiveLastName && (!contact.lastName || /^(contact|lead|user)$/i.test(contact.lastName.trim()))) {
        contactUpdates.lastName = effectiveLastName;
      }
      if (effectiveEmail && (!contact.email || contact.email.includes("@nexus-temp.com") || !contact.emailVerified)) {
        contactUpdates.email = effectiveEmail;
        contactUpdates.emailVerified = true;
      }
      if (effectivePhone && !contact.phone) {
        contactUpdates.phone = effectivePhone;
        if (event.channel === "whatsapp") contactUpdates.whatsappVerified = true;
      }
      if (account && !contact.accountId) contactUpdates.accountId = account.id;

      if (Object.keys(contactUpdates).length > 0) {
        await contact.update(contactUpdates);
      }
    }
  }

  // 6. Evaluate Completeness
  const completeness = await getMissingLeadInformation(lead);
  await lead.update({ missingFields: completeness.missing });

  let messageSent: string | null = null;

  // 7. Branch Logic: Complete vs Incomplete
  if (completeness.isComplete) {
    // ── CASE A: COMPLETE INFORMATION ──────────────────────────────────────────
    // Send acknowledgement
    const ack = generateAcknowledgementMessage(event.channel, completeness.known.name);
    messageSent = ack.body;

    if (event.channel === "whatsapp" && effectivePhone) {
      await sendWhatsAppMessage(effectivePhone, ack.body);
    } else if (event.channel === "email" && effectiveEmail && !effectiveEmail.includes("@nexus-temp.com")) {
      await sendCustomEmail(effectiveEmail, ack.subject || "We've received your enquiry", ack.body, lead.id);
    }

    // Mark READY_FOR_ASSIGNMENT
    await lead.update({ intakeStatus: "READY_FOR_ASSIGNMENT" });

    // Run Lead Assignment Engine
    const assignedUserId = lead.assignedToId || await assignDeal({
      firstName: lead.firstName,
      lastName: lead.lastName,
      email: lead.email,
      phone: lead.phone,
      company: lead.company,
      leadScore: lead.leadScore || 50,
      source: lead.source || "Inbound",
      industry: lead.industry || "General"
    });

    await lead.update({
      assignedToId: assignedUserId,
      intakeStatus: "ASSIGNED"
    });

    // Notify assigned sales rep
    if (assignedUserId) {
      await createNotification(
        assignedUserId,
        "lead_assigned",
        `🎯 New Lead Assigned: ${completeness.known.name || "Customer"} (${completeness.known.company || "Enterprise"})`,
        `Requirement: ${completeness.known.requirement || "Inbound enquiry"}. Profile is fully complete.`,
        `/leads/${lead.id}`
      );
    }

    // Log Activity
    if (Activity) {
      await Activity.create({
        id: crypto.randomUUID(),
        leadId: lead.id,
        type: event.channel === "whatsapp" ? "whatsapp_sms" : "email",
        outcome: "Intake Complete - Assigned",
        notes: `Customer completed intake details. Assigned to sales rep.`,
        direction: "internal",
        isCompleted: true,
        createdById: assignedUserId || null
      });
    }

    return {
      leadId: lead.id,
      intakeStatus: "ASSIGNED",
      isComplete: true,
      assignedToId: assignedUserId,
      messageSent
    };

  } else {
    // ── CASE B / C: INCOMPLETE INFORMATION ────────────────────────────────────
    const currentMessageCount = lead.intakeMessageCount || 0;

    if (currentMessageCount < 2) {
      // Send conversational missing fields request
      const prompt = generateCollectionMessage(completeness.missing, event.channel, completeness.known.name);
      messageSent = prompt;

      if (event.channel === "whatsapp" && effectivePhone) {
        await sendWhatsAppMessage(effectivePhone, prompt);
      } else if (event.channel === "email" && effectiveEmail && !effectiveEmail.includes("@nexus-temp.com")) {
        await sendCustomEmail(effectiveEmail, "Regarding your enquiry", prompt, lead.id);
      }

      await lead.update({
        intakeStatus: "COLLECTING_DETAILS",
        intakeMessageCount: currentMessageCount + 1,
        lastAutomatedIntakeMessageAt: new Date()
      });

      if (Activity) {
        await Activity.create({
          id: crypto.randomUUID(),
          leadId: lead.id,
          type: event.channel === "whatsapp" ? "whatsapp_sms" : "email",
          outcome: `Intake Requested (${completeness.missing.join(", ")})`,
          notes: prompt,
          direction: "outbound",
          isCompleted: true
        });
      }

      return {
        leadId: lead.id,
        intakeStatus: "COLLECTING_DETAILS",
        isComplete: false,
        assignedToId: lead.assignedToId,
        messageSent
      };

    } else {
      // Max intake requests exceeded -> Fallback to Sales Rep
      await lead.update({ intakeStatus: "INCOMPLETE" });

      const assignedUserId = lead.assignedToId || await assignDeal({
        firstName: lead.firstName,
        lastName: lead.lastName,
        email: lead.email || "incomplete@nexus.com",
        phone: lead.phone,
        company: lead.company || "Incomplete Profile",
        leadScore: lead.leadScore || 40,
        source: lead.source || "Inbound",
        industry: lead.industry || "General"
      });

      await lead.update({ assignedToId: assignedUserId });

      if (assignedUserId) {
        const missingList = completeness.missing.join(", ");
        await createNotification(
          assignedUserId,
          "lead_assigned",
          `⚠️ Incomplete Lead Assigned: ${lead.firstName} ${lead.lastName}`,
          `Customer has not yet provided ${missingList}. Please follow up directly.`,
          `/leads/${lead.id}`
        );
      }

      if (Activity) {
        await Activity.create({
          id: crypto.randomUUID(),
          leadId: lead.id,
          type: "task",
          outcome: "Intake Incomplete - Fallback Assigned",
          notes: `Automated intake limit reached. Missing: ${completeness.missing.join(", ")}. Assigned to sales rep for manual chase.`,
          direction: "internal",
          isCompleted: false,
          createdById: assignedUserId || null
        });
      }

      return {
        leadId: lead.id,
        intakeStatus: "INCOMPLETE",
        isComplete: false,
        assignedToId: assignedUserId,
        messageSent: null
      };
    }
  }
}
