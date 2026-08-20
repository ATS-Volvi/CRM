import { Request, Response } from "express";
import { sequelize } from "@nexus-crm/database";
import { Op } from "sequelize";
import { WON_STAGE_NAMES, CLOSED_STAGE_NAMES } from "../utils/pipelineStageHelpers";

// GET /coaching-notes — for the logged-in target user (rep sees their notes)
export const getCoachingNotes = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const CoachingNote = sequelize.models.CoachingNote;
    const notes = await CoachingNote.findAll({
      where: { targetUserId: userId },
      include: [
        { model: sequelize.models.User, as: "author", attributes: ["id", "name", "role"] },
        { model: sequelize.models.Deal, as: "deal", attributes: ["id", "name"], required: false },
        { model: sequelize.models.Lead, as: "lead", attributes: ["id", "firstName", "lastName", "company"], required: false },
      ],
      order: [["createdAt", "DESC"]],
      limit: 50,
    });
    res.json(notes);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// GET /coaching-notes/record — fetch thread of team comments & coaching notes for a lead or deal
export const getRecordComments = async (req: Request, res: Response) => {
  try {
    const { leadId, dealId } = req.query;
    if (!leadId && !dealId) {
      return res.status(400).json({ error: "leadId or dealId is required" });
    }
    const where: any = {};
    if (leadId) where.leadId = leadId;
    if (dealId) where.dealId = dealId;

    const CoachingNote = sequelize.models.CoachingNote;
    const notes = await CoachingNote.findAll({
      where,
      include: [
        { model: sequelize.models.User, as: "author", attributes: ["id", "name", "role", "email"] },
        { model: sequelize.models.User, as: "targetUser", attributes: ["id", "name", "role"] }
      ],
      order: [["createdAt", "ASC"]]
    });
    res.json(notes);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// POST /coaching-notes — create team comment or manager coaching note with @mentions
export const createCoachingNote = async (req: Request, res: Response) => {
  try {
    const { dealId, leadId, targetUserId, content } = req.body;
    const authorUserId = (req as any).user?.id;
    const authorRole = (req as any).user?.role;
    const authorName = (req as any).user?.name || "Team Member";

    if (!content || !content.trim()) {
      return res.status(400).json({ error: "Comment content is required" });
    }

    // If targetUserId is set (manager-directed coaching note), require manager/admin role
    if (targetUserId && !["admin", "manager"].includes(authorRole)) {
      return res.status(403).json({ error: "Only managers and admins can create directed coaching notes" });
    }

    const note = await sequelize.models.CoachingNote.create({
      id: require("crypto").randomUUID(),
      dealId: dealId || null,
      leadId: leadId || null,
      authorUserId,
      targetUserId: targetUserId || null,
      content,
      isRead: false,
    });

    // ── @mention Parsing & Notification Dispatch ─────────────────────────────
    const mentionMatches = content.match(/@([\w\.\s]+)/g) || [];
    if (mentionMatches.length > 0) {
      const allUsers: any[] = await sequelize.models.User.findAll({
        attributes: ["id", "name", "email"]
      });

      const { createNotification } = await import("../services/notificationService");
      const notifiedUserIds = new Set<string>();

      for (const rawMatch of mentionMatches) {
        const queryName = rawMatch.replace("@", "").trim().toLowerCase();
        const matchedUser = allUsers.find((u: any) =>
          u.name.toLowerCase().includes(queryName) || u.email.toLowerCase().includes(queryName)
        );

        if (matchedUser && matchedUser.id !== authorUserId && !notifiedUserIds.has(matchedUser.id)) {
          notifiedUserIds.add(matchedUser.id);

          let link = "/pipeline";
          let recordName = "a record";

          if (leadId) {
            const lead: any = await sequelize.models.Lead.findByPk(leadId);
            recordName = lead ? `${lead.firstName} ${lead.lastName}` : "a lead";
            link = `/leads/${leadId}`;
          } else if (dealId) {
            const deal: any = await sequelize.models.Deal.findByPk(dealId);
            recordName = deal ? deal.name : "a deal";
            link = `/pipeline`;
          }

          await createNotification(
            matchedUser.id,
            "mention",
            `Mentioned in comment by ${authorName}`,
            `${authorName} mentioned you on ${recordName}: "${content.slice(0, 80)}${content.length > 80 ? "..." : ""}"`,
            link
          );
        }
      }
    }

    // Fetch created note with associations
    const fullNote = await sequelize.models.CoachingNote.findByPk((note as any).id, {
      include: [
        { model: sequelize.models.User, as: "author", attributes: ["id", "name", "role", "email"] },
        { model: sequelize.models.User, as: "targetUser", attributes: ["id", "name", "role"] }
      ]
    });

    res.status(201).json(fullNote);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// PATCH /coaching-notes/:id/read — rep marks a note as read
export const markCoachingNoteRead = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;
    const note = await sequelize.models.CoachingNote.findOne({
      where: { id, targetUserId: userId },
    });
    if (!note) return res.status(404).json({ error: "Note not found" });
    await note.update({ isRead: true });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// GET /coaching-notes/authored — manager sees notes they wrote
export const getAuthoredCoachingNotes = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const CoachingNote = sequelize.models.CoachingNote;
    const notes = await CoachingNote.findAll({
      where: { authorUserId: userId },
      include: [
        { model: sequelize.models.User, as: "targetUser", attributes: ["id", "name", "role"] },
        { model: sequelize.models.Deal, as: "deal", attributes: ["id", "name"], required: false },
      ],
      order: [["createdAt", "DESC"]],
      limit: 50,
    });
    res.json(notes);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// GET /dashboard/stale-deals — deals with no activity for 5+ days
export const getStaleDeal = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const userRole = (req as any).user?.role;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 5);

    // Get active deals
    const stages = await sequelize.models.PipelineStage.findAll({
      where: { name: { [Op.notIn]: CLOSED_STAGE_NAMES } },
    });
    const stageIds = stages.map((s: any) => s.id);

    const whereClause: any = { stageId: { [Op.in]: stageIds } };
    if (userRole === "sales_rep") whereClause.ownerId = userId;

    const deals = await sequelize.models.Deal.findAll({
      where: whereClause,
      include: [
        { model: sequelize.models.PipelineStage, as: "stage" },
        { model: sequelize.models.User, as: "owner", attributes: ["id", "name"] },
      ],
      order: [["updatedAt", "ASC"]],
      limit: 20,
    });

    // Filter deals where last activity is older than 5 days
    const staleDeals = [];
    for (const deal of deals) {
      const d = deal.toJSON() as any;
      const lastActivity = await sequelize.models.Activity.findOne({
        where: { leadId: d.leadId || null },
        order: [["createdAt", "DESC"]],
      });
      const lastActivityDate = lastActivity ? (lastActivity as any).createdAt : d.updatedAt;
      if (new Date(lastActivityDate) < cutoff) {
        const daysSince = Math.floor((Date.now() - new Date(lastActivityDate).getTime()) / 86400000);
        staleDeals.push({ ...d, daysSinceActivity: daysSince, lastActivityDate });
      }
    }

    res.json(staleDeals);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// GET /dashboard/quote-expiry — quotes expiring in 1-3 days
export const getQuoteExpiry = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const userRole = (req as any).user?.role;
    const now = new Date();
    const in3Days = new Date();
    in3Days.setDate(now.getDate() + 3);

    const whereClause: any = {
      expirationDate: { [Op.between]: [now, in3Days] },
      status: { [Op.notIn]: ["Accepted", "Rejected"] },
    };

    const quotes = await sequelize.models.Quote.findAll({
      where: whereClause,
      include: [
        {
          model: sequelize.models.Deal,
          as: "deal",
          include: [
            { model: sequelize.models.User, as: "owner", attributes: ["id", "name"] },
          ],
        },
      ],
      order: [["expirationDate", "ASC"]],
      limit: 10,
    });

    const filtered = userRole === "sales_rep"
      ? quotes.filter((q: any) => q.deal?.ownerId === userId)
      : quotes;

    res.json(filtered);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// GET /dashboard/top-accounts — top accounts by deal revenue this quarter
export const getTopAccounts = async (req: Request, res: Response) => {
  try {
    const quarterStart = new Date();
    quarterStart.setMonth(Math.floor(quarterStart.getMonth() / 3) * 3, 1);
    quarterStart.setHours(0, 0, 0, 0);

    const wonDeals = await sequelize.models.Deal.findAll({
      include: [
        { model: sequelize.models.PipelineStage, as: "stage", where: { name: { [Op.in]: WON_STAGE_NAMES } } },
        { model: sequelize.models.Customer, as: "customer", attributes: ["id", "name", "industry"] },
      ],
      where: { updatedAt: { [Op.gte]: quarterStart } },
    });

    // Group by customer
    const accountMap: Map<string, { id: string; name: string; industry: string; revenue: number; deals: number }> = new Map();
    for (const deal of wonDeals) {
      const d = deal.toJSON() as any;
      if (!d.customer) continue;
      const key = d.customer.id;
      const prev = accountMap.get(key) || { id: d.customer.id, name: d.customer.name, industry: d.customer.industry, revenue: 0, deals: 0 };
      prev.revenue += parseFloat(d.amount) || 0;
      prev.deals += 1;
      accountMap.set(key, prev);
    }

    const sorted = Array.from(accountMap.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
    res.json(sorted);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// GET /dashboard/customer-birthdays — upcoming birthdays / anniversaries in next 7 days
export const getCustomerBirthdays = async (req: Request, res: Response) => {
  try {
    const customers = await sequelize.models.Customer.findAll({
      where: {
        [Op.or]: [
          { birthday: { [Op.ne]: null } },
          { anniversaryDate: { [Op.ne]: null } },
        ],
      },
      attributes: ["id", "name", "email", "phone", "birthday", "anniversaryDate"],
      limit: 100,
    });

    const today = new Date();
    const upcoming: any[] = [];

    for (const c of customers) {
      const cj = c.toJSON() as any;
      const checkDate = (dateStr: string | null, type: string) => {
        if (!dateStr) return;
        const d = new Date(dateStr);
        const thisYear = new Date(today.getFullYear(), d.getMonth(), d.getDate());
        const daysUntil = Math.ceil((thisYear.getTime() - today.getTime()) / 86400000);
        if (daysUntil >= 0 && daysUntil <= 7) {
          upcoming.push({ ...cj, eventType: type, date: dateStr, daysUntil });
        }
      };
      checkDate(cj.birthday, "birthday");
      checkDate(cj.anniversaryDate, "anniversary");
    }

    upcoming.sort((a, b) => a.daysUntil - b.daysUntil);
    res.json(upcoming);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// GET /dashboard/win-celebrations — recently Won deals for celebration feed
export const getWinCelebrations = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const userRole = (req as any).user?.role;
    const since = new Date();
    since.setDate(since.getDate() - 14); // last 2 weeks

    const wonStages = await sequelize.models.PipelineStage.findAll({
      where: { name: { [Op.in]: WON_STAGE_NAMES } },
    });
    const wonStageIds = wonStages.map((s: any) => s.id);

    const whereClause: any = {
      stageId: { [Op.in]: wonStageIds },
      updatedAt: { [Op.gte]: since },
    };
    if (userRole === "sales_rep") whereClause.ownerId = userId;

    const deals = await sequelize.models.Deal.findAll({
      where: whereClause,
      include: [
        { model: sequelize.models.User, as: "owner", attributes: ["id", "name"] },
        { model: sequelize.models.Customer, as: "customer", attributes: ["id", "name"], required: false },
      ],
      order: [["updatedAt", "DESC"]],
      limit: 10,
    });

    res.json(deals);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
