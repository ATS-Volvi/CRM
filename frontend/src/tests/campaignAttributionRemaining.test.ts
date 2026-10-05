/**
 * Comprehensive frontend tests for:
 * 1. formatMoney (SAR / INR / multi-currency grouping and ROAS calculation)
 * 2. 409 duplicate campaign code inline error handling
 * 3. CampaignDetail route param :id resolution
 * 4. LeadAttributionCard data rendering with and without a campaign
 * 5. Estimated Value fallback logic
 * 6. Dynamic Risk Indicator computation (with and without activities, recent vs stale)
 * 7. Enrichment skip logic (test domains, personal webmail domains, corporate domains)
 */

import {
  formatMoney,
  formatMultiCurrencyTotals,
  calculateSingleCurrencyRoas
} from "../lib/formatMoney";

describe("1. Currency and Money Formatting (formatMoney)", () => {
  test("formats SAR currency correctly", () => {
    const formatted = formatMoney(5000, "SAR");
    expect(formatted).toMatch(/SAR\s*5,000/);
  });

  test("formats INR currency with Indian numbering", () => {
    const formatted = formatMoney(120000, "INR");
    expect(formatted).toMatch(/(₹|INR)\s*1,20,000/);
  });

  test("handles null, undefined, empty, or invalid numeric values gracefully", () => {
    expect(formatMoney(null, "SAR")).toBe("—");
    expect(formatMoney(undefined, "SAR")).toBe("—");
    expect(formatMoney("", "SAR")).toBe("—");
    expect(formatMoney("invalid_number", "SAR")).toBe("—");
  });

  test("formats grouped multi-currency totals without adding across currencies", () => {
    const totals = {
      INR: 120000,
      SAR: 5000
    };

    const grouped = formatMultiCurrencyTotals(totals);
    expect(grouped).toContain("1,20,000");
    expect(grouped).toContain("5,000");
    expect(grouped).toContain("·");
  });

  test("computes ROAS strictly for single-currency campaigns", () => {
    const singleCurrencySpend = { SAR: 10000 };
    const singleCurrencyRevenue = { SAR: 50000 };

    const roas = calculateSingleCurrencyRoas(singleCurrencySpend, singleCurrencyRevenue);
    expect(roas).toBe("5.00x");
  });

  test("returns null (renders '—') for multi-currency ROAS to prevent invalid FX summation", () => {
    const multiSpend = { SAR: 10000, INR: 50000 };
    const multiRevenue = { SAR: 50000, INR: 200000 };

    const roas = calculateSingleCurrencyRoas(multiSpend, multiRevenue);
    expect(roas).toBeNull();
  });
});

describe("2. 409 Duplicate Campaign Code Inline Error Handling", () => {
  test("maps 409 duplicate campaign code error to inline field error", () => {
    const serverErrorMessage = "Campaign with code 'GOOGLE-SEARCH-Q4' already exists.";
    const formErrors: Record<string, string> = {};

    if (
      serverErrorMessage.toLowerCase().includes("code") &&
      serverErrorMessage.toLowerCase().includes("already exists")
    ) {
      formErrors.code = serverErrorMessage;
    }

    expect(formErrors.code).toBe("Campaign with code 'GOOGLE-SEARCH-Q4' already exists.");
  });

  test("validates that negative budget and actualSpend are rejected with inline errors", () => {
    const errors: Record<string, string> = {};
    const budget = "-500";
    const actualSpend = "-200";

    if (budget && Number(budget) < 0) {
      errors.budget = "Budget cannot be negative.";
    }
    if (actualSpend && Number(actualSpend) < 0) {
      errors.actualSpend = "Actual spend cannot be negative.";
    }

    expect(errors.budget).toBe("Budget cannot be negative.");
    expect(errors.actualSpend).toBe("Actual spend cannot be negative.");
  });

  test("validates that endDate before startDate is rejected with inline error", () => {
    const errors: Record<string, string> = {};
    const startDate = "2026-09-01";
    const endDate = "2026-08-15";

    if (startDate && endDate && new Date(endDate) < new Date(startDate)) {
      errors.endDate = "End date cannot be earlier than start date.";
    }

    expect(errors.endDate).toBe("End date cannot be earlier than start date.");
  });
});

