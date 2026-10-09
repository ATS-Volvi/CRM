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

export function buildCampaignAttributionSummary(
  leadId: string,
  attributions: any[],
  directCampaign?: any
): any | null {
  const validTouches = (attributions || [])
    .filter((a: any) => a && a.campaign)
    .sort((a: any, b: any) => {
      const dateA = new Date(a.createdAt || a.firstTouchAt || 0).getTime();
      const dateB = new Date(b.createdAt || b.firstTouchAt || 0).getTime();
      if (dateA !== dateB) return dateA - dateB;
      return String(a.id || "").localeCompare(String(b.id || ""));
    });

  if (validTouches.length === 0) {
    if (directCampaign) {
      const singleTouch = {
        id: `direct-${directCampaign.id}`,
        campaignId: directCampaign.id,
        campaignName: directCampaign.name || "Untitled Campaign",
        campaignCode: directCampaign.code || directCampaign.name || "NO-CODE",
        channel: directCampaign.channel || "Other",
        status: directCampaign.status || "UNKNOWN",
        startDate: directCampaign.startDate || null,
        endDate: directCampaign.endDate || null,
        utmSource: null,
        utmMedium: null,
        utmCampaign: directCampaign.code || null,
        touchDate: directCampaign.createdAt ? new Date(directCampaign.createdAt).toISOString() : new Date().toISOString(),
        firstTouchAt: null,
        lastTouchAt: null,
        touchType: "DIRECT",
        isFirstTouch: true,
        isLastTouch: true
      };
      return {
        lastTouch: singleTouch,
        firstTouch: singleTouch,
        totalTouches: 1,
        totalCampaigns: 1,
        touches: [singleTouch]
      };
    }
    return null;
  }

  const touches = validTouches.map((a: any, idx: number) => {
    const camp = a.campaign;
    const isFirst = idx === 0;
    const isLast = idx === validTouches.length - 1;
    return {
      id: a.id,
      campaignId: camp.id,
      campaignName: camp.name || "Untitled Campaign",
      campaignCode: camp.code || camp.name || "NO-CODE",
      channel: a.channel || camp.channel || "Other",
      status: camp.status || "UNKNOWN",
      startDate: camp.startDate || null,
      endDate: camp.endDate || null,
      utmSource: a.utmSource || null,
      utmMedium: a.utmMedium || null,
      utmCampaign: a.utmCampaign || camp.code || null,
      touchDate: a.createdAt ? new Date(a.createdAt).toISOString() : (a.firstTouchAt ? new Date(a.firstTouchAt).toISOString() : new Date().toISOString()),
      firstTouchAt: a.firstTouchAt || null,
      lastTouchAt: a.lastTouchAt || null,
      touchType: a.touchType || (isFirst ? "FIRST_TOUCH" : isLast ? "LAST_TOUCH" : "INTERMEDIATE"),
      isFirstTouch: isFirst,
      isLastTouch: isLast
    };
  });

  const distinctCampaignIds = new Set(touches.map((t: any) => t.campaignId));

  return {
    lastTouch: touches[touches.length - 1],
    firstTouch: touches[0],
    totalTouches: touches.length,
    totalCampaigns: distinctCampaignIds.size,
    touches
  };
}

