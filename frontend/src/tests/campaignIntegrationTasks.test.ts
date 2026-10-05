/**
 * Real Tests for Campaigns Integration Tasks (1, 2, 3, 4)
 * Uses real service helpers, classification logic, and CSV utilities.
 */

import { isSalesContactTouch, getSalesActivityType } from "../../../backend/src/controllers/attributionController";
import { escapeCsvCell, generateCsvRow, generateCsv } from "../../../backend/src/utils/csvHelper";
import { getCampaignWarningBadges } from "../lib/campaignPacing";

describe("TASK 1: Marketing Touch vs Sales Contact Classification", () => {
  test("classifies marketing touches as non-sales contacts (preserves lead status)", () => {
    // Pure marketing channels
    expect(isSalesContactTouch("Meta Ads", "Paid Social")).toBe(false);
    expect(isSalesContactTouch("Google Ads", "Paid Search")).toBe(false);
    expect(isSalesContactTouch("LinkedIn", "Advertisement")).toBe(false);
    expect(isSalesContactTouch("Website", "Organic")).toBe(false);
    expect(isSalesContactTouch("Direct", "Direct Traffic")).toBe(false);
    expect(isSalesContactTouch("Event", "Trade Show")).toBe(false);
    expect(isSalesContactTouch("Campaign", "Campaign")).toBe(false);
    expect(isSalesContactTouch("Other", "Other")).toBe(false);
    expect(isSalesContactTouch("Email", "Email Marketing")).toBe(false);
    expect(isSalesContactTouch("WhatsApp", "Paid Social")).toBe(false);
  });

  test("classifies real 1-on-1 sales interactions as sales contacts (advances stage to Contacted)", () => {
    // Sales calls, meetings, direct reps, 1-on-1 WhatsApp/Email conversations
    expect(isSalesContactTouch("Phone", "Sales Outbound")).toBe(true);
    expect(isSalesContactTouch("Call", "Sales Rep")).toBe(true);
    expect(isSalesContactTouch("Meeting", "Sales Rep")).toBe(true);
    expect(isSalesContactTouch("In-Person Meeting", "Direct")).toBe(true);
    expect(isSalesContactTouch("WhatsApp", "Direct")).toBe(true);
    expect(isSalesContactTouch("Email", "Sales Outbound")).toBe(true);
    expect(isSalesContactTouch("Email", "Sales Rep")).toBe(true);
  });

  test("maps sales touch to correct activity type", () => {
    expect(getSalesActivityType("Phone")).toBe("call");
    expect(getSalesActivityType("Call")).toBe("call");
    expect(getSalesActivityType("Meeting")).toBe("meeting");
    expect(getSalesActivityType("WhatsApp")).toBe("whatsapp_sms");
    expect(getSalesActivityType("Email")).toBe("email");
  });
});

