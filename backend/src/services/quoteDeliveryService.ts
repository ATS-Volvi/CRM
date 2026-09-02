import { sequelize } from "@nexus-crm/database";
import { sendEmail, getBaseHtmlTemplate } from "./emailService";
import { sendWhatsAppMessage } from "./whatsappService";
import { processOpportunityEvent } from "./opportunityAutomationEngine";
import PDFDocument from "pdfkit";

export interface ContactDeliveryContext {
  id?: string;
  name?: string;
  email?: string | null;
  phone?: string | null;
  whatsappNumber?: string | null;
  preferredCommunicationChannel?: string | null;
  emailVerified?: boolean;
  whatsappVerified?: boolean;
}

export interface LeadDeliveryContext {
  source?: string | null;
  sourceChannel?: string | null;
  sourceDetail?: string | null;
}

export interface DeliveryChannelResolution {
  channel: "EMAIL" | "WHATSAPP" | null;
  recipient: string | null;
  reason: string;
}

/**
 * Pure function to resolve the quotation communication channel for a contact/lead.
 * Rule: The communication of every quote, negotiation, and final quote MUST go through EMAIL,
 * regardless of which medium the lead came from.
 */
export function resolveDeliveryChannel(
  contact: ContactDeliveryContext | null | undefined,
  requestedChannel?: string | null,
  leadContext?: LeadDeliveryContext | null | undefined
): DeliveryChannelResolution {
  if (!contact) {
    return {
      channel: null,
      recipient: null,
      reason: "No contact or lead record found for this quote"
    };
  }

  const email = (contact.email || "").trim();
  const isPlaceholderEmail = !email || email.includes("unknown_wa_") || email.includes("@nexus-temp.com") || !email.includes("@");
  const isEmailVerified = Boolean(contact.emailVerified);

  // If a valid email is found on the contact/lead
  if (email && !isPlaceholderEmail) {
    return {
      channel: "EMAIL",
      recipient: email,
      reason: isEmailVerified
        ? "Email: verified customer email (standard quotation communication channel)"
        : "Email: extracted customer email (standard quotation communication channel)"
    };
  }

  // If requested channel is WhatsApp fallback or phone only exists
  const rawPhone = (contact.whatsappNumber || contact.phone || "").trim();
  const phone = rawPhone ? rawPhone.replace(/\s+/g, "") : "";

  return {
    channel: null,
    recipient: null,
    reason: phone
      ? `Quotation communication must go through email. Customer phone (${phone}) is known, but an email address must be extracted or provided before sending quotes.`
      : "Quotation communication must go through email. No valid customer email found on contact record."
  };
}

/**
 * Builds a binary PDF buffer for a quotation.
 */
