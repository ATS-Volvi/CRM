import { sequelize } from "@nexus-crm/database";
import { Op } from "sequelize";
import { getCampaignPerformance } from "./attributionService";
import { createNotification } from "./notificationService";

export interface CampaignWarningBadge {
  type: "budget_100" | "budget_80" | "ended_active" | "no_leads";
  label: string;
  severity: "rose" | "amber" | "slate";
}

/**
  * Pure helper to compute warning badges for campaigns in UI or backend checks
  */
export function getCampaignWarningBadges(campaign: any, totalLeads: number = 0): CampaignWarningBadge[] {
  const badges: CampaignWarningBadge[] = [];
  const budget = Number(campaign?.budget || 0);
  const actualSpend = campaign?.actualSpend !== null && campaign?.actualSpend !== undefined ? Number(campaign.actualSpend) : null;
  const status = (campaign?.status || "").toUpperCase();
  const startDate = campaign?.startDate ? new Date(campaign.startDate) : null;
  const endDate = campaign?.endDate ? new Date(campaign.endDate) : null;
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // a) Budget threshold warning
  if (budget > 0 && actualSpend !== null) {
    if (actualSpend >= budget) {
      badges.push({ type: "budget_100", label: "Over 100% of budget", severity: "rose" });
    } else if (actualSpend >= 0.8 * budget) {
      badges.push({ type: "budget_80", label: "Over 80% of budget", severity: "amber" });
    }
  }

  // b) Ended, still active warning
  if (status === "ACTIVE" && endDate && endDate < now) {
    badges.push({ type: "ended_active", label: "Ended, still active", severity: "amber" });
  }

  // c) No leads yet warning (> 7 days active with 0 leads)
  if (status === "ACTIVE" && startDate && startDate < sevenDaysAgo && totalLeads === 0) {
    badges.push({ type: "no_leads", label: "No leads yet", severity: "slate" });
  }

  return badges;
}

/**
 * Budget Pacing Alert & Monitoring Service
 * Runs daily to check active campaigns against 3 alert rules:
 *   a) actualSpend >= 80% of budget (alerts at 80% and 100% thresholds)
 *   b) ACTIVE campaign passed its endDate but is still ACTIVE
 *   c) ACTIVE campaign started > 7 days ago and has 0 leads
 * Avoids duplicate notifications by tracking groupKey / metadata / title.
 */
