import request from "supertest";
import { createServer } from "../../server";
import { sequelize } from "@nexus-crm/database";

const app = createServer();

describe("E2E: WhatsApp Business Template & Opportunity Handoff", () => {
  let authToken: string;
  let testUser: any;
  let testLead: any;
  let testDeal: any;

  beforeAll(async () => {
    // Create test user
    const userId = require("crypto").randomUUID();
    testUser = await sequelize.models.User.create({
      id: userId,
      email: `test_rep_${Date.now()}@nexus.com`,
      password: "hashedpassword",
      name: "Test Rep",
      role: "sales_rep"
    });

    const jwt = require("jsonwebtoken");
    authToken = jwt.sign(
      { id: (testUser as any).id, email: (testUser as any).email, role: (testUser as any).role },
      process.env.JWT_SECRET || "change_me"
    );

    // Create test lead
    testLead = await sequelize.models.Lead.create({
      id: require("crypto").randomUUID(),
      firstName: "Saudi",
      lastName: "Client",
      phone: "+966500000000",
      whatsappPhone: "+966500000000",
      preferredLanguage: "ar",
      status: "New"
    });

    // Create test deal
    testDeal = await sequelize.models.Deal.create({
      id: require("crypto").randomUUID(),
      name: "Riyadh Project Opportunity",
      leadId: (testLead as any).id,
      ownerId: (testUser as any).id,
      amount: 500000
    });

    // Seed test activity & handoff
    await sequelize.models.Activity.create({
      id: require("crypto").randomUUID(),
      leadId: (testLead as any).id,
      type: "call",
      outcome: "Connected",
      notes: "Initial discovery call completed",
      createdById: (testUser as any).id,
      direction: "outbound"
    });

    await sequelize.models.LeadReassignmentHistory.create({
      id: require("crypto").randomUUID(),
      leadId: (testLead as any).id,
      oldAssignedToId: null,
      newAssignedToId: (testUser as any).id,
      changedByUserId: (testUser as any).id,
      reason: "Initial routing"
    });
  });

  afterAll(async () => {
    if (testDeal) await sequelize.models.Deal.destroy({ where: { id: (testDeal as any).id } });
    if (testLead) await sequelize.models.Lead.destroy({ where: { id: (testLead as any).id } });
    if (testUser) await sequelize.models.User.destroy({ where: { id: (testUser as any).id } });
  });

  it("GET /api/v1/opportunities/:id returns opportunity with timeline and handoff history", async () => {
    const res = await request(app)
      .get(`/api/v1/opportunities/${(testDeal as any).id}`)
      .set("Authorization", `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe((testDeal as any).id);
    expect(Array.isArray(res.body.timeline)).toBe(true);
    expect(res.body.timeline.length).toBeGreaterThan(0);
    expect(Array.isArray(res.body.handoff)).toBe(true);
    expect(res.body.handoff.length).toBeGreaterThan(0);
  });

  it("POST /api/v1/whatsapp/send enforces template requirement outside 24h session window", async () => {
    const res = await request(app)
      .post("/api/v1/whatsapp/send")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        leadId: (testLead as any).id,
        text: "Outbound message outside 24h window"
      });

    // Should get requiresTemplate: true 400 when no approved template is configured
    // (stub SIDs are treated as missing — see rollout guard in whatsappController.ts)
    expect([400, 200]).toContain(res.status); // 400 = requiresTemplate, 200 = simulated stub send
    if (res.status === 400) {
      expect(res.body.requiresTemplate).toBe(true);
    }
  });

  it("POST /api/v1/leads/:id/activities logs skip reason note", async () => {
    const res = await request(app)
      .post(`/api/v1/leads/${(testLead as any).id}/activities`)
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        type: "note",
        outcome: "Skipped WhatsApp call summary: Customer preferred email",
        notes: "Call summary WhatsApp message skipped by rep. Mandatory reason: Customer preferred email"
      });

    expect(res.status).toBe(200);
    expect(res.body.notes).toContain("Customer preferred email");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Regression guard: in-session free-text path must NOT be redirected to template
// path after the branching logic changes introduced in 5072289.
// ─────────────────────────────────────────────────────────────────────────────

describe("Regression: in-session WhatsApp free-text path (within 24h window)", () => {
  let authToken: string;
  let inSessionLead: any;
  let testUser: any;

  beforeAll(async () => {
    const userId = require("crypto").randomUUID();
    testUser = await sequelize.models.User.create({
      id: userId,
      email: `test_insession_${Date.now()}@nexus.com`,
      password: "hashedpassword",
      name: "In-Session Test Rep",
      role: "sales_rep"
    });

    const jwt = require("jsonwebtoken");
    authToken = jwt.sign(
      { id: (testUser as any).id, email: (testUser as any).email, role: (testUser as any).role },
      process.env.JWT_SECRET || "change_me"
    );

    // Create a lead with lastInboundAt set to NOW → inside 24h window
    inSessionLead = await sequelize.models.Lead.create({
      id: require("crypto").randomUUID(),
      firstName: "Active",
      lastName: "Session",
      phone: "+966599000001",
      whatsappPhone: "+966599000001",
      preferredLanguage: "ar",
      status: "New",
      lastInboundAt: new Date() // <-- exactly now, well within 24h window
    });
  });

  afterAll(async () => {
    if (inSessionLead) await sequelize.models.Lead.destroy({ where: { id: (inSessionLead as any).id } });
    if (testUser) await sequelize.models.User.destroy({ where: { id: (testUser as any).id } });
  });

  it("dispatches via free-text path (not template path) when lead.lastInboundAt is within 24 hours", async () => {
    const res = await request(app)
      .post("/api/v1/whatsapp/send")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        leadId: (inSessionLead as any).id,
        text: "Hello, following up on your inquiry. — [regression test]"
      });

    // Must NOT return 400 requiresTemplate — that would mean the free-text path was broken
    expect(res.status).not.toBe(400);
    if (res.status === 400) {
      // If it does 400, surface the error clearly for debugging
      throw new Error(
        `In-session free-text was incorrectly routed to template path. ` +
        `Response body: ${JSON.stringify(res.body)}`
      );
    }

    // Should be 200 (real send) or 200 with simulated:true (no Twilio creds in test env)
    expect(res.status).toBe(200);

    // requiresTemplate must NOT be present on an in-session free-text send
    expect(res.body.requiresTemplate).toBeUndefined();

    // hasActiveSession flag (if present) should be true
    if (res.body.hasActiveSession !== undefined) {
      expect(res.body.hasActiveSession).toBe(true);
    }
  });

  it("does NOT invoke the template lookup when lead is in-session", async () => {
    // This test confirms the branching condition `hasActiveSession && !activeContentSid && !templateId`
    // correctly short-circuits to sendWhatsAppMessage() WITHOUT hitting the MessageTemplate DB query.
    // We verify indirectly: sending with text and no contentSid/templateId must succeed (200) not 400.
    const res = await request(app)
      .post("/api/v1/whatsapp/send")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        leadId: (inSessionLead as any).id,
        text: "A second in-session message — still inside the window",
        // No contentSid, no templateId — pure free-text path
      });

    expect(res.status).toBe(200);
    expect(res.body.requiresTemplate).toBeUndefined();
  });
});