export async function buildQuotePdfBuffer(quoteId: string): Promise<Buffer> {
  const quote = await sequelize.models.Quote.findByPk(quoteId, {
    include: [
      {
        model: sequelize.models.QuoteLineItem,
        as: "QuoteLineItems",
        include: [{ model: sequelize.models.PriceBookEntry, as: "product" }]
      },
      {
        model: sequelize.models.Deal,
        as: "deal",
        include: [{ model: sequelize.models.Lead, as: "lead" }]
      }
    ]
  });

  if (!quote) {
    throw new Error(`Quote not found with ID ${quoteId}`);
  }

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: "A4" });
    const buffers: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => buffers.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(buffers)));
    doc.on("error", (err: Error) => reject(err));

    const formatCurr = (val: number) => {
      const formatted = Number(val || 0).toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
      return `SAR ${formatted}`;
    };

    // Header
    doc.rect(40, 40, 515, 60).fill("#1e293b");
    doc.fillColor("#ffffff").fontSize(20).font("Helvetica-Bold").text("NEXUS CRM", 55, 55);
    doc.fontSize(9).font("Helvetica").fillColor("#94a3b8").text("ENTERPRISE SALES & QUOTATION SYSTEM", 55, 78);
    doc.fontSize(18).font("Helvetica-Bold").fillColor("#38bdf8").text("COMMERCIAL QUOTE", 340, 55, { align: "right" });
    doc.fontSize(9).font("Helvetica").fillColor("#94a3b8").text(`Quote #: ${(quote as any).quoteNumber || quoteId.slice(0, 8)}`, 340, 78, { align: "right" });

    // Details Grid
    doc.fillColor("#0f172a").fontSize(10).font("Helvetica-Bold").text("QUOTATION DETAILS", 40, 120);
    doc.moveTo(40, 135).lineTo(555, 135).strokeColor("#cbd5e1").stroke();

    const deal = (quote as any).deal;
    const lead = deal?.lead;
    const clientName = lead?.company || deal?.name || "Valued Customer";
    const contactPerson = lead ? `${lead.firstName || ""} ${lead.lastName || ""}`.trim() : "Procurement Officer";

    doc.fontSize(9).font("Helvetica-Bold").fillColor("#334155").text("Prepared For:", 40, 145);
    doc.font("Helvetica").text(clientName, 120, 145);
    doc.font("Helvetica-Bold").text("Contact:", 40, 160);
    doc.font("Helvetica").text(contactPerson, 120, 160);
    doc.font("Helvetica-Bold").text("Date:", 340, 145);
    doc.font("Helvetica").text(new Date((quote as any).createdAt).toLocaleDateString(), 420, 145);
    doc.font("Helvetica-Bold").text("Status:", 340, 160);
    doc.font("Helvetica").text((quote as any).status || "Draft", 420, 160);

    // Line items table
    doc.moveTo(40, 185).lineTo(555, 185).strokeColor("#cbd5e1").stroke();
    doc.rect(40, 195, 515, 22).fill("#f1f5f9");
    doc.fillColor("#334155").font("Helvetica-Bold").fontSize(8);
    doc.text("#", 45, 202);
    doc.text("ITEM & DESCRIPTION", 70, 202);
    doc.text("QTY", 330, 202, { width: 40, align: "right" });
    doc.text("UNIT PRICE", 380, 202, { width: 70, align: "right" });
    doc.text("TOTAL", 460, 202, { width: 90, align: "right" });

    let y = 225;
    const items = (quote as any).QuoteLineItems || [];

    if (items.length === 0) {
      doc.font("Helvetica").fontSize(9).fillColor("#64748b").text("No line items specified.", 50, y);
      y += 20;
    } else {
      items.forEach((item: any, idx: number) => {
        const prod = item.product;
        const name = prod?.name || item.name || `Item #${idx + 1}`;
        const qty = Number(item.quantity || item.qty || 1);
        const unitPrice = Number(item.unitPrice || 0);
        const total = Number(item.totalAmount || item.totalPrice || qty * unitPrice);

        doc.font("Helvetica-Bold").fontSize(8).fillColor("#0f172a").text(String(idx + 1), 45, y);
        doc.text(name, 70, y);
        doc.font("Helvetica").fontSize(8).text(String(qty), 330, y, { width: 40, align: "right" });
        doc.text(formatCurr(unitPrice), 380, y, { width: 70, align: "right" });
        doc.text(formatCurr(total), 460, y, { width: 90, align: "right" });

        y += 18;
      });
    }

    // Totals
    y += 10;
    doc.moveTo(40, y).lineTo(555, y).strokeColor("#e2e8f0").stroke();
    y += 15;
    const totalAmount = Number((quote as any).totalAmount || 0);
    doc.font("Helvetica-Bold").fontSize(11).fillColor("#0f172a").text("Total Quotation Amount:", 320, y);
    doc.fillColor("#0284c7").text(formatCurr(totalAmount), 460, y, { width: 90, align: "right" });

    // Terms & Conditions Footer
    y += 40;
    doc.rect(40, y, 515, 75).fill("#f8fafc");
    doc.fillColor("#475569").fontSize(8).font("Helvetica-Bold").text("COMMERCIAL TERMS & NOTES", 50, y + 10);
    doc.font("Helvetica").fontSize(7.5).fillColor("#64748b");
    doc.text("1. Validity: This commercial quotation is valid for 30 calendar days from the date of issue.", 50, y + 25);
    doc.text("2. Payment Terms: Net 30 days upon delivery and issuance of commercial invoice.", 50, y + 37);
    doc.text("3. Delivery: Delivery timelines are subject to confirmation upon issuance of Purchase Order.", 50, y + 49);

    doc.end();
  });
}