export async function checkCampaignBudgetPacingAndAlerts(): Promise<{
  alertsGenerated: number;
  campaignsChecked: number;
}> {
  const { Campaign, Notification, User } = sequelize.models;

  console.log("[BUDGET PACING] Running daily campaign pacing & budget alert check...");

  const campaigns = await Campaign.findAll({
    include: [{ model: User, as: "owner", attributes: ["id", "name", "email", "role"] }]
  });

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  let alertsGenerated = 0;

  for (const campaign of campaigns as any[]) {
    const budget = Number(campaign.budget || 0);
    const actualSpend = campaign.actualSpend !== null && campaign.actualSpend !== undefined ? Number(campaign.actualSpend) : null;
    const status = (campaign.status || "").toUpperCase();
    const startDate = campaign.startDate ? new Date(campaign.startDate) : null;
    const endDate = campaign.endDate ? new Date(campaign.endDate) : null;
    const ownerId = campaign.ownerId || (campaign.owner?.id);

    // Fetch campaign performance metrics for lead count
    const perf = await getCampaignPerformance(campaign.id);
    const totalLeads = perf?.metrics?.totalLeads || 0;

    // Find recipient users: campaign owner if set, otherwise all ADMIN users
    let targetUserIds: string[] = [];
    if (ownerId) {
      targetUserIds = [ownerId];
    } else {
      const adminUsers: any = await User.findAll({
        where: {
          role: { [Op.in]: ["admin", "ADMIN"] }
        }
      });
      targetUserIds = adminUsers.map((u: any) => u.id);
      if (targetUserIds.length === 0) {
        const firstAdmin: any = await User.findOne();
        if (firstAdmin?.id) targetUserIds = [firstAdmin.id];
      }
    }

    if (targetUserIds.length === 0) continue;

    // a) Rule: actualSpend >= 80% (threshold 80% and threshold 100%)
    if (budget > 0 && actualSpend !== null) {
      // 100% threshold
      if (actualSpend >= budget) {
        const groupKey = `CAMPAIGN_BUDGET_100_${campaign.id}`;
        const existing = await Notification.findOne({
          where: {
            [Op.or]: [
              { groupKey },
              { entityType: "Campaign", entityId: campaign.id, title: "Campaign Budget Exhausted (100%)" }
            ]
          }
        });

        if (!existing) {
          for (const uid of targetUserIds) {
            await createNotification(
              uid,
              "alert",
              "Campaign Budget Exhausted (100%)",
              `Campaign '${campaign.name}' (${campaign.code}) has reached 100% of its budget (${campaign.currency || "SAR"} ${actualSpend.toLocaleString()} of ${budget.toLocaleString()}).`,
              `/campaigns/${campaign.id}`
            );
            await Notification.update(
              { groupKey, entityType: "Campaign", entityId: campaign.id },
              { where: { userId: uid, title: "Campaign Budget Exhausted (100%)" } }
            );
          }
          alertsGenerated++;
        }
      }
      // 80% threshold
      else if (actualSpend >= 0.8 * budget) {
        const groupKey = `CAMPAIGN_BUDGET_80_${campaign.id}`;
        const existing = await Notification.findOne({
          where: {
            [Op.or]: [
              { groupKey },
              { entityType: "Campaign", entityId: campaign.id, title: "Campaign Budget Alert (80% Reached)" }
            ]
          }
        });

        if (!existing) {
          for (const uid of targetUserIds) {
            await createNotification(
              uid,
              "warning",
              "Campaign Budget Alert (80% Reached)",
              `Campaign '${campaign.name}' (${campaign.code}) has spent ${Math.round((actualSpend / budget) * 100)}% of its allocated budget.`,
              `/campaigns/${campaign.id}`
            );
            await Notification.update(
              { groupKey, entityType: "Campaign", entityId: campaign.id },
              { where: { userId: uid, title: "Campaign Budget Alert (80% Reached)" } }
            );
          }
          alertsGenerated++;
        }
      }
    }

    // b) Rule: ACTIVE campaign has passed its endDate but is still ACTIVE
    if (status === "ACTIVE" && endDate && endDate < now) {
      const groupKey = `CAMPAIGN_ENDED_ACTIVE_${campaign.id}`;
      const existing = await Notification.findOne({
        where: {
          [Op.or]: [
            { groupKey },
            { entityType: "Campaign", entityId: campaign.id, title: "Campaign Ended But Still Active" }
          ]
        }
      });

      if (!existing) {
        for (const uid of targetUserIds) {
          await createNotification(
            uid,
            "warning",
            "Campaign Ended But Still Active",
            `Campaign '${campaign.name}' (${campaign.code}) passed its scheduled end date (${endDate.toISOString().slice(0, 10)}) but is still marked ACTIVE.`,
            `/campaigns/${campaign.id}`
          );
          await Notification.update(
            { groupKey, entityType: "Campaign", entityId: campaign.id },
            { where: { userId: uid, title: "Campaign Ended But Still Active" } }
          );
        }
        alertsGenerated++;
      }
    }

    // c) Rule: ACTIVE campaign started > 7 days ago and has 0 leads
    if (status === "ACTIVE" && startDate && startDate < sevenDaysAgo && totalLeads === 0) {
      const groupKey = `CAMPAIGN_ZERO_LEADS_7D_${campaign.id}`;
      const existing = await Notification.findOne({
        where: {
          [Op.or]: [
            { groupKey },
            { entityType: "Campaign", entityId: campaign.id, title: "Campaign Inactivity Alert (0 Leads)" }
          ]
        }
      });

      if (!existing) {
        for (const uid of targetUserIds) {
          await createNotification(
            uid,
            "alert",
            "Campaign Inactivity Alert (0 Leads)",
            `Campaign '${campaign.name}' (${campaign.code}) launched more than 7 days ago (${startDate.toISOString().slice(0, 10)}) but has recorded 0 inbound leads.`,
            `/campaigns/${campaign.id}`
          );
          await Notification.update(
            { groupKey, entityType: "Campaign", entityId: campaign.id },
            { where: { userId: uid, title: "Campaign Inactivity Alert (0 Leads)" } }
          );
        }
        alertsGenerated++;
      }
    }
  }

  console.log(`[BUDGET PACING] Check complete. ${alertsGenerated} new alerts created across ${campaigns.length} campaigns.`);
  return { alertsGenerated, campaignsChecked: campaigns.length };
}

export function startCampaignPacingScheduler() {
  // Run once immediately on startup
  checkCampaignBudgetPacingAndAlerts().catch((err) =>
    console.error("[BUDGET PACING] Scheduler startup error:", err)
  );

  // Then check every 24 hours
  setInterval(() => {
    checkCampaignBudgetPacingAndAlerts().catch((err) =>
      console.error("[BUDGET PACING] Scheduler recurring error:", err)
    );
  }, 24 * 60 * 60 * 1000);

  console.log("Campaign Budget Pacing Scheduler initialized (24h interval).");
}
