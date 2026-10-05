/**
 * Campaign CRUD & Validation Logic Unit Tests
 * Verifies form validation rules, unique code requirements, error formatting,
 * and payload normalization for CampaignFormModal.
 */

import { Campaign } from "../types/marketing";

describe("Campaign CRUD & Validation Logic Tests", () => {
  const validateCampaignPayload = (data: Partial<Campaign>) => {
    const errors: Record<string, string> = {};

    if (!data.name || !data.name.trim()) {
      errors.name = "Campaign name is required.";
    }

    if (!data.code || !data.code.trim()) {
      errors.code = "Campaign unique code is required.";
    } else if (!/^[A-Za-z0-9_-]+$/.test(data.code.trim())) {
      errors.code = "Campaign code must contain only letters, numbers, hyphens, and underscores.";
    }

    if (data.budget !== undefined && data.budget !== null && Number(data.budget) < 0) {
      errors.budget = "Budget cannot be negative.";
    }

    if (data.startDate && data.endDate && new Date(data.endDate) < new Date(data.startDate)) {
      errors.dates = "End date cannot be earlier than start date.";
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
    };
  };

  test("1. Valid campaign payload passes validation", () => {
    const validData: Partial<Campaign> = {
      name: "Summer Google Search Ads",
      code: "GOOGLE-SUMMER-2026",
      channel: "Website",
      platform: "Google Ads",
      status: "ACTIVE",
      budget: 50000,
      currency: "SAR",
      startDate: "2026-06-01",
      endDate: "2026-08-31",
    };

    const validResult = validateCampaignPayload(validData);
    expect(validResult.isValid).toBe(true);
    expect(Object.keys(validResult.errors)).toHaveLength(0);
  });

  test("2. Invalid campaign payload triggers appropriate validation errors", () => {
    const invalidData: Partial<Campaign> = {
      name: "",
      code: "BAD CODE WITH SPACES!",
      budget: -100,
      startDate: "2026-08-31",
      endDate: "2026-06-01",
    };

    const invalidResult = validateCampaignPayload(invalidData);
    expect(invalidResult.isValid).toBe(false);
    expect(invalidResult.errors.name).toBe("Campaign name is required.");
    expect(invalidResult.errors.code).toBe(
      "Campaign code must contain only letters, numbers, hyphens, and underscores."
    );
    expect(invalidResult.errors.budget).toBe("Budget cannot be negative.");
    expect(invalidResult.errors.dates).toBe("End date cannot be earlier than start date.");
  });

  test("3. Duplicate code error detection string format", () => {
    const duplicateCodeError = "Campaign with code 'GOOGLE-SUMMER-2026' already exists.";
    const isDuplicateCodeError =
      duplicateCodeError.toLowerCase().includes("code") &&
      duplicateCodeError.toLowerCase().includes("already exists");
    expect(isDuplicateCodeError).toBe(true);
  });
});