/**
 * Resolves the primary contact and lead context for a quote.
 */
export async function getQuoteContact(quote: any): Promise<{
  contact: ContactDeliveryContext | null;
  leadContext: LeadDeliveryContext | null;
}> {
  const dealId = quote.dealId;
  if (!dealId) return { contact: null, leadContext: null };

  const deal = await sequelize.models.Deal.findByPk(dealId, {
    include: [
      {
        model: sequelize.models.Contact,
        as: "dealContacts",
        required: false
      },
      {
        model: sequelize.models.Lead,
        as: "lead",
        required: false
      },
      {
        model: sequelize.models.Account,
        as: "account",
        required: false,
        include: [{ model: sequelize.models.Contact, as: "contacts", required: false }]
      }
    ]
  });

  if (!deal) return { contact: null, leadContext: null };

  const lead = (deal as any).lead;
  const leadContext: LeadDeliveryContext = {
    source: lead?.source || null,
    sourceChannel: lead?.sourceChannel || null,
    sourceDetail: lead?.sourceDetail || null
  };

  // 1. Primary Deal Contact
  const dealContacts = (deal as any).dealContacts || [];
  if (dealContacts.length > 0) {
    const primary = dealContacts[0];
    const resolvedEmail = (primary.email && !primary.email.includes("@nexus-temp.com")) 
      ? primary.email 
      : (lead?.email && !lead.email.includes("@nexus-temp.com") ? lead.email : primary.email);

    return {
      contact: {
        id: primary.id,
        name: `${primary.firstName || ""} ${primary.lastName || ""}`.trim() || "Contact",
        email: resolvedEmail,
        phone: primary.phone || lead?.phone,
        whatsappNumber: primary.whatsappNumber || primary.phone || lead?.whatsappPhone,
        preferredCommunicationChannel: primary.preferredCommunicationChannel || lead?.communicationChannel,
        emailVerified: primary.emailVerified || Boolean(lead?.email),
        whatsappVerified: primary.whatsappVerified || Boolean(lead?.whatsappPhone)
      },
      leadContext
    };
  }

  // 2. Account Contacts
  const accountContacts = (deal as any).account?.contacts || [];
  if (accountContacts.length > 0) {
    const primary = accountContacts[0];
    const resolvedEmail = (primary.email && !primary.email.includes("@nexus-temp.com")) 
      ? primary.email 
      : (lead?.email && !lead.email.includes("@nexus-temp.com") ? lead.email : primary.email);

    return {
      contact: {
        id: primary.id,
        name: `${primary.firstName || ""} ${primary.lastName || ""}`.trim() || "Account Contact",
        email: resolvedEmail,
        phone: primary.phone || lead?.phone,
        whatsappNumber: primary.whatsappNumber || primary.phone || lead?.whatsappPhone,
        preferredCommunicationChannel: primary.preferredCommunicationChannel || lead?.communicationChannel,
        emailVerified: primary.emailVerified || Boolean(lead?.email),
        whatsappVerified: primary.whatsappVerified || Boolean(lead?.whatsappPhone)
      },
      leadContext
    };
  }

  // 3. Converted / Associated Lead
  if (lead) {
    return {
      contact: {
        id: lead.id,
        name: `${lead.firstName || ""} ${lead.lastName || ""}`.trim() || lead.company || "Lead",
        email: lead.email,
        phone: lead.phone,
        whatsappNumber: lead.whatsappPhone || lead.phone,
        preferredCommunicationChannel: lead.preferredCommunicationChannel || lead.communicationChannel,
        emailVerified: Boolean(lead.email),
        whatsappVerified: Boolean(lead.whatsappPhone)
      },
      leadContext
    };
  }

  return { contact: null, leadContext };
}

/**
 * Appends a delivery history event row to QuoteDeliveries.
 */
