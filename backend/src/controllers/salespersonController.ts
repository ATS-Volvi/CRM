import { Request, Response } from "express";
import { sequelize } from "@nexus-crm/database";
import { Op } from "sequelize";
import bcrypt from "bcrypt";
import crypto from "crypto";

/**
 * Derives a normalized pipeline cycle stage from a quote's status and timestamps.
 */
function deriveCycleStage(quote: any): string {
  const { status, sentAt, viewedAt, acceptedAt, expirationDate } = quote;

  if (status === "Accepted" || acceptedAt) return "Accepted";
  if (status === "Superseded") return "Superseded";
  if (status === "Rejected") return "Rejected";

  // Expired: has been sent, expiration is past, and not yet accepted
  if (sentAt && expirationDate && new Date(expirationDate) < new Date() && !acceptedAt) {
    return "Expired";
  }

  if (viewedAt) return "Viewed";
  if (sentAt) return "Sent";
  if (status === "Approved") return "Approved";
  if (status === "Pending Approval") return "Pending Approval";

  return "Draft";
}

// Helper to normalize and count lead sources
function normalizeLeadSources(leads: any[]): { source: string; count: number }[] {
  const counts = {
    email: 0,
    instagram: 0,
    cold_call: 0,
    website: 0,
    facebook: 0,
    other: 0
  };

  leads.forEach((l: any) => {
    let src = (l.source || "").toLowerCase().trim();
    if (!src) {
      counts.other++;
      return;
    }
    if (src === "cold_call" || src === "cold call" || src === "coldcall") {
      counts.cold_call++;
    } else if (src === "ig" || src === "instagram") {
      counts.instagram++;
    } else if (src === "fb" || src === "facebook") {
      counts.facebook++;
    } else if (src === "web" || src === "website") {
      counts.website++;
    } else if (src === "email") {
      counts.email++;
    } else {
      counts.other++;
    }
  });

  const ordered = [
    { source: "email", count: counts.email },
    { source: "instagram", count: counts.instagram },
    { source: "cold_call", count: counts.cold_call },
    { source: "website", count: counts.website },
    { source: "facebook", count: counts.facebook }
  ];

  if (counts.other > 0) {
    ordered.push({ source: "other", count: counts.other });
  }

  return ordered;
}

