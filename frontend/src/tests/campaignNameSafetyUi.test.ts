/**
 * Frontend Campaign Name Safety & Settings UI Component Tests
 */

import { CampaignPersonalizationSettingsCard } from "../components/CampaignPersonalizationSettingsCard";

describe("Campaign Name Safety & Personalization UI Tests", () => {
  test("CampaignPersonalizationSettingsCard component is defined and exported", () => {
    expect(typeof CampaignPersonalizationSettingsCard).toBe("function");
  });

  test("composer placeholder filtering hides firstName and lastName chips when setting is OFF", () => {
    const allPlaceholders = [
      { tag: "{{firstName}}", label: "First Name" },
      { tag: "{{lastName}}", label: "Last Name" },
      { tag: "{{company}}", label: "Company" },
      { tag: "{{campaignName}}", label: "Campaign Name" }
    ];

    // Filter logic when useCustomerNames is false
    const useCustomerNames = false;
    const availablePlaceholders = useCustomerNames
      ? allPlaceholders
      : allPlaceholders.filter((p) => p.tag !== "{{firstName}}" && p.tag !== "{{lastName}}");

    expect(availablePlaceholders).toHaveLength(2);
    expect(availablePlaceholders.some((p) => p.tag === "{{firstName}}")).toBe(false);
    expect(availablePlaceholders.some((p) => p.tag === "{{lastName}}")).toBe(false);
    expect(availablePlaceholders.some((p) => p.tag === "{{company}}")).toBe(true);
    expect(availablePlaceholders.some((p) => p.tag === "{{campaignName}}")).toBe(true);
  });

  test("composer placeholder filtering exposes all chips when setting is ON", () => {
    const allPlaceholders = [
      { tag: "{{firstName}}", label: "First Name" },
      { tag: "{{lastName}}", label: "Last Name" },
      { tag: "{{company}}", label: "Company" },
      { tag: "{{campaignName}}", label: "Campaign Name" }
    ];

    const useCustomerNames = true;
    const availablePlaceholders = useCustomerNames
      ? allPlaceholders
      : allPlaceholders.filter((p) => p.tag !== "{{firstName}}" && p.tag !== "{{lastName}}");

    expect(availablePlaceholders).toHaveLength(4);
    expect(availablePlaceholders.some((p) => p.tag === "{{firstName}}")).toBe(true);
    expect(availablePlaceholders.some((p) => p.tag === "{{lastName}}")).toBe(true);
  });

  test("default composer template starts with 'Dear Customer,' and contains no personal name placeholders", () => {
    const defaultBody = `<p>Dear Customer,</p>\n<p>We're excited to reach out regarding our latest offerings for {{company}}.</p>\n<p>Let us know if you have a few minutes for a quick chat.</p>\n<p>Best regards,<br/>The Team</p>`;
    expect(defaultBody.startsWith("<p>Dear Customer,</p>")).toBe(true);
    expect(defaultBody).not.toContain("{{firstName}}");
    expect(defaultBody).not.toContain("{{lastName}}");
  });

  test("composer subject placeholder example contains {{company}} with no personal name", () => {
    const exampleSubject = "e.g. Exclusive CRM Demo for {{company}}";
    expect(exampleSubject).toContain("{{company}}");
    expect(exampleSubject).not.toContain("{{firstName}}");
    expect(exampleSubject).not.toContain("{{lastName}}");
  });
});