export async function recordQuoteDeliveryEvent(
  quoteId: string,
  event: {
    channel: string;
    recipient: string;
    status: "SENT" | "DELIVERED" | "BOUNCED" | "VIEWED" | "FAILED";
    providerMessageId?: string | null;
    notes?: string | null;
    occurredAt?: Date;
  }
) {
  try {
    return await sequelize.models.QuoteDelivery.create({
      id: require("crypto").randomUUID(),
      quoteId,
      channel: event.channel,
      recipient: event.recipient,
      status: event.status,
      providerMessageId: event.providerMessageId || null,
      occurredAt: event.occurredAt || new Date(),
      notes: event.notes || null
    });
  } catch (err: any) {
    console.warn("QuoteDelivery event log notice:", err.message);
    return null;
  }
}

/**
 * Executes delivery of a quotation through the resolved or requested communication channel.
 * Strictly updates quote.status to "Sent" ONLY after the real transmission call succeeds,
 * and records a QuoteDelivery row.
 */
export async function deliverQuote(
  quoteId: string,
  options: {
    channel?: string | null;
    userId?: string;
    messageCustomization?: string;
  } = {}
) {
  const quote = await sequelize.models.Quote.findByPk(quoteId, {
    include: [
      {
        model: sequelize.models.Deal,
        as: "deal",
        include: [{ model: sequelize.models.Lead, as: "lead" }]
      },
      {
        model: sequelize.models.QuoteLineItem,
        as: "QuoteLineItems"
      }
    ]
  });

  if (!quote) {
    throw new Error(`Quote #${quoteId} not found`);
  }

  // Resolve Contact & Lead Context
  const { contact, leadContext } = await getQuoteContact(quote);
  const resolution = resolveDeliveryChannel(contact, options.channel, leadContext);

  if (!resolution.channel || !resolution.recipient) {
    // Record FAILED delivery event
    await recordQuoteDeliveryEvent((quote as any).id, {
      channel: options.channel || "UNSPECIFIED",
      recipient: contact?.email || contact?.phone || "Unknown",
      status: "FAILED",
      notes: `Send aborted: ${resolution.reason}`
    });

    throw new Error(
      `Cannot send quote: ${resolution.reason}. Please update the contact's email or phone number before sending.`
    );
  }

  const { channel, recipient, reason } = resolution;
  const quoteNumber = (quote as any).quoteNumber || `QT-${(quote as any).id.slice(0, 6)}`;
  const totalAmount = Number((quote as any).totalAmount || 0);
  const formattedAmount = `SAR ${totalAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
  const clientName = contact?.name || "Customer";
  const frontendUrl = process.env.FRONTEND_URL || process.env.CORS_ORIGIN?.split(",")[0] || "http://localhost:5173";

  // Generate cryptographically random access token and 30-day (or expirationDate) expiry
  const crypto = require("crypto");
  const publicToken = (quote as any).publicAccessToken || crypto.randomBytes(24).toString("hex");
  const expiresAt = (quote as any).publicAccessExpiresAt || (quote as any).expirationDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const customerPortalUrl = `${frontendUrl}/q/${publicToken}`;

  let providerMessageId: string | null = null;

  try {
    // ── REAL TRANSMISSION VIA EXISTING INFRASTRUCTURE ───────────────────────────
    if (channel === "EMAIL") {
      const subject = `Official Commercial Quotation #${quoteNumber} from Nexus CRM`;
      const bodyContent = `
        <p>Dear ${clientName},</p>
        <p>Thank you for considering Nexus CRM. Please find attached our official commercial quotation <strong>#${quoteNumber}</strong>.</p>
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 16px; margin: 20px 0;">
          <p style="margin: 0; font-size: 14px; color: #64748b;">Quotation Number: <strong style="color: #0f172a;">${quoteNumber}</strong></p>
          <p style="margin: 6px 0 0; font-size: 18px; color: #0284c7; font-weight: bold;">Total: ${formattedAmount}</p>
        </div>
        ${options.messageCustomization ? `<p style="font-style: italic; color: #475569;">"${options.messageCustomization}"</p>` : ""}
        <p>You can review, download, accept, or request revisions online via your secure quotation link:</p>
        <p><a href="${customerPortalUrl}" class="btn" style="color: #ffffff; background-color: #0284c7; padding: 10px 20px; text-decoration: none; border-radius: 6px; display: inline-block;">Review Quotation Online</a></p>
        <p>Please feel free to reply directly to this email with any questions or clarifications.</p>
      `;

      const html = getBaseHtmlTemplate(bodyContent);
      const emailResult = await sendEmail(recipient, subject, html);
      providerMessageId = (emailResult as any)?.id || (emailResult as any)?.messageId || null;
    } else if (channel === "WHATSAPP") {
      const whatsappMessage = `*Official Commercial Quotation #${quoteNumber}*\n\n` +
        `Dear ${clientName},\n` +
        `Your quotation is ready for review:\n` +
        `• Total Amount: *${formattedAmount}*\n` +
        `• Quote Reference: *${quoteNumber}*\n\n` +
        `${options.messageCustomization ? `Note: ${options.messageCustomization}\n\n` : ""}` +
        `Review, accept, or request revisions online:\n${customerPortalUrl}\n\n` +
        `Reply to this message if you have any questions or require revisions.`;

      const waResult = await sendWhatsAppMessage(recipient, whatsappMessage);
      providerMessageId = (waResult as any)?.messageId || (waResult as any)?.sid || null;
    }

    // ── STRICT POST-SEND STATUS TRANSITION ─────────────────────────────────────
    // Update Quote status to "Sent", record tokens and sentVia/sentAt AFTER transmission succeeds
    await quote.update({
      status: "Sent",
      sentAt: new Date(),
      sentVia: channel,
      publicAccessToken: publicToken,
      publicAccessExpiresAt: expiresAt,
      statusChangedAt: new Date()
    });

    // ── APPEND-ONLY QUOTE DELIVERY HISTORY ROW ─────────────────────────────────
    await recordQuoteDeliveryEvent((quote as any).id, {
      channel,
      recipient,
      status: "SENT",
      providerMessageId,
      notes: `Delivered via ${channel} (${reason})`
    });

    // Record Activity on Deal / Lead timeline
    const deal = (quote as any).deal;
    if (deal) {
      if (deal.leadId) {
        await sequelize.models.Activity.create({
          id: require("crypto").randomUUID(),
          leadId: deal.leadId,
          type: channel === "WHATSAPP" ? "whatsapp" : "email",
          outcome: `Quote ${quoteNumber} delivered via ${channel} to ${recipient}`,
          mentioned_user_ids: "[]",
          pinned: false,
          createdById: (options.userId && options.userId !== "system") ? options.userId : (deal.ownerId || null),
          direction: "outbound"
        }).catch((err: any) => console.warn("Activity log notice:", err.message));
      }

      // Emit Opportunity Automation Event
      processOpportunityEvent({
        opportunityId: deal.id,
        type: "QuoteSent",
        actorId: options.userId || deal.ownerId || null,
        payload: {
          quoteId: (quote as any).id,
          quoteNumber: (quote as any).quoteNumber,
          version: (quote as any).version,
          totalAmount: (quote as any).totalAmount,
          sentVia: channel,
          recipient
        }
      }).catch((err: any) => console.warn("Opportunity event notice:", err.message));
    }

    return {
      success: true,
      channel,
      recipient,
      messageId: providerMessageId,
      status: "Sent"
    };
  } catch (error: any) {
    await recordQuoteDeliveryEvent((quote as any).id, {
      channel,
      recipient,
      status: "FAILED",
      notes: `Send failed via ${channel}: ${error.message}`
    });

    throw error;
  }
};

