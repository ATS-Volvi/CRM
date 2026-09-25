import "dotenv/config";
import { sequelize } from "@nexus-crm/database";
import crypto from "crypto";
import {
  createCampaignAd,
  updateCampaignAd,
  deleteCampaignAd
} from "../../src/controllers/campaignController";

describe("Campaign Ad CRUD Endpoints", () => {
  let campaignId: string;
  let createdAdId: string;

  beforeAll(async () => {
    await sequelize.models.Campaign.sync();
    await sequelize.models.CampaignAd.sync();

    const timestamp = Date.now();
    const campaign = await sequelize.models.Campaign.create({
      id: crypto.randomUUID(),
      name: `Ad Management Test Campaign ${timestamp}`,
      code: `CAMP-ADS-${timestamp}`,
      channel: "Website",
      platform: "Google Ads",
      status: "ACTIVE",
      budget: 50000
    });
    campaignId = (campaign as any).id;
  });

  afterAll(async () => {
    try {
      if (createdAdId) {
        await sequelize.models.CampaignAd.destroy({ where: { id: createdAdId } });
      }
      if (campaignId) {
        await sequelize.models.Campaign.destroy({ where: { id: campaignId } });
      }
    } catch (e) {}
  });

  it("should create a new campaign ad under the campaign", async () => {
    const mockReq: any = {
      params: { id: campaignId },
      body: {
        name: "Search Keyword Ad Alpha",
        externalId: "gads_alpha_001",
        platform: "Google Ads",
        creativeType: "Text / Search",
        status: "ACTIVE"
      }
    };
    let responseData: any = null;
    let statusCode = 200;
    const mockRes: any = {
      json: (data: any) => { responseData = data; return mockRes; },
      status: (code: number) => { statusCode = code; return mockRes; }
    };

    await createCampaignAd(mockReq, mockRes);

    expect(statusCode).toBe(201);
    expect(responseData).toBeDefined();
    expect(responseData.name).toBe("Search Keyword Ad Alpha");
    expect(responseData.externalId).toBe("gads_alpha_001");
    expect(responseData.campaignId).toBe(campaignId);
    createdAdId = responseData.id;
  });

  it("should reject duplicate externalId under the same campaign with 409", async () => {
    const mockReq: any = {
      params: { id: campaignId },
      body: {
        name: "Another Ad with Same External ID",
        externalId: "gads_alpha_001", // Duplicate
        platform: "Google Ads",
        creativeType: "Text / Search",
        status: "ACTIVE"
      }
    };
    let responseData: any = null;
    let statusCode = 200;
    const mockRes: any = {
      json: (data: any) => { responseData = data; return mockRes; },
      status: (code: number) => { statusCode = code; return mockRes; }
    };

    await createCampaignAd(mockReq, mockRes);

    expect(statusCode).toBe(409);
    expect(responseData.error).toContain("already exists");
  });

  it("should update campaign ad properties", async () => {
    const mockReq: any = {
      params: { id: campaignId, adId: createdAdId },
      body: {
        name: "Updated Search Keyword Ad Alpha",
        status: "PAUSED"
      }
    };
    let responseData: any = null;
    let statusCode = 200;
    const mockRes: any = {
      json: (data: any) => { responseData = data; return mockRes; },
      status: (code: number) => { statusCode = code; return mockRes; }
    };

    await updateCampaignAd(mockReq, mockRes);

    expect(statusCode).toBe(200);
    expect(responseData.name).toBe("Updated Search Keyword Ad Alpha");
    expect(responseData.status).toBe("PAUSED");
  });

  it("should delete campaign ad", async () => {
    const mockReq: any = {
      params: { id: campaignId, adId: createdAdId }
    };
    let responseData: any = null;
    let statusCode = 200;
    const mockRes: any = {
      json: (data: any) => { responseData = data; return mockRes; },
      status: (code: number) => { statusCode = code; return mockRes; }
    };

    await deleteCampaignAd(mockReq, mockRes);

    expect(statusCode).toBe(200);
    expect(responseData.message).toContain("deleted successfully");

    const found = await sequelize.models.CampaignAd.findByPk(createdAdId);
    expect(found).toBeNull();
  });
});
