export interface CampaignWarningBadge {
  type: "budget_100" | "budget_80" | "ended_active" | "no_leads";
  label: string;
  severity: "rose" | "amber" | "slate";
}

/**
 * Computes warning badges for campaign list rows and detail views:
 *   - "Over 100% of budget" / "Over 80% of budget" (actualSpend >= 80% / 100% of budget)
 *   - "Ended, still active" (ACTIVE campaign whose endDate has passed)
 *   - "No leads yet" (ACTIVE campaign started > 7 days ago with 0 leads)
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
  if (status === "ACTIVE" && endDate && !isNaN(endDate.getTime()) && endDate < now) {
    badges.push({ type: "ended_active", label: "Ended, still active", severity: "amber" });
  }

  // c) No leads yet warning (> 7 days active with 0 leads)
  if (status === "ACTIVE" && startDate && !isNaN(startDate.getTime()) && startDate < sevenDaysAgo && totalLeads === 0) {
    badges.push({ type: "no_leads", label: "No leads yet", severity: "slate" });
  }

  return badges;
}
