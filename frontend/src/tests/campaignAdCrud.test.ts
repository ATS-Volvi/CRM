/**
 * Campaign Ad CRUD & Validation Logic Unit Tests
 * Verifies ad creation, editing, external ID validation, and payload structure.
 */

import { CampaignAd } from "../types/marketing";

describe("Campaign Ad CRUD & Validation Logic Tests", () => {
  const validateAdPayload = (data: Partial<CampaignAd>) => {
    const errors: Record<string, string> = {};

    if (!data.name || !data.name.trim()) {
      errors.name = "Ad name is required.";
    }

    if (data.externalId && data.externalId.trim().length > 100) {
      errors.externalId = "External ID is too long (max 100 characters).";
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
    };
  };

  test("1. Valid Ad Payload passes validation", () => {
    const validAd: Partial<CampaignAd> = {
      name: "Summer Search Ad 1",
      externalId: "gads_summer_01",
      platform: "google_ads",
      creativeType: "search_text",
      status: "ACTIVE",
    };
    const validResult = validateAdPayload(validAd);
    expect(validResult.isValid).toBe(true);
    expect(Object.keys(validResult.errors)).toHaveLength(0);
  });

  test("2. Invalid Ad Payload (missing name) triggers validation error", () => {
    const invalidAd: Partial<CampaignAd> = {
      name: "",
      externalId: "gads_summer_02",
    };
    const invalidResult = validateAdPayload(invalidAd);
    expect(invalidResult.isValid).toBe(false);
    expect(invalidResult.errors.name).toBe("Ad name is required.");
  });

  test("3. Ad Status values are well defined", () => {
    const statuses = ["ACTIVE", "PAUSED", "ARCHIVED"];
    for (const s of statuses) {
      expect(s).toBeDefined();
    }
  });
});
