import { Request, Response } from "express";
import { sequelize } from "@nexus-crm/database";
import { Op } from "sequelize";
import { triggerTemplatedEmail } from "../services/emailService";
import { assignLeadToSalesperson } from "../services/leadAssignmentService";
import { ingestLead } from "../services/leadIngestion";
import { updateLeadTemperature } from "../services/leadTemperatureService";
import { autoAssignDeal } from "../services/dealAssignmentEngine";
import { getLeadAccessLevel } from "../services/handoffAccessService";
import crypto from "crypto";

export const getLeads = async (req: Request, res: Response) => {
  try {
    const { source, channel, status, search, page, limit } = req.query;
    const user = (req as any).user;
    const where: any = {};

    // Data isolation for Sales Representatives: Only return leads assigned to them
    if (user && (user.role === "sales_rep" || user.role === "salesperson")) {
      where.assignedToId = user.id;
    }

    const rawSource = (source || channel)?.toString();
    if (rawSource && rawSource !== "ALL" && rawSource !== "All Channels" && rawSource !== "All Sources") {
      const lower = rawSource.toLowerCase();
      const likeOp = (Op as any).iLike || Op.like;
      if (lower === "whatsapp") {
        where.source = { [likeOp]: "%whatsapp%" };
      } else if (lower === "email") {
        where.source = { [likeOp]: "%email%" };
      } else if (lower === "website") {
        where.source = { [likeOp]: "%website%" };
      } else if (lower === "instagram") {
        where.source = { [likeOp]: "%instagram%" };
      } else if (lower === "facebook" || lower === "meta") {
        where.source = { [Op.or]: [{ [likeOp]: "%facebook%" }, { [likeOp]: "%meta%" }] };
      } else if (lower === "linkedin") {
        where.source = { [likeOp]: "%linkedin%" };
      } else if (lower === "referral") {
        where.source = { [likeOp]: "%referral%" };
      } else {
        where.source = { [Op.or]: [{ [Op.eq]: rawSource }, { [likeOp]: rawSource }] };
      }
    }

    if (status && status !== "All Statuses" && status !== "ALL") {
      where.status = status;
    }

    if (search) {
      const q = `%${search}%`;
      where[Op.or] = [
        { firstName: { [Op.like]: q } },
        { lastName: { [Op.like]: q } },
        { company: { [Op.like]: q } },
        { email: { [Op.like]: q } },
        { phone: { [Op.like]: q } }
      ];
    }

    // Server-side pagination: ?page=1&limit=50 (default 50, max 200)
    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit as string) || 50));
    const offset = (pageNum - 1) * limitNum;

    const isPaginated = !!(page || limit);

    // Compute live channel counts for quick-filter tabs
    const countsWhere: any = {};
    if (user && (user.role === "sales_rep" || user.role === "salesperson")) {
      countsWhere.assignedToId = user.id;
    }
    if (status && status !== "All Statuses" && status !== "ALL") {
      countsWhere.status = status;
    }

    const sourceCountsRaw: any[] = await sequelize.models.Lead.findAll({
      attributes: [
        "source",
        [sequelize.fn("COUNT", sequelize.col("id")), "count"]
      ],
      where: countsWhere,
      group: ["source"],
      raw: true
    });

    const channelCounts: Record<string, number> = {
      ALL: 0,
      Website: 0,
      Email: 0,
      WhatsApp: 0,
      Instagram: 0,
      LinkedIn: 0,
      Facebook: 0,
      Referral: 0
    };

    for (const row of sourceCountsRaw) {
      const c = parseInt(row.count, 10) || 0;
      channelCounts.ALL += c;
      const s = (row.source || "").toLowerCase();
      if (s.includes("website")) channelCounts.Website += c;
      else if (s.includes("email")) channelCounts.Email += c;
      else if (s.includes("whatsapp")) channelCounts.WhatsApp += c;
      else if (s.includes("instagram")) channelCounts.Instagram += c;
      else if (s.includes("linkedin")) channelCounts.LinkedIn += c;
      else if (s.includes("facebook") || s.includes("meta")) channelCounts.Facebook += c;
      else if (s.includes("referral")) channelCounts.Referral += c;
    }

    if (isPaginated) {
      // Paginated response: return envelope with metadata
      const { count, rows } = await sequelize.models.Lead.findAndCountAll({
        where,
        include: [
          {
            model: sequelize.models.User,
            as: "assignedTo",
            attributes: ["id", "name", "email"]
          },
          {
            model: sequelize.models.LeadContact,
            as: "contacts",
            attributes: ["id", "firstName", "lastName", "email", "phone", "role", "sourceChannel", "createdAt"]
          }
        ],
        order: [
          ["lastWhatsappAt", "DESC NULLS LAST"],
          ["createdAt", "DESC"]
        ],
        limit: limitNum,
        offset,
        distinct: true // avoid inflated count due to hasMany include
      });

      return res.json({
        data: rows,
        total: count,
        page: pageNum,
        totalPages: Math.ceil(count / limitNum),
        limit: limitNum,
        channelCounts
      });
    }

    // Non-paginated (legacy) — keep backward compatibility for pages that
    // haven't been updated yet; returns plain array
    const leads = await sequelize.models.Lead.findAll({
      where,
      include: [
        {
          model: sequelize.models.User,
          as: "assignedTo",
          attributes: ["id", "name", "email"]
        },
        {
          model: sequelize.models.LeadContact,
          as: "contacts",
          attributes: ["id", "firstName", "lastName", "email", "phone", "role", "message", "sourceChannel", "createdAt"]
        }
      ],
      // WhatsApp leads with recent messages bubble to the top;
      // everything else sorted by creation date descending
      order: [
        ["lastWhatsappAt", "DESC NULLS LAST"],
        ["createdAt", "DESC"]
      ]
    });

    res.json(leads);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * GET /api/v1/leads/:id
 * Fetches a SINGLE lead by primary key — avoids downloading all leads for detail view.
 */
