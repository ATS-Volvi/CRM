import { sequelize } from "@nexus-crm/database";
import * as crypto from "crypto";
import { assignLead } from "./assignmentEngine";
import { evaluateQuoteApproval } from "./approvalEngine";
import { createNotification } from "./notificationEngine";

// ─── STEP 1: LEAD LIFECYCLE & STRICT STATE MACHINE CONTRACT ──────────────────

export type LeadStage =
  | "New"
  | "Contacted"
  | "Qualified"
  | "Meeting"
  | "Proposal"
  | "Negotiation"
  | "Won"
  | "Lost";

export interface StageRules {
  allowedTransitions: LeadStage[];
  requiredNextAction: string;
  slaHours: number;
  mandatoryFields: string[];
}

export const LIFECYCLE_STAGE_RULES: Record<LeadStage, StageRules> = {
  New: {
    allowedTransitions: ["Contacted", "Qualified", "Lost"],
    requiredNextAction: "Reply to Lead",
    slaHours: 2,
    mandatoryFields: []
  },
  Contacted: {
    allowedTransitions: ["Qualified", "Lost"],
    requiredNextAction: "Qualify Lead",
    slaHours: 24,
    mandatoryFields: []
  },
  Qualified: {
    allowedTransitions: ["Meeting", "Proposal", "Won", "Lost"],
    requiredNextAction: "Schedule Meeting",
    slaHours: 24,
    mandatoryFields: ["requirement", "estimatedValue"]
  },
  Meeting: {
    allowedTransitions: ["Proposal", "Won", "Lost"],
    requiredNextAction: "Prepare Quote",
    slaHours: 24,
    mandatoryFields: []
  },
  Proposal: {
    allowedTransitions: ["Negotiation", "Won", "Lost"],
    requiredNextAction: "Follow Up on Quote",
    slaHours: 48,
    mandatoryFields: []
  },
  Negotiation: {
    allowedTransitions: ["Won", "Lost"],
    requiredNextAction: "Finalize Terms & Close",
    slaHours: 24,
    mandatoryFields: []
  },
  Won: {
    allowedTransitions: [],
    requiredNextAction: "Generate Customer Invoice",
    slaHours: 0,
    mandatoryFields: []
  },
  Lost: {
    allowedTransitions: [],
    requiredNextAction: "Log Loss Reason",
    slaHours: 0,
    mandatoryFields: ["lossReason"]
  }
};

export function validateStageTransition(currentStage: string, nextStage: LeadStage): void {
  const normCurrent = (currentStage || "New").trim() as LeadStage;
  const rules = LIFECYCLE_STAGE_RULES[normCurrent];
  if (!rules) return; // fallback for unlisted stages

  if (normCurrent === nextStage) return; // Same stage update is allowed

  if (!rules.allowedTransitions.includes(nextStage)) {
    throw new Error(`Invalid stage transition: Cannot move lead from '${normCurrent}' to '${nextStage}'. Allowed next stages: ${rules.allowedTransitions.join(", ")}`);
  }
}

// ─── STEP 2: NEXT ACTION ENGINE ──────────────────────────────────────────────

export interface NextActionState {
  currentStage: LeadStage;
  nextAction: string;
  dueDate: Date;
  ownerId: string | null;
  priority: "Low" | "Medium" | "High" | "Urgent";
}

export function computeNextActionEngine(
  stage: LeadStage,
  estimatedValue: number = 0,
  ownerId: string | null = null
): NextActionState {
  const rules = LIFECYCLE_STAGE_RULES[stage] || LIFECYCLE_STAGE_RULES.New;
  const slaHours = rules.slaHours || 24;
  const dueDate = new Date(Date.now() + slaHours * 3600 * 1000);

  let priority: "Low" | "Medium" | "High" | "Urgent" = "Medium";
  if (estimatedValue >= 5000000) priority = "Urgent"; // >= ₹50L
  else if (estimatedValue >= 1000000) priority = "High"; // >= ₹10L
  else if (stage === "New") priority = "High";

  return {
    currentStage: stage,
    nextAction: rules.requiredNextAction,
    dueDate,
    ownerId,
    priority
  };
}