/**
 * Shared helper to mark a quote as Viewed, record an append-only VIEWED event
 * in QuoteDeliveries, and log an activity on the deal/lead timeline.
 */
export const markQuoteAsViewed = async (quote: any, channel: string = "CUSTOMER_SELF_SERVICE") => {
  if (!quote) return;

  if (quote.status === "Sent") {
    await quote.update({
      status: "Viewed",
      viewedAt: new Date(),
      statusChangedAt: new Date()
    });

    const { contact } = await getQuoteContact(quote);

    await recordQuoteDeliveryEvent(quote.id, {
      channel: quote.sentVia || channel || "CUSTOMER_SELF_SERVICE",
      recipient: contact?.email || contact?.phone || "Customer",
      status: "VIEWED",
      notes: "Quote opened and viewed online by customer via secure link"
    });

    const deal = quote.deal;
    const leadId = deal?.leadId;
    const ownerId = deal?.ownerId;

    if (leadId) {
      await sequelize.models.Activity.create({
        id: require("crypto").randomUUID(),
        leadId,
        dealId: quote.dealId || null,
        type: "note",
        outcome: `Quote #${quote.quoteNumber || quote.id.slice(0, 8)} Viewed by Client online`,
        mentioned_user_ids: "[]",
        pinned: false,
        createdById: ownerId || "00000000-0000-0000-0000-000000000000",
        direction: "inbound"
      }).catch((err: any) => console.warn("Activity creation notice on quote view:", err.message));
    }
  }
};

