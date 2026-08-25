import request from "supertest";
import { createServer } from "../../server";
import { sequelize } from "@nexus-crm/database";
import { resolveDeliveryChannel } from "../../src/services/quoteDeliveryService";
import * as emailService from "../../src/services/emailService";
import * as whatsappService from "../../src/services/whatsappService";

const app = createServer();

describe("Quote Delivery System & Contact Communication E2E", () => {
  let authToken: string;
  let testUser: any;
  let sendEmailSpy: jest.SpyInstance;
  let sendWhatsAppSpy: jest.SpyInstance;

  beforeAll(async () => {
    // Mock the external network dispatchers
    sendEmailSpy = jest.spyOn(emailService, "sendEmail").mockResolvedValue({ id: "mock-email-id" } as any);
    sendWhatsAppSpy = jest.spyOn(whatsappService, "sendWhatsAppMessage").mockResolvedValue({ success: true, messageId: "SM123" } as any);

    // Create test user
    const userId = require("crypto").randomUUID();
    testUser = await sequelize.models.User.create({
      id: userId,
      email: `quote_delivery_rep_${Date.now()}@nexus.com`,
      password: "hashedpassword",
      name: "Quote Delivery Rep",
      role: "sales_rep"
    });

    const jwt = require("jsonwebtoken");
    authToken = jwt.sign(
      { id: (testUser as any).id, email: (testUser as any).email, role: (testUser as any).role },
      process.env.JWT_SECRET || "change_me"
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    sendEmailSpy.mockRestore();
    sendWhatsAppSpy.mockRestore();
  });

  describe("1. Pure resolveDeliveryChannel Function", () => {
    it("should prioritize explicit requestedChannel if valid recipient exists", () => {
      const contact = {
        email: "client@acme.com",
        phone: "+966501112233",
        preferredCommunicationChannel: "WHATSAPP"
      };

      // User explicitly requests EMAIL even though contact prefers WHATSAPP
      const res = resolveDeliveryChannel(contact, "EMAIL");
      expect(res.channel).toBe("EMAIL");
      expect(res.recipient).toBe("client@acme.com");
      expect(res.reason).toContain("Explicitly requested");
    });

    it("should fall back to contact.preferredCommunicationChannel when no channel is explicitly requested", () => {
      const contact = {
        email: "client@acme.com",
        whatsappNumber: "+966501112233",
        preferredCommunicationChannel: "WHATSAPP"
      };

      const res = resolveDeliveryChannel(contact);
      expect(res.channel).toBe("WHATSAPP");
      expect(res.recipient).toBe("+966501112233");
      expect(res.reason).toContain("preferred communication channel");
    });

    it("should fall back to Email if preferred is UNSPECIFIED but email is available", () => {
      const contact = {
        email: "lead@nexus.com",
        phone: "+966555555555",
        preferredCommunicationChannel: "UNSPECIFIED"
      };

      const res = resolveDeliveryChannel(contact);
      expect(res.channel).toBe("EMAIL");
      expect(res.recipient).toBe("lead@nexus.com");
    });

    it("should fall back to Phone/WhatsApp if email is absent", () => {
      const contact = {
        email: null,
        phone: "+966555555555",
        preferredCommunicationChannel: "UNSPECIFIED"
      };

      const res = resolveDeliveryChannel(contact);
      expect(res.channel).toBe("WHATSAPP");
      expect(res.recipient).toBe("+966555555555");
    });

    it("should return null if neither email nor phone is present", () => {
      const contact = {
        email: "",
        phone: "",
        preferredCommunicationChannel: "EMAIL"
      };

      const res = resolveDeliveryChannel(contact);
      expect(res.channel).toBeNull();
      expect(res.recipient).toBeNull();
      expect(res.reason).toContain("No valid");
    });
  });

  describe("2. Real Quote Delivery via API", () => {
    it("should deliver quote via EMAIL and strictly update status to 'Sent' with sentVia: EMAIL", async () => {
      // 1. Setup Deal, Contact, Quote
      const account = await sequelize.models.Account.create({
        id: require("crypto").randomUUID(),
        name: "Saudi Petrochemicals Ltd"
      });

      const contact = await sequelize.models.Contact.create({
        id: require("crypto").randomUUID(),
        accountId: (account as any).id,
        firstName: "Tariq",
        lastName: "Al-Ghamdi",
        email: "tariq@saudipetro.com",
        phone: "+966512345678",
        preferredCommunicationChannel: "EMAIL"
      });

      const deal = await sequelize.models.Deal.create({
        id: require("crypto").randomUUID(),
        name: "Industrial Valves supply",
        accountId: (account as any).id,
        ownerId: (testUser as any).id,
        amount: 85000
      });

      await sequelize.models.DealContact.create({
        id: require("crypto").randomUUID(),
        dealId: (deal as any).id,
        contactId: (contact as any).id,
        role: "Primary Buyer"
      });

      const quote = await sequelize.models.Quote.create({
        id: require("crypto").randomUUID(),
        dealId: (deal as any).id,
        quoteNumber: "QT-2026-001",
        status: "Approved",
        totalAmount: 85000
      });

      // 2. Dispatch Quote via API
      const res = await request(app)
        .post(`/api/v1/quotes/${(quote as any).id}/send`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({ channel: "EMAIL" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.channel).toBe("EMAIL");
      expect(res.body.recipient).toBe("tariq@saudipetro.com");

      // Verify emailService was actually invoked
      expect(sendEmailSpy).toHaveBeenCalledTimes(1);
      expect(sendEmailSpy).toHaveBeenCalledWith(
        "tariq@saudipetro.com",
        expect.stringContaining("QT-2026-001"),
        expect.any(String)
      );

      // Verify Quote in DB
      const updatedQuote = await sequelize.models.Quote.findByPk((quote as any).id);
      expect(updatedQuote).not.toBeNull();
      expect((updatedQuote as any).status).toBe("Sent");
      expect((updatedQuote as any).sentVia).toBe("EMAIL");
      expect((updatedQuote as any).sentAt).not.toBeNull();
    });

    it("should deliver quote via WHATSAPP and update status to 'Sent' with sentVia: WHATSAPP", async () => {
      const account = await sequelize.models.Account.create({
        id: require("crypto").randomUUID(),
        name: "Gulf Logistics Corp"
      });

      const contact = await sequelize.models.Contact.create({
        id: require("crypto").randomUUID(),
        accountId: (account as any).id,
        firstName: "Fahad",
        lastName: "Al-Otaibi",
        phone: "+966598765432",
        whatsappNumber: "+966598765432",
        preferredCommunicationChannel: "WHATSAPP"
      });

      const deal = await sequelize.models.Deal.create({
        id: require("crypto").randomUUID(),
        name: "Fleet Tracking System",
        accountId: (account as any).id,
        ownerId: (testUser as any).id,
        amount: 120000
      });

      await sequelize.models.DealContact.create({
        id: require("crypto").randomUUID(),
        dealId: (deal as any).id,
        contactId: (contact as any).id,
        role: "Primary Buyer"
      });

      const quote = await sequelize.models.Quote.create({
        id: require("crypto").randomUUID(),
        dealId: (deal as any).id,
        quoteNumber: "QT-2026-002",
        status: "Approved",
        totalAmount: 120000
      });

      const res = await request(app)
        .post(`/api/v1/quotes/${(quote as any).id}/send`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({ channel: "WHATSAPP" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.channel).toBe("WHATSAPP");
      expect(res.body.recipient).toBe("+966598765432");

      // Verify Twilio WhatsApp sender was invoked
      expect(sendWhatsAppSpy).toHaveBeenCalledTimes(1);
      expect(sendWhatsAppSpy).toHaveBeenCalledWith(
        "+966598765432",
        expect.stringContaining("QT-2026-002")
      );

      const updatedQuote = await sequelize.models.Quote.findByPk((quote as any).id);
      expect((updatedQuote as any).status).toBe("Sent");
      expect((updatedQuote as any).sentVia).toBe("WHATSAPP");
    });

    it("should return a clear 400 error and NEVER flip status to 'Sent' if contact has no recipient details", async () => {
      const deal = await sequelize.models.Deal.create({
        id: require("crypto").randomUUID(),
        name: "Anonymous Enquiry Deal",
        ownerId: (testUser as any).id,
        amount: 25000
      });

      const quote = await sequelize.models.Quote.create({
        id: require("crypto").randomUUID(),
        dealId: (deal as any).id,
        quoteNumber: "QT-2026-EMPTY",
        status: "Draft",
        totalAmount: 25000
      });

      const res = await request(app)
        .post(`/api/v1/quotes/${(quote as any).id}/send`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("Cannot send quote");

      // Check DB: Quote must remain in Draft and not be marked Sent
      const unmutatedQuote = await sequelize.models.Quote.findByPk((quote as any).id);
      expect((unmutatedQuote as any).status).toBe("Draft");
      expect((unmutatedQuote as any).sentVia).toBeNull();
      expect((unmutatedQuote as any).sentAt).toBeNull();
    });

    it("should preview delivery channel recommendation via GET /api/v1/quotes/:id/delivery-channel", async () => {
      const account = await sequelize.models.Account.create({
        id: require("crypto").randomUUID(),
        name: "Red Sea Construction"
      });

      const contact = await sequelize.models.Contact.create({
        id: require("crypto").randomUUID(),
        accountId: (account as any).id,
        firstName: "Majed",
        lastName: "Saleh",
        email: "majed@redsea.com",
        phone: "+966533334444",
        preferredCommunicationChannel: "WHATSAPP"
      });

      const deal = await sequelize.models.Deal.create({
        id: require("crypto").randomUUID(),
        name: "Jeddah Tower Framing",
        accountId: (account as any).id,
        ownerId: (testUser as any).id,
        amount: 350000
      });

      await sequelize.models.DealContact.create({
        id: require("crypto").randomUUID(),
        dealId: (deal as any).id,
        contactId: (contact as any).id,
        role: "Primary Buyer"
      });

      const quote = await sequelize.models.Quote.create({
        id: require("crypto").randomUUID(),
        dealId: (deal as any).id,
        quoteNumber: "QT-2026-PREVIEW",
        status: "Draft",
        totalAmount: 350000
      });

      const res = await request(app)
        .get(`/api/v1/quotes/${(quote as any).id}/delivery-channel`)
        .set("Authorization", `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.recommendedChannel).toBe("WHATSAPP");
      expect(res.body.availableChannels.email).toBe(true);
      expect(res.body.availableChannels.whatsapp).toBe(true);
      expect(res.body.contact.name).toBe("Majed Saleh");
      expect(res.body.resolutionReason).toContain("preferred communication channel");
    });

    it("should allow downloading PDF via GET /api/v1/quotes/:id/pdf without modifying quote status", async () => {
      const deal = await sequelize.models.Deal.create({
        id: require("crypto").randomUUID(),
        name: "PDF Inspection Deal",
        ownerId: (testUser as any).id,
        amount: 15000
      });

      const quote = await sequelize.models.Quote.create({
        id: require("crypto").randomUUID(),
        dealId: (deal as any).id,
        quoteNumber: "QT-PDF-CHECK",
        status: "Draft",
        totalAmount: 15000
      });

      const res = await request(app)
        .get(`/api/v1/quotes/${(quote as any).id}/pdf`)
        .set("Authorization", `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.header["content-type"]).toBe("application/pdf");
      expect(res.body).toBeDefined();

      // Ensure status is STILL Draft and NOT Sent
      const unmutatedQuote = await sequelize.models.Quote.findByPk((quote as any).id);
      expect((unmutatedQuote as any).status).toBe("Draft");
      expect((unmutatedQuote as any).sentAt).toBeNull();
    });
  });
});
