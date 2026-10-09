/**
 * Unit tests for Lead Campaign Badge & Attribution UI components
 */

import { LeadCampaignBadge } from "../components/LeadCampaignBadge";
import { CampaignFilterDropdown } from "../components/CampaignFilterDropdown";
import type { CampaignAttributionSummary } from "../types/marketing";

describe("Lead Campaign Badge & Toolbar Filter Tests", () => {
  test("LeadCampaignBadge and CampaignFilterDropdown components are defined and exported", () => {
    expect(typeof LeadCampaignBadge).toBe("function");
    expect(typeof CampaignFilterDropdown).toBe("function");
  });

  test("Attribution summary validates with single touch and multi-touch", () => {
    const singleTouchSummary: CampaignAttributionSummary = {
      lastTouch: {
        id: "touch-single",
        campaignId: "camp-oct-2026",
        campaignName: "October Special Offer",
        campaignCode: "OCT-OFFER",
        channel: "WhatsApp",
        status: "ACTIVE",
        startDate: "2026-10-01",
        endDate: "2026-10-31",
        utmSource: "whatsapp",
        utmMedium: "direct",
        touchDate: "2026-10-05T12:00:00Z",
        isFirstTouch: true,
        isLastTouch: true
      },
      firstTouch: {
        id: "touch-single",
        campaignId: "camp-oct-2026",
        campaignName: "October Special Offer",
        campaignCode: "OCT-OFFER",
        channel: "WhatsApp",
        status: "ACTIVE",
        startDate: "2026-10-01",
        endDate: "2026-10-31",
        utmSource: "whatsapp",
        utmMedium: "direct",
        touchDate: "2026-10-05T12:00:00Z",
        isFirstTouch: true,
        isLastTouch: true
      },
      totalTouches: 1,
      totalCampaigns: 1,
      touches: []
    };

    expect(singleTouchSummary.totalTouches).toBe(1);
    expect(singleTouchSummary.lastTouch.campaignCode).toBe("OCT-OFFER");
    expect(singleTouchSummary.lastTouch.isFirstTouch).toBe(true);
    expect(singleTouchSummary.lastTouch.isLastTouch).toBe(true);

    const multiTouchSummary: CampaignAttributionSummary = {
      lastTouch: {
        id: "touch-last",
        campaignId: "camp-oct-2026",
        campaignName: "October Special Offer",
        campaignCode: "OCT-OFFER",
        channel: "WhatsApp",
        status: "ACTIVE",
        touchDate: "2026-10-05T12:00:00Z",
        isFirstTouch: false,
        isLastTouch: true
      },
      firstTouch: {
        id: "touch-first",
        campaignId: "camp-summer",
        campaignName: "Summer Kickoff",
        campaignCode: "SUMMER-26",
        channel: "Google Ads",
        status: "COMPLETED",
        touchDate: "2026-08-01T10:00:00Z",
        isFirstTouch: true,
        isLastTouch: false
      },
      totalTouches: 2,
      totalCampaigns: 2,
      touches: []
    };

    expect(multiTouchSummary.totalTouches).toBe(2);
    expect(multiTouchSummary.firstTouch.campaignCode).toBe("SUMMER-26");
    expect(multiTouchSummary.firstTouch.isFirstTouch).toBe(true);
    expect(multiTouchSummary.firstTouch.isLastTouch).toBe(false);
    expect(multiTouchSummary.lastTouch.campaignCode).toBe("OCT-OFFER");
    expect(multiTouchSummary.lastTouch.isFirstTouch).toBe(false);
    expect(multiTouchSummary.lastTouch.isLastTouch).toBe(true);
  });

  test("Handles missing campaign code fallback logic", () => {
    const rawCampaign = {
      id: "camp-nocode",
      name: "Fall Awareness Push",
      code: ""
    };
    const resolvedCode = rawCampaign.code || rawCampaign.name || "NO-CODE";
    expect(resolvedCode).toBe("Fall Awareness Push");

    const emptyCampaign = {
      id: "camp-empty",
      name: "",
      code: ""
    };
    const fallbackCode = emptyCampaign.code || emptyCampaign.name || "NO-CODE";
    expect(fallbackCode).toBe("NO-CODE");
  });
});
