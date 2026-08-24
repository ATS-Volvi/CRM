import "dotenv/config";
import { sequelize } from "@nexus-crm/database";
import crypto from "crypto";
import { convertLeadToOpportunity } from "../../src/services/leadJourneyWorkflowEngine";
import { getCampaigns } from "../../src/controllers/campaignController";
import { getFulfillments } from "../../src/controllers/fulfillmentController";

describe("3 Defects Verification", () => {
  beforeAll(async () => {
    // Run migration file up
    const migration = require("../../../database/migrations/20260818000000-update-lead-status-default.js");
    await migration.up(sequelize.getQueryInterface(), sequelize.constructor);
  });

  describe("Defect 1: Lead.status Default Value & Migration", () => {
    it("should default Lead.status to 'NEW' upon creation without explicit status", async () => {
      const lead = await sequelize.models.Lead.create({
        id: crypto.randomUUID(),
        firstName: "Tariq",
        lastName: "Al-Mansoor",
        company: "Mansoor Logistics",
        email: `tariq_${Date.now()}@mansoor.sa`,
        phone: "+966509998877"
      });

      expect((lead as any).status).toBe("NEW");
    });
  });

  describe("Defect 2: convertLead Creates and Links Contact", () => {
    it("should find-or-create Contact, link DealContact, and set convertedContactId on Lead", async () => {
      const uniqueEmail = `sarah_${Date.now()}@acmeindustrial.com`;
      const lead = await sequelize.models.Lead.create({
        id: crypto.randomUUID(),
        firstName: "Sarah",
        lastName: "Connor",
        company: "Acme Industrial",
        email: uniqueEmail,
        phone: "+971501112233",
        status: "NEW",
        source: "Website"
      });

      const conversionResult = await convertLeadToOpportunity((lead as any).id, {
        requirement: "Complete HVAC Installation",
        estimatedValue: 250000
      });

      // 1. Check Account created
      expect(conversionResult.account).toBeDefined();
      expect(conversionResult.account.name).toBe("Acme Industrial");

      // 2. Check Contact created with matching properties
      expect(conversionResult.contact).toBeDefined();
      expect(conversionResult.contact.email).toBe(uniqueEmail);
      expect(conversionResult.contact.firstName).toBe("Sarah");
      expect(conversionResult.contact.lastName).toBe("Connor");
      expect(conversionResult.contact.accountId).toBe(conversionResult.account.id);

      // Verify Contact exists in DB
      const dbContact = await sequelize.models.Contact.findOne({ where: { email: uniqueEmail } });
      expect(dbContact).not.toBeNull();
      expect((dbContact as any).id).toBe(conversionResult.contact.id);

      // 3. Check Deal created and linked via DealContact
      expect(conversionResult.deal).toBeDefined();
      const dealContact = await sequelize.models.DealContact.findOne({
        where: {
          dealId: conversionResult.deal.id,
          contactId: conversionResult.contact.id
        }
      });
      expect(dealContact).not.toBeNull();
      expect((dealContact as any).role).toBe("Initiator");
      expect((dealContact as any).isPrimary).toBe(true);

      // 4. Check convertedContactId and convertedAccountId on the Lead record
      const reloadedLead: any = await sequelize.models.Lead.findByPk((lead as any).id);
      expect(reloadedLead.status).toBe("CONVERTED");
      expect(reloadedLead.convertedContactId).toBe(conversionResult.contact.id);
      expect(reloadedLead.convertedAccountId).toBe(conversionResult.account.id);
      expect(reloadedLead.convertedDealId).toBe(conversionResult.deal.id);
    });
  });

  describe("Defect 3: Campaign and Fulfillment Models & Controller Routes", () => {
    it("should have Campaign, CampaignAd, Fulfillment, and FulfillmentItem defined in sequelize.models", () => {
      expect(sequelize.models.Campaign).toBeDefined();
      expect(sequelize.models.CampaignAd).toBeDefined();
      expect(sequelize.models.Fulfillment).toBeDefined();
      expect(sequelize.models.FulfillmentItem).toBeDefined();
      expect(sequelize.models.LeadAttribution).toBeDefined();
      expect(sequelize.models.AttributionEvent).toBeDefined();
    });

    it("should successfully execute getCampaigns without throwing", async () => {
      // Create a test campaign
      const campaign = await sequelize.models.Campaign.create({
        id: crypto.randomUUID(),
        name: "Q3 Industrial Automation",
        code: `CAMP-Q3-${Date.now()}`,
        channel: "Paid Search",
        status: "ACTIVE",
        budget: 50000
      });

      const mockReq: any = { query: {} };
      let responseData: any = null;
      let statusCode: number = 200;
      const mockRes: any = {
        json: (data: any) => { responseData = data; return mockRes; },
        status: (code: number) => { statusCode = code; return mockRes; }
      };

      await getCampaigns(mockReq, mockRes);

      expect(statusCode).toBe(200);
      expect(responseData).toBeDefined();
      expect(Array.isArray(responseData.data)).toBe(true);
      expect(responseData.total).toBeGreaterThanOrEqual(1);
    });

    it("should successfully execute getFulfillments without throwing", async () => {
      const mockReq: any = { query: {} };
      let responseData: any = null;
      let statusCode: number = 200;
      const mockRes: any = {
        json: (data: any) => { responseData = data; return mockRes; },
        status: (code: number) => { statusCode = code; return mockRes; }
      };

      await getFulfillments(mockReq, mockRes);

      expect(statusCode).toBe(200);
      expect(responseData).toBeDefined();
      expect(Array.isArray(responseData.data)).toBe(true);
    });
  });
});
