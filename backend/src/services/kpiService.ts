import { sequelize } from "@nexus-crm/database";
import { Op } from "sequelize";

export async function calculateUserKpis(userId: string): Promise<any> {
  try {
    const deals = await sequelize.models.Deal.findAll({
      where: { ownerId: userId },
      include: [{ model: sequelize.models.PipelineStage, as: "stage" }]
    });

    const activities = await sequelize.models.Activity.findAll({
      where: { createdById: userId }
    });

    const leads = await sequelize.models.Lead.findAll({
      where: { assignedToId: userId }
    });

    const leadsAssigned = leads.length;

    // 1. Quota Attainment (Won deal values vs Target)
    const wonDeals = deals.filter((d: any) => d.stage?.name === "Won");
    const actualRevenue = wonDeals.reduce((sum: number, d: any) => sum + Number(d.amount), 0);

    const targetRecord = await sequelize.models.KpiTarget.findOne({
      where: { salespersonId: userId, kpiName: "revenue" }
    });
    const targetRevenue = targetRecord ? Number((targetRecord as any).targetValue) : 100000;

    const quotaAttainment = {
      current: actualRevenue,
      target: targetRevenue,
      percentage: targetRevenue > 0 ? Math.round((actualRevenue / targetRevenue) * 100) : 0
    };

    // 2. Win/Close Rate
    const totalClosed = deals.filter((d: any) => d.stage?.name === "Won" || d.stage?.name === "Lost").length;
    const closeRate = totalClosed > 0 ? (wonDeals.length / totalClosed) * 100 : 0;

    // 3. Contact Rate & First Response Time
    let totalResponseTimeMs = 0;
    let leadsWithResponse = 0;
    let contactedLeadsCount = 0;
    let qualifiedLeadsCount = 0;

    for (const leadObj of leads) {
      const lead = leadObj as any;
      const leadActivities = await sequelize.models.Activity.findAll({
        where: {
          leadId: lead.id,
          type: { [Op.in]: ["call", "email", "whatsapp_sms", "meeting"] }
        },
        order: [["createdAt", "ASC"]]
      });

      if (leadActivities.length > 0) {
        contactedLeadsCount++;
        const firstAct = leadActivities[0];
        const responseTime = new Date((firstAct as any).createdAt).getTime() - new Date(lead.createdAt).getTime();
        if (responseTime > 0) {
          totalResponseTimeMs += responseTime;
          leadsWithResponse++;
        }
      }

      // Qualification Rate (transitioned out of New / Unqualified status)
      if (lead.status && !["New", "Unqualified"].includes(lead.status)) {
        qualifiedLeadsCount++;
      }
    }

    const avgResponseTimeMin = leadsWithResponse > 0 
      ? Math.round(totalResponseTimeMs / (leadsWithResponse * 1000 * 60)) 
      : 15; // default fallback (15 mins)

    const contactRate = leadsAssigned > 0 ? (contactedLeadsCount / leadsAssigned) * 100 : 0;
    const qualificationRate = leadsAssigned > 0 ? (qualifiedLeadsCount / leadsAssigned) * 100 : 0;

    // 4. Activity metrics
    const callsMade = activities.filter((a: any) => a.type === "call").length;
    const meetingsHeld = activities.filter((a: any) => a.type === "meeting").length;
    const emailsSent = activities.filter((a: any) => a.type === "email").length;

    return {
      leadsAssigned,
      quotaAttainment,
      closeRate: Number(closeRate.toFixed(1)),
      firstResponseTimeMin: avgResponseTimeMin,
      contactRate: Number(contactRate.toFixed(1)),
      qualificationRate: Number(qualificationRate.toFixed(1)),
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

export async function calculateTeamKpis(scopedUserIds?: string[]): Promise<any> {
  try {
    const dealsWhere: any = {};
    const leadsWhere: any = {};
    if (scopedUserIds) {
      dealsWhere.ownerId = { [Op.in]: scopedUserIds };
      leadsWhere.assignedToId = { [Op.in]: scopedUserIds };
    }

    const deals = await sequelize.models.Deal.findAll({
      where: dealsWhere,
      include: [{ model: sequelize.models.PipelineStage, as: "stage" }]
    });

    const wonDeals = deals.filter((d: any) => d.stage?.name === "Won");
    const totalWonAmount = wonDeals.reduce((sum: number, d: any) => sum + Number(d.amount), 0);

    const totalClosed = deals.filter((d: any) => d.stage?.name === "Won" || d.stage?.name === "Lost").length;
    const teamCloseRate = totalClosed > 0 ? (wonDeals.length / totalClosed) * 100 : 0;

    // Lead averages for team
    const leads = await sequelize.models.Lead.findAll({
      where: leadsWhere
    });
    let contactedCount = 0;
    let totalRespTimeMs = 0;
    let leadsWithResp = 0;

    for (const leadObj of leads) {
      const lead = leadObj as any;
      const acts = await sequelize.models.Activity.findAll({
        where: {
          leadId: lead.id,
          type: { [Op.in]: ["call", "email", "whatsapp_sms", "meeting"] }
        },
        order: [["createdAt", "ASC"]]
      });

      if (acts.length > 0) {
        contactedCount++;
        const responseTime = new Date((acts[0] as any).createdAt).getTime() - new Date(lead.createdAt).getTime();
        if (responseTime > 0) {
          totalRespTimeMs += responseTime;
          leadsWithResp++;
        }
      }
    }

    const teamAvgResponseTimeMin = leadsWithResp > 0 
      ? Math.round(totalRespTimeMs / (leadsWithResp * 1000 * 60)) 
      : 20;

    const teamContactRate = leads.length > 0 ? (contactedCount / leads.length) * 100 : 0;

    return {
      totalPipelineValue: deals.reduce((sum: number, d: any) => sum + Number(d.amount), 0),
      totalWonAmount,
      teamCloseRate: Number(teamCloseRate.toFixed(1)),
      activeDealsCount: deals.length,
      firstResponseTimeMin: teamAvgResponseTimeMin,
      contactRate: Number(teamContactRate.toFixed(1))
    };
  } catch (error) {
    console.error("Error calculating team KPIs:", error);
    return null;
  }
}