export const getSalespersonsPerformance = async (req: Request, res: Response) => {
  try {
    const caller = (req as any).user;
    const { getScopedUserIds } = require("../services/scopeHelper");
    const scopedUserIds = await getScopedUserIds(caller);

    // 1. Fetch scoped users
    const users = await sequelize.models.User.findAll({
      where: { id: { [Op.in]: scopedUserIds } },
      attributes: ["id", "name", "role", "isAvailable", "maxOpenLeads"]
    });

    const salespersonStats = [];

    for (const user of users) {
      const u = user as any;

      // 2. Fetch all leads assigned to this user
      const leads = await sequelize.models.Lead.findAll({
        where: { assignedToId: u.id }
      });

      // 3. Fetch all deals owned by this user
      const deals = await sequelize.models.Deal.findAll({
        where: { ownerId: u.id },
        include: [{ model: sequelize.models.PipelineStage, as: "stage" }]
      });

      const dealIds = deals.map((d: any) => d.id);
      let purchaseOrders: any[] = [];
      let wonClients: any[] = [];
      let quotesResult: any[] = [];

      if (dealIds.length > 0) {
        // 4a. Fetch quotes with deal->lead chain for client name resolution
        const rawQuotes = await sequelize.models.Quote.findAll({
          where: { dealId: dealIds },
          include: [
            {
              model: sequelize.models.Deal,
              as: "deal",
              include: [{ model: sequelize.models.Lead, as: "lead" }]
            },
            { model: sequelize.models.PurchaseOrder, as: "purchaseOrder" }
          ],
          order: [["createdAt", "DESC"]]
        });

        // 4b. Fetch ApprovalRequests separately — targetId is a plain string, not a real FK
        const quoteIds = rawQuotes.map((q: any) => q.id);
        const approvalsByQuoteId: Record<string, any> = {};

        if (quoteIds.length > 0) {
          const approvals = await sequelize.models.ApprovalRequest.findAll({
            where: { targetId: { [Op.in]: quoteIds }, type: "Quote" }
          });
          approvals.forEach((ar: any) => {
            // Keep the most recent approval entry per quote
            if (
              !approvalsByQuoteId[ar.targetId] ||
              new Date(ar.createdAt) > new Date(approvalsByQuoteId[ar.targetId].createdAt)
            ) {
              approvalsByQuoteId[ar.targetId] = ar;
            }
          });
        }

        // 4c. Build enriched quotes list and extract purchase orders
        rawQuotes.forEach((q: any) => {
          if (q.purchaseOrder) {
            purchaseOrders.push({
              id: q.purchaseOrder.id,
              poNumber: q.purchaseOrder.poNumber,
              amount: q.purchaseOrder.amount,
              status: q.purchaseOrder.status,
              createdAt: q.purchaseOrder.createdAt
            });
          }

          const lead = q.deal?.lead;
          const dealName = lead
            ? lead.company || `${lead.firstName} ${lead.lastName}`.trim()
            : (q.deal?.name ?? "Unknown");

          const approval = approvalsByQuoteId[q.id];

          quotesResult.push({
            id: q.id,
            quoteNumber: q.quoteNumber ?? null,
            version: q.version ?? 1,
            status: q.status,
            cycleStage: deriveCycleStage(q),
            totalAmount: parseFloat(q.totalAmount) || 0,
            dealId: q.dealId,
            dealName,
            createdAt: q.createdAt,
            sentAt: q.sentAt ?? null,
            viewedAt: q.viewedAt ?? null,
            acceptedAt: q.acceptedAt ?? null,
            expirationDate: q.expirationDate ?? null,
            approvalStatus: approval?.status ?? null,
            approvalComments: approval?.comments ?? null,
            approvedBy: approval?.approvedById ?? null
          });
        });

        wonClients = leads.filter((l: any) => l.status === "Qualified" || l.status === "Contacted");
      }

      // 5. Fetch last 50 activities created by this user, with lead context
      const rawActivities = await sequelize.models.Activity.findAll({
        where: { createdById: u.id },
        include: [{ model: sequelize.models.Lead }],
        order: [["createdAt", "DESC"]],
        limit: 50
      });

      // Pin pinned items to the top, then sort by date descending
      const activities = (rawActivities as any[])
        .map((act: any) => {
          const lead = act.Lead ?? act.lead ?? null;
          const leadName = lead
            ? lead.company || `${lead.firstName} ${lead.lastName}`.trim()
            : null;
          return {
            id: act.id,
            type: act.type,
            outcome: act.outcome ?? null,
            createdAt: act.createdAt,
            leadId: act.leadId ?? null,
            leadName,
            pinned: act.pinned ?? false,
            priority: act.priority ?? null
          };
        })
        .sort((a: any, b: any) => {
          if (a.pinned && !b.pinned) return -1;
          if (!a.pinned && b.pinned) return 1;
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });

      // Lead sources distribution
      const leadSources = normalizeLeadSources(leads);

      // Deal stage mix
      const dealTypeMap: Record<string, number> = {};
      deals.forEach((d: any) => {
        const stageName = d.stage?.name || "Draft";
        dealTypeMap[stageName] = (dealTypeMap[stageName] || 0) + 1;
      });
      const dealTypes = Object.keys(dealTypeMap).map(name => ({
        stage: name,
        count: dealTypeMap[name]
      }));

      salespersonStats.push({
        id: u.id,
        name: u.name,
        role: u.role,
        isAvailable: u.isAvailable,
        maxOpenLeads: u.maxOpenLeads,
        totalLeads: leads.length,
        totalDeals: deals.length,
        purchaseOrders,
        wonClients: wonClients.map((c: any) => ({
          id: c.id,
          name: `${c.firstName} ${c.lastName}`,
          company: c.company || "N/A",
          email: c.email,
          status: c.status
        })),
        leadSources,
        dealTypes,
        quotes: quotesResult,
        activities
      });
    }

    res.json(salespersonStats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createSalesperson = async (req: Request, res: Response) => {
  try {
    const caller = (req as any).user;
    if (!caller || !["admin", "director"].includes(caller.role)) {
      res.status(403).json({ error: "Forbidden: only admins and directors can create users" });
      return;
    }

    const { name, email, password, role, maxOpenLeads, isAvailable, managerId } = req.body;

    // Validate required fields
    if (!name || !email || !password) {
      res.status(400).json({ error: "name, email and password are required" });
      return;
    }

    const ALLOWED_ROLES = ["sales_rep", "sales_manager", "director", "admin"];
    if (role && !ALLOWED_ROLES.includes(role)) {
      res.status(400).json({ error: `role must be one of: ${ALLOWED_ROLES.join(", ")}` });
      return;
    }

    // Email uniqueness check
    const existing = await sequelize.models.User.findOne({ where: { email } });
    if (existing) {
      res.status(400).json({ error: "A user with that email already exists" });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await sequelize.models.User.create({
      id: crypto.randomUUID(),
      name,
      email,
      password: hashedPassword,
      role: role || "sales_rep",
      maxOpenLeads: maxOpenLeads ?? 20,
      isAvailable: isAvailable ?? true,
      managerId: managerId || null
    }) as any;

    // Return created user without the password
    res.status(201).json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      maxOpenLeads: user.maxOpenLeads,
      isAvailable: user.isAvailable,
      createdAt: user.createdAt
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getSalespersonPerformanceDetails = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const user = await sequelize.models.User.findByPk(id, {
      attributes: ["id", "name", "role", "isAvailable", "maxOpenLeads"]
    });

    if (!user) {
      res.status(404).json({ error: "Salesperson not found" });
      return;
    }

    const u = user as any;

    // Fetch leads
    const leads = await sequelize.models.Lead.findAll({
      where: { assignedToId: u.id }
    });

    // Fetch deals with stages and leads
    const deals = await sequelize.models.Deal.findAll({
      where: { ownerId: u.id },
      include: [
        { model: sequelize.models.PipelineStage, as: "stage" },
        { model: sequelize.models.Lead, as: "lead" }
      ]
    });

    const dealIds = deals.map((d: any) => d.id);
    let purchaseOrders: any[] = [];
    let wonClients: any[] = [];
    let quotesResult: any[] = [];

    if (dealIds.length > 0) {
      const rawQuotes = await sequelize.models.Quote.findAll({
        where: { dealId: dealIds },
        include: [
          {
            model: sequelize.models.Deal,
            as: "deal",
            include: [{ model: sequelize.models.Lead, as: "lead" }]
          },
          { model: sequelize.models.PurchaseOrder, as: "purchaseOrder" }
        ],
        order: [["createdAt", "DESC"]]
      });

      const quoteIds = rawQuotes.map((q: any) => q.id);
      const approvalsByQuoteId: Record<string, any> = {};

      if (quoteIds.length > 0) {
        const approvals = await sequelize.models.ApprovalRequest.findAll({
          where: { targetId: { [Op.in]: quoteIds }, type: "Quote" }
        });
        approvals.forEach((ar: any) => {
          if (!approvalsByQuoteId[ar.targetId] || new Date(ar.createdAt) > new Date(approvalsByQuoteId[ar.targetId].createdAt)) {
            approvalsByQuoteId[ar.targetId] = ar;
          }
        });
      }

      rawQuotes.forEach((q: any) => {
        if (q.purchaseOrder) {
          purchaseOrders.push({
            id: q.purchaseOrder.id,
            poNumber: q.purchaseOrder.poNumber,
            amount: q.purchaseOrder.amount,
            status: q.purchaseOrder.status,
            createdAt: q.purchaseOrder.createdAt
          });
        }

        const lead = q.deal?.lead;
        const dealName = lead
          ? lead.company || `${lead.firstName} ${lead.lastName}`.trim()
          : (q.deal?.name ?? "Unknown");

        const approval = approvalsByQuoteId[q.id];

        quotesResult.push({
          id: q.id,
          quoteNumber: q.quoteNumber ?? null,
          version: q.version ?? 1,
          status: q.status,
          cycleStage: deriveCycleStage(q),
          totalAmount: parseFloat(q.totalAmount) || 0,
          dealId: q.dealId,
          dealName,
          createdAt: q.createdAt,
          sentAt: q.sentAt ?? null,
          viewedAt: q.viewedAt ?? null,
          acceptedAt: q.acceptedAt ?? null,
          expirationDate: q.expirationDate ?? null,
          approvalStatus: approval?.status ?? null,
          approvalComments: approval?.comments ?? null,
          approvedBy: approval?.approvedById ?? null
        });
      });

      wonClients = leads.filter((l: any) => l.status === "Qualified" || l.status === "Contacted");
    }

    // Fetch activities
    const rawActivities = await sequelize.models.Activity.findAll({
      where: { createdById: u.id },
      include: [{ model: sequelize.models.Lead }],
      order: [["createdAt", "DESC"]],
      limit: 50
    });

    const activities = (rawActivities as any[])
      .map((act: any) => {
        const lead = act.Lead ?? act.lead ?? null;
        const leadName = lead ? lead.company || `${lead.firstName} ${lead.lastName}`.trim() : null;
        return {
          id: act.id,
          type: act.type,
          outcome: act.outcome ?? null,
          createdAt: act.createdAt,
          leadId: act.leadId ?? null,
          leadName,
          pinned: act.pinned ?? false,
          priority: act.priority ?? null
        };
      })
      .sort((a: any, b: any) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

    // Lead sources
    const leadSources = normalizeLeadSources(leads);

    // Deal categories
    const dealTypeMap: Record<string, number> = {};
    deals.forEach((d: any) => {
      const stageName = d.stage?.name || "Draft";
      dealTypeMap[stageName] = (dealTypeMap[stageName] || 0) + 1;
    });
    const dealTypes = Object.keys(dealTypeMap).map(name => ({ stage: name, count: dealTypeMap[name] }));

    // Won and Lost Leads derivation
    const wonDeals = deals.filter((d: any) => d.stage?.name === "Won");
    const lostDeals = deals.filter((d: any) => d.stage?.name === "Lost");

    const wonLeads = wonDeals.map((d: any) => {
      const l = d.lead || {};
      return {
        id: l.id || "",
        name: l.firstName && l.lastName ? `${l.firstName} ${l.lastName}`.trim() : (l.firstName || l.lastName || "Unknown"),
        company: l.company || "N/A",
        dealValue: parseFloat(d.amount) || 0,
        closeDate: d.updatedAt || d.createdAt,
        source: l.source || "Other"
      };
    });

    const lostLeads = lostDeals.map((d: any) => {
      const l = d.lead || {};
      return {
        id: l.id || "",
        name: l.firstName && l.lastName ? `${l.firstName} ${l.lastName}`.trim() : (l.firstName || l.lastName || "Unknown"),
        company: l.company || "N/A",
        dealValue: parseFloat(d.amount) || 0,
        closeDate: d.updatedAt || d.createdAt,
        source: l.source || "Other"
      };
    });

    // Overall won / (won + lost) success rate excluding open stages
    const closedCount = wonLeads.length + lostLeads.length;
    const successRate = closedCount > 0 ? parseFloat((wonLeads.length / closedCount).toFixed(2)) : 0;

    // Count and win-rate per lead source
    const sourceBreakdown: Record<string, { total: number; won: number; winRate: number }> = {};
    leads.forEach((l: any) => {
      const src = (l.source || "Other").toLowerCase().trim() || "other";
      if (!sourceBreakdown[src]) {
        sourceBreakdown[src] = { total: 0, won: 0, winRate: 0 };
      }
      sourceBreakdown[src].total++;
    });

    wonDeals.forEach((d: any) => {
      if (d.lead) {
        const src = (d.lead.source || "Other").toLowerCase().trim() || "other";
        if (!sourceBreakdown[src]) {
          sourceBreakdown[src] = { total: 0, won: 0, winRate: 0 };
        }
        sourceBreakdown[src].won++;
      }
    });

    Object.keys(sourceBreakdown).forEach((src) => {
      const item = sourceBreakdown[src];
      item.winRate = item.total > 0 ? parseFloat((item.won / item.total).toFixed(2)) : 0;
    });

    // Best Fit Suggestion
    const sourceClosedStats: Record<string, { won: number; lost: number; total: number }> = {};
    deals.forEach((d: any) => {
      if (!d.lead) return;
      const stageName = d.stage?.name;
      if (stageName !== "Won" && stageName !== "Lost") return;

      const src = (d.lead.source || "Other").toLowerCase().trim() || "other";
      if (!sourceClosedStats[src]) {
        sourceClosedStats[src] = { won: 0, lost: 0, total: 0 };
      }
      sourceClosedStats[src].total++;
      if (stageName === "Won") {
        sourceClosedStats[src].won++;
      } else {
        sourceClosedStats[src].lost++;
      }
    });

    let bestSource: string | null = null;
    let bestWinRate = -1;
    Object.keys(sourceClosedStats).forEach((src) => {
      const stats = sourceClosedStats[src];
      if (stats.total >= 5) {
        const winRate = stats.won / stats.total;
        if (winRate > bestWinRate) {
          bestWinRate = winRate;
          bestSource = src;
        }
      }
    });

    let bestFitSuggestion: any = null;
    if (bestSource) {
      bestFitSuggestion = {
        source: bestSource,
        winRate: parseFloat((bestWinRate * 100).toFixed(1))
      };
    } else {
      bestFitSuggestion = {
        source: null,
        winRate: null,
        reason: "insufficient closed deals to recommend"
      };
    }

    res.json({
      id: u.id,
      name: u.name,
      role: u.role,
      isAvailable: u.isAvailable,
      maxOpenLeads: u.maxOpenLeads,
      totalLeads: leads.length,
      totalDeals: deals.length,
      purchaseOrders,
      wonClients: wonClients.map((c: any) => ({
        id: c.id,
        name: `${c.firstName} ${c.lastName}`,
        company: c.company || "N/A",
        email: c.email,
        status: c.status
      })),
      leadSources,
      dealTypes,
      quotes: quotesResult,
      activities,
      wonLeads,
      lostLeads,
      successRate,
      sourceBreakdown,
      bestFitSuggestion
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getAllSalespersons = async (req: Request, res: Response) => {
  try {
    const users = await sequelize.models.User.findAll({
      where: {
        role: { [Op.in]: ["sales_rep", "sales_manager", "admin"] }
      },
      attributes: ["id", "name", "role", "email"],
      order: [["name", "ASC"]]
    });
    res.json(users);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
