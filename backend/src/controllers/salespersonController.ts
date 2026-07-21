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
      attributes: ["id", "name", "role", "isAvailable", "maxOpenLeads", "department", "territory", "team"]
    });

    const salespersonStats = [];

    // Fetch active KPI Master names once
    const activeMasters = await sequelize.models.KpiMaster.findAll({ where: { isActive: true }, attributes: ["name"] });
    const activeKpiNames = activeMasters.map((m: any) => m.name);

    for (const user of users) {
      const u = user as any;

      // Fetch KPI Targets summary restricted to active master KPIs
      const targets = await sequelize.models.KpiTarget.findAll({
        where: { 
          salespersonId: u.id,
          kpiName: { [Op.in]: activeKpiNames }
        }
      });
      const activeKpiCount = targets.filter((t: any) => t.targetValue > 0).length;
      
      const revClosedModel = targets.find((t: any) => t.kpiName === "Revenue Closed");
      const revenueClosed = revClosedModel ? (revClosedModel as any).currentValue : 0;
      
      const monthlyAchievementModel = targets.find((t: any) => t.kpiName === "Monthly Achievement");
      const targetAchievementPct = monthlyAchievementModel ? (monthlyAchievementModel as any).currentValue : 0;

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
            { model: sequelize.models.PurchaseOrder, as: "PurchaseOrder" }
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
          if (q.PurchaseOrder) {
            purchaseOrders.push({
              id: q.PurchaseOrder.id,
              poNumber: q.PurchaseOrder.poNumber,
              amount: q.PurchaseOrder.amount,
              status: q.PurchaseOrder.status,
              createdAt: q.PurchaseOrder.createdAt
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
        email: u.email,
        role: u.role,
        isAvailable: u.isAvailable,
        maxOpenLeads: u.maxOpenLeads,
        department: u.department || "Sales",
        territory: u.territory || "EMEA",
        team: u.team || "Aces",
        activeKpiCount,
        revenueClosed,
        targetAchievementPct,
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

    const { name, email, password, role, maxOpenLeads, isAvailable, managerId, department, territory, team } = req.body;

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
      managerId: managerId || null,
      department: department || "Sales",
      territory: territory || "EMEA",
      team: team || "Aces"
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
      attributes: ["id", "name", "role", "isAvailable", "maxOpenLeads", "department", "territory", "team"]
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
          { model: sequelize.models.PurchaseOrder }
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
        if (q.PurchaseOrder) {
          purchaseOrders.push({
            id: q.PurchaseOrder.id,
            poNumber: q.PurchaseOrder.poNumber,
            amount: q.PurchaseOrder.amount,
            status: q.PurchaseOrder.status,
            createdAt: q.PurchaseOrder.createdAt
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
      department: u.department || "Sales",
      territory: u.territory || "EMEA",
      team: u.team || "Aces",
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

export const updateSalespersonCapacity = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { maxOpenLeads } = req.body;
    
    if (typeof maxOpenLeads !== "number" || maxOpenLeads < 0) {
      res.status(400).json({ error: "maxOpenLeads must be a non-negative number" });
      return;
    }

    const user = await sequelize.models.User.findByPk(id);
    if (!user) {
      res.status(404).json({ error: "Representative not found" });
      return;
    }

    await user.update({ maxOpenLeads });
    res.json({ message: "Capacity updated successfully", maxOpenLeads });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// ──────────────────────────────────────────────────────────────
// KPI TARGETS & TARGET MANAGEMENT
// ──────────────────────────────────────────────────────────────

const STANDARD_KPIS = [
  // Lead Generation
  { name: "New Leads", category: "Lead Generation", defaultVal: 50, freq: "monthly", weight: 10 },
  { name: "Qualified Leads", category: "Lead Generation", defaultVal: 20, freq: "monthly", weight: 15 },
  { name: "Assigned Leads", category: "Lead Generation", defaultVal: 60, freq: "monthly", weight: 5 },
  // Prospecting
  { name: "Calls Made", category: "Prospecting", defaultVal: 200, freq: "monthly", weight: 10 },
  { name: "Follow-ups", category: "Prospecting", defaultVal: 150, freq: "monthly", weight: 10 },
  { name: "Emails", category: "Prospecting", defaultVal: 300, freq: "monthly", weight: 5 },
  { name: "Customer Visits", category: "Prospecting", defaultVal: 12, freq: "monthly", weight: 15 },
  // Meetings
  { name: "Meetings Scheduled", category: "Meetings", defaultVal: 15, freq: "monthly", weight: 10 },
  { name: "Meetings Completed", category: "Meetings", defaultVal: 10, freq: "monthly", weight: 15 },
  { name: "Product Demo", category: "Meetings", defaultVal: 8, freq: "monthly", weight: 10 },
  { name: "Technical Meeting", category: "Meetings", defaultVal: 4, freq: "monthly", weight: 10 },
  // Sales
  { name: "Quotations Sent", category: "Sales", defaultVal: 15, freq: "monthly", weight: 10 },
  { name: "Quotations Approved", category: "Sales", defaultVal: 5, freq: "monthly", weight: 20 },
  { name: "Purchase Orders", category: "Sales", defaultVal: 5, freq: "monthly", weight: 20 },
  { name: "Revenue Closed", category: "Sales", defaultVal: 100000, freq: "monthly", weight: 30 },
  // Conversion
  { name: "Lead → Meeting %", category: "Conversion", defaultVal: 20, freq: "monthly", weight: 15 },
  { name: "Meeting → Proposal %", category: "Conversion", defaultVal: 60, freq: "monthly", weight: 15 },
  { name: "Proposal → PO %", category: "Conversion", defaultVal: 40, freq: "monthly", weight: 15 },
  { name: "Lead → Customer %", category: "Conversion", defaultVal: 10, freq: "monthly", weight: 20 },
  // Finance
  { name: "Invoice Clearance", category: "Finance", defaultVal: 5, freq: "monthly", weight: 10 },
  { name: "Payment Collection", category: "Finance", defaultVal: 80000, freq: "monthly", weight: 20 },
  { name: "Outstanding Collections", category: "Finance", defaultVal: 20000, freq: "monthly", weight: 10 },
  // Customer
  { name: "New Clients", category: "Customer", defaultVal: 5, freq: "monthly", weight: 15 },
  { name: "Repeat Clients", category: "Customer", defaultVal: 2, freq: "monthly", weight: 10 },
  // Performance
  { name: "Monthly Achievement", category: "Performance", defaultVal: 80, freq: "monthly", weight: 10 },
  { name: "Quarterly Achievement", category: "Performance", defaultVal: 85, freq: "quarterly", weight: 10 },
  { name: "Performance Score", category: "Performance", defaultVal: 75, freq: "monthly", weight: 10 }
];

export const getSalespersonKpis = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const salesperson = await sequelize.models.User.findByPk(id);
    if (!salesperson) {
      res.status(404).json({ error: "Salesperson not found" });
      return;
    }

    // 1. Fetch KPI Master definitions (or auto-populate if none exist)
    let kpiMasters = await sequelize.models.KpiMaster.findAll({ where: { isActive: true } });
    if (kpiMasters.length === 0) {
      const createdMasters = [];
      for (const kpi of STANDARD_KPIS) {
        const m = await sequelize.models.KpiMaster.create({
          id: crypto.randomUUID(),
          name: kpi.name,
          category: kpi.category,
          targetValue: kpi.defaultVal,
          frequency: kpi.freq,
          weightage: kpi.weight,
          isActive: true
        });
        createdMasters.push(m);
      }
      kpiMasters = createdMasters;
    }

    // 2. Fetch saved targets for salesperson
    let targets = await sequelize.models.KpiTarget.findAll({
      where: { salespersonId: id }
    });

    // 3. Match targets with current active KPI Masters, auto-initializing missing ones
    const targetMap = new Map(targets.map((t: any) => [t.kpiName, t]));
    const matchedTargets = [];

    for (const master of kpiMasters) {
      const existing = targetMap.get((master as any).name);
      if (!existing) {
        const t = await sequelize.models.KpiTarget.create({
          id: crypto.randomUUID(),
          salespersonId: id,
          kpiName: (master as any).name,
          targetValue: (master as any).targetValue,
          currentValue: 0,
          frequency: (master as any).frequency,
          weightage: (master as any).weightage,
          effectiveDate: new Date(),
          expiryDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
          notes: `Auto-initialized target for ${(master as any).name}`,
          status: "Active"
        });
        matchedTargets.push(t);
      } else {
        matchedTargets.push(existing);
      }
    }
    targets = matchedTargets;

    // 2. Perform dynamic calculations of currentValue based on real database entries
    const leads = await sequelize.models.Lead.findAll({ where: { assignedToId: id } });
    const deals = await sequelize.models.Deal.findAll({ where: { ownerId: id } });
    const dealIds = deals.map((d: any) => d.id);
    
    const activities = await sequelize.models.Activity.findAll({ where: { createdById: id } });
    const quotes = dealIds.length > 0 ? await sequelize.models.Quote.findAll({ where: { dealId: { [Op.in]: dealIds } } }) : [];
    
    // Invoices and PurchaseOrders
    const invoices = quotes.length > 0 ? await sequelize.models.Invoice.findAll({ where: { quoteId: { [Op.in]: quotes.map((q: any) => q.id) } } }) : [];
    const pos = quotes.length > 0 ? await sequelize.models.PurchaseOrder.findAll({ where: { quoteId: { [Op.in]: quotes.map((q: any) => q.id) } } }) : [];

    // Helper counts
    const newLeadsCount = leads.filter((l: any) => l.status === "New").length;
    const qualifiedLeadsCount = leads.filter((l: any) => l.status === "Qualified" || l.status === "Contacted").length;
    const assignedLeadsCount = leads.length;

    const callsCount = activities.filter((a: any) => (a.type || "").toLowerCase() === "call").length;
    const followupsCount = activities.filter((a: any) => (a.type || "").toLowerCase() === "follow_up").length;
    const emailsCount = activities.filter((a: any) => (a.type || "").toLowerCase() === "email").length;
    const visitsCount = activities.filter((a: any) => (a.type || "").toLowerCase() === "visit").length;

    const meetingsScheduled = activities.filter((a: any) => (a.type || "").toLowerCase() === "meeting").length;
    const meetingsCompleted = activities.filter((a: any) => (a.type || "").toLowerCase() === "meeting" && (a.outcome || "").toLowerCase() === "completed").length;
    const demoCount = activities.filter((a: any) => (a.type || "").toLowerCase() === "demo").length;
    const techMeetingsCount = activities.filter((a: any) => (a.type || "").toLowerCase() === "technical").length;

    const quotesSentCount = quotes.filter((q: any) => q.status === "Sent" || q.status === "Accepted").length;
    const quotesApprovedCount = quotes.filter((q: any) => q.status === "Accepted").length;
    const posCount = pos.length;
    const revenueClosedVal = pos.reduce((sum: number, po: any) => sum + (parseFloat(po.amount) || 0), 0);

    const leadToMeetingPct = assignedLeadsCount > 0 ? Math.round((meetingsScheduled / assignedLeadsCount) * 100) : 0;
    const meetingToProposalPct = meetingsScheduled > 0 ? Math.round((quotesSentCount / meetingsScheduled) * 100) : 0;
    const proposalToPoPct = quotesSentCount > 0 ? Math.round((posCount / quotesSentCount) * 100) : 0;
    const leadToCustomerPct = assignedLeadsCount > 0 ? Math.round((qualifiedLeadsCount / assignedLeadsCount) * 100) : 0;

    const invoiceClearanceCount = invoices.filter((inv: any) => inv.status === "Paid").length;
    const paymentCollectionVal = invoices.filter((inv: any) => inv.status === "Paid").reduce((sum: number, inv: any) => sum + (parseFloat(inv.totalAmount || inv.total || 0)), 0);
    const outstandingVal = invoices.filter((inv: any) => inv.status === "Sent" || inv.status === "Pending").reduce((sum: number, inv: any) => sum + (parseFloat(inv.totalAmount || inv.total || 0)), 0);

    const newClientsCount = qualifiedLeadsCount;
    // Repeat clients: clients/companies that appear multiple times in leads/deals
    const clientCompanies = leads.map((l: any) => l.company).filter(Boolean);
    const uniqueClients = new Set(clientCompanies);
    const repeatClientsCount = clientCompanies.length - uniqueClients.size;

    // Get current achievement of all other targets to compute Monthly/Quarterly achievements
    const getAchievement = (current: number, target: number) => {
      if (target <= 0) return 0;
      return Math.min(100, Math.round((current / target) * 100));
    };

    const targetValMaps: Record<string, number> = {};

    const updatedTargets = await Promise.all(
      targets.map(async (targetModel: any) => {
        let current = 0;
        const name = targetModel.kpiName;

        switch (name) {
          case "New Leads": current = newLeadsCount; break;
          case "Qualified Leads": current = qualifiedLeadsCount; break;
          case "Assigned Leads": current = assignedLeadsCount; break;
          case "Calls Made": current = callsCount; break;
          case "Follow-ups": current = followupsCount; break;
          case "Emails": current = emailsCount; break;
          case "Customer Visits": current = visitsCount; break;
          case "Meetings Scheduled": current = meetingsScheduled; break;
          case "Meetings Completed": current = meetingsCompleted; break;
          case "Product Demo": current = demoCount; break;
          case "Technical Meeting": current = techMeetingsCount; break;
          case "Quotations Sent": current = quotesSentCount; break;
          case "Quotations Approved": current = quotesApprovedCount; break;
          case "Purchase Orders": current = posCount; break;
          case "Revenue Closed": current = revenueClosedVal; break;
          case "Lead → Meeting %": current = leadToMeetingPct; break;
          case "Meeting → Proposal %": current = meetingToProposalPct; break;
          case "Proposal → PO %": current = proposalToPoPct; break;
          case "Lead → Customer %": current = leadToCustomerPct; break;
          case "Invoice Clearance": current = invoiceClearanceCount; break;
          case "Payment Collection": current = paymentCollectionVal; break;
          case "Outstanding Collections": current = outstandingVal; break;
          case "New Clients": current = newClientsCount; break;
          case "Repeat Clients": current = repeatClientsCount; break;
          default: current = targetModel.currentValue || 0; break;
        }

        targetValMaps[name] = current;

        // Save current value
        await targetModel.update({ currentValue: current });
        return targetModel;
      })
    );

    // Compute achievements
    const avgMonthlyAchievement = Math.round(
      updatedTargets
        .filter((t: any) => t.frequency === "monthly" && t.kpiName !== "Monthly Achievement" && t.kpiName !== "Performance Score")
        .reduce((sum: number, t: any) => sum + getAchievement(t.currentValue, t.targetValue), 0) /
        (updatedTargets.filter((t: any) => t.frequency === "monthly" && t.kpiName !== "Monthly Achievement" && t.kpiName !== "Performance Score").length || 1)
    );

    const avgQuarterlyAchievement = Math.round(
      updatedTargets
        .filter((t: any) => t.frequency === "quarterly" && t.kpiName !== "Quarterly Achievement")
        .reduce((sum: number, t: any) => sum + getAchievement(t.currentValue, t.targetValue), 0) /
        (updatedTargets.filter((t: any) => t.frequency === "quarterly" && t.kpiName !== "Quarterly Achievement").length || 1)
    );

    const performanceScore = Math.round(
      updatedTargets
        .filter((t: any) => t.kpiName !== "Performance Score")
        .reduce((sum: number, t: any) => sum + (getAchievement(t.currentValue, t.targetValue) * (t.weightage || 10)), 0) /
        (updatedTargets.filter((t: any) => t.kpiName !== "Performance Score").reduce((sum: number, t: any) => sum + (t.weightage || 10), 0) || 1)
    );

    // Update performance metrics
    const finalTargets = await Promise.all(
      updatedTargets.map(async (t: any) => {
        if (t.kpiName === "Monthly Achievement") {
          await t.update({ currentValue: avgMonthlyAchievement });
        } else if (t.kpiName === "Quarterly Achievement") {
          await t.update({ currentValue: avgQuarterlyAchievement });
        } else if (t.kpiName === "Performance Score") {
          await t.update({ currentValue: performanceScore });
        }
        return t;
      })
    );

    const masters = await sequelize.models.KpiMaster.findAll({ attributes: ["name", "category"] });
    const categoryMap = new Map(masters.map((m: any) => [m.name, m.category]));

    const result = finalTargets.map((t: any) => {
      const json = t.toJSON();
      json.category = categoryMap.get(t.kpiName) || "Performance";
      return json;
    });

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const editKpiTarget = async (req: Request, res: Response) => {
  try {
    const caller = (req as any).user;
    if (!caller || !["admin", "director", "sales_manager"].includes(caller.role)) {
      res.status(403).json({ error: "Forbidden: Only Admin or Managers can edit targets" });
      return;
    }

    const kpiId = req.params.kpiId as string;
    const { targetValue, frequency, weightage, effectiveDate, expiryDate, notes, reason } = req.body;

    const kpi = await sequelize.models.KpiTarget.findByPk(kpiId);
    if (!kpi) {
      res.status(404).json({ error: "KPI target not found" });
      return;
    }

    // Check if target is locked
    if ((kpi as any).status === "Locked") {
      res.status(400).json({ error: "Target is locked and cannot be edited" });
      return;
    }

    const oldVal = (kpi as any).targetValue;

    // Update target
    await kpi.update({
      targetValue: targetValue !== undefined ? Number(targetValue) : (kpi as any).targetValue,
      frequency: frequency || (kpi as any).frequency,
      weightage: weightage !== undefined ? Number(weightage) : (kpi as any).weightage,
      effectiveDate: effectiveDate || (kpi as any).effectiveDate,
      expiryDate: expiryDate || (kpi as any).expiryDate,
      notes: notes || (kpi as any).notes,
      createdBy: caller.id
    });

    // Write to audit history
    await sequelize.models.KpiTargetHistory.create({
      id: crypto.randomUUID(),
      kpiTargetId: kpiId,
      oldValue: oldVal,
      newValue: targetValue !== undefined ? Number(targetValue) : oldVal,
      changedBy: caller.id,
      reason: reason || "Manual target update",
      changeDate: new Date()
    });

    res.json({ message: "KPI target updated successfully", kpi });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getKpiHistory = async (req: Request, res: Response) => {
  try {
    const kpiId = req.params.kpiId as string;
    const history = await sequelize.models.KpiTargetHistory.findAll({
      where: { kpiTargetId: kpiId },
      include: [{ model: sequelize.models.User, as: "changedByUser", attributes: ["name", "email"] }],
      order: [["changeDate", "DESC"]]
    });
    res.json(history);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const restoreKpiHistory = async (req: Request, res: Response) => {
  try {
    const caller = (req as any).user;
    if (!caller || !["admin", "director"].includes(caller.role)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const historyId = req.params.historyId as string;
    const log = await sequelize.models.KpiTargetHistory.findByPk(historyId);
    if (!log) {
      res.status(404).json({ error: "Audit history record not found" });
      return;
    }

    const kpi = await sequelize.models.KpiTarget.findByPk((log as any).kpiTargetId);
    if (!kpi) {
      res.status(404).json({ error: "KPI target not found" });
      return;
    }

    const oldVal = (kpi as any).targetValue;

    // Restore to oldValue of history or newValue
    await kpi.update({
      targetValue: (log as any).oldValue,
      createdBy: caller.id
    });

    // Write restore log to audit history
    await sequelize.models.KpiTargetHistory.create({
      id: crypto.randomUUID(),
      kpiTargetId: (kpi as any).id,
      oldValue: oldVal,
      newValue: (log as any).oldValue,
      changedBy: caller.id,
      reason: `Restored to value from audit version dated ${new Date((log as any).changeDate).toLocaleDateString()}`,
      changeDate: new Date()
    });

    res.json({ message: "KPI target restored successfully", kpi });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const bulkAssignTargets = async (req: Request, res: Response) => {
  try {
    const caller = (req as any).user;
    if (!caller || !["admin", "director"].includes(caller.role)) {
      res.status(403).json({ error: "Forbidden: Only admins can bulk assign targets" });
      return;
    }

    const { kpiName, targetValue, frequency, weightage, department, team, salespersonIds } = req.body;

    if (!kpiName || targetValue === undefined) {
      res.status(400).json({ error: "kpiName and targetValue are required" });
      return;
    }

    const whereUser: any = {};
    if (salespersonIds && Array.isArray(salespersonIds) && salespersonIds.length > 0) {
      whereUser.id = { [Op.in]: salespersonIds };
    } else {
      if (department) whereUser.department = department;
      if (team) whereUser.team = team;
    }

    // Find all matching users
    const users = await sequelize.models.User.findAll({ where: whereUser });
    const count = users.length;

    for (const u of users) {
      let kpi = await sequelize.models.KpiTarget.findOne({
        where: { salespersonId: (u as any).id, kpiName }
      });

      const oldVal = kpi ? (kpi as any).targetValue : 0;

      if (kpi) {
        await kpi.update({
          targetValue: Number(targetValue),
          frequency: frequency || (kpi as any).frequency,
          weightage: weightage !== undefined ? Number(weightage) : (kpi as any).weightage,
          createdBy: caller.id
        });
      } else {
        kpi = await sequelize.models.KpiTarget.create({
          id: crypto.randomUUID(),
          salespersonId: (u as any).id,
          kpiName,
          targetValue: Number(targetValue),
          currentValue: 0,
          frequency: frequency || "monthly",
          weightage: weightage !== undefined ? Number(weightage) : 10,
          createdBy: caller.id,
          status: "Active"
        });
      }

      await sequelize.models.KpiTargetHistory.create({
        id: crypto.randomUUID(),
        kpiTargetId: (kpi as any).id,
        oldValue: oldVal,
        newValue: Number(targetValue),
        changedBy: caller.id,
        reason: `Bulk assigned target by ${department ? 'department: ' + department : team ? 'team: ' + team : 'admin select'}`,
        changeDate: new Date()
      });
    }

    res.json({ message: `Successfully assigned targets to ${count} salespersons.` });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const lockKpiTargets = async (req: Request, res: Response) => {
  try {
    const caller = (req as any).user;
    if (!caller || !["admin", "director"].includes(caller.role)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const { salespersonId, status } = req.body; // status: 'Locked' or 'Active'
    
    await sequelize.models.KpiTarget.update(
      { status: status === "Locked" ? "Locked" : "Active" },
      { where: { salespersonId } }
    );

    res.json({ message: `Targets updated to ${status} for salesperson.` });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const approveKpiTargetChange = async (req: Request, res: Response) => {
  try {
    const caller = (req as any).user;
    if (!caller || !["admin", "director"].includes(caller.role)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const { kpiId, approve } = req.body;
    const kpi = await sequelize.models.KpiTarget.findByPk(kpiId as string);
    if (!kpi) {
      res.status(404).json({ error: "KPI target not found" });
      return;
    }

    await kpi.update({
      status: approve ? "Active" : "Rejected"
    });

    res.json({ message: approve ? "Target approved and active" : "Target update rejected", kpi });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