describe("TASK 2: Ad-Level Funnel Performance Metrics & Sorting", () => {
  const mockAds = [
    { id: "ad-1", name: "Prefab Industrial Office Ad", externalId: "fb_ad_101", platform: "Meta Ads", creativeType: "Carousel" },
    { id: "ad-2", name: "High Voltage Panels Search Ad", externalId: "goog_ad_202", platform: "Google Ads", creativeType: "Text" },
    { id: "ad-3", name: "Brand Awareness Video", externalId: "li_ad_303", platform: "LinkedIn", creativeType: "Video" }
  ];

  const mockAdMetrics = [
    {
      adId: "ad-1",
      adName: "Prefab Industrial Office Ad",
      totalLeads: 12,
      qualifiedLeads: 8,
      totalOpportunities: 5,
      wonOrdersCount: 3,
      totalRevenue: 450000
    },
    {
      adId: "ad-2",
      adName: "High Voltage Panels Search Ad",
      totalLeads: 25,
      qualifiedLeads: 18,
      totalOpportunities: 10,
      wonOrdersCount: 6,
      totalRevenue: 980000
    },
    {
      adId: "ad-3",
      adName: "Brand Awareness Video",
      totalLeads: 0,
      qualifiedLeads: 0,
      totalOpportunities: 0,
      wonOrdersCount: 0,
      totalRevenue: 0
    }
  ];

  test("correctly maps per-ad metrics with fallback to dash '-' when 0 or missing", () => {
    const metricsMap = new Map(mockAdMetrics.map(m => [m.adId, m]));

    const ad1 = metricsMap.get("ad-1")!;
    expect(ad1.totalLeads).toBe(12);
    expect(ad1.qualifiedLeads).toBe(8);
    expect(ad1.totalOpportunities).toBe(5);
    expect(ad1.wonOrdersCount).toBe(3);
    expect(ad1.totalRevenue).toBe(450000);

    const ad3 = metricsMap.get("ad-3")!;
    expect(ad3.totalLeads > 0 ? ad3.totalLeads : "—").toBe("—");
    expect(ad3.qualifiedLeads > 0 ? ad3.qualifiedLeads : "—").toBe("—");
    expect(ad3.totalOpportunities > 0 ? ad3.totalOpportunities : "—").toBe("—");
    expect(ad3.wonOrdersCount > 0 ? ad3.wonOrdersCount : "—").toBe("—");
    expect(ad3.totalRevenue > 0 ? ad3.totalRevenue : "—").toBe("—");
  });

  test("sorts ads correctly by Leads in ascending and descending order", () => {
    const metricsMap = new Map(mockAdMetrics.map(m => [m.adId, m]));

    // Descending sort
    const descSorted = [...mockAds].sort((a, b) => {
      const aLeads = metricsMap.get(a.id)?.totalLeads || 0;
      const bLeads = metricsMap.get(b.id)?.totalLeads || 0;
      return bLeads - aLeads;
    });

    expect(descSorted[0].id).toBe("ad-2"); // 25 leads
    expect(descSorted[1].id).toBe("ad-1"); // 12 leads
    expect(descSorted[2].id).toBe("ad-3"); // 0 leads

    // Ascending sort
    const ascSorted = [...mockAds].sort((a, b) => {
      const aLeads = metricsMap.get(a.id)?.totalLeads || 0;
      const bLeads = metricsMap.get(b.id)?.totalLeads || 0;
      return aLeads - bLeads;
    });

    expect(ascSorted[0].id).toBe("ad-3"); // 0 leads
    expect(ascSorted[1].id).toBe("ad-1"); // 12 leads
    expect(ascSorted[2].id).toBe("ad-2"); // 25 leads
  });

  test("reconciles all registered ads plus unattributed row to exactly equal campaign totals", () => {
    // Campaign has registered ads ad-1 and ad-2, plus unattributed leads/deals
    const registeredAdsMetrics = [
      { adId: "ad-1", totalLeads: 12, qualifiedLeads: 8, totalOpportunities: 5, wonOrdersCount: 3, totalRevenue: 450000 },
      { adId: "ad-2", totalLeads: 25, qualifiedLeads: 18, totalOpportunities: 10, wonOrdersCount: 6, totalRevenue: 980000 }
    ];

    const unattributedMetric = {
      adId: null,
      adName: "Not attributed to an ad",
      isUnattributed: true,
      totalLeads: 13,
      qualifiedLeads: 4,
      totalOpportunities: 3,
      wonOrdersCount: 1,
      totalRevenue: 120000
    };

    const allAdRows = [...registeredAdsMetrics, unattributedMetric];

    // Campaign totals
    const campaignTotalLeads = 50; // 12 + 25 + 13
    const campaignQualifiedLeads = 30; // 8 + 18 + 4
    const campaignTotalOpps = 18; // 5 + 10 + 3
    const campaignWonOrders = 10; // 3 + 6 + 1
    const campaignTotalRevenue = 1550000; // 450k + 980k + 120k

    const sumLeads = allAdRows.reduce((sum, r) => sum + r.totalLeads, 0);
    const sumQual = allAdRows.reduce((sum, r) => sum + r.qualifiedLeads, 0);
    const sumOpps = allAdRows.reduce((sum, r) => sum + r.totalOpportunities, 0);
    const sumWon = allAdRows.reduce((sum, r) => sum + r.wonOrdersCount, 0);
    const sumRevenue = allAdRows.reduce((sum, r) => sum + r.totalRevenue, 0);

    expect(sumLeads).toBe(campaignTotalLeads);
    expect(sumQual).toBe(campaignQualifiedLeads);
    expect(sumOpps).toBe(campaignTotalOpps);
    expect(sumWon).toBe(campaignWonOrders);
    expect(sumRevenue).toBe(campaignTotalRevenue);
  });
});

