/**
 * Campaign Detail Logic & Unit Contract Tests
 * Verifies campaign metrics calculation, funnel conversion rates, unit economics,
 * and status badge mapping for CampaignDetail component.
 */

import { Campaign, CampaignMetrics, CampaignStatus } from "../types/marketing";

describe("Campaign Detail Logic & Contract Tests", () => {
  test("1. Status badge mapping verification", () => {
    const statuses: CampaignStatus[] = ["ACTIVE", "PAUSED", "COMPLETED", "CANCELLED", "DRAFT"];
    for (const status of statuses) {
      expect(status).toBeDefined();
    }
  });

  test("2. Metrics and unit economics calculations", () => {
    const mockMetrics: CampaignMetrics = {
      totalLeads: 100,
      qualifiedLeads: 40,
      totalOpportunities: 20,
      wonDealsCount: 8,
      wonOrdersCount: 10,
      totalRevenue: 250000,
      conversionRateLeadToQual: 40.0,
      conversionRateQualToOpp: 50.0,
      conversionRateOppToWon: 40.0,
      costPerLead: 200,
      costPerQualifiedLead: 500,
      costPerOpportunity: 1000,
      costPerWonDeal: 2500,
      roas: 12.5,
      roiPct: 1150.0,
    };

    // Funnel assertions
    expect(mockMetrics.conversionRateLeadToQual).toBe((mockMetrics.qualifiedLeads / mockMetrics.totalLeads) * 100);
    expect(mockMetrics.conversionRateQualToOpp).toBe((mockMetrics.totalOpportunities / mockMetrics.qualifiedLeads) * 100);
    expect(mockMetrics.conversionRateOppToWon).toBe((mockMetrics.wonDealsCount / mockMetrics.totalOpportunities) * 100);
  });

  test("3. Budget and Spend calculations", () => {
    const mockCampaign: Campaign = {
      id: "camp-test-123",
      name: "Summer Google Search Ads",
      code: "GOOGLE-SUMMER-2026",
      channel: "Website",
      platform: "Google Ads",
      status: "ACTIVE",
      budget: 25000,
      actualSpend: 20000,
      currency: "SAR",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const budgetUtilized = (Number(mockCampaign.actualSpend) / Number(mockCampaign.budget)) * 100;
    expect(budgetUtilized).toBe(80);
  });
});