export const getLeadById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;

    const lead = await sequelize.models.Lead.findByPk(String(id), {
      include: [
        {
          model: sequelize.models.User,
          as: "assignedTo",
          attributes: ["id", "name", "email", "role"]
        },
        {
          model: sequelize.models.LeadContact,
          as: "contacts",
          attributes: ["id", "firstName", "lastName", "email", "phone", "role", "message", "sourceChannel", "createdAt"]
        }
      ]
    });

    if (!lead) return res.status(404).json({ error: "Lead not found" });

    // Handoff access evaluation (current owner, admin/manager, or prior owner)
    const access = await getLeadAccessLevel(user?.id, user?.role, lead);
    if (!access.canRead) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const leadJson = typeof lead.toJSON === "function" ? lead.toJSON() : lead;
    res.json({
      ...leadJson,
      isViewOnly: access.isViewOnly,
      userPermission: access.accessLevel
    });
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

import { computeStageNextAction, qualifyLeadWorkflow } from "../services/stageNextActionEngine";

export const updateLead = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;
    const updateData = req.body;
    const lead = await sequelize.models.Lead.findByPk(id as string);
    if (!lead) return res.status(404).json({ error: "Lead not found" });

    const access = await getLeadAccessLevel(user?.id, user?.role, lead);
    if (!access.canWrite) {
      return res.status(403).json({
        error: access.reason || "Handed off — view only. This lead has been reassigned to another representative.",
        isViewOnly: true
      });
    }

    if (updateData.assignedToId && updateData.assignedToId !== (lead as any).assignedToId) {
      await assignLeadToSalesperson(lead, updateData.assignedToId);
      delete updateData.assignedToId;
    }

    // Auto-calculate nextAction & nextActionDue when status changes if not manually provided
    if (updateData.status && updateData.status !== (lead as any).status && !updateData.nextAction) {
      const config = computeStageNextAction(updateData.status);
      updateData.nextAction = config.nextAction;
      if (config.hoursDue > 0) {
        updateData.nextActionDue = new Date(Date.now() + config.hoursDue * 3600 * 1000);
      } else {
        updateData.nextActionDue = null;
      }
    }

    // Map expectedValue/estimatedValue/notes/requirements to qualificationData & body for clean persistence
    if (updateData.expectedValue !== undefined || updateData.estimatedValue !== undefined || updateData.requirements !== undefined || updateData.notes !== undefined) {
      const existingQual = (lead as any).qualificationData || {};
      const estVal = updateData.expectedValue !== undefined ? updateData.expectedValue : updateData.estimatedValue;
      const reqTxt = updateData.requirements !== undefined ? updateData.requirements : updateData.notes;
      
      updateData.qualificationData = {
        ...existingQual,
        ...(estVal !== undefined ? { estimatedValue: estVal } : {}),
        ...(reqTxt !== undefined ? { requirement: reqTxt, notes: reqTxt } : {})
      };
      if (reqTxt && !updateData.body) {
        updateData.body = reqTxt;
      }
      if (estVal && !updateData.budgetRange) {
        updateData.budgetRange = String(estVal);
      }
      delete updateData.expectedValue;
      delete updateData.estimatedValue;
      delete updateData.requirements;
      delete updateData.notes;
    }

    await lead.update(updateData);

    const { checkAndAutoAdvanceLead } = require("../services/leadStageAutomationService");
    await checkAndAutoAdvanceLead((lead as any).id || id, { userId: (req as any).user?.id });

    // Reload fresh lead state after potential auto-transitions
    await lead.reload();
    res.json(lead);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * POST /api/v1/leads/:id/qualify
 * Qualifies a lead using the 5-field Qualification Drawer payload.
 * Auto-creates linked Account (Customer) and Deal (Opportunity),
 * sets status -> Qualified, and updates nextAction -> Prepare Quote.
 */