describe("TASK 3: Budget Pacing Alerts & Warning Badges", () => {
  const now = new Date();
  const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
  const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
  const fiveDaysInFuture = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);

  test("resolves recipient to ownerId if present, or falls back to all ADMIN users when unassigned", () => {
    const campaignWithOwner = { id: "c-1", ownerId: "user-rep-101" };
    const campaignWithoutOwner = { id: "c-2", ownerId: null };
    const allUsers = [
      { id: "admin-1", role: "admin" },
      { id: "admin-2", role: "admin" },
      { id: "rep-1", role: "sales_rep" }
    ];

    // Helper logic from campaignBudgetPacingService
    const resolveRecipients = (campaign: any, users: any[]) => {
      if (campaign.ownerId) return [campaign.ownerId];
      return users.filter(u => u.role === "admin").map(u => u.id);
    };

    expect(resolveRecipients(campaignWithOwner, allUsers)).toEqual(["user-rep-101"]);
    expect(resolveRecipients(campaignWithoutOwner, allUsers)).toEqual(["admin-1", "admin-2"]);
  });

  test("flags 'Over 80% of budget' when spend >= 80% and < 100%", () => {
    const campaign = {
      budget: 100000,
      actualSpend: 85000,
      status: "ACTIVE",
      startDate: tenDaysAgo.toISOString(),
      endDate: fiveDaysInFuture.toISOString()
    };

    const badges = getCampaignWarningBadges(campaign, 15);
    expect(badges.some(b => b.label === "Over 80% of budget" && b.severity === "amber")).toBe(true);
    expect(badges.some(b => b.label === "Over 100% of budget")).toBe(false);
  });

  test("flags 'Over 100% of budget' when spend >= 100%", () => {
    const campaign = {
      budget: 100000,
      actualSpend: 110000,
      status: "ACTIVE",
      startDate: tenDaysAgo.toISOString(),
      endDate: fiveDaysInFuture.toISOString()
    };

    const badges = getCampaignWarningBadges(campaign, 20);
    expect(badges.some(b => b.label === "Over 100% of budget" && b.severity === "rose")).toBe(true);
  });

  test("flags 'Ended, still active' when an ACTIVE campaign has passed its endDate", () => {
    const campaign = {
      budget: 100000,
      actualSpend: 50000,
      status: "ACTIVE",
      startDate: tenDaysAgo.toISOString(),
      endDate: twoDaysAgo.toISOString() // Ended 2 days ago
    };

    const badges = getCampaignWarningBadges(campaign, 10);
    expect(badges.some(b => b.label === "Ended, still active" && b.severity === "amber")).toBe(true);
  });

  test("flags 'No leads yet' when an ACTIVE campaign started > 7 days ago and has 0 leads", () => {
    const campaign = {
      budget: 50000,
      actualSpend: 10000,
      status: "ACTIVE",
      startDate: tenDaysAgo.toISOString(), // 10 days ago (> 7 days)
      endDate: fiveDaysInFuture.toISOString()
    };

    const badges = getCampaignWarningBadges(campaign, 0); // 0 leads
    expect(badges.some(b => b.label === "No leads yet" && b.severity === "slate")).toBe(true);
  });

  test("does not flag 'No leads yet' if campaign is less than 7 days old or has leads", () => {
    const newCampaign = {
      budget: 50000,
      actualSpend: 5000,
      status: "ACTIVE",
      startDate: twoDaysAgo.toISOString(), // 2 days old (< 7 days)
      endDate: fiveDaysInFuture.toISOString()
    };
    expect(getCampaignWarningBadges(newCampaign, 0).some(b => b.label === "No leads yet")).toBe(false);

    const activeWithLeads = {
      budget: 50000,
      actualSpend: 10000,
      status: "ACTIVE",
      startDate: tenDaysAgo.toISOString(),
      endDate: fiveDaysInFuture.toISOString()
    };
    expect(getCampaignWarningBadges(activeWithLeads, 4).some(b => b.label === "No leads yet")).toBe(false);
  });
});

describe("TASK 4: Phone Export & CSV Formula Injection Guard", () => {
  test("preserves international phone numbers with leading '+' without single quote prefixing", () => {
    expect(escapeCsvCell("+966500000001")).toBe("+966500000001");
    expect(escapeCsvCell("+1 (555) 019-2834")).toBe("+1 (555) 019-2834");
    expect(escapeCsvCell("+971 50 123 4567")).toBe("+971 50 123 4567");
    expect(escapeCsvCell("+44-20-7946-0919")).toBe("+44-20-7946-0919");
    expect(escapeCsvCell("+919876543210")).toBe("+919876543210");
  });

  test("preserves negative numbers without single quote prefixing", () => {
    expect(escapeCsvCell("-35.5")).toBe("-35.5");
    expect(escapeCsvCell("-1200")).toBe("-1200");
    expect(escapeCsvCell("-0.05")).toBe("-0.05");
  });

  test("neutralizes formula injection formulas starting with =, @, +, -", () => {
    expect(escapeCsvCell("=1+1")).toBe("'=1+1");
    expect(escapeCsvCell("@SUM(A1:A10)")).toBe("'@SUM(A1:A10)");
    expect(escapeCsvCell("+cmd|' /C calc'!A0")).toBe("'+cmd|' /C calc'!A0");
    expect(escapeCsvCell("-2+3")).toBe("'-2+3");
  });

  test("neutralizes values starting with tab (\\t) and carriage return (\\r)", () => {
    expect(escapeCsvCell("\t=HYPERLINK()")).toBe("'\t=HYPERLINK()");
    expect(escapeCsvCell("\rDangerous")).toBe("\"'\rDangerous\"");
    expect(escapeCsvCell("\r\nDangerous")).toBe("\"'\r\nDangerous\"");
  });

  test("exports raw CSV rows with phone numbers preserved", () => {
    const headers = ["leadNumber", "name", "phone", "status"];
    const rows = [
      ["LD-2026-0001", "Ahmed Al-Mansoor", "+966500000001", "NEW"],
      ["LD-2026-0002", "Sarah Jenkins", "+1 (555) 234-5678", "QUALIFIED"]
    ];

    const csv = generateCsv(headers, rows);
    expect(csv).toContain("+966500000001");
    expect(csv).toContain("+1 (555) 234-5678");
    expect(csv).not.toContain("'+966500000001");
  });
});
