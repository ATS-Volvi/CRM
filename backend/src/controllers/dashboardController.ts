import { Request, Response } from "express";
import { sequelize } from "@nexus-crm/database";
import { calculateUserKpis, calculateTeamKpis } from "../services/kpiService";

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
    const teamKpis = await calculateTeamKpis();
    const deals = await sequelize.models.Deal.findAll({
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

export const getHomeDashboard = async (req: Request, res: Response) => {
  try {
    const clientsCount = await sequelize.models.Lead.count({ where: { status: "Qualified" } });
    
    // Sum PO amounts
    const poValue = await sequelize.models.PurchaseOrder.sum("amount") || 0;
    
    // Total Leads
    const leadsCount = await sequelize.models.Lead.count();
    
    // Conversion rate: Qualified Leads / Total Leads
    const qualifiedLeads = await sequelize.models.Lead.count({ where: { status: "Qualified" } });
    const conversionRate = leadsCount > 0 ? Math.round((qualifiedLeads / leadsCount) * 100) : 0;
    
    // Sum Invoices totalAmount
    const invoicesTotal = await sequelize.models.Invoice.sum("totalAmount") || 0;

    // Clients: Latest 5 qualified leads
    const dbClients = await sequelize.models.Lead.findAll({
      where: { status: "Qualified" },
      limit: 5,
      order: [["createdAt", "DESC"]]
    });
    const clients = dbClients.map((l: any) => ({
      id: l.id,
      name: `${l.firstName} ${l.lastName}`,
      company: l.company || "—",
      status: l.status,
      email: l.email
    }));

    // Leads: Latest 5 leads
    const dbLeads = await sequelize.models.Lead.findAll({
      limit: 5,
      order: [["createdAt", "DESC"]]
    });
    const leads = dbLeads.map((l: any) => ({
      id: l.id,
      name: `${l.firstName} ${l.lastName}`,
      company: l.company || "—",
      amount: 0,
      status: l.status,
      source: l.source || "Direct"
    }));

    // Quotes: Latest 5 quotes with deal info
    const dbQuotes = await sequelize.models.Quote.findAll({
      limit: 5,
      order: [["createdAt", "DESC"]],
      include: [{ model: sequelize.models.Deal, as: "deal", required: false }]
    });
    const quotes = dbQuotes.map((q: any) => ({
      id: q.id,
      quoteNumber: q.quoteNumber || "—",
      dealName: q.deal?.name || "—",
      amount: Number(q.totalAmount),
      status: q.status,
      createdAt: q.createdAt
    }));

    // Purchase Orders: Latest 5 POs
    const dbPOs = await sequelize.models.PurchaseOrder.findAll({
      limit: 5,
      order: [["createdAt", "DESC"]]
    });
    const purchaseOrders = dbPOs.map((p: any) => ({
      id: p.id,
      poNumber: p.poNumber,
      amount: Number(p.amount),
      status: p.status,
      createdAt: p.createdAt
    }));

    res.json({
      clientsCount,
      poValue,
      leadsCount,
      conversionRate,
      invoicesTotal,
      clients,
      leads,
      quotes,
      purchaseOrders
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
