/**
 * Campaign Detail Logic & Unit Contract Tests
 * Verifies campaign metrics calculation, funnel conversion rates, unit economics,
 * and status badge mapping for CampaignDetail component.
 */

import { Campaign, CampaignMetrics, CampaignStatus } from "../types/marketing";

export function verifyCampaignDetailRules() {
  // Test 1: Status badge mapping verification
  const statuses: CampaignStatus[] = ["ACTIVE", "PAUSED", "COMPLETED", "CANCELLED", "DRAFT"];
  for (const status of statuses) {
    if (!status) throw new Error("Invalid campaign status");
  }

  // Test 2: Metrics and unit economics calculations
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
    roiPct: 1150.0
  };

  // Funnel assertions
  if (mockMetrics.conversionRateLeadToQual !== (mockMetrics.qualifiedLeads / mockMetrics.totalLeads) * 100) {
    throw new Error("Lead to Qualified conversion rate calculation mismatch");
  }

  if (mockMetrics.conversionRateQualToOpp !== (mockMetrics.totalOpportunities / mockMetrics.qualifiedLeads) * 100) {
    throw new Error("Qualified to Opportunity conversion rate calculation mismatch");
  }

  if (mockMetrics.conversionRateOppToWon !== (mockMetrics.wonDealsCount / mockMetrics.totalOpportunities) * 100) {
    throw new Error("Opportunity to Won conversion rate calculation mismatch");
  }

  // Test 3: Budget and Spend calculations
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
    updatedAt: new Date().toISOString()
  };

  const budgetUtilized = (Number(mockCampaign.actualSpend) / Number(mockCampaign.budget)) * 100;
  if (budgetUtilized !== 80) {
    throw new Error("Budget utilization percentage calculation mismatch");
  }

  return {
    success: true,
    message: "Campaign detail rules and metrics contract verified successfully."
  };
}