export const qualifyLeadEndpoint = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;
    const qualificationData = req.body;

    const lead = await sequelize.models.Lead.findByPk(id as string);
    if (!lead) return res.status(404).json({ error: "Lead not found" });

    const access = await getLeadAccessLevel(user?.id, user?.role, lead);
    if (!access.canWrite) {
      return res.status(403).json({
        error: access.reason || "Handed off — view only. This lead has been reassigned to another representative.",
        isViewOnly: true
      });
    }

    const { convertLeadToOpportunity } = require("../services/leadJourneyWorkflowEngine");

    const result = await convertLeadToOpportunity(String(id), qualificationData?.qualificationData || qualificationData, user?.id);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};


export const convertLead = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const user = (req as any).user;

    const lead = await sequelize.models.Lead.findByPk(id);
    if (!lead) return res.status(404).json({ error: "Lead not found" });

    const access = await getLeadAccessLevel(user?.id, user?.role, lead);
    if (!access.canWrite) {
      return res.status(403).json({
        error: access.reason || "Handed off — view only. This lead has been reassigned to another representative.",
        isViewOnly: true
      });
    }

    const { convertLeadToOpportunity } = require("../services/leadJourneyWorkflowEngine");
    const result = await convertLeadToOpportunity(
      id,
      req.body?.qualificationData || req.body,
      (req as any).user?.id
    );

    res.json({
      message: "Lead converted to Account, Contact and Opportunity successfully",
      account: result.account,
      contact: result.contact,
      deal: result.deal,
      opportunity: result.deal,
      lead: result.lead,
      // Surfaced so the frontend can show "needs manual assignment" if desired
      autoAssigned: result.autoAssigned ?? false,
      autoAssignReason: result.autoAssignReason
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const markLeadNotConverted = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const { reason } = req.body;
    const lead = await sequelize.models.Lead.findByPk(id);
    if (!lead) return res.status(404).json({ error: "Lead not found" });

    if ((lead as any).status === "CONVERTED") {
      return res.status(400).json({ error: "Cannot mark an already converted lead as not converted." });
    }

    await (lead as any).update({
      status: "NOT_CONVERTED",
      nextAction: "Archive or Re-engage Later",
      nextActionDue: null,
      notes: reason ? `${(lead as any).notes || ""}\nDisqualification Reason: ${reason}`.trim() : (lead as any).notes
    });

    res.json({ message: "Lead marked as not converted", lead });
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
    const userId = (req as any).user?.id;
    const userRole = (req as any).user?.role;
    const models = sequelize.models;

    if (!masterId || !duplicateIds || !Array.isArray(duplicateIds)) {
      return res.status(400).json({ error: "masterId and duplicateIds array are required" });
    }

    const masterLead = await models.Lead.findByPk(String(masterId));
    if (!masterLead) {
      return res.status(404).json({ error: "Master lead not found" });
    }

    // Evaluate write access ONLY on the master lead being merged into
    const access = await getLeadAccessLevel(userId, userRole, masterLead);
    if (!access.canWrite) {
      return res.status(403).json({
        error: access.reason || "Handed off — view only. You cannot merge leads into a master lead you do not own.",
        isViewOnly: true
      });
    }
    
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
    const user = (req as any).user;
    const lead = await sequelize.models.Lead.findByPk(String(id));
    if (!lead) return res.status(404).json({ error: "Lead not found" });

    const access = await getLeadAccessLevel(user?.id, user?.role, lead);
    if (!access.canWrite) {
      return res.status(403).json({
        error: access.reason || "Handed off — view only. This lead has been reassigned to another representative.",
        isViewOnly: true
      });
    }

    await lead.destroy();
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
        notes: "Client clicked Unsubscribe. All future marketing/templated emails are now blocked.",
      direction: "internal"
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

    const triggerUserId = (lead as any).assignedToId || (req as any).user?.id;
    const name = (lead as any).company || `${(lead as any).firstName} ${(lead as any).lastName} Deal`;
    const amount = (lead as any).leadScore ? (lead as any).leadScore * 100 : 0;

    deal = await sequelize.models.Deal.create({
      id: crypto.randomUUID(),
      name,
      amount,
      stageId: stage ? (stage as any).id : null,
      leadId: (lead as any).id,
      ownerId: triggerUserId,
      customerId: (lead as any).customerId || null
    });

    // Attempt auto-assignment to a senior_ae — best-effort, non-blocking.
    // autoAssignDeal persists the ownerId change to DB internally.
    try {
      const assignResult = await autoAssignDeal((deal as any).id, triggerUserId);
      if (assignResult && assignResult.assigned) {
        // Reload so the response body reflects the updated ownerId
        await (deal as any).reload();
        console.log(`[getLeadDealForQuote] Deal ${(deal as any).id} auto-assigned to senior_ae ${assignResult.newOwnerId}.`);
      } else if (assignResult && !assignResult.assigned) {
        console.log(`[getLeadDealForQuote] No eligible senior_ae for deal ${(deal as any).id} — leaving with triggering user. Reason: ${assignResult.reason}`);
      }
    } catch (assignErr: any) {
      console.warn("[getLeadDealForQuote] Auto-assignment attempt failed (non-fatal):", assignErr?.message || assignErr);
    }

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

export const getLeadAccountHistory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const currentLead: any = await sequelize.models.Lead.findByPk(String(id));
    if (!currentLead) return res.status(404).json({ error: "Lead not found" });

    const orConditions: any[] = [];
    if (currentLead.accountId) orConditions.push({ accountId: currentLead.accountId });
    if (currentLead.customerId) orConditions.push({ customerId: currentLead.customerId });
    if (currentLead.company) orConditions.push({ company: currentLead.company });
    if (currentLead.email) orConditions.push({ email: currentLead.email });
    if (currentLead.phone) orConditions.push({ phone: currentLead.phone });

    const relatedLeads = orConditions.length > 0 ? await sequelize.models.Lead.findAll({
      where: {
        [Op.or]: orConditions,
        id: { [Op.ne]: currentLead.id }
      },
      include: [
        { model: sequelize.models.User, as: "assignedTo", attributes: ["id", "name", "email"] }
      ],
      order: [["createdAt", "DESC"]],
      limit: 20
    }) : [];

    const allLeadIds = [currentLead.id, ...relatedLeads.map((l: any) => l.id)];

    const deals = await sequelize.models.Deal.findAll({
      where: {
        [Op.or]: [
          { leadId: { [Op.in]: allLeadIds } },
          ...(currentLead.accountId ? [{ accountId: currentLead.accountId }] : [])
        ]
      },
      order: [["createdAt", "DESC"]],
      limit: 10
    });

    const dealIds = deals.map((d: any) => d.id);
    const quotes = dealIds.length > 0 ? await sequelize.models.Quote.findAll({
      where: { dealId: { [Op.in]: dealIds } },
      order: [["createdAt", "DESC"]],
      limit: 15
    }) : [];

    res.json({
      relatedLeads,
      deals,
      quotes
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const clearUnreadCount = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const lead = await sequelize.models.Lead.findByPk(String(id));
    if (!lead) return res.status(404).json({ error: "Lead not found" });
    await lead.update({ unreadWhatsappCount: 0 });
    res.json({ success: true, unreadWhatsappCount: 0 });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Generates an AI summary of what a specific lead wants, filtering out conversational noise
 * and extracting structured, actionable deliverables, specifications, and commercial parameters.
 */
export const getLeadAiSummary = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { synthesizeLeadRequirements } = require("../services/aiRequirementSynthesis");
    const result = await synthesizeLeadRequirements(String(id));
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Manually set the temperature for a lead (overrides automatic decay).
 */
export const updateTemperature = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { temperature } = req.body;
    
    if (!["Hot", "Warm", "Cold"].includes(temperature)) {
      return res.status(400).json({ error: "Invalid temperature" });
    }

    const lead = await sequelize.models.Lead.findByPk(id);
    if (!lead) {
      return res.status(404).json({ error: "Lead not found" });
    }

    await lead.update({
      temperature,
      temperatureOverride: true
    });

    res.status(200).json({ success: true, temperature, override: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Removes the manual override and recalculates temperature based on decay.
 */
export const unlockTemperature = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    
    const lead = await sequelize.models.Lead.findByPk(id);
    if (!lead) {
      return res.status(404).json({ error: "Lead not found" });
    }

    (lead as any).temperatureOverride = false;
    await lead.save();
    
    await updateLeadTemperature(lead);

    res.status(200).json({ success: true, temperature: (lead as any).temperature, override: false });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getLeadContacts = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const LeadContactModel = sequelize.models.LeadContact;
    if (!LeadContactModel) {
      return res.status(200).json([]);
    }

    const contacts = await LeadContactModel.findAll({
      where: { leadId: id },
      order: [["createdAt", "DESC"]]
    });

    res.status(200).json(contacts);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const runE2eLeadJourneyEndpoint = async (req: Request, res: Response) => {
  try {
    const { runEndToEndLeadJourneySim } = require("../services/leadJourneyWorkflowEngine");
    const { testEmail } = req.body || {};
    
    const result = await runEndToEndLeadJourneySim(testEmail);
    return res.status(result.success ? 200 : 500).json(result);
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

export const getLeadMissingInfo = async (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { getMissingLeadInformation } = require("../services/leadIntakeAutomationEngine");
    const result = await getMissingLeadInformation(id);
    const lead = await sequelize.models.Lead.findByPk(id);
    return res.status(200).json({
      ...result,
      intakeStatus: lead ? (lead as any).intakeStatus : "INCOMPLETE",
      intakeMessageCount: lead ? (lead as any).intakeMessageCount : 0
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

export const requestMissingDetails = async (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { channel } = req.body || {};
    const { getMissingLeadInformation, generateCollectionMessage } = require("../services/leadIntakeAutomationEngine");
    const { sendWhatsAppMessage } = require("../services/whatsappService");
    const { sendCustomEmail } = require("../services/emailService");
    
    const lead = await sequelize.models.Lead.findByPk(id) as any;
    if (!lead) {
      return res.status(404).json({ error: "Lead not found" });
    }

    const missingInfo = await getMissingLeadInformation(lead);
    if (missingInfo.isComplete) {
      return res.status(200).json({ message: "Lead profile is already complete", isComplete: true });
    }

    const targetChannel = channel || (lead.communicationChannel === "whatsapp" ? "whatsapp" : "email");
    const message = generateCollectionMessage(missingInfo.missing, targetChannel, missingInfo.known.name);

    if (targetChannel === "whatsapp" && lead.phone) {
      await sendWhatsAppMessage(lead.phone, message);
    } else if (lead.email && !lead.email.includes("@nexus-temp.com")) {
      await sendCustomEmail(lead.email, "Regarding your enquiry - Additional Details", message, lead.id);
    }

    await lead.update({
      intakeStatus: "COLLECTING_DETAILS",
      intakeMessageCount: (lead.intakeMessageCount || 0) + 1,
      lastAutomatedIntakeMessageAt: new Date()
    });

    if (sequelize.models.Activity) {
      await sequelize.models.Activity.create({
        id: crypto.randomUUID(),
        leadId: lead.id,
        type: targetChannel === "whatsapp" ? "whatsapp_sms" : "email",
        outcome: `Missing Details Requested (${missingInfo.missing.join(", ")})`,
        notes: message,
        direction: "outbound",
        isCompleted: true,
        createdById: (req as any).user?.id || null
      });
    }

    return res.status(200).json({ success: true, message, intakeStatus: "COLLECTING_DETAILS" });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};