/**
 * Deterministic inbound message acceptance detector.
 * Scans message text for positive confirmation phrases and flags a pinned Activity
 * for salesperson review without auto-accepting.
 */
export const detectAndFlagQuoteAcceptance = async (options: {
  leadId?: string | null;
  dealId?: string | null;
  messageText: string;
  sourceChannel: "WHATSAPP" | "EMAIL";
  senderInfo?: string;
}): Promise<boolean> => {
  if (!options.messageText) return false;

  const text = options.messageText.toLowerCase();
  const positivePhrases = [
    "approved",
    "approve",
    "go ahead",
    "please proceed",
    "proceed with the quote",
    "proceed with the order",
    "accept quote",
    "accepted",
    "agreed",
    "looks good to proceed",
    "we accept",
    "i accept",
    "deal agreed"
  ];

  const matchedPhrase = positivePhrases.find(phrase => text.includes(phrase));
  if (!matchedPhrase) return false;

  const { Op } = require("sequelize");
  const quoteWhere: any = {
    status: { [Op.in]: ["Sent", "Viewed"] }
  };

  let quote: any = null;
  let targetLeadId = options.leadId;

  if (options.dealId) {
    quote = await sequelize.models.Quote.findOne({
      where: { ...quoteWhere, dealId: options.dealId },
      include: [{ model: sequelize.models.Deal, as: "deal" }],
      order: [["createdAt", "DESC"]]
    });
  }

  if (!quote && targetLeadId) {
    const deals = await sequelize.models.Deal.findAll({
      where: { leadId: targetLeadId },
      attributes: ["id"]
    });
    const dealIds = deals.map((d: any) => d.id);
    if (dealIds.length > 0) {
      quote = await sequelize.models.Quote.findOne({
        where: { ...quoteWhere, dealId: { [Op.in]: dealIds } },
        include: [{ model: sequelize.models.Deal, as: "deal" }],
        order: [["createdAt", "DESC"]]
      });
    }
  }

  // Fallback: match across all leads with this sender email/phone
  if (!quote && options.senderInfo) {
    const matchingLeads = await sequelize.models.Lead.findAll({
      where: {
        [Op.or]: [
          { email: options.senderInfo },
          { phone: { [Op.like]: `%${options.senderInfo.slice(-7)}%` } }
        ]
      },
      attributes: ["id"]
    });
    const allLeadIds = matchingLeads.map((l: any) => l.id);
    if (allLeadIds.length > 0) {
      const deals = await sequelize.models.Deal.findAll({
        where: { leadId: { [Op.in]: allLeadIds } },
        attributes: ["id"]
      });
      const dealIds = deals.map((d: any) => d.id);
      if (dealIds.length > 0) {
        quote = await sequelize.models.Quote.findOne({
          where: { ...quoteWhere, dealId: { [Op.in]: dealIds } },
          include: [{ model: sequelize.models.Deal, as: "deal" }],
          order: [["createdAt", "DESC"]]
        });
      }
    }
  }

  if (!quote) return false;

  const quoteRef = quote.quoteNumber || quote.id.slice(0, 8);
  const snippet = options.messageText.length > 100 ? `${options.messageText.slice(0, 97)}...` : options.messageText;
  const activityLeadId = (quote as any).deal?.leadId || targetLeadId || options.leadId || null;

  // Create pinned Activity notice for staff confirmation — NEVER auto-accept
  await sequelize.models.Activity.create({
    id: require("crypto").randomUUID(),
    leadId: activityLeadId,
    dealId: (quote as any).dealId || options.dealId || null,
    type: "note",
    outcome: `Possible quote acceptance detected in client ${options.sourceChannel} message: "${snippet}" — confirm to mark Quote #${quoteRef} Accepted`,
    pinned: true,
    createdById: "00000000-0000-0000-0000-000000000000",
    direction: "inbound"
  }).catch((err: any) => console.warn("Quote acceptance flag activity notice:", err.message));

  return true;
};

