import { Request, Response } from "express";
import { sequelize } from "@nexus-crm/database";
import { triggerTemplatedEmail } from "../services/emailService";
import { assignLeadToSalesperson } from "../services/leadAssignmentService";
import { ingestLead } from "../services/leadIngestion";
import crypto from "crypto";

export const getLeads = async (req: Request, res: Response) => {
  try {
    const { source, status, search } = req.query;
    const where: any = {};
    
    if (source && source !== "All Sources") {
      where.source = source.toString();
    }
    
    if (status && status !== "All Statuses") {
      where.status = status;
    }

    const leads = await sequelize.models.Lead.findAll({
      where,
      include: [
        {
          model: sequelize.models.User,
          as: "assignedTo",
          attributes: ["id", "name", "email"]
        }
      ],
      order: [["createdAt", "DESC"]]
    });

    res.json(leads);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createLead = async (req: Request, res: Response) => {
  try {
    const { firstName, lastName, email, company, source, status, industry, phone, budgetRange } = req.body;
    
    const leadId = await ingestLead({
      firstName,
      lastName,
      email,
      phone,
      company,
      source: source || 'email',
      industry,
      budgetRange,
      rawPayload: req.body
    });

    const lead = await sequelize.models.Lead.findByPk(leadId);
    if (email) {
      const slaHours = process.env.LEAD_RESPONSE_SLA_HOURS || "24";
      triggerTemplatedEmail("lead_acknowledgement", email, { 
        lead_name: firstName, 
        sla_hours: slaHours 
      }, (lead as any).id).catch(err => console.error("Email send failed:", err));
    }
    res.status(201).json(lead);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateLead = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    const lead = await sequelize.models.Lead.findByPk(id as string);
    if (!lead) return res.status(404).json({ error: "Lead not found" });
    
    if (updateData.assignedToId && updateData.assignedToId !== (lead as any).assignedToId) {
      await assignLeadToSalesperson(lead, updateData.assignedToId);
      delete updateData.assignedToId;
    }

    await lead.update(updateData);
    res.json(lead);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const convertLead = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const lead = await sequelize.models.Lead.findByPk(String(id));
    if (!lead) return res.status(404).json({ error: "Lead not found" });

    const l = lead as any;

    // Check if customer already exists for this lead
    let customer = l.customerId ? await sequelize.models.Customer.findByPk(l.customerId) : null;
    if (!customer) {
      customer = await sequelize.models.Customer.create({
        id: crypto.randomUUID(),
        name: l.company || `${l.firstName} ${l.lastName}`.trim(),
        primaryContactName: `${l.firstName} ${l.lastName}`.trim(),
        email: l.email,
        phone: l.phone,
        address: l.address || null,
        industry: l.industry || "General"
      });
      await l.update({ customerId: (customer as any).id, status: "Qualified" });
    }

    // Get or create deal for this lead
    let deal = await sequelize.models.Deal.findOne({ where: { leadId: l.id } });
    if (!deal) {
      const stage = await sequelize.models.PipelineStage.findOne({ where: { name: "Qualified" } })
        || await sequelize.models.PipelineStage.findOne({ order: [["order", "ASC"]] });

      deal = await sequelize.models.Deal.create({
        id: crypto.randomUUID(),
        name: l.company ? `${l.company} Opportunity` : `${l.firstName} ${l.lastName} Opportunity`,
        amount: l.leadScore ? l.leadScore * 1000 : 50000,
        stageId: stage ? (stage as any).id : null,
        leadId: l.id,
        ownerId: l.assignedToId || (req as any).user?.id,
        customerId: (customer as any).id
      });
    } else {
      await deal.update({ customerId: (customer as any).id });
    }

    res.json({ message: "Lead converted to Customer and Deal successfully", customer, deal });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getDuplicateLeads = async (req: Request, res: Response) => {
  try {
    const leads = await sequelize.models.Lead.findAll();
    
    const groups: { [key: string]: any[] } = {};
    leads.forEach((l: any) => {
      const key = l.email ? l.email.toLowerCase() : l.company ? l.company.toLowerCase() : l.id;
      if (!groups[key]) groups[key] = [];
      groups[key].push(l);
    });

    const duplicateGroups = Object.values(groups).filter(g => g.length > 1);
    res.json(duplicateGroups);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const mergeLeads = async (req: Request, res: Response) => {
  try {
    const { masterId, duplicateIds } = req.body;
    const models = sequelize.models;
    
    await models.Deal.update({ leadId: masterId }, { where: { leadId: duplicateIds } });
    await models.Activity.update({ leadId: masterId }, { where: { leadId: duplicateIds } });
    await models.LeadStageHistory.update({ leadId: masterId }, { where: { leadId: duplicateIds } });
    await models.ScheduledEmail.update({ leadId: masterId }, { where: { leadId: duplicateIds } });

    await models.Lead.destroy({ where: { id: duplicateIds } });

    res.json({ success: true, message: `Merged ${duplicateIds.length} duplicates into master ${masterId}` });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteLead = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const deletedCount = await sequelize.models.Lead.destroy({ where: { id: String(id) } });
    if (deletedCount === 0) {
       return res.status(404).json({ error: "Lead not found" });
    }
    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const handleUnsubscribe = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const lead = await sequelize.models.Lead.findByPk(String(id));
    if (!lead) return res.status(404).send("Lead not found.");

    const l = lead as any;
    if (!l.optedOutEmail) {
      l.optedOutEmail = true;
      await l.save();

      await sequelize.models.Activity.create({
        id: crypto.randomUUID(),
        leadId: l.id,
        type: "Email",
        status: "Completed",
        assignedToId: l.assignedToId,
        notes: "Client clicked Unsubscribe. All future marketing/templated emails are now blocked."
      });
    }

    const html = `
    <html>
      <body style="font-family: sans-serif; text-align: center; margin-top: 50px;">
        <h2>Unsubscribed Successfully</h2>
        <p>You have been removed from our mailing list. You will no longer receive automated emails from us.</p>
      </body>
    </html>
    `;
    res.send(html);
  } catch (error: any) {
    res.status(500).send("An error occurred processing your request.");
  }
};

export const reassignLead = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { newAssignedToId, reason } = req.body;
    const caller = (req as any).user;

    if (!caller) return res.status(401).json({ error: "Unauthorized" });

    const lead = await sequelize.models.Lead.findByPk(String(id));
    if (!lead) return res.status(404).json({ error: "Lead not found" });

    const oldAssignedToId = (lead as any).assignedToId;
    await lead.update({ assignedToId: newAssignedToId || null });

    await sequelize.models.LeadReassignmentHistory.create({
      id: crypto.randomUUID(),
      leadId: id,
      oldAssignedToId: oldAssignedToId || null,
      newAssignedToId: newAssignedToId || null,
      changedByUserId: caller.id,
      reason: reason || null
    });

    res.json({ message: "Lead reassigned successfully", lead });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getLeadReassignmentHistory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const history = await sequelize.models.LeadReassignmentHistory.findAll({
      where: { leadId: id },
      include: [
        { model: sequelize.models.User, as: "oldAssignee", attributes: ["id", "name", "email"] },
        { model: sequelize.models.User, as: "newAssignee", attributes: ["id", "name", "email"] },
        { model: sequelize.models.User, as: "changedByUser", attributes: ["id", "name", "email"] }
      ],
      order: [["createdAt", "DESC"]]
    });
    res.json(history);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getLeadDealForQuote = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const lead = await sequelize.models.Lead.findByPk(String(id));
    if (!lead) return res.status(404).json({ error: "Lead not found" });

    let deal = await sequelize.models.Deal.findOne({ where: { leadId: (lead as any).id } });
    if (deal) return res.json(deal);

    const validStages = ["New", "Contacted", "Qualified", "Meeting/Demo", "Proposal", "Negotiation", "Won", "Lost", "On Hold"];
    const searchStatus = (lead as any).status === "New Lead" ? "New" : (lead as any).status;
    let stage = null;
    if (validStages.includes(searchStatus)) {
      stage = await sequelize.models.PipelineStage.findOne({ where: { name: searchStatus } });
    }
    if (!stage) {
      stage = await sequelize.models.PipelineStage.findOne({ order: [['order', 'ASC']] });
    }

    const ownerId = (lead as any).assignedToId || (req as any).user?.id;
    const name = (lead as any).company || `${(lead as any).firstName} ${(lead as any).lastName} Deal`;
    const amount = (lead as any).leadScore ? (lead as any).leadScore * 100 : 0;

    deal = await sequelize.models.Deal.create({
      id: crypto.randomUUID(),
      name,
      amount,
      stageId: stage ? (stage as any).id : null,
      leadId: (lead as any).id,
      ownerId,
      customerId: (lead as any).customerId || null
    });

    res.status(201).json(deal);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getLead = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const lead = await sequelize.models.Lead.findByPk(String(id));
    if (!lead) return res.status(404).json({ error: "Lead not found" });
    res.json(lead);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
