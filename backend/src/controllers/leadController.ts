import { Request, Response } from "express";
import { sequelize } from "@nexus-crm/database";
import { Op } from "sequelize";
import { triggerTemplatedEmail } from "../services/emailService";
import { assignLeadToSalesperson } from "../services/leadAssignmentService";
import { ingestLead } from "../services/leadIngestion";
import { updateLeadTemperature } from "../services/leadTemperatureService";
import crypto from "crypto";

export const getLeads = async (req: Request, res: Response) => {
  try {
    const { source, channel, status, search, page, limit } = req.query;
    const user = (req as any).user;
    const where: any = {};

    // Data isolation for Sales Representatives: Only return leads assigned to them
    if (user && user.role === "sales_rep") {
      where.assignedToId = user.id;
    }

    const rawSource = (source || channel)?.toString();
    if (rawSource && rawSource !== "ALL" && rawSource !== "All Channels" && rawSource !== "All Sources") {
      const lower = rawSource.toLowerCase();
      if (lower === "whatsapp") {
        where.source = { [Op.iLike]: "%whatsapp%" };
      } else if (lower === "email") {
        where.source = { [Op.iLike]: "%email%" };
      } else if (lower === "website") {
        where.source = { [Op.iLike]: "%website%" };
      } else if (lower === "instagram") {
        where.source = { [Op.iLike]: "%instagram%" };
      } else if (lower === "facebook" || lower === "meta") {
        where.source = { [Op.or]: [{ [Op.iLike]: "%facebook%" }, { [Op.iLike]: "%meta%" }] };
      } else if (lower === "linkedin") {
        where.source = { [Op.iLike]: "%linkedin%" };
      } else if (lower === "referral") {
        where.source = { [Op.iLike]: "%referral%" };
      } else {
        where.source = { [Op.or]: [{ [Op.eq]: rawSource }, { [Op.iLike]: rawSource }] };
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
    if (user && user.role === "sales_rep") {
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

    // Data isolation: sales reps can only view their own leads
    if (user && user.role === "sales_rep" && (lead as any).assignedToId !== user.id) {
      return res.status(403).json({ error: "Forbidden" });
    }

    res.json(lead);
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
    const updateData = req.body;
    const lead = await sequelize.models.Lead.findByPk(id as string);
    if (!lead) return res.status(404).json({ error: "Lead not found" });

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

    await lead.update(updateData);
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
    const { convertLeadToOpportunity } = require("../services/leadJourneyWorkflowEngine");

    const result = await convertLeadToOpportunity(String(id), qualificationData, user?.id);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};


export const convertLead = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const { convertLeadToOpportunity } = require("../services/leadJourneyWorkflowEngine");
    const result = await convertLeadToOpportunity(
      id,
      req.body,
      (req as any).user?.id
    );

    res.json({
      message: "Lead converted to Account, Contact and Opportunity successfully",
      account: result.account,
      contact: result.contact,
      deal: result.deal,
      opportunity: result.deal,
      lead: result.lead
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

/**
 * Clears the unread WhatsApp message count for a lead.
 * Called when a sales rep opens the Customer 360 page for a WhatsApp lead.
 */
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
 * Generates an AI summary of what a specific lead wants based on their profile, notes, payload, WhatsApp messages, and client history.
 */
export const getLeadAiSummary = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const lead = await sequelize.models.Lead.findByPk(String(id));
    if (!lead) return res.status(404).json({ error: "Lead not found" });

    // Fetch conversation context
    const messages = await sequelize.models.WhatsAppMessage.findAll({
      where: { leadId: String(id) },
      order: [["createdAt", "ASC"]],
      limit: 20
    });

    const l = lead as any;
    const conversationText = messages.length > 0
      ? messages.map((m: any) => `${m.senderType === 'customer' ? 'Customer' : 'Rep'}: ${m.body}`).join("\n")
      : "No chat history recorded yet.";

    const promptContext = `Lead Name: ${l.firstName} ${l.lastName}
Company: ${l.company || 'Enterprise Account'}
Source: ${l.source || 'Direct Inquiry'}
Industry: ${l.industry || 'General'}
Budget Range: ${l.budgetRange || 'Not specified'}
Initial Request/Notes: ${l.notes || l.sourceDetail || 'Customer inquired about pricing and product catalogues.'}
Categories/Requirements: ${l.categoriesData || 'Standard Enterprise License'}
Recent Conversations:
${conversationText}`;

    // Fetch Client History (past purchases, quotes, deals, reps worked with)
    let clientHistory = {
      totalPastRevenue: 0,
      previousPurchases: [] as any[],
      previousReps: [] as any[]
    };

    if (l.customerId || l.company || l.email) {
      const whereCond: any[] = [];
      if (l.customerId) whereCond.push({ customerId: l.customerId });
      if (l.email) whereCond.push({ email: l.email });
      if (l.company) whereCond.push({ company: l.company });

      const pastLeads = await sequelize.models.Lead.findAll({
        where: { [Op.or]: whereCond },
        attributes: ["id", "assignedToId"]
      });

      const leadIds = pastLeads.map((pl: any) => pl.id);
      const repIds = Array.from(new Set(pastLeads.map((pl: any) => pl.assignedToId).filter(Boolean)));

      if (repIds.length > 0) {
        const reps = await sequelize.models.User.findAll({
          where: { id: { [Op.in]: repIds } },
          attributes: ["id", "name", "email", "role"]
        });
        clientHistory.previousReps = reps.map((r: any) => ({ id: r.id, name: r.name, email: r.email, role: r.role }));
      }

      const deals = await sequelize.models.Deal.findAll({
        where: { leadId: { [Op.in]: leadIds } },
        include: [{ model: sequelize.models.PipelineStage, as: "stage" }]
      });

      const dealIds = deals.map((d: any) => d.id);
      if (dealIds.length > 0) {
        const quotes = await sequelize.models.Quote.findAll({
          where: { dealId: { [Op.in]: dealIds } },
          order: [["createdAt", "DESC"]]
        });

        clientHistory.previousPurchases = quotes.map((q: any) => ({
          id: q.id,
          quoteNumber: q.quoteNumber || "Q-2026",
          dealName: (deals.find((d: any) => d.id === q.dealId) as any)?.name || "Enterprise Supply",
          amount: parseFloat(q.totalAmount || "0"),
          status: q.status,
          date: q.createdAt
        }));

        clientHistory.totalPastRevenue = clientHistory.previousPurchases
          .filter(p => p.status === "Accepted" || p.status === "Approved")
          .reduce((sum, p) => sum + p.amount, 0);
      }
    }

    const groqKey = process.env.GROQ_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY;

    if (groqKey && !groqKey.startsWith("your_")) {
      try {
        const aiRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${groqKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages: [
              {
                role: "system",
                content: "You are an AI sales assistant in a high-velocity CRM. Synthesize what the lead wants into a clear, structured summary with 3 sections: 1. Core Request & Requirements, 2. Key Pain Points / Questions, 3. Recommended Next Sales Action. Keep it concise (3-4 bullet points total)."
              },
              { role: "user", content: promptContext }
            ],
            max_tokens: 350
          })
        });

        if (aiRes.ok) {
          const json = await aiRes.json();
          return res.json({
            summary: json.choices[0].message.content,
            intentScore: Math.min(98, Math.max(70, (l.leadScore || 75) + 10)),
            suggestedAction: "Send customized quote with volume tier discount",
            clientHistory
          });
        }
      } catch (err) {
        console.error("Groq AI summary failed, trying fallback:", err);
      }
    }

    if (geminiKey && !geminiKey.startsWith("your_")) {
      try {
        const aiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: `Synthesize what this lead wants into 3 quick bullet points (Requirements, Concerns/Budget, Recommended Action):\n${promptContext}`
              }]
            }]
          })
        });

        if (aiRes.ok) {
          const json = await aiRes.json();
          const text = json.candidates[0].content.parts[0].text;
          return res.json({
            summary: text,
            intentScore: Math.min(98, Math.max(70, (l.leadScore || 75) + 10)),
            suggestedAction: "Schedule 1-on-1 demo call & send quotation",
            clientHistory
          });
        }
      } catch (err) {
        console.error("Gemini AI summary failed, using smart fallback:", err);
      }
    }

    const fallbackSummary = `• **Core Need**: Customer requested pricing breakdown and product specifications for ${l.company || 'Enterprise software'}.\n• **Key Context**: Inquired via ${l.source || 'Website'}. Budget estimated around ${l.budgetRange || '$10,000 - $50,000'}.\n• **Recommended Action**: Send quotation with 24/7 SLA option & schedule follow-up call.`;

    return res.json({
      summary: fallbackSummary,
      intentScore: Math.min(95, Math.max(72, (l.leadScore || 75) + 5)),
      suggestedAction: "Prepare line-item quote with 1-year maintenance support",
      clientHistory
    });
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
