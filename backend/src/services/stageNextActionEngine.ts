import { sequelize } from "@nexus-crm/database";
import crypto from "crypto";

export interface QualificationData {
  requirement?: string;
  budget?: string | number;
  timeline?: string;
  decisionMaker?: string;
  estimatedValue?: number;
}

export function computeStageNextAction(status: string): { nextAction: string; hoursDue: number } {
  const normalized = (status || "New").trim();
  switch (normalized) {
    case "New":
    case "New Lead":
      return { nextAction: "Reply to Lead", hoursDue: 2 };
    case "Contacted":
      return { nextAction: "Qualify Lead", hoursDue: 24 };
    case "Qualified":
      return { nextAction: "Prepare Quote", hoursDue: 24 };
    case "Meeting/Demo":
    case "Meeting":
      return { nextAction: "Prepare Quote", hoursDue: 24 };
    case "Proposal":
    case "Quote Sent":
      return { nextAction: "Follow Up on Quote", hoursDue: 48 };
    case "Negotiation":
      return { nextAction: "Finalize Terms & Close", hoursDue: 24 };
    case "Won":
    case "Closed Won":
      return { nextAction: "Create Invoice", hoursDue: 0 };
    case "Lost":
    case "Closed Lost":
      return { nextAction: "Closed Lost", hoursDue: 0 };
    default:
      return { nextAction: "Follow Up", hoursDue: 24 };
  }
}

export async function qualifyLeadWorkflow(leadId: string, qualificationData: QualificationData, userId?: string) {
  const lead = await sequelize.models.Lead.findByPk(leadId);
  if (!lead) throw new Error("Lead not found");

  const l = lead as any;
  const estimatedValue = qualificationData.estimatedValue || (qualificationData.budget ? Number(qualificationData.budget) : 50000);

  // 1. Save qualification drawer data & advance stage to Qualified
  const nextActionConfig = computeStageNextAction("Qualified");
  const nextActionDue = new Date(Date.now() + nextActionConfig.hoursDue * 3600 * 1000);

  await l.update({
    status: "Qualified",
    nextAction: nextActionConfig.nextAction,
    nextActionDue,
    qualificationData: {
      ...qualificationData,
      qualifiedAt: new Date().toISOString(),
      qualifiedBy: userId || l.assignedToId
    },
    leadScore: Math.min(100, (l.leadScore || 50) + 25)
  });

  // 2. Seamless Automatic Account (Customer) linking
  let account: any = null;
  const accountName = l.company || `${l.firstName} ${l.lastName}`.trim();
  
  if (sequelize.models.Account) {
    account = await sequelize.models.Account.findOne({
      where: { name: accountName }
    });

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
  }

  // 3. Seamless Automatic Opportunity (Deal) creation
  let deal: any = await sequelize.models.Deal.findOne({ where: { leadId: l.id } });
  if (!deal) {
    const stage = await sequelize.models.PipelineStage.findOne({ where: { name: "Qualified" } })
      || await sequelize.models.PipelineStage.findOne({ order: [["order", "ASC"]] });

    deal = await sequelize.models.Deal.create({
      id: crypto.randomUUID(),
      name: l.company ? `${l.company} Opportunity` : `${l.firstName} ${l.lastName} Opportunity`,
      amount: estimatedValue,
      stageId: stage ? (stage as any).id : null,
      leadId: l.id,
      ownerId: l.assignedToId || userId
    });
  } else {
    await deal.update({ amount: estimatedValue });
  }

  // 4. Log Qualification activity record
  await sequelize.models.Activity.create({
    id: crypto.randomUUID(),
    leadId: l.id,
    type: "Note",
    notes: `🎯 Lead Qualified! Requirement: "${qualificationData.requirement || 'N/A'}", Est. Value: ₹${estimatedValue.toLocaleString('en-IN')}, Timeline: ${qualificationData.timeline || 'N/A'}. Opportunity auto-created.`,
    createdById: userId || l.assignedToId,
    status: "Completed"
  });

  return { lead, account, deal };
}
