process.env.USE_SQLITE = "true";
process.env.DB_DIALECT = "sqlite";
process.env.DB_STORAGE = "./test.sqlite";

import request from "supertest";
import { createServer } from "../../server";
import { sequelize } from "@nexus-crm/database";
import { resolveDeliveryChannel } from "../../src/services/quoteDeliveryService";
import * as emailService from "../../src/services/emailService";
import * as whatsappService from "../../src/services/whatsappService";
import jwt from "jsonwebtoken";

describe("Phase 2: Quote Delivery System — Full Hierarchy & Delivery History", () => {
  let app: any;
  let authToken: string;
  let adminUserId = "00000000-0000-0000-0000-000000000000";

  beforeAll(async () => {
    app = createServer();

    authToken = jwt.sign(
      { id: adminUserId, email: "admin@nexus.com", role: "admin" },
      process.env.JWT_SECRET || "default_secret"
    );
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. PURE RESOLUTION HIERARCHY TESTS
  // ─────────────────────────────────────────────────────────────────────────────
  describe("1. Full 5-Tier Documented Hierarchy in resolveDeliveryChannel", () => {
    it("Tier 1: Explicit requested channel (verified vs unverified)", () => {
      // Verified Email
      const r1 = resolveDeliveryChannel(
        { email: "user@client.com", phone: "+966501111111", emailVerified: true },
        "EMAIL"
      );
      expect(r1.channel).toBe("EMAIL");
      expect(r1.reason).toBe("Explicitly requested (verified recipient)");

      // Unverified Email
      const r2 = resolveDeliveryChannel(
        { email: "user@client.com", phone: "+966501111111", emailVerified: false },
        "EMAIL"
      );
      expect(r2.channel).toBe("EMAIL");
      expect(r2.reason).toBe("Explicitly requested (unverified recipient)");

      // Verified WhatsApp
      const r3 = resolveDeliveryChannel(
        { email: "user@client.com", phone: "+966501111111", whatsappVerified: true },
        "WHATSAPP"
      );
      expect(r3.channel).toBe("WHATSAPP");
      expect(r3.reason).toBe("Explicitly requested (verified recipient)");

      // Unverified WhatsApp
      const r4 = resolveDeliveryChannel(
        { email: "user@client.com", phone: "+966501111111", whatsappVerified: false },
        "WHATSAPP"
      );
      expect(r4.channel).toBe("WHATSAPP");
      expect(r4.reason).toBe("Explicitly requested (unverified recipient)");
    });

    it("Tier 2: Preferred communication channel (Verified)", () => {
      // Verified WhatsApp Preferred
      const rWa = resolveDeliveryChannel({
        email: "salman@client.com",
        whatsappNumber: "+966502222222",
        preferredCommunicationChannel: "WHATSAPP",
        whatsappVerified: true
      });
      expect(rWa.channel).toBe("WHATSAPP");
      expect(rWa.recipient).toBe("+966502222222");
      expect(rWa.reason).toBe("Recommended: WhatsApp — verified preferred communication channel");

      // Verified Email Preferred
      const rEm = resolveDeliveryChannel({
        email: "salman@client.com",
        phone: "+966502222222",
        preferredCommunicationChannel: "EMAIL",
        emailVerified: true
      });
      expect(rEm.channel).toBe("EMAIL");
      expect(rEm.recipient).toBe("salman@client.com");
      expect(rEm.reason).toBe("Recommended: Email — verified preferred communication channel");
    });

    it("Tier 3: Preferred communication channel (Unverified, lower confidence flagged)", () => {
      // Unverified WhatsApp Preferred
      const rWa = resolveDeliveryChannel({
        email: "salman@client.com",
        whatsappNumber: "+966502222222",
        preferredCommunicationChannel: "WHATSAPP",
        whatsappVerified: false
      });
      expect(rWa.channel).toBe("WHATSAPP");
      expect(rWa.recipient).toBe("+966502222222");
      expect(rWa.reason).toBe("Recommended: WhatsApp — unverified preferred communication channel");

      // Unverified Email Preferred
      const rEm = resolveDeliveryChannel({
        email: "salman@client.com",
        phone: "+966502222222",
        preferredCommunicationChannel: "EMAIL",
        emailVerified: false
      });
      expect(rEm.channel).toBe("EMAIL");
      expect(rEm.recipient).toBe("salman@client.com");
      expect(rEm.reason).toBe("Recommended: Email — unverified preferred communication channel");
    });

    it("Tier 4: Lead's Original Intake Channel Default (Website -> Email, WhatsApp -> WhatsApp)", () => {
      // Website Intake Form with no contact preference
      const rWeb = resolveDeliveryChannel(
        {
          email: "webinquiry@client.com",
          phone: "+966503333333",
          preferredCommunicationChannel: "UNSPECIFIED"
        },
        null,
        { source: "Website Form", sourceChannel: "Website" }
      );
      expect(rWeb.channel).toBe("EMAIL");
      expect(rWeb.recipient).toBe("webinquiry@client.com");
      expect(rWeb.reason).toBe("Recommended: Email — defaulting from Website intake to Email");

      // WhatsApp Intake with no contact preference
      const rWaLead = resolveDeliveryChannel(
        {
          email: "inquiry@client.com",
          phone: "+966503333333",
          preferredCommunicationChannel: "UNSPECIFIED"
        },
        null,
        { source: "WhatsApp Inbound", sourceChannel: "WhatsApp" }
      );
      expect(rWaLead.channel).toBe("WHATSAPP");
      expect(rWaLead.recipient).toBe("+966503333333");
      expect(rWaLead.reason).toBe("Recommended: WhatsApp — defaulting from WhatsApp intake to WhatsApp");
    });

    it("Tier 5: Final Fallback to available email then phone", () => {
      // Email available, no preference or lead context
      const rEmail = resolveDeliveryChannel({
        email: "fallback@client.com",
        phone: "+966504444444",
        preferredCommunicationChannel: "UNSPECIFIED"
      });
      expect(rEmail.channel).toBe("EMAIL");
      expect(rEmail.recipient).toBe("fallback@client.com");
      expect(rEmail.reason).toBe("Default: Email — fallback to available email");

      // Only Phone available
      const rPhone = resolveDeliveryChannel({
        email: null,
        phone: "+966504444444",
        preferredCommunicationChannel: "UNSPECIFIED"
      });
      expect(rPhone.channel).toBe("WHATSAPP");
      expect(rPhone.recipient).toBe("+966504444444");
      expect(rPhone.reason).toBe("Default: WhatsApp — fallback to available phone/WhatsApp");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. REAL SEND & APPEND-ONLY DELIVERY HISTORY MODEL
  // ─────────────────────────────────────────────────────────────────────────────
  describe("2. QuoteDelivery History Event Log via API", () => {
    let leadId: string;
    let accountId: string;
    let contactId: string;
    let dealId: string;
    let quoteId: string;

    beforeEach(async () => {
      jest.spyOn(emailService, "sendEmail").mockResolvedValue({ id: "mailgun_test_msg_999" } as any);
      jest.spyOn(whatsappService, "sendWhatsAppMessage").mockResolvedValue({
        success: true,
        messageId: "twilio_wa_msg_888"
      } as any);

      // Create test Lead
      const lead = await sequelize.models.Lead.create({
        id: require("crypto").randomUUID(),
        firstName: "Tariq",
        lastName: "Al-Harbi",
        company: "Al-Harbi Construction",
        email: "tariq@alharbi.com",
        phone: "+966505555555",
        status: "Converted",
        preferredCommunicationChannel: "EMAIL",
        source: "Website",
        sourceChannel: "Website"
      });
      leadId = (lead as any).id;

      // Create Account & Contact
      const account = await sequelize.models.Account.create({
        id: require("crypto").randomUUID(),
        name: "Al-Harbi Construction",
        email: "tariq@alharbi.com",
        phone: "+966505555555"
      });
      accountId = (account as any).id;

      const contact = await sequelize.models.Contact.create({
        id: require("crypto").randomUUID(),
        accountId,
        firstName: "Tariq",
        lastName: "Al-Harbi",
        email: "tariq@alharbi.com",
        phone: "+966505555555",
        whatsappNumber: "+966505555555",
        preferredCommunicationChannel: "EMAIL",
        emailVerified: true,
        whatsappVerified: true
      });
      contactId = (contact as any).id;

      // Create Deal
      const deal = await sequelize.models.Deal.create({
        id: require("crypto").randomUUID(),
        name: "Commercial Tower Fitting",
        accountId,
        leadId,
        ownerId: adminUserId,
        amount: 250000
      });
      dealId = (deal as any).id;

      // Associate Contact to Deal
      await sequelize.models.DealContact.create({
        id: require("crypto").randomUUID(),
        dealId,
        contactId,
        isPrimary: true
      });

      // Create Quote
      const quote = await sequelize.models.Quote.create({
        id: require("crypto").randomUUID(),
        dealId,
        status: "Approved",
        totalAmount: 250000,
        quoteNumber: "QT-2026-9001",
        version: 1
      });
      quoteId = (quote as any).id;
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("should create a QuoteDelivery row with status 'SENT' upon sending a quote", async () => {
      const sendRes = await request(app)
        .post(`/api/v1/quotes/${quoteId}/send`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({ channel: "EMAIL" });

      expect(sendRes.status).toBe(200);
      expect(sendRes.body.success).toBe(true);

      // Verify QuoteDelivery row was inserted
      const deliveries = await sequelize.models.QuoteDelivery.findAll({
        where: { quoteId },
        order: [["occurredAt", "ASC"]]
      });

      expect(deliveries.length).toBe(1);
      expect((deliveries[0] as any).status).toBe("SENT");
      expect((deliveries[0] as any).channel).toBe("EMAIL");
      expect((deliveries[0] as any).recipient).toBe("tariq@alharbi.com");
      expect((deliveries[0] as any).providerMessageId).toBe("mailgun_test_msg_999");
    });

    it("should append a 'VIEWED' QuoteDelivery row when public quote is opened", async () => {
      // 1. Send first
      await request(app)
        .post(`/api/v1/quotes/${quoteId}/send`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({ channel: "EMAIL" });

      // 2. Client opens public quote (unauthenticated public link)
      const viewRes = await request(app)
        .get(`/api/v1/quotes/${quoteId}/public`);

      expect(viewRes.status).toBe(200);
      expect(viewRes.body.status).toBe("Viewed");

      // Verify QuoteDelivery history now has 2 distinct rows: SENT and VIEWED
      const deliveries = await sequelize.models.QuoteDelivery.findAll({
        where: { quoteId },
        order: [["occurredAt", "ASC"]]
      });

      expect(deliveries.length).toBe(2);
      expect((deliveries[0] as any).status).toBe("SENT");
      expect((deliveries[1] as any).status).toBe("VIEWED");
      expect((deliveries[1] as any).notes).toContain("viewed online");
    });

    it("should append delivery webhook events (DELIVERED, BOUNCED) and retrieve via GET /quotes/:id/deliveries", async () => {
      // 1. Initial Send
      await request(app)
        .post(`/api/v1/quotes/${quoteId}/send`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({ channel: "EMAIL" });

      // 2. Delivery Webhook
      const delivRes = await request(app)
        .post(`/api/v1/quotes/${quoteId}/delivery-status`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          status: "DELIVERED",
          channel: "EMAIL",
          recipient: "tariq@alharbi.com",
          providerMessageId: "mailgun_test_msg_999",
          notes: "Delivered to recipient mail server (250 OK)"
        });
      expect(delivRes.status).toBe(201);

      // 3. Client View
      await request(app).get(`/api/v1/quotes/${quoteId}/public`);

      // 4. Retrieve complete delivery history timeline
      const timelineRes = await request(app)
        .get(`/api/v1/quotes/${quoteId}/deliveries`)
        .set("Authorization", `Bearer ${authToken}`);

      expect(timelineRes.status).toBe(200);
      expect(Array.isArray(timelineRes.body)).toBe(true);
      expect(timelineRes.body.length).toBe(3);

      const statuses = timelineRes.body.map((d: any) => d.status);
      expect(statuses).toEqual(["SENT", "DELIVERED", "VIEWED"]);
    });
  });
});
