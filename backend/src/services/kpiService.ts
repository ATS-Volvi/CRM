import { sequelize } from "@nexus-crm/database";

export async function calculateUserKpis(userId: string): Promise<any> {
  try {
    const deals = await sequelize.models.Deal.findAll({
      where: { ownerId: userId },
      include: [{ model: sequelize.models.PipelineStage, as: "stage" }]
    });

    const quotes = await sequelize.models.Quote.findAll({
      include: [{
        model: sequelize.models.Deal,
        as: "deal",
        where: { ownerId: userId }
      }]
    });

    const activities = await sequelize.models.Activity.findAll({
      where: { createdById: userId }
    });

    const leadsAssigned = await sequelize.models.Lead.count({
      where: { assignedToId: userId }
    });

    // 1. Quota Attainment (Calculate sum of won deal values)
    const wonDeals = deals.filter((d: any) => d.stage?.name === "Won");
    const actualRevenue = wonDeals.reduce((sum: number, d: any) => sum + Number(d.amount), 0);

    // Fetch Target
    const targetRecord = await sequelize.models.KpiTarget.findOne({
      where: { userId, kpiName: "revenue" }
    });
    const targetRevenue = targetRecord ? Number((targetRecord as any).targetValue) : 100000; // Default fallback target

    const quotaAttainment = {
      current: actualRevenue,
      target: targetRevenue,
      percentage: targetRevenue > 0 ? Math.round((actualRevenue / targetRevenue) * 100) : 0
    };

    // 2. Win/Close Rate
    const totalClosed = deals.filter((d: any) => d.stage?.name === "Won" || d.stage?.name === "Lost").length;
    const closeRate = totalClosed > 0 ? (wonDeals.length / totalClosed) * 100 : 0;

    // 3. Activity metrics
    const callsMade = activities.filter((a: any) => a.type === "call").length;
    const meetingsHeld = activities.filter((a: any) => a.type === "meeting").length;
    const emailsSent = activities.filter((a: any) => a.type === "email").length;

    return {
      leadsAssigned,
      quotaAttainment,
      closeRate: Number(closeRate.toFixed(1)),
      activities: {
        calls: callsMade,
        meetings: meetingsHeld,
        emails: emailsSent
      }
    };
  } catch (error) {
    console.error(`Error calculating KPIs for user ${userId}:`, error);
    return null;
  }
}

export async function calculateTeamKpis(): Promise<any> {
  try {
    const deals = await sequelize.models.Deal.findAll({
      include: [{ model: sequelize.models.PipelineStage, as: "stage" }]
    });

    const wonDeals = deals.filter((d: any) => d.stage?.name === "Won");
    const totalWonAmount = wonDeals.reduce((sum: number, d: any) => sum + Number(d.amount), 0);

    const totalClosed = deals.filter((d: any) => d.stage?.name === "Won" || d.stage?.name === "Lost").length;
    const teamCloseRate = totalClosed > 0 ? (wonDeals.length / totalClosed) * 100 : 0;

    return {
      totalPipelineValue: deals.reduce((sum: number, d: any) => sum + Number(d.amount), 0),
      totalWonAmount,
      teamCloseRate: Number(teamCloseRate.toFixed(1)),
      activeDealsCount: deals.length
    };
  } catch (error) {
    console.error("Error calculating team KPIs:", error);
    return null;
  }
}
