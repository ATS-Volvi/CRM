import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { computeAudience, computeWhatsAppAudience } from "../../src/services/campaignMessageService";
import { previewAudience } from "../../src/controllers/campaignMessageController";
import { sequelize } from "@nexus-crm/database";

describe("Campaign Audience Union & Controller Validation Unit Tests", () => {
  let origLeadAttribFindAll: any;
  let origLeadFindAll: any;
  let origCampaignFindByPk: any;
  let origCampaignFindAll: any;

  beforeEach(() => {
    origLeadAttribFindAll = sequelize.models.LeadAttribution.findAll;
    origLeadFindAll = sequelize.models.Lead.findAll;
    origCampaignFindByPk = sequelize.models.Campaign.findByPk;
    origCampaignFindAll = sequelize.models.Campaign.findAll;
  });

  afterEach(() => {
    sequelize.models.LeadAttribution.findAll = origLeadAttribFindAll;
    sequelize.models.Lead.findAll = origLeadFindAll;
    sequelize.models.Campaign.findByPk = origCampaignFindByPk;
    sequelize.models.Campaign.findAll = origCampaignFindAll;
  });

  it("1. computeWhatsAppAudience unions leads from primary and included campaigns, strictly excluding widened leads without consent", async () => {
    (sequelize.models.LeadAttribution as any).findAll = async () => [
      { leadId: "lead-attrib-1" }
    ];

    const testLeads = [
      // Primary campaign lead with consent -> ELIGIBLE
      {
        id: "lead-primary-1",
        campaignId: "camp-primary",
        phone: "+971501111111",
        whatsappConsentStatus: "OPTED_IN",
        optedOutWhatsapp: false,
        status: "NEW"
      },
      // Widened lead from included campaign WITH consent -> ELIGIBLE
      {
        id: "lead-widened-consented",
        campaignId: "camp-secondary",
        phone: "+971502222222",
        whatsappConsentStatus: "OPTED_IN",
        optedOutWhatsapp: false,
        status: "NEW"
      },
      // Widened lead from included campaign WITHOUT consent (UNSPECIFIED) -> EXCLUDED (mandatory exclusion)
      {
        id: "lead-widened-no-consent",
        campaignId: "camp-secondary",
        phone: "+971503333333",
        whatsappConsentStatus: "UNSPECIFIED",
        optedOutWhatsapp: false,
        status: "NEW"
      }
    ];

    (sequelize.models.Lead as any).findAll = async () => testLeads;

    const result = await computeWhatsAppAudience("camp-primary", {
      includeFromCampaignIds: ["camp-secondary"]
    });

    assert.deepStrictEqual(
      result.eligibleLeads.map((l: any) => l.id),
      ["lead-primary-1", "lead-widened-consented"]
    );
    assert.strictEqual(result.excludedByReason.noConsent, 1);
  });

  it("2. Regression check: empty or missing includeFromCampaignIds behaves exactly as single-campaign query", async () => {
    let capturedAttribQuery: any = null;
    (sequelize.models.LeadAttribution as any).findAll = async (options: any) => {
      capturedAttribQuery = options;
      return [];
    };

    (sequelize.models.Lead as any).findAll = async () => [
      {
        id: "lead-single-1",
        campaignId: "camp-solo",
        email: "solo@example.com",
        optedOutEmail: false,
        status: "NEW"
      }
    ];

    // Call without includeFromCampaignIds
    const result = await computeAudience("camp-solo", {});

    assert.ok(capturedAttribQuery);
    const inSymbol = Object.getOwnPropertySymbols(capturedAttribQuery.where.campaignId)[0];
    assert.deepStrictEqual(capturedAttribQuery.where.campaignId[inSymbol], ["camp-solo"]);
    assert.deepStrictEqual(result.eligibleLeads.map((l: any) => l.id), ["lead-single-1"]);
  });

  it("3. previewAudience returns 400 when includeFromCampaignIds contains an unknown campaign ID", async () => {
    (sequelize.models.Campaign as any).findByPk = async () => ({ id: "camp-1", name: "Main Campaign" });
    (sequelize.models.Campaign as any).findAll = async () => [{ id: "camp-valid" }];

    const req: any = {
      params: { id: "camp-1" },
      body: {
        channel: "WHATSAPP",
        audienceFilter: {
          includeFromCampaignIds: ["camp-valid", "camp-nonexistent-999"]
        }
      }
    };

    let statusCode = 200;
    let responseBody: any = null;
    const res: any = {
      status: (code: number) => {
        statusCode = code;
        return res;
      },
      json: (body: any) => {
        responseBody = body;
        return res;
      }
    };

    await previewAudience(req, res);

    assert.strictEqual(statusCode, 400);
    assert.ok(
      typeof responseBody?.error === "string" &&
      responseBody.error.includes("camp-nonexistent-999"),
      `Expected error message to mention camp-nonexistent-999, got: ${responseBody?.error}`
    );
  });

  it("4. previewAudience returns 400 when includeFromCampaignIds is not an array", async () => {
    (sequelize.models.Campaign as any).findByPk = async () => ({ id: "camp-1", name: "Main Campaign" });

    const req: any = {
      params: { id: "camp-1" },
      body: {
        channel: "WHATSAPP",
        audienceFilter: {
          includeFromCampaignIds: "not-an-array"
        }
      }
    };

    let statusCode = 200;
    let responseBody: any = null;
    const res: any = {
      status: (code: number) => {
        statusCode = code;
        return res;
      },
      json: (body: any) => {
        responseBody = body;
        return res;
      }
    };

    await previewAudience(req, res);

    assert.strictEqual(statusCode, 400);
    assert.ok(
      typeof responseBody?.error === "string" &&
      responseBody.error.includes("includeFromCampaignIds must be an array"),
      `Expected error message to mention array requirement, got: ${responseBody?.error}`
    );
  });
});