/**
 * Sends an official confirmation email for the Final Agreed Quotation.
 */
export async function sendFinalAgreedQuoteEmail(
  quoteId: string,
  options: { userId?: string; notes?: string } = {}
): Promise<{ success: boolean; recipient?: string; messageId?: string; error?: string }> {
  try {
    const quote: any = await sequelize.models.Quote.findByPk(quoteId, {
      include: [
        {
          model: sequelize.models.Deal,
          as: "deal",
          include: [{ model: sequelize.models.Lead, as: "lead" }]
        },
        {
          model: sequelize.models.QuoteLineItem,
          as: "QuoteLineItems",
          include: [{ model: sequelize.models.PriceBookEntry, as: "product" }]
        }
      ]
    });

    if (!quote) return { success: false, error: "Quote not found" };

    const { contact } = await getQuoteContact(quote);
    const email = contact?.email;

    if (!email || email.includes("@nexus-temp.com")) {
      return { success: false, error: "No valid email address found for sending final quote confirmation" };
    }

    const quoteNumber = quote.quoteNumber || `QT-${quote.id.slice(0, 6)}`;
    const totalAmount = Number(quote.totalAmount || 0);
    const formattedAmount = `SAR ${totalAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
    const clientName = contact.name || "Valued Customer";
    const frontendUrl = process.env.FRONTEND_URL || process.env.CORS_ORIGIN?.split(",")[0] || "http://localhost:5173";
    const customerPortalUrl = quote.publicAccessToken ? `${frontendUrl}/q/${quote.publicAccessToken}` : frontendUrl;

    const subject = `Confirmed: Final Agreed Commercial Quotation #${quoteNumber} (v${quote.version || 1})`;
    const bodyContent = `
      <p>Dear ${clientName},</p>
      <p>We are pleased to confirm that <strong>Quotation #${quoteNumber} (Version ${quote.version || 1})</strong> has been finalized as the <strong>Official Final Agreed Quotation</strong>.</p>
      <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 16px; margin: 20px 0;">
        <p style="margin: 0; font-size: 14px; color: #166534; font-weight: bold;">Status: Final Agreed Commercial Terms</p>
        <p style="margin: 6px 0 0; font-size: 18px; color: #15803d; font-weight: bold;">Agreed Total: ${formattedAmount}</p>
      </div>
      ${options.notes ? `<p style="font-style: italic; color: #475569;">"${options.notes}"</p>` : ""}
      <p>You can access your complete final quote breakdown and documentation online at any time:</p>
      <p><a href="${customerPortalUrl}" class="btn" style="color: #ffffff; background-color: #15803d; padding: 10px 20px; text-decoration: none; border-radius: 6px; display: inline-block;">View Final Agreed Quote</a></p>
      <p>Thank you for partnering with Nexus CRM. Our fulfillment team will proceed with the next steps.</p>
    `;

    const html = getBaseHtmlTemplate(bodyContent);
    const emailResult = await sendEmail(email, subject, html);
    const providerMessageId = (emailResult as any)?.id || (emailResult as any)?.messageId || null;

    await recordQuoteDeliveryEvent(quote.id, {
      channel: "EMAIL",
      recipient: email,
      status: "SENT",
      providerMessageId,
      notes: `Final Agreed Quote Confirmation sent via Email to ${email}`
    });

    return { success: true, recipient: email, messageId: providerMessageId };
  } catch (err: any) {
    console.warn("Failed to send final agreed quote email:", err.message);
    return { success: false, error: err.message };
  }
}

