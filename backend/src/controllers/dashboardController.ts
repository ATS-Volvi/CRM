import { Request, Response } from "express";
import { sequelize } from "@nexus-crm/database";
import { calculateUserKpis, calculateTeamKpis } from "../services/kpiService";
import { getScopedUserIds } from "../services/scopeHelper";
import { Op } from "sequelize";

export const getKpiDashboard = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || "mock-user";
    
    // Fetch all tasks of this user
    const tasks = await sequelize.models.Activity.findAll({
      where: { type: 'task', createdById: userId },
      order: [['createdAt', 'DESC']],
      limit: 10
    });

    const userKpis = await calculateUserKpis(userId);

    const metrics = {
      quotaAttainment: userKpis ? userKpis.quotaAttainment : { current: 0, target: 100000, percentage: 0 },
      closeRate: { current: userKpis ? userKpis.closeRate : 0, trend: "Real-time" },
      leadsAssigned: userKpis ? userKpis.leadsAssigned : 0,
      activities: userKpis ? userKpis.activities : { calls: 0, meetings: 0, emails: 0 },
      tasks
    };

    res.json(metrics);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getManagementDashboard = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const scopedUserIds = await getScopedUserIds(user);

    const teamKpis = await calculateTeamKpis(scopedUserIds);
    const deals = await sequelize.models.Deal.findAll({
      where: { ownerId: { [Op.in]: scopedUserIds } },
      include: [{ model: sequelize.models.PipelineStage, as: 'stage' }]
    });

    // Funnel distribution count
    const funnelStages = ["New", "Contacted", "Qualified", "Meeting/Demo", "Proposal", "Negotiation", "Won", "Lost", "On Hold"];
    const funnel = funnelStages.map(stageName => {
      const stageDeals = deals.filter((d: any) => d.stage?.name === stageName);
      return {
        stage: stageName,
        count: stageDeals.length,
        value: stageDeals.reduce((sum: number, d: any) => sum + Number(d.amount || 0), 0)
      };
    });

    res.json({
      totalPipelineValue: teamKpis ? teamKpis.totalPipelineValue : 0,
      totalWon: teamKpis ? teamKpis.totalWonAmount : 0,
      winRate: teamKpis ? teamKpis.teamCloseRate : 0,
      activeDealsCount: teamKpis ? teamKpis.activeDealsCount : 0,
      funnel
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getMyTodayDashboard = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || "mock-user";
    const { Op } = require("sequelize");

    // 1. Tasks due today or overdue
    const tasks = await sequelize.models.Activity.findAll({
      where: {
        type: "task",
        createdById: userId,
        isCompleted: false,
        dueDate: {
          [Op.lte]: new Date()
        }
      },
      order: [["dueDate", "ASC"]]
    });

    // 2. Leads to follow up (assigned leads with no activity logged in the last 3 days)
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const leads = await sequelize.models.Lead.findAll({
      where: {
        assignedToId: userId,
        status: ["New", "Contacted"]
      },
      include: [{
        model: sequelize.models.Activity,
        as: "activities",
        required: false,
        where: {
          createdAt: {
            [Op.gte]: threeDaysAgo
          }
        }
      }]
    });

    // Filter leads that have 0 activities within the last 3 days
    const followUpsNeeded = leads.filter((l: any) => !l.activities || l.activities.length === 0);

    // 3. New leads assigned today
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const newLeadsToday = await sequelize.models.Lead.findAll({
      where: {
        assignedToId: userId,
        createdAt: {
          [Op.gte]: startOfToday
        }
      }
    });

    res.json({
      tasks,
      followUpsNeeded,
      newLeadsToday
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// -----------------------------------------------------------------------------
// GET /api/v1/dashboard/home
// -----------------------------------------------------------------------------
export const getMyHomeDashboard = async (req: Request, res: Response) => {
  try {
    const { Op } = require("sequelize");
    const userId = (req as any).user?.id || "mock-user";

    const range = (req.query.range as string) || "week";
    let startDate: Date;
    let endDate: Date;
    if (req.query.startDate && req.query.endDate) {
      startDate = new Date(req.query.startDate as string);
      endDate   = new Date(req.query.endDate   as string);
    } else {
      endDate   = new Date();
      startDate = new Date();
      if (range === "day") { startDate.setHours(0,0,0,0); }
      else { startDate.setDate(startDate.getDate()-7); startDate.setHours(0,0,0,0); }
    }
    const dateFilter = { [Op.between]: [startDate, endDate] };

    const leads: any[] = (await sequelize.models.Lead.findAll({
      where: { assignedToId: userId, createdAt: dateFilter },
      include: [{ model: sequelize.models.Deal, as: "Deals", required: false }],
      order: [["createdAt","DESC"]], limit: 20
    })) as any[];

    const allDeals: any[] = (await sequelize.models.Deal.findAll({
      where: { ownerId: userId },
      include: [{ model: sequelize.models.PipelineStage, as: "stage" }]
    })) as any[];
    const dealIds = allDeals.map((d: any) => d.id);

    const rawQuotes: any[] = dealIds.length > 0
      ? (await sequelize.models.Quote.findAll({
          where: { dealId: { [Op.in]: dealIds }, createdAt: dateFilter },
          include: [{ model: sequelize.models.Deal, as: "deal", include: [{ model: sequelize.models.Lead, as: "lead" }] }, { model: sequelize.models.PurchaseOrder, as: "purchaseOrder" }],
          order: [["createdAt","DESC"]], limit: 20
        })) as any[]
      : [];

    const allQuoteIds: string[] = dealIds.length > 0
      ? ((await sequelize.models.Quote.findAll({ where: { dealId: { [Op.in]: dealIds } }, attributes: ["id"] })) as any[]).map((q: any) => q.id)
      : [];

    const allPOs: any[] = allQuoteIds.length > 0
      ? (await sequelize.models.PurchaseOrder.findAll({ where: { quoteId: { [Op.in]: allQuoteIds } } })) as any[] : [];
    const recentPOs: any[] = rawQuotes.map((q: any) => q.purchaseOrder).filter(Boolean);
    const poValue = allPOs.reduce((s: number, po: any) => s + (parseFloat(po.amount)||0), 0);

    const invoices: any[] = allQuoteIds.length > 0
      ? (await sequelize.models.Invoice.findAll({ where: { quoteId: { [Op.in]: allQuoteIds }, createdAt: dateFilter } })) as any[] : [];
    const invoicesTotal = invoices.reduce((s: number, inv: any) => s + (parseFloat(inv.amount)||0), 0);

    const wonDeals = allDeals.filter((d: any) => d.stage?.name === "Won");
    const clientLeadIds = [...new Set<string>(wonDeals.map((d: any) => d.leadId).filter(Boolean))];
    const clientLeads: any[] = clientLeadIds.length > 0
      ? (await sequelize.models.Lead.findAll({ where: { id: { [Op.in]: clientLeadIds } }, limit: 10 })) as any[] : [];

    const { calculateUserKpis } = await import("../services/kpiService");
    const kpis = await calculateUserKpis(userId);
    const conversionRate = kpis?.closeRate ?? 0;

    const clients = clientLeads.map((l: any) => ({ id: l.id, name: `${l.firstName} ${l.lastName}`, company: l.company||"N/A", status: l.status, email: l.email }));
    const leadsOut = leads.map((l: any) => ({ id: l.id, name: `${l.firstName} ${l.lastName}`, company: l.company||"N/A", amount: (l.Deals && l.Deals.length > 0) ? parseFloat(l.Deals[0].amount)||0 : 0, status: l.status, source: l.source }));

    const cs = (q: any): string => {
      if (q.status === "Accepted" || q.acceptedAt) return "Accepted";
      if (q.status === "Superseded") return "Superseded";
      if (q.status === "Rejected") return "Rejected";
      if (q.sentAt && q.expirationDate && new Date(q.expirationDate) < new Date() && !q.acceptedAt) return "Expired";
      if (q.viewedAt) return "Viewed";
      if (q.sentAt) return "Sent";
      if (q.status === "Approved") return "Approved";
      if (q.status === "Pending Approval") return "Pending Approval";
      return "Draft";
    };

    const quotesOut = rawQuotes.map((q: any) => {
      const lead = q.deal?.lead;
      const dealName = lead ? lead.company||`${lead.firstName} ${lead.lastName}`.trim() : (q.deal?.name??"Unknown");
      return { id: q.id, quoteNumber: q.quoteNumber??"Draft", dealName, amount: parseFloat(q.totalAmount)||0, status: cs(q), createdAt: q.createdAt };
    });
    const purchaseOrdersOut = recentPOs.map((po: any) => ({ id: po.id, poNumber: po.poNumber, amount: parseFloat(po.amount)||0, status: po.status, createdAt: po.createdAt }));

    res.json({ range, startDate, endDate, clientsCount: clientLeads.length, poValue, leadsCount: leads.length, conversionRate, invoicesTotal, clients, leads: leadsOut, quotes: quotesOut, purchaseOrders: purchaseOrdersOut });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getKpiTarget = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || "mock-user";
    const target = await sequelize.models.KpiTarget.findOne({
      where: { userId, kpiName: "revenue" }
    });
    res.json(target || { kpiName: "revenue", targetValue: 100000 });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateKpiTarget = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || "mock-user";
    const { targetValue } = req.body;
    
    let target = await sequelize.models.KpiTarget.findOne({
      where: { userId, kpiName: "revenue" }
    });

    if (target) {
      await target.update({ targetValue });
    } else {
      const crypto = require("crypto");
      target = await sequelize.models.KpiTarget.create({
        id: crypto.randomUUID(),
        userId,
        kpiName: "revenue",
        targetValue,
        period: "monthly"
      });
    }

    res.json(target);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getActivitiesReports = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const scopedUserIds = await getScopedUserIds(user);

    // 1. Activity Volume
    const activities = await sequelize.models.Activity.findAll({
      where: { createdById: { [Op.in]: scopedUserIds } }
    });

    const volumeCounts = { call: 0, email: 0, meeting: 0, task: 0, note: 0 };
    activities.forEach((act: any) => {
      const t = act.type as keyof typeof volumeCounts;
      if (volumeCounts[t] !== undefined) {
        volumeCounts[t]++;
      }
    });

    // 2. Leads with No Activity
    const allLeads = await sequelize.models.Lead.findAll({
      where: { assignedToId: { [Op.in]: scopedUserIds } },
      include: [{ model: sequelize.models.Activity, as: "activities", required: false }]
    });
    const noActivityLeads = allLeads.filter((l: any) => !l.activities || l.activities.length === 0);

    // 3. Activity to Outcome (Simple breakdown of outcomes)
    const outcomes: Record<string, number> = {};
    activities.forEach((act: any) => {
      if (act.outcome) {
        outcomes[act.outcome] = (outcomes[act.outcome] || 0) + 1;
      }
    });

    // 4. Follow-up SLA Compliance
    // SLA Met: First activity logged within 24 hours of Lead creation
    let complianceMet = 0;
    let complianceBreached = 0;
    for (const lead of allLeads) {
      const leadActs = (lead as any).activities || [];
      if (leadActs.length > 0) {
        // Sort by creation date
        leadActs.sort((a: any, b: any) => a.createdAt.getTime() - b.createdAt.getTime());
        const firstActDate = leadActs[0].createdAt;
        const diffMs = firstActDate.getTime() - (lead as any).createdAt.getTime();
        const diffHours = diffMs / (1000 * 60 * 60);
        if (diffHours <= 24) {
          complianceMet++;
        } else {
          complianceBreached++;
        }
      } else {
        complianceBreached++;
      }
    }

    // 5. Call Outcome Distribution
    const callOutcomes: Record<string, number> = {};
    activities.filter((act: any) => act.type === "call").forEach((act: any) => {
      const outcome = act.outcome || "No Outcome Listed";
      callOutcomes[outcome] = (callOutcomes[outcome] || 0) + 1;
    });

    // 6. Meeting Conversion Rate
    const meetings = activities.filter((act: any) => act.type === "meeting");
    const convertedMeetings = meetings.filter((act: any) => 
      act.outcome && (act.outcome.toLowerCase().includes("qualified") || act.outcome.toLowerCase().includes("deal") || act.outcome.toLowerCase().includes("won"))
    );
    const meetingConversionRate = meetings.length > 0 ? (convertedMeetings.length / meetings.length) * 100 : 0;

    res.json({
      activityVolume: volumeCounts,
      noActivityLeadsCount: noActivityLeads.length,
      activityToOutcome: outcomes,
      slaCompliance: { met: complianceMet, breached: complianceBreached },
      callOutcomeDistribution: callOutcomes,
      meetingConversionRate: Math.round(meetingConversionRate)
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