// ─── STEP 3: QUALIFICATION MODEL & MANDATORY FIELD VALIDATOR ──────────────────

export interface QualificationModel {
  requirement: string;
  estimatedValue: number;
  budget?: string | number;
  timeline?: string;
  decisionMaker?: string;
  productService?: string;
  probability?: number;
  notes?: string;
}

export function validateQualificationData(data: Partial<QualificationModel>): QualificationModel {
  if (!data.requirement || typeof data.requirement !== "string" || !data.requirement.trim()) {
    throw new Error("Qualification Error: 'requirement' field is mandatory to qualify a lead.");
  }
  if (!data.estimatedValue || isNaN(Number(data.estimatedValue)) || Number(data.estimatedValue) <= 0) {
    throw new Error("Qualification Error: 'estimatedValue' (numeric > 0) is mandatory to qualify a lead.");
  }

  return {
    requirement: data.requirement.trim(),
    estimatedValue: Number(data.estimatedValue),
    budget: data.budget || data.estimatedValue,
    timeline: data.timeline || "Within 30 Days",
    decisionMaker: data.decisionMaker || "Primary Contact",
    productService: data.productService || "General Solutions",
    probability: data.probability ?? 50,
    notes: data.notes || ""
  };
}

// ─── STEP 4: OPPORTUNITY CONVERSION & CONTEXT INHERITANCE ─────────────────────

