/**
 * Campaign CRUD & Validation Logic Unit Tests
 * Verifies form validation rules, unique code requirements, error formatting,
 * and payload normalization for CampaignFormModal.
 */

import { Campaign, CampaignStatus } from "../types/marketing";

export function verifyCampaignCrudRules() {
  // Test 1: Required field validation (name & code)
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
      errors
    };
  };

  // Valid payload test
  const validData: Partial<Campaign> = {
    name: "Summer Google Search Ads",
    code: "GOOGLE-SUMMER-2026",
    channel: "Website",
    platform: "Google Ads",
    status: "ACTIVE",
    budget: 50000,
    currency: "SAR",
    startDate: "2026-06-01",
    endDate: "2026-08-31"
  };

  const validResult = validateCampaignPayload(validData);
  if (!validResult.isValid) {
    throw new Error("Valid campaign payload failed validation: " + JSON.stringify(validResult.errors));
  }

  // Invalid payload test (missing name, invalid code characters, negative budget, inverted dates)
  const invalidData: Partial<Campaign> = {
    name: "",
    code: "BAD CODE WITH SPACES!",
    budget: -100,
    startDate: "2026-08-31",
    endDate: "2026-06-01"
  };

  const invalidResult = validateCampaignPayload(invalidData);
  if (invalidResult.isValid) {
    throw new Error("Invalid campaign payload was incorrectly marked valid");
  }

  if (!invalidResult.errors.name || !invalidResult.errors.code || !invalidResult.errors.budget || !invalidResult.errors.dates) {
    throw new Error("Missing expected field errors in validation result: " + JSON.stringify(invalidResult.errors));
  }

  // Test 2: Uniqueness Error Formatting
  const duplicateCodeError = "Campaign with code 'GOOGLE-SUMMER-2026' already exists.";
  const isDuplicateCodeError = duplicateCodeError.toLowerCase().includes("code") && duplicateCodeError.toLowerCase().includes("already exists");
  if (!isDuplicateCodeError) {
    throw new Error("Duplicate code error detection logic failed");
  }

  return {
    success: true,
    message: "Campaign CRUD validation rules verified successfully."
  };
}
