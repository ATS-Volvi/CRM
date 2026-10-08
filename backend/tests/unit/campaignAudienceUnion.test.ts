import { computeAudience, computeWhatsAppAudience } from "../../src/services/campaignMessageService";
import { previewAudience } from "../../src/controllers/campaignMessageController";
import { sequelize } from "@nexus-crm/database";

describe("Campaign Audience Union & Controller Validation Unit Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("1. computeWhatsAppAudience unions leads from primary and included campaigns, strictly excluding widened leads without consent", async () => {
    jest.spyOn(sequelize.models.LeadAttribution, "findAll").mockResolvedValueOnce([
      { leadId: "lead-attrib-1" }
    ] as any);

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

    jest.spyOn(sequelize.models.Lead, "findAll").mockResolvedValueOnce(testLeads as any);

    const result = await computeWhatsAppAudience("camp-primary", {
      includeFromCampaignIds: ["camp-secondary"]
    });

    expect(result.eligibleLeads.map((l: any) => l.id)).toEqual([
      "lead-primary-1",
      "lead-widened-consented"
    ]);
    expect(result.excludedByReason.noConsent).toBe(1);
  });

  it("2. Regression check: empty or missing includeFromCampaignIds behaves exactly as single-campaign query", async () => {
    const attribSpy = jest.spyOn(sequelize.models.LeadAttribution, "findAll").mockResolvedValueOnce([] as any);
    const leadSpy = jest.spyOn(sequelize.models.Lead, "findAll").mockResolvedValueOnce([
      {
        id: "lead-single-1",
        campaignId: "camp-solo",
        email: "solo@example.com",
        optedOutEmail: false,
        status: "NEW"
      }
    ] as any);

    // Call without includeFromCampaignIds
    const result = await computeAudience("camp-solo", {});

    expect(attribSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { campaignId: { [Symbol.for("in")]: ["camp-solo"] } }
      })
    );
    expect(result.eligibleLeads.map((l: any) => l.id)).toEqual(["lead-single-1"]);
  });

  it("3. previewAudience returns 400 when includeFromCampaignIds contains an unknown campaign ID", async () => {
    jest.spyOn(sequelize.models.Campaign, "findByPk").mockResolvedValueOnce({ id: "camp-1", name: "Main Campaign" } as any);
    jest.spyOn(sequelize.models.Campaign, "findAll").mockResolvedValueOnce([{ id: "camp-valid" }] as any);

    const req: any = {
      params: { id: "camp-1" },
      body: {
        channel: "WHATSAPP",
        audienceFilter: {
          includeFromCampaignIds: ["camp-valid", "camp-nonexistent-999"]
        }
      }
    };

    const res: any = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    await previewAudience(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.stringContaining("camp-nonexistent-999")
      })
    );
  });

  it("4. previewAudience returns 400 when includeFromCampaignIds is not an array", async () => {
    jest.spyOn(sequelize.models.Campaign, "findByPk").mockResolvedValueOnce({ id: "camp-1", name: "Main Campaign" } as any);

    const req: any = {
      params: { id: "camp-1" },
      body: {
        channel: "WHATSAPP",
        audienceFilter: {
          includeFromCampaignIds: "not-an-array"
        }
      }
    };

    const res: any = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    await previewAudience(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.stringContaining("includeFromCampaignIds must be an array")
      })
    );
  });
});
