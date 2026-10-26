process.env.USE_SQLITE = "true";
process.env.DB_DIALECT = "sqlite";
process.env.DB_STORAGE = "./test.sqlite";

import request from "supertest";
import { createServer } from "../../server";
import { sequelize } from "@nexus-crm/database";
import * as emailService from "../../src/services/emailService";
import * as whatsappService from "../../src/services/whatsappService";
import jwt from "jsonwebtoken";

describe("Phase 3: Quote Delivery System — Expiring Tokens, Customer Portal & Message Flagging", () => {
  let app: any;
  let authToken: string;
  const adminUserId = "00000000-0000-0000-0000-000000000000";

  beforeAll(async () => {
    app = createServer();
    authToken = jwt.sign(
      { id: adminUserId, email: "admin@nexus.com", role: "admin" },
      process.env.JWT_SECRET || "default_secret"
    );
  });

  let leadId: string;
  let accountId: string;
  let contactId: string;
  let wonStageId: string;
  let dealId: string;
  let quoteId: string;

  beforeEach(async () => {
    jest.spyOn(emailService, "sendEmail").mockResolvedValue({ id: "mailgun_p3_001" } as any);
    jest.spyOn(whatsappService, "sendWhatsAppMessage").mockResolvedValue({
      success: true,
      messageId: "twilio_p3_002"
    } as any);

    // Find or create Won Pipeline Stage
    const { Op } = require("sequelize");
    let wonStage: any = await sequelize.models.PipelineStage.findOne({
      where: { name: { [Op.like]: "%Won%" } }
    });
    if (!wonStage) {
      wonStage = await sequelize.models.PipelineStage.create({
        id: require("crypto").randomUUID(),
        name: "Closed Won",
        order: 10
      });
    }
    wonStageId = wonStage.id;

    // Create Lead
    const lead = await sequelize.models.Lead.create({
      id: require("crypto").randomUUID(),
      firstName: "Faisal",
      lastName: "Al-Otaibi",
      company: "Otaibi Global",
      email: "faisal@otaibi.com",
      phone: "+966509999999",
      status: "Converted",
      preferredCommunicationChannel: "EMAIL",
      emailVerified: true
    });
    leadId = (lead as any).id;

    // Create Account & Contact
    const account = await sequelize.models.Account.create({
      id: require("crypto").randomUUID(),
      name: "Otaibi Global",
      email: "faisal@otaibi.com",
      phone: "+966509999999"
    });
    accountId = (account as any).id;

    const contact = await sequelize.models.Contact.create({
      id: require("crypto").randomUUID(),
      accountId,
      firstName: "Faisal",
      lastName: "Al-Otaibi",
      email: "faisal@otaibi.com",
      phone: "+966509999999",
      preferredCommunicationChannel: "EMAIL",
      emailVerified: true
    });
    contactId = (contact as any).id;

    // Create Deal
    const deal = await sequelize.models.Deal.create({
      id: require("crypto").randomUUID(),
      name: "Enterprise Cloud Setup",
      accountId,
      leadId,
      ownerId: adminUserId,
      amount: 180000,
      status: "Open"
    });
    dealId = (deal as any).id;

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
      totalAmount: 180000,
      quoteNumber: "QT-2026-8888",
      version: 1
    });
    quoteId = (quote as any).id;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. TOKEN GENERATION & EXPIRATION VALIDATION
  // ─────────────────────────────────────────────────────────────────────────────
  describe("1. Secure Expiring Access Token & by-token Endpoint", () => {
    it("should generate a publicAccessToken and publicAccessExpiresAt when quote is sent", async () => {
      const sendRes = await request(app)
        .post(`/api/v1/quotes/${quoteId}/send`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({ channel: "EMAIL" });

      expect(sendRes.status).toBe(200);

      const quote: any = await sequelize.models.Quote.findByPk(quoteId);
      expect(quote.publicAccessToken).toBeDefined();
      expect(quote.publicAccessToken.length).toBeGreaterThan(16);
      expect(quote.publicAccessExpiresAt).toBeDefined();
      expect(new Date(quote.publicAccessExpiresAt).getTime()).toBeGreaterThan(Date.now());
    });

    it("should return quote data via GET /api/v1/public/quotes/by-token/:token and mark status as Viewed", async () => {
      // 1. Send first
      await request(app)
        .post(`/api/v1/quotes/${quoteId}/send`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({ channel: "EMAIL" });

      const quoteBefore: any = await sequelize.models.Quote.findByPk(quoteId);
      const token = quoteBefore.publicAccessToken;

      // 2. Unauthenticated client access by token
      const res = await request(app).get(`/api/v1/public/quotes/by-token/${token}`);
      expect(res.status).toBe(200);
      expect(res.body.quoteNumber).toBe("QT-2026-8888");
      expect(res.body.status).toBe("Viewed");

      // Verify QuoteDelivery has VIEWED event
      const deliveries = await sequelize.models.QuoteDelivery.findAll({
        where: { quoteId },
        order: [["occurredAt", "ASC"]]
      });
      const statuses = deliveries.map((d: any) => d.status);
      expect(statuses).toContain("SENT");
      expect(statuses).toContain("VIEWED");
    });

    it("should return 410 Gone when accessing an expired token", async () => {
      // Create quote with expired token
      const expiredQuote: any = await sequelize.models.Quote.create({
        id: require("crypto").randomUUID(),
        dealId,
        status: "Sent",
        totalAmount: 50000,
        quoteNumber: "QT-EXPIRED-001",
        publicAccessToken: "expired_token_abc_123",
        publicAccessExpiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000) // 1 day ago
      });

      const res = await request(app).get(`/api/v1/public/quotes/by-token/${expiredQuote.publicAccessToken}`);
      expect(res.status).toBe(410);
      expect(res.body.expired).toBe(true);
      expect(res.body.error).toContain("expired");
    });

    it("should return 404 for non-existent token", async () => {
      const res = await request(app).get("/api/v1/public/quotes/by-token/non_existent_token_999");
      expect(res.status).toBe(404);
    });

    it("should preserve backward compatibility for old ID-based public endpoints", async () => {
      const res = await request(app).get(`/api/v1/public/quotes/${quoteId}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(quoteId);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. CUSTOMER SELF-SERVICE ACCEPTANCE & WON AUTOMATION
  // ─────────────────────────────────────────────────────────────────────────────
  describe("2. Unauthenticated Customer Acceptance (/by-token/:token/accept)", () => {
    it("should allow unauthenticated customer to accept quote, log CUSTOMER_SELF_SERVICE delivery, and trigger Won stage", async () => {
      // 1. Send quote
      await request(app)
        .post(`/api/v1/quotes/${quoteId}/send`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({ channel: "EMAIL" });

      const quoteBefore: any = await sequelize.models.Quote.findByPk(quoteId);
      const token = quoteBefore.publicAccessToken;

      // 2. Customer accepts on public page without login
      const acceptRes = await request(app)
        .post(`/api/v1/public/quotes/by-token/${token}/accept`)
        .send({
          acceptedByName: "Faisal Al-Otaibi",
          acceptedByEmail: "faisal@otaibi.com"
        });

      expect(acceptRes.status).toBe(200);
      expect(acceptRes.body.success).toBe(true);

      // Verify Quote status is Accepted
      const updatedQuote: any = await sequelize.models.Quote.findByPk(quoteId);
      expect(updatedQuote.status).toBe("Accepted");
      expect(updatedQuote.acceptedAt).toBeDefined();

      // Verify QuoteDelivery row with CUSTOMER_SELF_SERVICE method
      const deliveries = await sequelize.models.QuoteDelivery.findAll({
        where: { quoteId, channel: "CUSTOMER_SELF_SERVICE" }
      });
      expect(deliveries.length).toBeGreaterThan(0);
      expect((deliveries[0] as any).notes).toContain("Faisal Al-Otaibi");

      // Verify Opportunity Won automation fired
      const updatedDeal: any = await sequelize.models.Deal.findByPk(dealId);
      expect(["Won", "WON"]).toContain(updatedDeal.status);
      expect(updatedDeal.stageId).toBe(wonStageId);
    });

    it("should reject customer acceptance if name or email is missing", async () => {
      const quote: any = await sequelize.models.Quote.create({
        id: require("crypto").randomUUID(),
        dealId,
        status: "Sent",
        totalAmount: 10000,
        publicAccessToken: "valid_token_test_acceptance"
      });

      const res = await request(app)
        .post(`/api/v1/public/quotes/by-token/${quote.publicAccessToken}/accept`)
        .send({ acceptedByName: "" });

      expect(res.status).toBe(400);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. CUSTOMER REVISION REQUESTS
  // ─────────────────────────────────────────────────────────────────────────────
  describe("3. Unauthenticated Customer Revision Request (/by-token/:token/request-changes)", () => {
    it("should set quote status to 'Revision Requested' and notify sales rep", async () => {
      // 1. Send quote
      await request(app)
        .post(`/api/v1/quotes/${quoteId}/send`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({ channel: "EMAIL" });

      const quoteBefore: any = await sequelize.models.Quote.findByPk(quoteId);
      const token = quoteBefore.publicAccessToken;

      // 2. Customer requests revision
      const revRes = await request(app)
        .post(`/api/v1/public/quotes/by-token/${token}/request-changes`)
        .send({
          message: "Please adjust scope for additional 5 user licenses",
          customerName: "Faisal Al-Otaibi",
          customerEmail: "faisal@otaibi.com"
        });

      expect(revRes.status).toBe(200);
      expect(revRes.body.success).toBe(true);

      const updatedQuote: any = await sequelize.models.Quote.findByPk(quoteId);
      expect(updatedQuote.status).toBe("Revision Requested");

      // Verify QuoteDelivery row logged
      const deliveries = await sequelize.models.QuoteDelivery.findAll({
        where: { quoteId }
      });
      const revisionDelivery = deliveries.find((d: any) =>
        (d.notes || "").includes("Please adjust scope")
      );
      expect(revisionDelivery).toBeDefined();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. INBOUND MESSAGE KEYWORD DETECTION (FLAG WITHOUT AUTO-ACCEPTING)
  // ─────────────────────────────────────────────────────────────────────────────
  describe("4. Inbound Message Acceptance Keyword Detection", () => {
    it("should flag a pinned activity note when inbound message contains positive confirmation phrases without auto-accepting", async () => {
      // 1. Quote is Sent
      await sequelize.models.Quote.update(
        { status: "Sent" },
        { where: { id: quoteId } }
      );

      // 2. Inbound email with "Please proceed with the quote"
      const inboundRes = await request(app)
        .post("/api/v1/emails/inbound")
        .set("x-inbound-secret", "nexus_inbound_email_secret_2026")
        .send({
          from: "Faisal Al-Otaibi <faisal@otaibi.com>",
          to: "sales@nexus.com",
          subject: "Quotation Review Feedback",
          text: "Thank you for the proposal. Everything looks great, please proceed with the quote!"
        });

      expect(inboundRes.status).toBe(201);

      // Verify quote is STILL Sent (never auto-accepted from message alone)
      const quoteAfter: any = await sequelize.models.Quote.findByPk(quoteId);
      expect(quoteAfter.status).toBe("Sent");

      // Verify pinned Activity prompt created on Lead
      const activities = await sequelize.models.Activity.findAll({
        where: { leadId, pinned: true }
      });

      const acceptancePrompt = activities.find((a: any) =>
        (a.outcome || "").includes("Possible quote acceptance detected")
      );
      expect(acceptancePrompt).toBeDefined();
      expect((acceptancePrompt as any).outcome).toContain("confirm to mark Quote");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. INTERNAL CONFIRMATION TAGGING (signQuote)
  // ─────────────────────────────────────────────────────────────────────────────
  describe("5. Internal Confirmation Tagging", () => {
    it("should tag QuoteDelivery channel as INTERNAL_CONFIRMED when staff confirms agreement", async () => {
      const signRes = await request(app)
        .post(`/api/v1/public/quotes/${quoteId}/sign`)
        .send({ signedBy: "Sales Manager John" });

      expect(signRes.status).toBe(200);

      const deliveries = await sequelize.models.QuoteDelivery.findAll({
        where: { quoteId, channel: "INTERNAL_CONFIRMED" }
      });
      expect(deliveries.length).toBe(1);
      expect((deliveries[0] as any).notes).toContain("internally by staff member");
    });
  });
});
