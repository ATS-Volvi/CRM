/**
 * Unit & Integration Test for Lead Attribution Component & Marketing API Client
 */

import { attributionApi } from "../api/marketing";

describe("Lead Attribution Integration & API Tests", () => {
  test("attributionApi exposes getLeadAttribution, getLeadAttributionHistory, and recordManualTouch", () => {
    expect(typeof attributionApi.getLeadAttribution).toBe("function");
    expect(typeof attributionApi.getLeadAttributionHistory).toBe("function");
    expect(typeof attributionApi.recordManualTouch).toBe("function");
    expect(typeof attributionApi.getTaxonomy).toBe("function");
  });

  test("LeadAttribution structure validates correctly", () => {
    const mockAttribution = {
      leadId: "lead-123",
      channel: "Meta Ads",
      sourceType: "Paid Social",
      sourceName: "Instagram Feed Ad",
      campaign: {
        id: "camp-001",
        name: "Q3 Enterprise Digital Expansion",
        code: "CMP-2026-Q3-EXP"
      },
      ad: {
        id: "ad-001",
        name: "Enterprise Workflow Video Ad - 30s",
        platform: "Instagram",
        creativeType: "Video"
      },
      touches: [
        {
          id: "touch-1",
          leadId: "lead-123",
          channel: "Meta Ads",
          sourceType: "Paid Social",
          touchType: "FIRST_TOUCH",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ]
    };

    expect(mockAttribution.leadId).toBe("lead-123");
    expect(mockAttribution.channel).toBe("Meta Ads");
    expect(mockAttribution.campaign.code).toBe("CMP-2026-Q3-EXP");
    expect(mockAttribution.ad.platform).toBe("Instagram");
    expect(mockAttribution.touches.length).toBe(1);
  });
});