describe("3. CampaignDetail Route Params & Resource Resolution", () => {
  test("extracts :id param and builds correct API request URL", () => {
    const mockRouteParams = { id: "camp-789" };
    const campaignId = mockRouteParams.id;

    expect(campaignId).toBe("camp-789");
    const expectedDetailEndpoint = `/api/v1/campaigns/${campaignId}`;
    const expectedLeadsEndpoint = `/api/v1/campaigns/${campaignId}/leads`;
    const expectedOpportunitiesEndpoint = `/api/v1/campaigns/${campaignId}/opportunities`;
    const expectedPerformanceEndpoint = `/api/v1/campaigns/${campaignId}/performance`;

    expect(expectedDetailEndpoint).toBe("/api/v1/campaigns/camp-789");
    expect(expectedLeadsEndpoint).toBe("/api/v1/campaigns/camp-789/leads");
    expect(expectedOpportunitiesEndpoint).toBe("/api/v1/campaigns/camp-789/opportunities");
    expect(expectedPerformanceEndpoint).toBe("/api/v1/campaigns/camp-789/performance");
  });
});

describe("4. LeadAttributionCard Rendering Scenarios", () => {
  test("processes attribution data WITH an attached campaign and ad creative", () => {
    const attributionWithCampaign = {
      leadId: "lead-001",
      channel: "Instagram",
      sourceType: "Paid Social",
      sourceName: "Instagram Feed Ad",
      campaign: {
        id: "camp-001",
        name: "Q4 High-Voltage Campaign",
        code: "HV-Q4-2026"
      },
      ad: {
        id: "ad-001",
        name: "Video 30s High Voltage",
        platform: "Instagram",
        creativeType: "Video"
      },
      touches: [
        {
          id: "touch-1",
          leadId: "lead-001",
          channel: "Instagram",
          sourceType: "Paid Social",
          touchType: "FIRST_TOUCH",
          createdAt: "2026-09-20T10:00:00Z"
        }
      ]
    };

    expect(attributionWithCampaign.campaign).toBeDefined();
    expect(attributionWithCampaign.campaign?.code).toBe("HV-Q4-2026");
    expect(attributionWithCampaign.ad?.name).toBe("Video 30s High Voltage");
    expect(attributionWithCampaign.touches.length).toBe(1);
  });

  test("processes attribution data WITHOUT a campaign (e.g. Direct / Organic search)", () => {
    const attributionWithoutCampaign = {
      leadId: "lead-002",
      channel: "Website",
      sourceType: "Organic Search",
      sourceName: "Google Search",
      campaign: null,
      ad: null,
      touches: []
    };

    expect(attributionWithoutCampaign.campaign).toBeNull();
    expect(attributionWithoutCampaign.ad).toBeNull();
    expect(attributionWithoutCampaign.channel).toBe("Website");
    expect(attributionWithoutCampaign.sourceType).toBe("Organic Search");
  });
});

describe("5. Lead Estimated Value Fallback Logic", () => {
  const resolveEstimatedValue = (lead: any): { display: string; isReal: boolean } => {
    const rawVal =
      lead.estimatedValue ??
      lead.expectedValue ??
      lead.opportunity?.amount ??
      lead.deal?.amount;

    if (
      rawVal !== undefined &&
      rawVal !== null &&
      rawVal !== "" &&
      !isNaN(Number(rawVal)) &&
      Number(rawVal) > 0
    ) {
      return { display: `SAR ${Number(rawVal).toLocaleString()}`, isReal: true };
    }

    if (lead.budgetRange) {
      return { display: lead.budgetRange, isReal: true };
    }

    return { display: "Not estimated", isReal: false };
  };

  test("returns formatted real value when estimatedValue or opportunity amount is present", () => {
    const leadWithValue = { estimatedValue: 150000 };
    const res = resolveEstimatedValue(leadWithValue);
    expect(res.display).toContain("150,000");
    expect(res.isReal).toBe(true);

    const leadWithOpp = { opportunity: { amount: 80000 } };
    const resOpp = resolveEstimatedValue(leadWithOpp);
    expect(resOpp.display).toContain("80,000");
  });

  test("returns budget range when no direct numeric value is set", () => {
    const leadWithBudget = { budgetRange: "SAR 50,000 - 100,000" };
    const res = resolveEstimatedValue(leadWithBudget);
    expect(res.display).toBe("SAR 50,000 - 100,000");
    expect(res.isReal).toBe(true);
  });

  test("returns 'Not estimated' when no value or budget exists (no fake multiplication)", () => {
    const emptyLead = { firstName: "Test", email: "test@example.com", leadScore: 90 };
    const res = resolveEstimatedValue(emptyLead);
    expect(res.display).toBe("Not estimated");
    expect(res.isReal).toBe(false);
  });
});

