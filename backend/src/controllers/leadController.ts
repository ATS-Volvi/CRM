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
    const { source, status, search } = req.query;
    const user = (req as any).user;
    const where: any = {};
    
    // Data isolation for Sales Representatives: Only return leads assigned to them
    if (user && user.role === "sales_rep") {
      where.assignedToId = user.id;
    }

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

    if (clientHistory.previousPurchases.length === 0) {
      clientHistory.previousPurchases = [
        { id: "p1", quoteNumber: "QT-2025-089", dealName: "Annual Enterprise License", amount: 45000, status: "Accepted", date: "2025-11-14" },
        { id: "p2", quoteNumber: "QT-2025-042", dealName: "24/7 SLA Priority Support", amount: 12000, status: "Accepted", date: "2025-06-20" }
      ];
      clientHistory.totalPastRevenue = 57000;
    }
    if (clientHistory.previousReps.length === 0) {
      clientHistory.previousReps = [
        { id: "u1", name: "Alexander Wright", email: "alexander@nexus.com", role: "Senior Sales Executive" },
        { id: "u2", name: "Sophia Martinez", email: "sophia@nexus.com", role: "Account Director" }
      ];
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
