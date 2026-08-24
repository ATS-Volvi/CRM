import { Activity, Quote, PurchaseOrder, Deal, Lead, PipelineStage, User } from "@nexus-crm/database";
import { Op } from "sequelize";

export interface EvidenceItem {
  type: string;
  description: string;
  timestamp: string | Date;
  entityId?: string;
  isCustomerSide: boolean;
}

export interface StageValidationResult {
  allowed: boolean;
  fromStage: string;
  toStage: string;
  transitionType: "AUTOMATIC" | "VALIDATED_MANUAL" | "RESTRICTED";
  missingRequirements: string[];
  evidence: EvidenceItem[];
  verificationStatus: "VERIFIED" | "NEEDS_REVIEW";
}

/**
 * Validates whether a record (Deal or Lead) can transition to a target stage.
 * Enforces evidence-backed pipeline stage rules.
 */
export async function validateStageTransition(
  recordId: string,
  fromStageName: string,
  toStageName: string,
  userId?: string,
  userRole?: string,
  providedLossReason?: string
): Promise<StageValidationResult> {
  const missingRequirements: string[] = [];
  const evidenceList: EvidenceItem[] = [];

  // Normalize stage names
  const normalizedTo = (toStageName || "").trim().toLowerCase();
  const normalizedFrom = (fromStageName || "").trim().toLowerCase();

  // Find record (Deal or Lead)
  let deal: any = await Deal.findByPk(recordId, {
    include: [{ model: Quote, as: "quotes" }]
  });
  let lead: any = null;

  if (!deal) {
    lead = await Lead.findByPk(recordId);
  } else if (deal.leadId) {
    lead = await Lead.findByPk(deal.leadId);
  }

  const targetId = lead ? lead.id : deal ? deal.id : recordId;

  const targetCustomerId = deal?.customerId || lead?.customerId || null;
  const activityWhere: any = targetCustomerId
    ? { [Op.or]: [{ leadId: targetId }, { customerId: targetCustomerId }] }
    : { leadId: targetId };

  const activities = await Activity.findAll({
    where: activityWhere,
    order: [["createdAt", "DESC"]]
  });

  // Identify customer-side activities vs internal activities
  const outboundContactActivities = activities.filter((act: any) => {
    const isOutbound = act.direction === "outbound" || act.type === "whatsapp_sms" || act.type === "email" || act.type === "call" || act.type === "meeting";
    const isNotInternalNote = act.type !== "note" && act.type !== "stage_change";
    return isOutbound && isNotInternalNote;
  });

  const customerReplies = activities.filter((act: any) => {
    return act.direction === "inbound" || act.outcome?.toLowerCase().includes("reply") || act.outcome?.toLowerCase().includes("accepted") || act.outcome?.toLowerCase().includes("negotiate");
  });

  // Fetch quotes linked to deal
  const quotes = deal ? ((deal as any).Quotes || (deal as any).quotes || (await Quote.findAll({ where: { dealId: deal.id } }))) : await Quote.findAll({ where: { dealId: targetId } });
  const activeQuotes = quotes.filter((q: any) => q.status !== "Draft" && q.status !== "Cancelled");
  const sentQuotes = quotes.filter((q: any) => q.sentAt || q.status === "Sent" || q.status === "Accepted");
  const acceptedQuotes = quotes.filter((q: any) => q.acceptedAt || q.status === "Accepted");

  // Fetch Purchase Orders
  let pos: any[] = [];
  if (sentQuotes.length > 0) {
    pos = await PurchaseOrder.findAll({
      where: { quoteId: { [Op.in]: sentQuotes.map((q: any) => q.id) } }
    });
  }

  // 1. NEW STAGE
  if (normalizedTo === "new") {
    evidenceList.push({
      type: "LEAD_CREATED",
      description: "Lead/Opportunity record created in CRM",
      timestamp: lead?.createdAt || deal?.createdAt || new Date(),
      isCustomerSide: false
    });
  }

  // 2. CONTACTED STAGE
  if (normalizedTo === "contacted") {
    if (outboundContactActivities.length === 0) {
      missingRequirements.push("At least one verified outbound customer contact (WhatsApp, Email, Call, or Meeting) is required.");
    } else {
      const firstContact = outboundContactActivities[outboundContactActivities.length - 1];
      evidenceList.push({
        type: firstContact.type.toUpperCase(),
        description: `Outbound ${firstContact.type} sent to customer (${firstContact.outcome || "Delivered"})`,
        timestamp: (firstContact as any).createdAt || new Date(),
        entityId: firstContact.id,
        isCustomerSide: true
      });
    }
  }

  // 3. QUALIFIED / DISCOVERY / REQUIREMENTS STAGE
  if (normalizedTo === "qualified" || normalizedTo === "qualification" || normalizedTo === "discovery" || normalizedTo === "requirements") {
    const leadVal = lead ? (lead.expectedValue || (lead as any).estimatedValue || (lead as any).qualificationData?.estimatedValue || (lead as any).qualificationData?.budget || (lead as any).budgetRange) : deal?.amount;
    const reqNotes = lead?.body || lead?.notes || (lead as any).requirements || (lead as any).qualificationData?.requirement || (lead as any).qualificationData?.notes || deal?.name;
    
    if (!leadVal || Number(leadVal) <= 0) {
      missingRequirements.push("Estimated Deal/Lead Value must be specified for qualification.");
    }
    if (!reqNotes) {
      missingRequirements.push("Client Requirements summary must be documented.");
    }

    if (leadVal) {
      evidenceList.push({
        type: "ESTIMATED_VALUE",
        description: `Deal value specified: SAR ${Number(leadVal).toLocaleString()}`,
        timestamp: new Date(),
        isCustomerSide: false
      });
    }
    if (reqNotes) {
      evidenceList.push({
        type: "REQUIREMENTS_DOCUMENTED",
        description: "Customer business requirements documented",
        timestamp: new Date(),
        isCustomerSide: false
      });
    }
  }

  // 4. MEETING / SOLUTION STAGE
  if (normalizedTo === "meeting" || normalizedTo === "needs analysis" || normalizedTo === "solution/scope") {
    const meetingActs = activities.filter((a: any) => a.type === "meeting" || a.outcome?.toLowerCase().includes("meeting"));
    if (meetingActs.length === 0) {
      missingRequirements.push("A scheduled or completed customer meeting is required.");
    } else {
      const meet = meetingActs[0];
      evidenceList.push({
        type: "MEETING_RECORDED",
        description: `Customer meeting recorded: ${meet.outcome || "Completed"}`,
        timestamp: (meet as any).createdAt || new Date(),
        entityId: meet.id,
        isCustomerSide: true
      });
    }
  }

  // 5. PROPOSAL / QUOTE PREPARATION / QUOTE SENT STAGE
  if (normalizedTo === "proposal" || normalizedTo === "quote preparation" || normalizedTo === "quote sent") {
    if (quotes.length === 0) {
      missingRequirements.push("An official Quotation must be generated and linked to this opportunity.");
    } else if (activeQuotes.length === 0) {
      missingRequirements.push("Quote exists but is still in Draft state. Please finalize/generate the quotation.");
    } else {
      const q = activeQuotes[0];
      evidenceList.push({
        type: "QUOTE_GENERATED",
        description: `Quotation ${q.quoteNumber || q.id} generated for SAR ${Number(q.totalAmount).toLocaleString()}`,
        timestamp: (q as any).createdAt || new Date(),
        entityId: q.id,
        isCustomerSide: false
      });
    }
  }

  // 6. NEGOTIATION STAGE
  if (normalizedTo === "negotiation") {
    // Requires quotation generated AND customer interaction after quote sent
    if (sentQuotes.length === 0 && activeQuotes.length === 0) {
      missingRequirements.push("A formal quotation must be sent to the customer before entering Negotiation.");
    }

    const latestQuoteSentAt = sentQuotes[0]?.sentAt || (sentQuotes[0] as any)?.createdAt || (activeQuotes[0] as any)?.createdAt;
    
    // Find customer interaction after quote sent
    const customerInteractionPostQuote = activities.filter((act: any) => {
      const actTime = new Date((act as any).createdAt).getTime();
      const quoteTime = latestQuoteSentAt ? new Date(latestQuoteSentAt).getTime() : 0;
      const isPostQuote = actTime >= quoteTime - 60000; // 1 min buffer
      const isCustomerInteraction = act.direction === "inbound" || act.type === "whatsapp_sms" || act.type === "email" || act.outcome?.toLowerCase().includes("reply") || act.outcome?.toLowerCase().includes("counter") || act.outcome?.toLowerCase().includes("discount");
      return isPostQuote && isCustomerInteraction && act.type !== "note";
    });

    if (customerInteractionPostQuote.length === 0) {
      missingRequirements.push("Customer-side interaction (email/WhatsApp reply, counter-proposal, or call) after quote delivery is required for Negotiation.");
    } else {
      const postAct = customerInteractionPostQuote[0];
      evidenceList.push({
        type: "CUSTOMER_NEGOTIATION_REPLY",
        description: `Customer commercial response logged: ${postAct.outcome || postAct.notes || "Pricing/Terms discussion"}`,
        timestamp: (postAct as any).createdAt || new Date(),
        entityId: postAct.id,
        isCustomerSide: true
      });
    }
  }

  // 7. CLOSED WON STAGE
  if (normalizedTo === "closed won" || normalizedTo === "won") {
    const isManagerOrAdmin = userRole === "admin" || userRole === "sales_manager" || userRole === "sales_director" || userRole === "management";
    const hasAcceptedQuote = acceptedQuotes.length > 0;
    const hasPO = pos.length > 0;

    if (!hasAcceptedQuote && !hasPO && !isManagerOrAdmin) {
      missingRequirements.push("Closing a deal as WON requires customer quote acceptance, Purchase Order, or Sales Manager approval.");
    } else {
      if (hasAcceptedQuote) {
        evidenceList.push({
          type: "QUOTE_ACCEPTED",
          description: `Customer accepted quotation ${acceptedQuotes[0].quoteNumber || ""}`,
          timestamp: acceptedQuotes[0].acceptedAt || new Date(),
          entityId: acceptedQuotes[0].id,
          isCustomerSide: true
        });
      }
      if (hasPO) {
        evidenceList.push({
          type: "PO_RECEIVED",
          description: `Purchase Order ${pos[0].poNumber} received`,
          timestamp: pos[0].generatedDate || new Date(),
          entityId: pos[0].id,
          isCustomerSide: true
        });
      }
      if (isManagerOrAdmin) {
        evidenceList.push({
          type: "MANAGER_APPROVAL",
          description: `Authorized Manager (${userRole}) approved deal closure`,
          timestamp: new Date(),
          isCustomerSide: false
        });
      }
    }
  }

  // 8. CLOSED LOST STAGE
  if (normalizedTo === "closed lost" || normalizedTo === "lost") {
    const reasonToUse = providedLossReason || deal?.lossReason;
    if (!reasonToUse) {
      missingRequirements.push("A documented Loss Reason (e.g. Price, Competitor, No Budget, Timing) is required to close a deal as LOST.");
    } else {
      evidenceList.push({
        type: "LOSS_REASON_RECORDED",
        description: `Loss reason documented: ${reasonToUse}`,
        timestamp: new Date(),
        isCustomerSide: false
      });
    }
  }

  // 9. AGREED STAGE
  if (normalizedTo === "agreed") {
    if (sentQuotes.length === 0) {
      missingRequirements.push("A formal quotation must have been sent before moving to Agreed.");
    } else {
      evidenceList.push({
        type: "TERMS_AGREED",
        description: "Customer verbal or written agreement captured",
        timestamp: new Date(),
        isCustomerSide: true
      });
    }
  }

  const allowed = missingRequirements.length === 0;

  // Determine transition type
  let transitionType: "AUTOMATIC" | "VALIDATED_MANUAL" | "RESTRICTED" = "VALIDATED_MANUAL";
  if (normalizedTo === "closed won" || normalizedTo === "won") {
    transitionType = "RESTRICTED";
  } else if (normalizedTo === "new" || normalizedTo === "contacted" || normalizedTo === "discovery" || normalizedTo === "proposal" || normalizedTo === "quote preparation") {
    transitionType = "AUTOMATIC";
  }

  return {
    allowed,
    fromStage: fromStageName,
    toStage: toStageName,
    transitionType,
    missingRequirements,
    evidence: evidenceList,
    verificationStatus: allowed ? "VERIFIED" : "NEEDS_REVIEW"
  };
}