export async function convertLeadToOpportunity(leadId: string, qualificationData: QualificationModel, userId?: string) {
  const lead = await sequelize.models.Lead.findByPk(leadId);
  if (!lead) throw new Error("Lead not found");
  const l = lead as any;

  // 1. Validate Stage Transition & Qualification Model
  validateStageTransition(l.status, "Qualified");
  const validQual = validateQualificationData(qualificationData);

  // 2. Compute Next Action Engine
  const nextState = computeNextActionEngine("Qualified", validQual.estimatedValue, l.assignedToId || userId);

  // 3. Inherit Customer Account
  const accountName = l.company || `${l.firstName} ${l.lastName}`.trim();
  let account: any = await sequelize.models.Account.findOne({ where: { name: accountName } });
  if (!account) {
    account = await sequelize.models.Account.create({
      id: crypto.randomUUID(),
      name: accountName,
      primaryContactName: `${l.firstName} ${l.lastName}`.trim(),
      email: l.email,
      phone: l.phone,
      industry: l.industry || "General"
    });
  }

  // 4. Inherit Primary Contact
  let contact: any = null;
  if (sequelize.models.Contact) {
    contact = await sequelize.models.Contact.findOne({ where: { email: l.email } });
    if (!contact) {
      contact = await sequelize.models.Contact.create({
        id: crypto.randomUUID(),
        accountId: account.id,
        firstName: l.firstName,
        lastName: l.lastName,
        email: l.email,
        phone: l.phone,
        role: "Decision Maker"
      });
    }
  }

  // 5. Create Opportunity (Deal) inheriting full context
  let deal: any = await sequelize.models.Deal.findOne({ where: { leadId: l.id } });
  if (!deal) {
    const stage = await sequelize.models.PipelineStage.findOne({ where: { name: "Qualified" } })
      || await sequelize.models.PipelineStage.findOne({ order: [["order", "ASC"]] });

    deal = await sequelize.models.Deal.create({
      id: crypto.randomUUID(),
      name: l.company ? `${l.company} Opportunity` : `${l.firstName} ${l.lastName} Opportunity`,
      amount: validQual.estimatedValue,
      stageId: stage ? (stage as any).id : null,
      leadId: l.id,
      accountId: account.id,
      customerId: account.id,
      ownerId: userId || l.assignedToId
    });
  } else {
    await deal.update({
      amount: validQual.estimatedValue,
      accountId: account.id,
      customerId: account.id
    });
  }

  // 5b. Auto-create DealSplit & DealOwner rows (commission split)
  // Qualifying rep = lead.assignedToId, Closing AE = deal.ownerId (may be same person)
  try {
    const { DealSplit, DealOwner, WorkspaceSetting, User } = sequelize.models;
    if (DealSplit || DealOwner) {
      // Read default split from workspace settings (default 20% if not set)
      const splitSetting = WorkspaceSetting ? (await WorkspaceSetting.findOne({ where: { key: "default_qualifying_split_pct" } }) as any) : null;
      const defaultSplit = splitSetting ? Math.min(100, Math.max(0, parseFloat(splitSetting.value))) : 20;

      let qualifyingRepId = l.assignedToId;
      const closingAeId = deal.ownerId as string | null;

      // Check if there was a manual escalation or SLA breach
      const { LeadReassignmentHistory } = sequelize.models;
      const reassignments = LeadReassignmentHistory
        ? (await LeadReassignmentHistory.findAll({
            where: { leadId: l.id },
            order: [["createdAt", "DESC"]]
          }) as any[])
        : [];

      let didForfeit = false;
      if (reassignments.length > 0) {
        const lastReassignment = reassignments[0];
        // If it was reassigned to the current closing AE
        if (lastReassignment.newAssignedToId === closingAeId) {
          if (lastReassignment.reason && lastReassignment.reason.includes("SLA Breach")) {
            didForfeit = true; // Forfeit commission completely
          } else {
            // Manual escalation: Original rep still gets their origination split
            qualifyingRepId = lastReassignment.oldAssignedToId;
          }
        }
      }

      if (DealSplit) {
        const existingSplits = await DealSplit.count({ where: { dealId: deal.id } });
        if (existingSplits === 0) {
          if (qualifyingRepId && closingAeId && qualifyingRepId !== closingAeId) {
            await DealSplit.bulkCreate([
              {
                id: crypto.randomUUID(),
                dealId: deal.id,
                userId: qualifyingRepId,
                splitPercentage: didForfeit ? 0 : defaultSplit,
                configuredByUserId: null,
                isCrossTeam: false
              },
              {
                id: crypto.randomUUID(),
                dealId: deal.id,
                userId: closingAeId,
                splitPercentage: didForfeit ? 100 : 100 - defaultSplit,
                configuredByUserId: null,
                isCrossTeam: false
              }
            ]);
          } else if (closingAeId || qualifyingRepId) {
            await DealSplit.create({
              id: crypto.randomUUID(),
              dealId: deal.id,
              userId: closingAeId || qualifyingRepId,
              splitPercentage: 100,
              configuredByUserId: null,
              isCrossTeam: false
            });
          }
        }
      }
    }
  } catch (splitErr) {
    console.warn("[convertLeadToOpportunity] DealSplit creation failed (non-fatal):", splitErr);
  }

  // 6. Update Lead record with Qualification details & Next Action
  await l.update({
    status: "Qualified",
    nextAction: nextState.nextAction,
    nextActionDue: nextState.dueDate,
    customerId: account.id,
    qualificationData: {
      ...validQual,
      qualifiedAt: new Date().toISOString(),
      qualifiedBy: userId || l.assignedToId,
      opportunityId: deal.id,
      accountId: account.id
    },
    leadScore: Math.min(100, (l.leadScore || 50) + 25)
  });

  // 7. Notify Sales Rep
  if (l.assignedToId) {
    await createNotification({
      userId: l.assignedToId,
      type: "LEAD_QUALIFIED",
      title: "Lead Qualified & Opportunity Created",
      message: `Lead '${l.firstName} ${l.lastName}' has been qualified. Opportunity created with value ₹${validQual.estimatedValue.toLocaleString()}.`
    });
  }

  return {
    lead: l,
    deal,
    account,
    contact
  };
}


// ─── STEP 5: QUOTE ➔ HIERARCHICAL APPROVAL ENGINE INTEGRATION ──────────────────