export const getLeads = async (req: Request, res: Response) => {
  try {
    const { source, channel, status, search, page, limit, campaignId, campaignIds, campaign } = req.query;
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

    // Campaign filter (multi-select / comma-separated / single)
    const countsWhere: any = {};
    if (user && (user.role === "sales_rep" || user.role === "salesperson")) {
      countsWhere.assignedToId = user.id;
    }
    if (status && status !== "All Statuses" && status !== "ALL") {
      countsWhere.status = status;
    }

    const rawCampaign = campaignId || campaignIds || campaign;
    let filterCampaignIds: string[] = [];
    if (Array.isArray(rawCampaign)) {
      filterCampaignIds = rawCampaign.flatMap((c: any) => String(c).split(",")).map((s: string) => s.trim()).filter(Boolean);
    } else if (typeof rawCampaign === "string") {
      filterCampaignIds = rawCampaign.split(",").map((s: string) => s.trim()).filter(Boolean);
    }

    if (filterCampaignIds.length > 0) {
      const matchingAttributions = await sequelize.models.LeadAttribution.findAll({
        where: { campaignId: { [Op.in]: filterCampaignIds } },
        attributes: ["leadId"],
        raw: true
      });
      const attributedLeadIds = matchingAttributions.map((a: any) => a.leadId).filter(Boolean);

      const campaignOrConditions: any[] = [
        { campaignId: { [Op.in]: filterCampaignIds } }
      ];
      if (attributedLeadIds.length > 0) {
        campaignOrConditions.push({ id: { [Op.in]: attributedLeadIds } });
      }

      where[Op.and] = [
        ...(where[Op.and] || []),
        { [Op.or]: campaignOrConditions }
      ];
      countsWhere[Op.and] = [
        ...(countsWhere[Op.and] || []),
        { [Op.or]: campaignOrConditions }
      ];
    }

    // Server-side pagination: ?page=1&limit=50 (default 50, max 200)
    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit as string) || 50));
    const offset = (pageNum - 1) * limitNum;

    const isPaginated = !!(page || limit);

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

    let rows: any[] = [];
    let count = 0;
    let leads: any[] = [];

    if (isPaginated) {
      // Paginated response: return envelope with metadata
      const resData = await sequelize.models.Lead.findAndCountAll({
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
      rows = resData.rows;
      count = resData.count;
    } else {
      // Non-paginated (legacy)
      leads = await sequelize.models.Lead.findAll({
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
        order: [
          ["lastWhatsappAt", "DESC NULLS LAST"],
          ["createdAt", "DESC"]
        ]
      });
    }

    // Batched query for Campaign Attribution to avoid N+1 queries
    const targetRows = isPaginated ? rows : leads;
    const targetIds = targetRows.map((l: any) => l.id).filter(Boolean);

    const attributionsByLeadId = new Map<string, any[]>();
    const directCampaignsById = new Map<string, any>();

    if (targetIds.length > 0) {
      const attributions = await sequelize.models.LeadAttribution.findAll({
        where: { leadId: { [Op.in]: targetIds } },
        include: [
          {
            model: sequelize.models.Campaign,
            as: "campaign",
            required: false
          }
        ],
        order: [
          ["createdAt", "ASC"],
          ["id", "ASC"]
        ]
      });

      for (const attr of attributions) {
        const lId = (attr as any).leadId;
        if (!attributionsByLeadId.has(lId)) {
          attributionsByLeadId.set(lId, []);
        }
        attributionsByLeadId.get(lId)!.push(attr);
      }

      const missingLeadCampaignIds = targetRows
        .filter((l: any) => {
          const attrs = attributionsByLeadId.get(l.id) || [];
          const hasValidAttrCamp = attrs.some((a: any) => !!a.campaign);
          return !hasValidAttrCamp && l.campaignId;
        })
        .map((l: any) => l.campaignId)
        .filter(Boolean);

      if (missingLeadCampaignIds.length > 0) {
        const directCamps = await sequelize.models.Campaign.findAll({
          where: { id: { [Op.in]: Array.from(new Set(missingLeadCampaignIds)) } }
        });
        for (const c of directCamps) {
          directCampaignsById.set((c as any).id, c);
        }
      }
    }

    const attachAttribution = (l: any) => {
      const leadObj = typeof l.toJSON === "function" ? l.toJSON() : { ...l };
      const attrs = attributionsByLeadId.get(leadObj.id) || [];
      const directCamp = leadObj.campaignId ? directCampaignsById.get(leadObj.campaignId) : undefined;
      leadObj.campaignAttribution = buildCampaignAttributionSummary(leadObj.id, attrs, directCamp);
      return leadObj;
    };

    if (isPaginated) {
      return res.json({
        data: rows.map(attachAttribution),
        total: count,
        page: pageNum,
        totalPages: Math.ceil(count / limitNum),
        limit: limitNum,
        channelCounts
      });
    }

    res.json(leads.map(attachAttribution));
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
    const leadAny = lead as any;

    const attrs = await sequelize.models.LeadAttribution.findAll({
      where: { leadId: leadAny.id },
      include: [{ model: sequelize.models.Campaign, as: "campaign", required: false }],
      order: [["createdAt", "ASC"], ["id", "ASC"]]
    });
    let directCamp = null;
    const hasValidAttrCamp = attrs.some((a: any) => !!a.campaign);
    if (!hasValidAttrCamp && leadAny.campaignId) {
      directCamp = await sequelize.models.Campaign.findByPk(leadAny.campaignId);
    }
    const campaignAttribution = buildCampaignAttributionSummary(leadAny.id, attrs, directCamp);

    res.json({
      ...leadJson,
      campaignAttribution,
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

    if (!leadId) {
      return res.status(202).json({ status: "held_for_review" });
    }

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

    const { validateStageTransition } = require("../services/stageValidationService");
    const validation = await validateStageTransition(String(id), (lead as any).status || "New", "Qualified", user?.id, user?.role);
    if (!validation.allowed) {
      return res.status(400).json({
        error: `Cannot qualify lead: ${validation.missingRequirements.join(" ")}`,
        missingRequirements: validation.missingRequirements
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
      (req as any).user?.id,
      {
        targetRepId: req.body?.targetRepId,
        handoffNotes: req.body?.handoffNotes || req.body?.notes
      }
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
      autoAssignReason: result.autoAssignReason,
      autoAssignResult: result.autoAssignResult
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const handoffLead = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const user = (req as any).user;
    const { targetRepId, handoffNotes, estimatedValue, dealName } = req.body;

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
    const l = lead as any;
    const qualData = {
      estimatedValue: estimatedValue || Number(l.budgetRange) || 50000,
      dealName: dealName || (l.company ? `${l.company} Opportunity` : `${l.firstName} ${l.lastName} Opportunity`),
      accountName: l.company || `${l.firstName} ${l.lastName}`.trim(),
      ...req.body?.qualificationData
    };

    const result = await convertLeadToOpportunity(
      id,
      qualData,
      user?.id,
      {
        targetRepId,
        handoffNotes: handoffNotes || req.body?.notes
      }
    );

    res.json({
      message: "Lead handed off to closer successfully",
      deal: result.deal,
      lead: result.lead,
      targetRepId: result.deal?.ownerId,
      autoAssignResult: result.autoAssignResult
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

export const renderUnsubscribePage = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const lead = await sequelize.models.Lead.findByPk(String(id));
    if (!lead) {
      const genericHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>Unsubscribe</title>
          <style>
            body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; background-color: #f8fafc; color: #1e293b; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; }
            .card { background: #ffffff; max-width: 480px; width: 100%; padding: 40px; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.06); text-align: center; border: 1px solid #e2e8f0; }
            h2 { margin-top: 0; color: #0f172a; font-size: 22px; }
            p { color: #64748b; font-size: 14px; line-height: 1.6; margin: 16px 0 0; }
          </style>
        </head>
        <body>
          <div class="card">
            <h2>Unsubscribe from Emails</h2>
            <p>If you have an active email subscription, you can manage your preferences or unsubscribe by replying directly to any email.</p>
          </div>
        </body>
      </html>
      `;
      return res.send(genericHtml);
    }

    const l = lead as any;
    const emailEscaped = (l.email || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    const idEscaped = encodeURIComponent(String(l.id || id || ""))
      .replace(/["'<>]/g, "");

    if (l.optedOutEmail) {
      const alreadyHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>Already Unsubscribed</title>
          <style>
            body { font-family: 'Inter', -apple-system, sans-serif; background-color: #f8fafc; color: #1e293b; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; }
            .card { background: #fff; max-width: 480px; width: 100%; padding: 40px; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.06); text-align: center; border: 1px solid #e2e8f0; }
            h2 { margin-top: 0; color: #0f172a; font-size: 22px; }
            p { color: #64748b; font-size: 14px; line-height: 1.6; }
          </style>
        </head>
        <body>
          <div class="card">
            <h2>Already Unsubscribed</h2>
            <p><strong>${emailEscaped}</strong> is already unsubscribed from our mailing list.</p>
          </div>
        </body>
      </html>
      `;
      return res.send(alreadyHtml);
    }

    const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Unsubscribe Confirmation</title>
        <style>
          body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; background-color: #f8fafc; color: #1e293b; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; }
          .card { background: #ffffff; max-width: 480px; width: 100%; padding: 40px; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.06); text-align: center; border: 1px solid #e2e8f0; }
          h2 { margin-top: 0; color: #0f172a; font-size: 22px; }
          p { color: #64748b; font-size: 14px; line-height: 1.6; margin: 16px 0 24px; }
          .btn { background-color: #ef4444; color: #ffffff; border: none; padding: 12px 28px; font-size: 14px; font-weight: 600; border-radius: 8px; cursor: pointer; transition: background-color 0.2s; }
          .btn:hover { background-color: #dc2626; }
        </style>
      </head>
      <body>
        <div class="card">
          <h2>Unsubscribe from Emails</h2>
          <p>Please confirm that you would like to unsubscribe <strong>${emailEscaped}</strong> from all automated and marketing emails.</p>
          <form method="POST" action="/api/v1/leads/unsubscribe/${idEscaped}">
            <button type="submit" class="btn">Unsubscribe</button>
          </form>
        </div>
      </body>
    </html>
    `;
    res.send(html);
  } catch (error: any) {
    res.status(500).send("An error occurred loading the page.");
  }
};

export const handleUnsubscribe = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const lead = await sequelize.models.Lead.findByPk(String(id));
    if (!lead) {
      const genericSuccessHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>Unsubscribed Successfully</title>
          <style>
            body { font-family: 'Inter', sans-serif; background-color: #f8fafc; color: #1e293b; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; }
            .card { background: #fff; max-width: 480px; width: 100%; padding: 40px; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.06); text-align: center; border: 1px solid #e2e8f0; }
            h2 { margin-top: 0; color: #10b981; font-size: 22px; }
            p { color: #64748b; font-size: 14px; line-height: 1.6; }
          </style>
        </head>
        <body>
          <div class="card">
            <h2>Unsubscribed Successfully</h2>
            <p>You have been removed from our mailing list. You will no longer receive automated emails from us.</p>
          </div>
        </body>
      </html>
      `;
      return res.send(genericSuccessHtml);
    }

    const l = lead as any;
    if (!l.optedOutEmail) {
      l.optedOutEmail = true;
      await l.save();

      try {
        await sequelize.models.Activity.create({
          id: crypto.randomUUID(),
          leadId: l.id,
          type: "email",
          notes: "Client confirmed Unsubscribe. All future marketing/templated emails are now blocked.",
          direction: "internal"
        });
      } catch (actErr: any) {
        console.error("Error logging unsubscribe activity:", actErr);
      }
    }

    // Update any CampaignRecipients for this lead with unsubscribedAt timestamp
    if (sequelize.models.CampaignRecipient) {
      await sequelize.models.CampaignRecipient.update(
        { unsubscribedAt: new Date() },
        { where: { leadId: l.id, unsubscribedAt: null } }
      ).catch((err: any) => console.error("Error updating campaign recipients unsubscribe:", err));
    }

    const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Unsubscribed Successfully</title>
        <style>
          body { font-family: 'Inter', sans-serif; background-color: #f8fafc; color: #1e293b; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; }
          .card { background: #fff; max-width: 480px; width: 100%; padding: 40px; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.06); text-align: center; border: 1px solid #e2e8f0; }
          h2 { margin-top: 0; color: #10b981; font-size: 22px; }
          p { color: #64748b; font-size: 14px; line-height: 1.6; }
        </style>
      </head>
      <body>
        <div class="card">
          <h2>Unsubscribed Successfully</h2>
          <p>You have been removed from our mailing list. You will no longer receive automated emails from us.</p>
        </div>
      </body>
    </html>
    `;
    res.send(html);
  } catch (error: any) {
    console.error("Error handling unsubscribe:", error);
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
      originalOwnerId: triggerUserId,
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

// ─────────────────────────────────────────────────────────────────────────────
// POST /leads/:id/enrich — Manually trigger / re-trigger enrichment for a lead
// Returns 202 Accepted immediately; enrichment runs in the background
// ─────────────────────────────────────────────────────────────────────────────
export const triggerLeadEnrichment = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { Lead } = sequelize.models;

    const lead = await Lead.findByPk(id, { attributes: ["id", "email", "company"] });
    if (!lead) return res.status(404).json({ error: "Lead not found" });

    // Import lazily to keep the controller boot time unchanged
    const { enrichLeadAsync } = await import("../services/enrichmentService");

    // Fire-and-forget — return 202 before enrichment completes
    enrichLeadAsync(
      (lead as any).id,
      (lead as any).email ?? "",
      (lead as any).company ?? ""
    ).catch((e: any) =>
      console.error(`[enrichment] Manual re-enrich failed for lead ${id}:`, e)
    );

    return res.status(202).json({
      success: true,
      message: "Enrichment triggered — status will update momentarily"
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /leads/:id/find-contacts — On-demand domain contacts search via Hunter
// Synchronous (reps wait for the result after clicking the button)
// ─────────────────────────────────────────────────────────────────────────────
export const findLeadContacts = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const refresh = req.query.refresh === "true";
    const requestedById = (req as any).user?.id || null;
    const { Lead, LeadContactDiscovery } = sequelize.models;

    const lead = await Lead.findByPk(id, { attributes: ["id", "email", "company"] });
    if (!lead) return res.status(404).json({ error: "Lead not found" });

    const leadData = lead.toJSON() as any;
    const { extractDomain, isPersonalDomain, findContactsForDomain, logEnrichmentUsage } = await import("../services/enrichmentService");

    const email = leadData.email || "";
    let domain = extractDomain(email);

    // If email doesn't yield a domain, try deriving from company name if it contains a dot
    if (!domain && leadData.company && leadData.company.includes(".")) {
      domain = leadData.company.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    }

    if (!domain) {
      return res.status(400).json({ error: "Cannot discover contacts: No valid company domain found on this lead." });
    }

    if (isPersonalDomain(domain)) {
      return res.status(400).json({ error: "Cannot search contacts for personal email domains." });
    }

    // Check if discovery already exists for this lead
    const existing = await LeadContactDiscovery.findOne({
      where: { leadId: id },
      order: [["createdAt", "DESC"]]
    });

    // If already discovered and refresh not requested, return cached discovery immediately
    if (!refresh && existing) {
      const existingData = existing.toJSON() as any;
      return res.status(200).json({
        fromCache: true,
        discovery: {
          id: existingData.id,
          domain: existingData.domain,
          emailPattern: existingData.emailPattern,
          totalFound: existingData.totalFound,
          discoveredAt: existingData.discoveredAt,
          contacts: JSON.parse(existingData.contactsFound || "[]")
        }
      });
    }

    // Call Hunter domain search
    let discoveryResult;
    try {
      discoveryResult = await findContactsForDomain(domain);
    } catch (hunterErr: any) {
      await logEnrichmentUsage(id, "hunter", domain, "failed", null, hunterErr.message || String(hunterErr));
      return res.status(hunterErr.message?.includes("429") ? 429 : 502).json({
        error: hunterErr.message || "Failed to retrieve contacts from Hunter.io"
      });
    }

    // Log unified credit usage
    const callStatus = discoveryResult.contacts.length > 0 ? "contacts_discovered" : "not_found";
    await logEnrichmentUsage(id, "hunter", domain, callStatus, 200, null);

    // Save or update in LeadContactDiscoveries table
    let savedDiscovery;
    const now = new Date();
    if (existing) {
      await existing.update({
        domain,
        contactsFound: JSON.stringify(discoveryResult.contacts),
        emailPattern: discoveryResult.pattern,
        totalFound: discoveryResult.totalFound,
        discoveredAt: now,
        requestedById
      });
      savedDiscovery = existing;
    } else {
      savedDiscovery = await LeadContactDiscovery.create({
        id: crypto.randomUUID(),
        leadId: id,
        domain,
        contactsFound: JSON.stringify(discoveryResult.contacts),
        emailPattern: discoveryResult.pattern,
        totalFound: discoveryResult.totalFound,
        discoveredAt: now,
        requestedById
      });
    }

    const savedData = savedDiscovery.toJSON() as any;

    return res.status(200).json({
      fromCache: false,
      discovery: {
        id: savedData.id,
        domain,
        organization: discoveryResult.organization,
        emailPattern: discoveryResult.pattern,
        totalFound: discoveryResult.totalFound,
        discoveredAt: savedData.discoveredAt,
        contacts: discoveryResult.contacts
      }
    });
  } catch (error: any) {
    console.error("[findLeadContacts] Error discovering contacts:", error);
    return res.status(500).json({ error: error.message || "Internal server error discovering contacts" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /leads/:id/discovered-contacts — Fetch cached contact discovery if available
// ─────────────────────────────────────────────────────────────────────────────
export const getLeadDiscoveredContacts = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { LeadContactDiscovery } = sequelize.models;

    const existing = await LeadContactDiscovery.findOne({
      where: { leadId: id },
      order: [["createdAt", "DESC"]]
    });

    if (!existing) {
      return res.status(200).json({ discovery: null });
    }

    const existingData = existing.toJSON() as any;
    return res.status(200).json({
      discovery: {
        id: existingData.id,
        domain: existingData.domain,
        emailPattern: existingData.emailPattern,
        totalFound: existingData.totalFound,
        discoveredAt: existingData.discoveredAt,
        contacts: JSON.parse(existingData.contactsFound || "[]")
      }
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /leads/:id/whatsapp-consent — Record manual WhatsApp consent by sales rep
// ─────────────────────────────────────────────────────────────────────────────
export const recordWhatsAppConsent = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { source } = req.body;

    const validSources = ["verbal", "written", "form", "other"];
    const normalizedSource = String(source || "verbal").toLowerCase().trim();
    if (!validSources.includes(normalizedSource)) {
      return res.status(400).json({
        error: `Invalid consent source. Must be one of: ${validSources.join(", ")}`
      });
    }

    const lead = await sequelize.models.Lead.findByPk(String(id));
    if (!lead) {
      return res.status(404).json({ error: "Lead not found" });
    }

    const l = lead as any;
    const caller = (req as any).user;
    const repName = caller?.name || caller?.email || "Sales Representative";
    const repId = caller?.id || l.assignedToId || null;

    l.whatsappConsentStatus = "OPTED_IN";
    l.optedOutWhatsapp = false;
    l.whatsappOptInAt = new Date();
    l.whatsappConsentSource = normalizedSource;
    await l.save();

    // Also update any matching contact if exists
    if (sequelize.models.Contact && (l.phone || l.whatsappPhone)) {
      const phoneDigits = (l.whatsappPhone || l.phone || "").replace(/\D/g, "").slice(-10);
      if (phoneDigits.length >= 7) {
        await Promise.resolve(sequelize.models.Contact.update(
          {
            whatsappConsentStatus: "OPTED_IN",
            optedOutWhatsapp: false,
            whatsappOptInAt: new Date(),
            whatsappConsentSource: normalizedSource
          },
          {
            where: {
              [Op.or]: [
                { phone: { [Op.like]: `%${phoneDigits}%` } },
                { whatsappNumber: { [Op.like]: `%${phoneDigits}%` } }
              ]
            }
          }
        )).catch(() => {});
      }
    }

    // Log Activity noting which rep recorded it and the source
    await sequelize.models.Activity.create({
      id: crypto.randomUUID(),
      leadId: l.id,
      customerId: l.customerId || l.accountId || null,
      type: "note",
      notes: `Manual WhatsApp consent recorded by ${repName}. Source: ${normalizedSource.toUpperCase()}`,
      outcome: `WhatsApp Consent Recorded (${normalizedSource})`,
      direction: "internal",
      pinned: true,
      isCompleted: true,
      createdById: repId
    } as any);

    return res.status(200).json({
      success: true,
      lead: l
    });
  } catch (error: any) {
    console.error("[recordWhatsAppConsent] Error recording consent:", error);
    return res.status(500).json({ error: error.message || "Failed to record WhatsApp consent" });
  }
};


