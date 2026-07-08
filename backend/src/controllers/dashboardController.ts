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
