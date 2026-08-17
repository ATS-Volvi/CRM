import { sequelize } from "@nexus-crm/database";
import { Op } from "sequelize";
import crypto from "crypto";

export interface QualificationData {
  requirement?: string;
  budget?: string | number;
  timeline?: string;
  decisionMaker?: string;
  estimatedValue?: number;
}

export function computeStageNextAction(status: string): { nextAction: string; hoursDue: number } {
  const normalized = (status || "NEW").trim().toUpperCase();
  switch (normalized) {
    case "NEW":
    case "NEW LEAD":
      return { nextAction: "Reply to Lead", hoursDue: 2 };
    case "CONTACTED":
      return { nextAction: "Qualify Lead", hoursDue: 24 };
    case "QUALIFIED":
      return { nextAction: "Prepare Quote", hoursDue: 24 };
    case "CONVERTED":
      return { nextAction: "Follow Up on Opportunity", hoursDue: 24 };
    case "NOT_CONVERTED":
      return { nextAction: "Closed Not Converted", hoursDue: 0 };
    // Opportunity pipeline stages
    case "DISCOVERY":
      return { nextAction: "Understand Customer Needs", hoursDue: 24 };
    case "REQUIREMENTS":
      return { nextAction: "Scope Requirements", hoursDue: 24 };
    case "SOLUTION/SCOPE":
    case "MEETING/DEMO":
    case "MEETING":
      return { nextAction: "Prepare Proposal", hoursDue: 24 };
    case "QUOTE PREPARATION":
      return { nextAction: "Generate Official Quote", hoursDue: 24 };
    case "QUOTE SENT":
    case "PROPOSAL":
      return { nextAction: "Follow Up on Quote", hoursDue: 48 };
    case "NEGOTIATION":
      return { nextAction: "Finalize Terms & Close", hoursDue: 24 };
    case "AGREED":
      return { nextAction: "Prepare Order & Contract", hoursDue: 24 };
    case "WON":
    case "CLOSED WON":
      return { nextAction: "Create Invoice", hoursDue: 0 };
    case "LOST":
    case "CLOSED LOST":
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

  // 1. Save qualification drawer data & advance stage to QUALIFIED
  const nextActionConfig = computeStageNextAction("QUALIFIED");
  const nextActionDue = new Date(Date.now() + nextActionConfig.hoursDue * 3600 * 1000);

  // 2. Seamless Automatic Account linking
  let account: any = null;
  const accountName = l.company || `${l.firstName} ${l.lastName}`.trim();
  
  if (sequelize.models.Account) {
    account = await sequelize.models.Account.findOne({
      where: { name: { [Op.like]: `%${accountName}%` } }
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

  // 3. Find or create Contact
  let contact: any = null;
  if (sequelize.models.Contact) {
    if (l.email) {
      contact = await sequelize.models.Contact.findOne({ where: { email: l.email } });
    }
    if (!contact && account) {
      contact = await sequelize.models.Contact.create({
        id: crypto.randomUUID(),
        accountId: account.id,
        firstName: l.firstName,
        lastName: l.lastName,
        email: l.email,
        phone: l.phone,
        role: "Decision Maker",
        sourceChannel: l.source || "Direct"
      });
    } else if (contact && !contact.accountId && account) {
      await contact.update({ accountId: account.id });
    }
  }

  // 4. Seamless Automatic Opportunity (Deal) creation
  let deal: any = await sequelize.models.Deal.findOne({ where: { leadId: l.id } });
  if (!deal) {
    const stage = await sequelize.models.PipelineStage.findOne({ where: { name: "Requirements" } })
      || await sequelize.models.PipelineStage.findOne({ where: { name: "Discovery" } })
      || await sequelize.models.PipelineStage.findOne({ order: [["order", "ASC"]] });

    deal = await sequelize.models.Deal.create({
      id: crypto.randomUUID(),
      name: l.company ? `${l.company} Opportunity` : `${l.firstName} ${l.lastName} Opportunity`,
      amount: estimatedValue,
      stageId: stage ? (stage as any).id : null,
      leadId: l.id,
      accountId: account ? account.id : null,
      customerId: account ? account.id : null,
      ownerId: l.assignedToId || userId
    });
  } else {
    await deal.update({ 
      amount: estimatedValue,
      accountId: account ? account.id : deal.accountId,
      customerId: account ? account.id : deal.customerId
    });
  }

  // 5. Link Contact to Deal
  if (contact && deal && sequelize.models.DealContact) {
    const existingDealContact = await sequelize.models.DealContact.findOne({
      where: { dealId: deal.id, contactId: contact.id }
    });
    if (!existingDealContact) {
      await sequelize.models.DealContact.create({
        id: crypto.randomUUID(),
        dealId: deal.id,
        contactId: contact.id,
        role: "Primary",
        isPrimary: true
      });
    }
  }

  // 6. Update Lead record with Qualification details & Next Action
  await l.update({
    status: "QUALIFIED",
    nextAction: nextActionConfig.nextAction,
    nextActionDue,
    accountId: account ? account.id : l.accountId,
    customerId: account ? account.id : l.customerId,
    qualificationData: {
      ...qualificationData,
      qualifiedAt: new Date().toISOString(),
      qualifiedBy: userId || l.assignedToId
    },
    leadScore: Math.min(100, (l.leadScore || 50) + 25)
  });

  // 7. Log Qualification activity record
  await sequelize.models.Activity.create({
    id: crypto.randomUUID(),
    leadId: l.id,
    type: "Note",
    notes: `🎯 Lead Qualified! Requirement: "${qualificationData.requirement || 'N/A'}", Est. Value: ₹${estimatedValue.toLocaleString('en-IN')}, Timeline: ${qualificationData.timeline || 'N/A'}. Opportunity auto-created.`,
    createdById: userId || l.assignedToId,
    direction: "internal"
  });

  return { lead, account, contact, deal };
}