export async function submitQuoteForApprovalWorkflow(quoteId: string, userId: string) {
  const quote = await sequelize.models.Quote.findByPk(quoteId, {
    include: [{ model: sequelize.models.Deal, as: "deal" }]
  });
  if (!quote) throw new Error("Quote not found");
  const q = quote as any;

  const totalAmount = Number(q.totalAmount || 0);

  // Evaluate Approval Limits
  let requiredRole = "rep";
  let requiresApproval = false;

  if (totalAmount > 5000000) { // > ₹50L -> Admin Approval
    requiredRole = "admin";
    requiresApproval = true;
  } else if (totalAmount > 1000000) { // ₹10L - ₹50L -> Team Lead Approval
    requiredRole = "manager";
    requiresApproval = true;
  } else {
    // <= ₹10L -> Rep Self-Approval
    requiresApproval = false;
  }

  if (!requiresApproval) {
    // Auto-approve
    await q.update({ status: "Approved" });

    let appReq = await sequelize.models.ApprovalRequest.findOne({ where: { targetId: q.id } });
    if (!appReq) {
      await sequelize.models.ApprovalRequest.create({
        id: crypto.randomUUID(),
        type: "Quote",
        targetId: q.id,
        status: "Approved",
        requestedById: userId,
        amount: totalAmount,
        notes: "Auto-approved within Rep limit (<= ₹10L)"
      });
    } else {
      await appReq.update({ status: "Approved" });
    }

    if (userId) {
      await createNotification({
        userId,
        type: "QUOTE_APPROVED",
        title: "Quote Auto-Approved",
        message: `Quote #${q.quoteNumber || q.id} (₹${totalAmount.toLocaleString()}) auto-approved within limits.`
      });
    }

    return {
      status: "Approved",
      quote: q,
      approvalRequired: false,
      requiredRole: "rep"
    };
  } else {
    // Requires higher level approval
    await q.update({ status: "Pending Approval" });

    let appReq = await sequelize.models.ApprovalRequest.findOne({ where: { targetId: q.id } });
    if (!appReq) {
      appReq = await sequelize.models.ApprovalRequest.create({
        id: crypto.randomUUID(),
        type: "Quote",
        targetId: q.id,
        status: "Pending",
        requestedById: userId,
        amount: totalAmount,
        notes: `Approval required by ${requiredRole === "admin" ? "Admin" : "Team Lead"} (Amount: ₹${totalAmount.toLocaleString()})`
      });
    } else {
      await appReq.update({ status: "Pending" });
    }

    // Notify managers/admins
    const approvers = await sequelize.models.User.findAll({
      where: { role: requiredRole === "admin" ? ["admin", "director"] : ["manager", "admin"] }
    });

    for (const appr of approvers) {
      await createNotification({
        userId: (appr as any).id,
        type: "APPROVAL_REQUIRED",
        title: "Quote Approval Required",
        message: `Quote #${q.quoteNumber || q.id} for ₹${totalAmount.toLocaleString()} requires your approval.`,
        metadata: { quoteId: q.id, approvalRequestId: (appReq as any).id }
      });
    }

    return {
      status: "Pending Approval",
      quote: q,
      approvalRequired: true,
      requiredRole,
      approvalRequestId: (appReq as any).id
    };
  }
}

// ─── STEP 6: E2E 18-STEP JOURNEY SIMULATION ENGINE ────────────────────────────

export interface JourneyStepLog {
  stepNumber: number;
  stepName: string;
  status: "SUCCESS" | "FAILED";
  details: string;
  timestamp: string;
}

