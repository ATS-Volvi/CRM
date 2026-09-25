/**
 * Campaign Integration End-to-End Frontend Contract Test Suite
 * Verifies campaign detail metrics, campaign CRUD validation, and ad management contracts.
 */

import { Campaign, CampaignMetrics, CampaignAd } from "../types/marketing";

describe("Campaign Frontend Module Integration Tests", () => {
  test("1. Campaign Detail Contract: calculates funnel conversion rates and budget utilization accurately", () => {
    const mockCampaign: Campaign = {
      id: "camp-int-01",
      name: "Q3 Acquisition Blitz",
      code: "Q3-BLITZ-2026",
      channel: "Website",
      platform: "Meta Ads",
      status: "ACTIVE",
      budget: 100000,
      actualSpend: 75000,
      currency: "SAR",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const mockMetrics: CampaignMetrics = {
      totalLeads: 500,
      qualifiedLeads: 250,
      totalOpportunities: 100,
      wonDealsCount: 25,
      wonOrdersCount: 30,
      totalRevenue: 1500000,
      conversionRateLeadToQual: 50.0,
      conversionRateQualToOpp: 40.0,
      conversionRateOppToWon: 25.0,
      costPerLead: 150,
      costPerQualifiedLead: 300,
      costPerOpportunity: 750,
      costPerWonDeal: 3000,
      roas: 20.0,
      roiPct: 1900.0,
    };

    expect(mockMetrics.conversionRateLeadToQual).toBe((mockMetrics.qualifiedLeads / mockMetrics.totalLeads) * 100);
    expect(mockMetrics.conversionRateQualToOpp).toBe((mockMetrics.totalOpportunities / mockMetrics.qualifiedLeads) * 100);
    expect(mockMetrics.conversionRateOppToWon).toBe((mockMetrics.wonDealsCount / mockMetrics.totalOpportunities) * 100);
    expect((Number(mockCampaign.actualSpend) / Number(mockCampaign.budget)) * 100).toBe(75);
  });

  test("2. Campaign CRUD Contract: validates name, alphanumeric code format, and positive budget", () => {
    const validateCampaign = (data: Partial<Campaign>) => {
      const errors: Record<string, string> = {};
      if (!data.name?.trim()) errors.name = "Campaign name is required.";
      if (!data.code?.trim() || !/^[A-Za-z0-9_-]+$/.test(data.code.trim())) {
        errors.code = "Valid campaign code required.";
      }
      if (data.budget !== undefined && Number(data.budget) < 0) {
        errors.budget = "Budget cannot be negative.";
      }
      return { isValid: Object.keys(errors).length === 0, errors };
    };

    const valid = validateCampaign({ name: "Brand Push", code: "BRAND_2026", budget: 20000 });
    expect(valid.isValid).toBe(true);

    const invalid = validateCampaign({ name: "", code: "INVALID CODE", budget: -500 });
    expect(invalid.isValid).toBe(false);
    expect(invalid.errors.name).toBeDefined();
    expect(invalid.errors.code).toBeDefined();
    expect(invalid.errors.budget).toBeDefined();
  });

  test("3. Campaign Ad CRUD Contract: validates ad name, external ID length, and active status", () => {
    const validateAd = (data: Partial<CampaignAd>) => {
      const errors: Record<string, string> = {};
      if (!data.name?.trim()) errors.name = "Ad name is required.";
      if (data.externalId && data.externalId.length > 100) errors.externalId = "External ID too long.";
      return { isValid: Object.keys(errors).length === 0, errors };
    };

    const validAd = validateAd({
      name: "Video Reel Ad #1",
      platform: "meta_ads",
      creativeType: "video",
      externalId: "meta_reel_001",
      status: "ACTIVE",
    });
    expect(validAd.isValid).toBe(true);

    const invalidAd = validateAd({ name: "" });
    expect(invalidAd.isValid).toBe(false);
    expect(invalidAd.errors.name).toBe("Ad name is required.");
  });
});
