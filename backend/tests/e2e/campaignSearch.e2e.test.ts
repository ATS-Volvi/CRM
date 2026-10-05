import "dotenv/config";
import { sequelize } from "@nexus-crm/database";
import crypto from "crypto";
import { getCampaigns } from "../../src/controllers/campaignController";

describe("Campaign Search Endpoint (getCampaigns with ?search=)", () => {
  let createdCampaignIds: string[] = [];

  beforeAll(async () => {
    await sequelize.models.Campaign.sync();
    const timestamp = Date.now();
    const c1 = await sequelize.models.Campaign.create({
      id: crypto.randomUUID(),
      name: `Special Alpha Promo ${timestamp}`,
      code: `CODE-ALPHA-${timestamp}`,
      description: "High conversion email nurture campaign",
      channel: "Email",
      status: "ACTIVE",
      budget: 12000
    });
    const c2 = await sequelize.models.Campaign.create({
      id: crypto.randomUUID(),
      name: `Beta Industrial Outreach ${timestamp}`,
      code: `CODE-BETA-${timestamp}`,
      description: "Direct outreach for robotics supply",
      channel: "LinkedIn",
      status: "ACTIVE",
      budget: 35000
    });
    createdCampaignIds = [(c1 as any).id, (c2 as any).id];
  });

  afterAll(async () => {
    if (createdCampaignIds.length > 0) {
      await sequelize.models.Campaign.destroy({
        where: { id: createdCampaignIds }
      });
    }
  });

  it("should filter campaigns by matching name", async () => {
    const mockReq: any = { query: { search: "Special Alpha Promo" } };
    let responseData: any = null;
    let statusCode = 200;
    const mockRes: any = {
      json: (data: any) => { responseData = data; return mockRes; },
      status: (code: number) => { statusCode = code; return mockRes; }
    };

    await getCampaigns(mockReq, mockRes);

    expect(statusCode).toBe(200);
    expect(responseData.data.length).toBeGreaterThanOrEqual(1);
    const found = responseData.data.find((row: any) => (row.campaign?.name || row.name)?.includes("Special Alpha Promo"));
    expect(found).toBeDefined();
  });

  it("should filter campaigns by matching code", async () => {
    const mockReq: any = { query: { search: "CODE-BETA-" } };
    let responseData: any = null;
    let statusCode = 200;
    const mockRes: any = {
      json: (data: any) => { responseData = data; return mockRes; },
      status: (code: number) => { statusCode = code; return mockRes; }
    };

    await getCampaigns(mockReq, mockRes);

    expect(statusCode).toBe(200);
    expect(responseData.data.length).toBeGreaterThanOrEqual(1);
    const found = responseData.data.find((row: any) => (row.campaign?.code || row.code)?.includes("CODE-BETA-"));
    expect(found).toBeDefined();
  });

  it("should return empty list when search term has 0 matches", async () => {
    const mockReq: any = { query: { search: "NONEXISTENT_CAMPAIGN_TERM_XYZ999" } };
    let responseData: any = null;
    let statusCode = 200;
    const mockRes: any = {
      json: (data: any) => { responseData = data; return mockRes; },
      status: (code: number) => { statusCode = code; return mockRes; }
    };

    await getCampaigns(mockReq, mockRes);

    expect(statusCode).toBe(200);
    expect(responseData.data).toEqual([]);
    expect(responseData.total).toBe(0);
  });
});
