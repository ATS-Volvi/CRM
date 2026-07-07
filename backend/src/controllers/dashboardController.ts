import { Request, Response } from "express";
import { sequelize } from "@nexus-crm/database";

export const getKpiDashboard = async (req: Request, res: Response) => {
  try {
    // For MVP we just return aggregate counts or dummy metrics 
    // combined with real tasks from Activities.
    
    // Fetch all activities of type 'task'
    const tasks = await sequelize.models.Activity.findAll({
      where: { type: 'task' },
      include: [{ model: sequelize.models.Lead, as: 'Lead' }],
      order: [['createdAt', 'DESC']],
      limit: 10
    });

    const metrics = {
      quotaAttainment: { current: 1200000, target: 1500000, percentage: 80, trend: "+8%" },
      closeRate: { current: 28.4, previous: 31.2, trend: "-2.8%" },
      urgentFollowUps: [],
      tasks
    };

    res.json(metrics);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getManagementDashboard = async (req: Request, res: Response) => {
  try {
    // Fetch real deals to calculate pipeline value
    const deals = await sequelize.models.Deal.findAll({
      include: [{ model: sequelize.models.PipelineStage, as: 'stage' }]
    });

    const totalPipelineValue = deals.reduce((acc: number, deal: any) => acc + Number(deal.amount || 0), 0);
    const wonDeals = deals.filter((d: any) => d.stage?.name === 'Won');
    const totalWon = wonDeals.reduce((acc: number, deal: any) => acc + Number(deal.amount || 0), 0);

    const metrics = {
      totalPipelineValue,
      totalWon,
      winRate: deals.length > 0 ? (wonDeals.length / deals.length) * 100 : 0,
      activeDealsCount: deals.length
    };

    res.json(metrics);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
