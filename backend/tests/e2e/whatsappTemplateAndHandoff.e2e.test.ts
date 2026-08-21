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

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.hasActiveSession).toBe(false);
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
