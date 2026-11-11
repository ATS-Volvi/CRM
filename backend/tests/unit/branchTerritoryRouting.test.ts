import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { extractLeadDetailsFromText } from "../../src/services/aiLeadExtraction";
import { calculateRepSuitabilityScore } from "../../src/services/repPerformanceService";

describe("Branch & Territory-Based Inbound Routing Tests", () => {
  describe("1. AI & Heuristic Territory / Branch Extraction", () => {
    it("extracts Jubail territory from an inbound project message", async () => {
      const text = "Hello, we need 10 portacabins for our site in Jubail industrial zone.";
      const res = await extractLeadDetailsFromText(text);
      assert.equal(res.territory, "Jubail");
    });

    it("extracts Dammam territory from an inbound enquiry", async () => {
      const text = "Looking for mobile office containers at Dammam port. Call me at 0551234567.";
      const res = await extractLeadDetailsFromText(text);
      assert.equal(res.territory, "Dammam");
    });

    it("extracts Riyadh territory from subject/message", async () => {
      const text = "Urgent quotation needed for Riyadh branch project.";
      const res = await extractLeadDetailsFromText(text);
      assert.equal(res.territory, "Riyadh");
    });

    it("extracts Khobar territory from 'Al Khobar' or 'Khobar'", async () => {
      const text = "Require sanitation cabins for project in Al Khobar.";
      const res = await extractLeadDetailsFromText(text);
      assert.equal(res.territory, "Khobar");
    });

    it("returns undefined territory when no branch or city is mentioned", async () => {
      const text = "Hello please send me your product catalog and price list.";
      const res = await extractLeadDetailsFromText(text);
      assert.equal(res.territory, undefined);
    });
  });

  describe("2. Territory Suitability Scoring (Jubail Rep vs Other Branches)", () => {
    function makeMockProfile(userId: string, name: string, territory: string) {
      return {
        userId,
        name,
        email: `${userId}@company.com`,
        role: "sales_rep",
        experienceYears: 4,
        experienceTier: "Mid-level AE",
        skills: ["Manufacturing", "General"],
        territory,
        maxOpenLeads: 30,
        openLeadCount: 5,
        openOpportunityCount: 2,
        openPipelineValue: 100000,
        weightedWorkload: 10,
        totalLeadsAssigned: 50,
        convertedLeads: 15,
        rawConversionRate: 0.30,
        bayesianConversionRate: 0.28,
        totalDeals: 10,
        wonDeals: 3,
        opportunityWinRate: 0.30,
        totalRevenueWon: 500000,
        totalAssignedPipeline: 1000000,
        revenueConversionRate: 0.50,
        averageDealSize: 150000,
        averageFirstResponseMinutes: 12,
        slaComplianceRate: 0.95,
        managerPerformanceRating: 4.5,
        recentHighValueLeadCount: 1,
        recentLeadValueAssigned: 200000,
        performanceScore: 85
      };
    }

    const jubailRep = makeMockProfile("rep-jubail-1", "Omar Jubail", "Jubail");
    const riyadhRep = makeMockProfile("rep-riyadh-1", "Tariq Riyadh", "Riyadh");

    const leadContext = {
      firstName: "Ahmed",
      lastName: "Al-Ghamdi",
      email: "ahmed@aramco.com",
      industry: "Manufacturing",
      territory: "Jubail"
    };

    const priorityDetails = {
      priorityScore: 75,
      priorityTier: "HIGH" as const,
      expectedRevenue: 100000,
      isHighValueLead: false,
      reasonSummary: "Standard commercial inquiry"
    };

    const policyWeights = {
      conversionRate: 0.20,
      industrySkill: 0.20,
      territoryMatch: 0.15,
      revenuePerformance: 0.10,
      experienceTier: 0.10,
      responseTime: 0.05,
      slaCompliance: 0.05,
      workloadCapacity: 0.10,
      fairnessDistribution: 0.025,
      managerRating: 0.025
    };

    it("gives 100 territory score to the Jubail branch rep for Jubail lead", () => {
      const jubailEval = calculateRepSuitabilityScore(jubailRep, leadContext, policyWeights, priorityDetails);
      assert.equal(jubailEval.breakdown.territoryScore, 100);
    });

    it("penalizes Riyadh branch rep on territory score for Jubail lead", () => {
      const riyadhEval = calculateRepSuitabilityScore(riyadhRep, leadContext, policyWeights, priorityDetails);
      assert.equal(riyadhEval.breakdown.territoryScore, 40);
    });

    it("ensures Jubail branch rep has a significantly higher overall suitability score for Jubail lead", () => {
      const jubailEval = calculateRepSuitabilityScore(jubailRep, leadContext, policyWeights, priorityDetails);
      const riyadhEval = calculateRepSuitabilityScore(riyadhRep, leadContext, policyWeights, priorityDetails);

      assert.ok(
        jubailEval.finalScore > riyadhEval.finalScore,
        `Expected Jubail rep score (${jubailEval.finalScore}) to exceed Riyadh rep score (${riyadhEval.finalScore})`
      );
      assert.equal(jubailEval.finalScore - riyadhEval.finalScore, 9); // (100 - 40) * 0.15 = 9 points difference
    });
  });
});