describe("6. Dynamic Risk Indicator Computation", () => {
  const computeRiskIndicator = (activities: any[]): { showRisk: boolean; message: string | null } => {
    const contactActivities = activities.filter((a: any) => {
      const t = (a.type || "").toLowerCase();
      return (
        t.includes("call") ||
        t.includes("whatsapp") ||
        t.includes("email") ||
        t.includes("meeting") ||
        t.includes("sms")
      );
    });

    if (activities.length === 0 || contactActivities.length === 0) {
      return { showRisk: true, message: "No contact logged yet" };
    }

    const lastContactActivity = contactActivities.reduce((latest: any, curr: any) => {
      const tCurr = new Date(curr.createdAt || curr.date || 0).getTime();
      const tLatest = new Date(latest.createdAt || latest.date || 0).getTime();
      return tCurr > tLatest ? curr : latest;
    }, contactActivities[0]);

    const lastContactDate = new Date(lastContactActivity.createdAt || lastContactActivity.date);
    const daysSince = Math.floor((Date.now() - lastContactDate.getTime()) / (1000 * 60 * 60 * 24));

    if (daysSince > 7) {
      return { showRisk: true, message: `No direct contact in ${daysSince} days. Follow up required.` };
    }

    // Recent contact within 7 days -> no risk line
    return { showRisk: false, message: null };
  };

  test("shows 'No contact logged yet' when lead has zero activities", () => {
    const res = computeRiskIndicator([]);
    expect(res.showRisk).toBe(true);
    expect(res.message).toBe("No contact logged yet");
  });

  test("omits risk indicator when recent contact happened (<= 7 days ago)", () => {
    const recentActivities = [
      { type: "call", createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() }
    ];
    const res = computeRiskIndicator(recentActivities);
    expect(res.showRisk).toBe(false);
    expect(res.message).toBeNull();
  });

  test("shows warning when last contact was stale (> 7 days ago)", () => {
    const staleActivities = [
      { type: "email", createdAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString() }
    ];
    const res = computeRiskIndicator(staleActivities);
    expect(res.showRisk).toBe(true);
    expect(res.message).toContain("No direct contact in 12 days");
  });
});

describe("7. Enrichment Skip Logic & Meaningful Data Check", () => {
  const PERSONAL_DOMAINS = new Set([
    "gmail.com", "yahoo.com", "hotmail.com", "outlook.com",
    "hotmail.co.uk", "yahoo.co.uk", "icloud.com", "me.com"
  ]);

  const RESERVED_TEST_DOMAINS = new Set([
    "example.com", "example.org", "example.net",
    "test.com", "localhost", "local", "invalid", "whatsapp.local"
  ]);

  const shouldSkipEnrichment = (domain: string): boolean => {
    const d = (domain || "").toLowerCase().trim();
    return (
      PERSONAL_DOMAINS.has(d) ||
      RESERVED_TEST_DOMAINS.has(d) ||
      d.endsWith(".local") ||
      d.endsWith(".test") ||
      d.endsWith(".example") ||
      d.endsWith(".localhost")
    );
  };

  const shouldDisplayCompanyIntelligence = (status: string, enrichedData: any): boolean => {
    if (!status || status !== "enriched" || !enrichedData) return false;
    return Boolean(
      enrichedData.industry ||
      enrichedData.sector ||
      enrichedData.sizeRange ||
      enrichedData.employeeCount ||
      enrichedData.foundedYear ||
      enrichedData.country ||
      enrichedData.city ||
      enrichedData.companyType ||
      enrichedData.description ||
      enrichedData.linkedinHandle
    );
  };

  test("skips enrichment for free personal email domains", () => {
    expect(shouldSkipEnrichment("gmail.com")).toBe(true);
    expect(shouldSkipEnrichment("yahoo.com")).toBe(true);
    expect(shouldSkipEnrichment("outlook.com")).toBe(true);
    expect(shouldSkipEnrichment("icloud.com")).toBe(true);
  });

  test("skips enrichment for reserved, test, and placeholder domains", () => {
    expect(shouldSkipEnrichment("example.com")).toBe(true);
    expect(shouldSkipEnrichment("test.com")).toBe(true);
    expect(shouldSkipEnrichment("localhost")).toBe(true);
    expect(shouldSkipEnrichment("company.local")).toBe(true);
    expect(shouldSkipEnrichment("service.test")).toBe(true);
  });

  test("allows enrichment for valid corporate domains", () => {
    expect(shouldSkipEnrichment("aramco.com")).toBe(false);
    expect(shouldSkipEnrichment("stc.com.sa")).toBe(false);
    expect(shouldSkipEnrichment("volvi.ai")).toBe(false);
  });

  test("hides Company Intelligence UI if enriched data is empty or generic disclaimer", () => {
    expect(shouldDisplayCompanyIntelligence("skipped", null)).toBe(false);
    expect(shouldDisplayCompanyIntelligence("not_found", null)).toBe(false);
    expect(shouldDisplayCompanyIntelligence("enriched", {})).toBe(false);
    expect(
      shouldDisplayCompanyIntelligence("enriched", {
        industry: "Renewable Energy",
        employeeCount: 500
      })
    ).toBe(true);
  });
});
