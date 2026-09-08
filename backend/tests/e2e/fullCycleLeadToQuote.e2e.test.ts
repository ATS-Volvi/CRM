import request from "supertest";
import { createServer } from "../../server";
import { sequelize } from "@nexus-crm/database";
import * as emailService from "../../src/services/emailService";
import * as whatsappService from "../../src/services/whatsappService";
import jwt from "jsonwebtoken";

const app = createServer();

describe("Full Commercial Lifecycle: Lead to Quote E2E", () => {
  let sendEmailSpy: jest.SpyInstance;
  let sendWhatsAppSpy: jest.SpyInstance;

  let qualifyingRep: any;
  let closerRep1: any;
  let closerRep2: any;

  let qualifyingRepToken: string;
  let closerRep1Token: string;
  let closerRep2Token: string;

  beforeAll(async () => {
    // Mock external network dispatchers
    sendEmailSpy = jest.spyOn(emailService, "sendEmail").mockResolvedValue({ id: "mock-email-id" } as any);
    sendWhatsAppSpy = jest.spyOn(whatsappService, "sendWhatsAppMessage").mockResolvedValue({ success: true, messageId: "SM123" } as any);

    // Ensure database connection
    if (!sequelize.models.User) {
      await sequelize.sync();
    }

    const timestamp = Date.now();

    // 1. Seed qualifying rep (role: salesperson)
    qualifyingRep = await sequelize.models.User.create({
      id: require("crypto").randomUUID(),
      name: `Salesman 1 (Qualifying Rep ${timestamp})`,
      email: `qualifying_rep_${timestamp}@nexus.com`,
      password: "hashedpassword123",
      role: "salesperson",
      isAvailable: true,
      status: "Active",
      maxOpenDeals: 20,
      dealValueCutoff: null
    });

    // 2. Seed candidate closer rep 1 (role: salesperson - NO senior_ae promotion!)
    closerRep1 = await sequelize.models.User.create({
      id: require("crypto").randomUUID(),
      name: `Salesman 2 (Closer 1 ${timestamp})`,
      email: `closer_rep1_${timestamp}@nexus.com`,
      password: "hashedpassword123",
      role: "salesperson",
      isAvailable: true,
      status: "Active",
      maxOpenDeals: 20,
      dealValueCutoff: null
    });

    // 3. Seed candidate closer rep 2 (role: salesperson - NO senior_ae promotion!)
    closerRep2 = await sequelize.models.User.create({
      id: require("crypto").randomUUID(),
      name: `Salesman 3 (Closer 2 ${timestamp})`,
      email: `closer_rep2_${timestamp}@nexus.com`,
      password: "hashedpassword123",
      role: "salesperson",
      isAvailable: true,
      status: "Active",
      maxOpenDeals: 20,
      dealValueCutoff: null
    });

    const jwtSecret = process.env.JWT_SECRET || "change_me";

    qualifyingRepToken = jwt.sign(
      { id: qualifyingRep.id, email: qualifyingRep.email, role: qualifyingRep.role },
      jwtSecret
    );

    closerRep1Token = jwt.sign(
      { id: closerRep1.id, email: closerRep1.email, role: closerRep1.role },
      jwtSecret
    );

    closerRep2Token = jwt.sign(
      { id: closerRep2.id, email: closerRep2.email, role: closerRep2.role },
      jwtSecret
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    sendEmailSpy.mockRestore();
    sendWhatsAppSpy.mockRestore();
  });

  test("1. Full 12-Step Lead-to-Quote Commercial Lifecycle with 3-Way Total Consistency Assertions", async () => {
    // Step 1: Lead Ingestion (POST /public/leads)
    const leadRes = await request(app)
      .post("/api/v1/public/leads")
      .send({
        firstName: "Acme",
        lastName: "Enterprise",
        email: `procurement_${Date.now()}@acme.com`,
        phone: "+966501112233",
        company: "Acme Middle East Industrial",
        source: "Website",
        industry: "Manufacturing",
        assignedToId: qualifyingRep.id
      });

    expect(leadRes.status).toBe(201);
    const leadId = leadRes.body.leadId || leadRes.body.data?.id || leadRes.body.id;
    expect(leadId).toBeDefined();

    // Step 2: Qualification Activity Prerequisite Enforcement
    // Attempt qualification without logging activity -> MUST BE BLOCKED (Status 400)
    const unactiveQualifyRes = await request(app)
      .post(`/api/v1/leads/${leadId}/qualify`)
      .set("Authorization", `Bearer ${qualifyingRepToken}`)
      .send({
        estimatedValue: 750000,
        dealName: "Acme Expansion Deal",
        accountName: "Acme Middle East Industrial"
      });

    expect(unactiveQualifyRes.status).toBe(400);
    expect(unactiveQualifyRes.body.error || unactiveQualifyRes.body.message).toContain("activity");

    // Log mandatory activity (POST /api/v1/activities)
    const activityRes = await request(app)
      .post("/api/v1/activities")
      .set("Authorization", `Bearer ${qualifyingRepToken}`)
      .send({
        entityType: "LEAD",
        entityId: leadId,
        type: "call",
        notes: "Discovery call completed with Procurement VP. Budget and timeline validated.",
        outcome: "Qualified"
      });

    expect(activityRes.status).toBe(201);

    // Step 3: Qualify Lead & Auto-Convert to Opportunity
    const qualifyRes = await request(app)
      .post(`/api/v1/leads/${leadId}/qualify`)
      .set("Authorization", `Bearer ${qualifyingRepToken}`)
      .send({
        estimatedValue: 750000,
        dealName: "Acme Expansion Deal",
        accountName: "Acme Middle East Industrial"
      });

    if (qualifyRes.status !== 200) {
      console.log("QUALIFY FAILED BODY:", qualifyRes.body);
    }
    expect(qualifyRes.status).toBe(200);
    const deal = qualifyRes.body.data?.deal || qualifyRes.body.deal || qualifyRes.body;
    const dealId = deal.id;
    expect(dealId).toBeDefined();

    // HARD ASSERTION FOR CHANGE 2: Deal.amount MUST BE A VALID NUMERIC NUMBER (NOT NaN!)
    expect(typeof deal.amount).toBe("number");
    expect(isNaN(deal.amount)).toBe(false);
    expect(deal.amount).toBe(750000);

    // HARD ASSERTION FOR CHANGE 1: Closer Auto-Assignment triggered automatically on conversion!
    const autoAssignOutcome = qualifyRes.body.autoAssignResult;
    expect(autoAssignOutcome).toBeDefined();
    expect(autoAssignOutcome.assigned).toBe(true);

    const assignedCloserId = autoAssignOutcome.newOwnerId || deal.ownerId;
    expect(assignedCloserId).toBeDefined();
    expect(assignedCloserId).not.toBe(qualifyingRep.id); // Qualifying rep explicitly excluded!
    expect([closerRep1.id, closerRep2.id]).toContain(assignedCloserId);

    const winningToken = assignedCloserId === closerRep1.id ? closerRep1Token : closerRep2Token;

    // Step 5: Winning Rep Opens Dashboard (GET /api/v1/opportunities/:id)
    const oppRes = await request(app)
      .get(`/api/v1/opportunities/${dealId}`)
      .set("Authorization", `Bearer ${winningToken}`);

    expect(oppRes.status).toBe(200);
    const fetchedOpp = oppRes.body.data || oppRes.body;
    expect(fetchedOpp.id).toBe(dealId);

    // Step 6: Create Quote with Line Item Discount & Tax (POST /api/v1/opportunities/:id/quotes)
    // Line Item 1: Qty 10, UnitPrice 65,000, 0% discount, 15% tax
    // Line Item 2: Qty 1, UnitPrice 100,000, 5% discount, 15% tax
    // Mathematical Expected Total = (650,000 - 0 + 97,500) + (100,000 - 5,000 + 14,250) = 747,500 + 109,250 = 856,750 EXACT.
    const createQuoteRes = await request(app)
      .post(`/api/v1/opportunities/${dealId}/quotes`)
      .set("Authorization", `Bearer ${winningToken}`)
      .send({
        items: [
          {
            quantity: 10,
            unitPrice: 65000,
            discount: 0,
            tax: 15,
            isOptional: false
          },
          {
            quantity: 1,
            unitPrice: 100000,
            discount: 5,
            tax: 15,
            isOptional: false
          }
        ]
      });

    expect(createQuoteRes.status).toBe(201);
    const quote = createQuoteRes.body.data || createQuoteRes.body.quote || createQuoteRes.body;
    const quoteId = quote.id;
    expect(quoteId).toBeDefined();

    // Step 7: Send Quote (POST /api/v1/quotes/:id/send)
    const sendRes = await request(app)
      .post(`/api/v1/quotes/${quoteId}/send`)
      .set("Authorization", `Bearer ${winningToken}`)
      .send({ channel: "EMAIL" });

    expect(sendRes.status).toBe(200);
    const quoteDb: any = await sequelize.models.Quote.findByPk(quoteId);
    const publicToken = sendRes.body.data?.publicToken || sendRes.body.publicToken || quote.publicAccessToken || quoteDb?.publicAccessToken;
    expect(publicToken).toBeDefined();

    // Step 8: Total Consistency Check (Bug 2 Regression Guard)
    // 1. Raw DB row
    const rawQuoteDb: any = await sequelize.models.Quote.findByPk(quoteId);
    const rawDbTotal = Number(rawQuoteDb.totalAmount);

    // 2. Authenticated GET /api/v1/quotes/:id
    const authQuoteRes = await request(app)
      .get(`/api/v1/quotes/${quoteId}`)
      .set("Authorization", `Bearer ${winningToken}`);

    expect(authQuoteRes.status).toBe(200);
    const authQuoteData = authQuoteRes.body.data || authQuoteRes.body;
    const authTotal = Number(authQuoteData.totalAmount);

    // 3. Customer-facing unauthenticated GET /api/v1/public/quotes/by-token/:token
    const publicQuoteRes = await request(app)
      .get(`/api/v1/public/quotes/by-token/${publicToken}`);

    expect(publicQuoteRes.status).toBe(200);
    const publicQuoteData = publicQuoteRes.body.data || publicQuoteRes.body;
    const publicTotal = Number(publicQuoteData.totalAmount);

    // HARD REGRESSION ASSERTIONS FOR BUG 2
    expect(rawDbTotal).toBe(856750);
    expect(authTotal).toBe(856750);
    expect(publicTotal).toBe(856750);
    expect(rawDbTotal).toBe(authTotal);
    expect(authTotal).toBe(publicTotal);

    // Step 9: Customer Requests Changes (POST /api/v1/public/quotes/by-token/:token/request-changes)
    const reqChangesRes = await request(app)
      .post(`/api/v1/public/quotes/by-token/${publicToken}/request-changes`)
      .send({ notes: "Please apply a 10% discount to item 2." });

    expect(reqChangesRes.status).toBe(200);

    // Step 10: Rep Issues Revision & Re-sends (POST /api/v1/quotes/:id/create-revision)
    const revisionRes = await request(app)
      .post(`/api/v1/quotes/${quoteId}/create-revision`)
      .set("Authorization", `Bearer ${winningToken}`)
      .send({
        items: [
          {
            quantity: 10,
            unitPrice: 65000,
            discount: 0,
            tax: 15,
            isOptional: false
          },
          {
            quantity: 1,
            unitPrice: 100000,
            discount: 10, // Increased discount to 10%
            tax: 15,
            isOptional: false
          }
        ]
      });

    expect(revisionRes.status).toBe(201);
    const revisedQuote = revisionRes.body.data || revisionRes.body.quote || revisionRes.body;
    const revisedQuoteId = revisedQuote.id;
    expect(revisedQuoteId).toBeDefined();

    const sendRevisionRes = await request(app)
      .post(`/api/v1/quotes/${revisedQuoteId}/send`)
      .set("Authorization", `Bearer ${winningToken}`)
      .send({ channel: "EMAIL" });

    expect(sendRevisionRes.status).toBe(200);
    const revisedQuoteDb: any = await sequelize.models.Quote.findByPk(revisedQuoteId);
    const revisedPublicToken = sendRevisionRes.body.data?.publicToken || sendRevisionRes.body.publicToken || revisedQuote.publicAccessToken || revisedQuoteDb?.publicAccessToken;
    expect(revisedPublicToken).toBeDefined();

    // Re-assert 3-Way Total Consistency on Revision
    // Item 1 total: 747,500
    // Item 2: 100,000 - 10,000 = 90,000 + 13,500 tax = 103,500
    // Revised Total = 747,500 + 103,500 = 851,000
    const rawRevisedDb: any = await sequelize.models.Quote.findByPk(revisedQuoteId);
    const rawRevisedTotal = Number(rawRevisedDb.totalAmount);

    const authRevisedRes = await request(app)
      .get(`/api/v1/quotes/${revisedQuoteId}`)
      .set("Authorization", `Bearer ${winningToken}`);
    const authRevisedTotal = Number((authRevisedRes.body.data || authRevisedRes.body).totalAmount);

    const publicRevisedRes = await request(app)
      .get(`/api/v1/public/quotes/by-token/${revisedPublicToken}`);
    const publicRevisedTotal = Number((publicRevisedRes.body.data || publicRevisedRes.body).totalAmount);

    expect(rawRevisedTotal).toBe(851000);
    expect(authRevisedTotal).toBe(851000);
    expect(publicRevisedTotal).toBe(851000);
    expect(rawRevisedTotal).toBe(authRevisedTotal);
    expect(authRevisedTotal).toBe(publicRevisedTotal);

    // Step 11: Customer Accepts Quote (POST /api/v1/public/quotes/by-token/:token/accept)
    const acceptRes = await request(app)
      .post(`/api/v1/public/quotes/by-token/${revisedPublicToken}/accept`)
      .send({ acceptedByName: "Procurement VP", acceptedByEmail: "procurement@acme.com" });

    expect(acceptRes.status).toBe(200);

    // Step 12: Opportunity Marked Won (POST /api/v1/opportunities/:id/mark-won)
    const markWonRes = await request(app)
      .post(`/api/v1/opportunities/${dealId}/mark-won`)
      .set("Authorization", `Bearer ${winningToken}`)
      .send({ winningQuoteId: revisedQuoteId });

    expect(markWonRes.status).toBe(200);
  });

  test("2. dealValueCutoff Guardrail Regression Test", async () => {
    const timestamp = Date.now();

    // 1. Create a high-value deal worth $5,000,000 (5M)
    const dealId = require("crypto").randomUUID();
    const highValueDeal = await sequelize.models.Deal.create({
      id: dealId,
      name: `Mega Enterprise Expansion ${timestamp}`,
      amount: 5000000,
      ownerId: qualifyingRep.id
    });

    // 2. Set strict dealValueCutoff of $100,000 on ALL closer reps
    await sequelize.models.User.update(
      { dealValueCutoff: 100000 },
      { where: { id: [closerRep1.id, closerRep2.id, qualifyingRep.id] } }
    );

    // 3. Call auto-assign endpoint for the $5M deal
    const autoAssignRes = await request(app)
      .post(`/api/v1/deals/${dealId}/auto-assign`)
      .set("Authorization", `Bearer ${qualifyingRepToken}`)
      .send({});

    // 4. Assert deal auto-assignment is rejected due to dealValueCutoff gate
    expect(autoAssignRes.status).toBe(200);
    expect(autoAssignRes.body.assigned).toBe(false);

    const reason = autoAssignRes.body.reason || autoAssignRes.body.message || "";
    expect(reason.toLowerCase()).toMatch(/cutoff|capacity|no eligible|unassigned/);
  });
});