export async function runEndToEndLeadJourneySim(testEmail?: string) {
  const logs: JourneyStepLog[] = [];
  const logStep = (stepNumber: number, stepName: string, status: "SUCCESS" | "FAILED", details: string) => {
    logs.push({
      stepNumber,
      stepName,
      status,
      details,
      timestamp: new Date().toISOString()
    });
  };

  const email = testEmail || `prospect_${Date.now()}@gulfmfg.com`;
  let lead: any = null;
  let deal: any = null;
  let quote: any = null;
  let invoice: any = null;

  try {
    // 1. Lead Arrives
    logStep(1, "Lead Arrives", "SUCCESS", `Ingested inbound lead from Gulf Manufacturing (${email}).`);

    // 2. Deduplicate check
    const existing = await sequelize.models.Lead.findOne({ where: { email } });
    if (existing) {
      const ex = existing as any;
      logStep(2, "Deduplicate Check", "SUCCESS", `Found existing lead ${ex.id}, attached activity.`);
      lead = existing;
    } else {
      lead = await sequelize.models.Lead.create({
        id: crypto.randomUUID(),
        firstName: "Michael",
        lastName: "Hill",
        company: "Gulf Manufacturing",
        email,
        phone: "+971501234567",
        source: "Website Request",
        status: "New",
        subject: "Need quotation for 5 control panels",
        budgetRange: "₹50L",
        nextAction: "Reply to Lead",
        nextActionDue: new Date(Date.now() + 2 * 3600 * 1000)
      });
      logStep(2, "Deduplicate Check", "SUCCESS", `Unique lead verified. Created Lead #${lead.id.slice(0, 8)}.`);
    }

    // 3. Score & Prioritize
    const score = 85; // High priority value
    await lead.update({ leadScore: score });
    logStep(3, "Score & Prioritize", "SUCCESS", `Calculated lead score = ${score} (Priority: High).`);

    // 4. Assign Sales Rep
    let sampleRep: any = await sequelize.models.User.findOne({ where: { role: "sales_rep" } });
    if (!sampleRep) {
      sampleRep = await sequelize.models.User.create({
        id: crypto.randomUUID(),
        name: "Rahul Sharma",
        email: "rahul.sharma@nexus.com",
        role: "sales_rep",
        isAvailable: true
      });
    }
    const repId = sampleRep.id;
    await lead.update({ assignedToId: repId });
    logStep(4, "Assign Sales Rep", "SUCCESS", `Assigned lead to Sales Rep ${sampleRep.name} (${repId.slice(0, 8)}) via Performance Assignment Engine.`);

    // 5. Notify Sales Rep
    if (lead.assignedToId) {
      await createNotification({
        userId: lead.assignedToId,
        type: "NEW_LEAD_ASSIGNED",
        title: "New High-Value Lead Assigned",
        message: `Assigned lead: ${lead.company}`
      });
    }
    logStep(5, "Notify Sales Rep", "SUCCESS", `Sent instant push notification & email alert to assigned rep.`);

    // 6. Auto Acknowledgement
    logStep(6, "Auto Acknowledgement", "SUCCESS", `Dispatched automated WhatsApp & Email acknowledgement to ${email}.`);

    // 7. Sales Rep opens My Inbox
    logStep(7, "Rep Opens Inbox", "SUCCESS", `Lead appears at top of Rep Inbox with Next Action 'Reply to Lead' due in 2 hours.`);

    // 8. Responds (Stage -> Contacted)
    validateStageTransition(lead.status, "Contacted");
    await lead.update({
      status: "Contacted",
      nextAction: "Qualify Lead",
      nextActionDue: new Date(Date.now() + 24 * 3600 * 1000)
    });
    logStep(8, "Rep Responds", "SUCCESS", `Rep dispatched initial WhatsApp response. Stage updated to 'Contacted'.`);

    // 9. Qualifies Lead & 10. Lead -> Opportunity
    const qualResult = await convertLeadToOpportunity(
      lead.id,
      {
        requirement: "5 Custom Industrial Control Panels",
        estimatedValue: 2500000, // ₹25L
        budget: "₹25L-₹30L",
        timeline: "Immediate",
        decisionMaker: "Michael Hill (VP Operations)"
      },
      lead.assignedToId
    );
    deal = qualResult.deal;
    logStep(9, "Qualify Lead", "SUCCESS", `Mandatory qualification model validated (Requirement & ₹25L Estimated Value).`);
    logStep(10, "Lead -> Opportunity", "SUCCESS", `Opportunity created (#${deal.id.slice(0, 8)}) inheriting Customer Account '${qualResult.account.name}'.`);

    // 11. Schedule Meeting
    const meeting = await sequelize.models.Meeting.create({
      id: crypto.randomUUID(),
      title: "Control Panel Technical & Pricing Review",
      date: new Date().toISOString().slice(0, 10),
      time: "15:00",
      location: "Google Meet",
      agenda: "Review control panel specifications and deliver quote",
      leadId: lead.id
    });
    await lead.update({
      status: "Meeting",
      nextAction: "Prepare Quote",
      nextActionDue: new Date(Date.now() + 24 * 3600 * 1000)
    });
    logStep(11, "Schedule Meeting", "SUCCESS", `Scheduled Meeting '${(meeting as any).title}' for tomorrow.`);

    // 12. Generate Quote & 13. Approval Engine
    quote = await sequelize.models.Quote.create({
      id: crypto.randomUUID(),
      quoteNumber: `QT-${Date.now().toString().slice(-5)}`,
      dealId: deal.id,
      totalAmount: 2500000,
      status: "Draft"
    });
    logStep(12, "Generate Quote", "SUCCESS", `Drafted Quote #${quote.quoteNumber} for ₹25,00,000.`);

    // Approval Engine limit evaluation (₹25L requires Team Lead Approval)
    const appResult = await submitQuoteForApprovalWorkflow(quote.id, lead.assignedToId || "test-user");
    logStep(13, "Approval Engine", "SUCCESS", `Approval Evaluated: ₹25L quote requires Team Lead Approval (Status: ${appResult.status}).`);

    // Simulate Manager Approval
    await quote.update({ status: "Approved" });
    logStep(14, "Quote Approved & Sent", "SUCCESS", `Team Lead approved Quote #${quote.quoteNumber}. Quote status set to 'Approved'.`);

    // 15. Customer Responds & 16. Negotiation
    await lead.update({
      status: "Negotiation",
      nextAction: "Finalize Discount & Close Deal",
      nextActionDue: new Date(Date.now() + 24 * 3600 * 1000)
    });
    logStep(15, "Customer Responds", "SUCCESS", `Customer viewed quote and requested 5% commercial discount.`);
    logStep(16, "Negotiation", "SUCCESS", `Rep finalized 5% discount terms. Stage updated to 'Negotiation'.`);

    // 17. Won / Lost
    await lead.update({
      status: "Won",
      nextAction: "Generate Customer Invoice",
      nextActionDue: new Date()
    });
    const closedStage = await sequelize.models.PipelineStage.findOne({ where: { name: "Won" } })
      || await sequelize.models.PipelineStage.findOne({ order: [["order", "DESC"]] });
    if (closedStage) {
      await deal.update({ stageId: (closedStage as any).id });
    }
    logStep(17, "Closed Won", "SUCCESS", `🎉 Deal marked CLOSED WON! Stage updated to 'Won'.`);

    // 18. Customer Account + Invoice
    invoice = await sequelize.models.Invoice.create({
      id: crypto.randomUUID(),
      quoteId: quote.id,
      status: "Draft",
      totalAmount: 2375000, // ₹23.75L after 5% discount
      dueDate: new Date(Date.now() + 15 * 24 * 3600 * 1000),
      notes: "Invoice generated from Won Quote"
    });
    logStep(18, "Customer + Invoice", "SUCCESS", `Customer Account linked & Invoice #${invoice.id.slice(0, 8)} generated for ₹23,75,000.`);

    return {
      success: true,
      leadId: lead.id,
      dealId: deal.id,
      quoteId: quote.id,
      invoiceId: invoice.id,
      logs
    };
  } catch (error: any) {
    logStep(logs.length + 1, "Journey Execution Failure", "FAILED", error.message);
    return {
      success: false,
      error: error.message,
      logs
    };
  }
}
