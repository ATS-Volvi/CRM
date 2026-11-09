process.env.USE_SQLITE = "true";
process.env.DB_DIALECT = "sqlite";

import request from "supertest";
import { createServer } from "../../server";
import { sequelize } from "@nexus-crm/database";
import jwt from "jsonwebtoken";
import crypto from "crypto";

describe("Field Service Gated Initiation E2E Tests (Deal Won & Asset Repair)", () => {
  let app: any;
  let adminToken: string;
  let repToken: string;
  let testAdminUser: any;
  let testRepUser: any;
  let testAccount: any;
  let testContact: any;
  let testAsset: any;

  beforeAll(async () => {
    app = createServer();

    testAdminUser = await sequelize.models.User.create({
      id: crypto.randomUUID(),
      name: "Field Admin",
      email: `field_admin_${Date.now()}@nexus.test`,
      password: "password123",
      role: "admin",
    });

    testRepUser = await sequelize.models.User.create({
      id: crypto.randomUUID(),
      name: "Field Rep",
      email: `field_rep_${Date.now()}@nexus.test`,
      password: "password123",
      role: "sales_rep",
    });

    testAccount = await sequelize.models.Account.create({
      id: crypto.randomUUID(),
      name: "Atlas Heavy Machinery Rentals",
      email: "ops@atlasrentals.com",
      phone: "+91 98765 43210",
      street: "Plot 42, Industrial Zone",
      city: "Jubail",
      state: "Eastern Province",
      postalCode: "31951",
      country: "Saudi Arabia",
    });

    testContact = await sequelize.models.Contact.create({
      id: crypto.randomUUID(),
      accountId: testAccount.id,
      firstName: "Fahad",
      lastName: "Al-Otaibi",
      email: "fahad@atlasrentals.com",
      phone: "+91 98765 43211",
    });

    testAsset = await sequelize.models.Asset.create({
      id: crypto.randomUUID(),
      name: "Diesel Generator 500kVA",
      type: "Heavy Equipment",
      serialNumber: "SN-GEN-9921",
      status: "Deployed",
      condition: "Good",
      customerId: testAccount.id,
    });

    // Generate JWTs directly
    const jwtSecret = process.env.JWT_SECRET || "default_secret";
    adminToken = jwt.sign(
      { id: testAdminUser.id, email: testAdminUser.email, role: "admin" },
      jwtSecret
    );
    repToken = jwt.sign(
      { id: testRepUser.id, email: testRepUser.email, role: "sales_rep" },
      jwtSecret
    );
  });

  test("1. Create Work Order accepts and persists workOrderType", async () => {
    const res = await request(app)
      .post("/api/v1/work-orders")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        subject: "Routine Maintenance for Atlas Generator",
        workOrderType: "Maintenance",
        priority: "High",
        accountId: testAccount.id,
        contactId: testContact.id,
        assetId: testAsset.id,
      });

    expect(res.status).toBe(201);
    expect(res.body.workOrderType).toBe("Maintenance");
    expect(res.body.subject).toBe("Routine Maintenance for Atlas Generator");
    expect(res.body.assetId).toBe(testAsset.id);
  });

  test("2. Opportunity Closed Won with createInstallationWorkOrder: true automatically drafts Installation Work Order", async () => {
    const opp: any = await sequelize.models.Deal.create({
      id: crypto.randomUUID(),
      name: "Rental - 3x Mobile Water Pumps",
      amount: 45000,
      stage: "Negotiation",
      status: "OPEN",
      accountId: testAccount.id,
      contactId: testContact.id,
      ownerId: testRepUser.id,
    });

    const markWonRes = await request(app)
      .post(`/api/v1/opportunities/${opp.id}/mark-won`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        reason: "CONTRACT_SIGNED",
        createInstallationWorkOrder: true,
        workOrderNotes: "Deliver and commission at Jubail Site Gate 3",
        city: "Jubail",
      });

    expect(markWonRes.status).toBe(200);

    // Verify Work Order was drafted
    const createdWo: any = await sequelize.models.WorkOrder.findOne({
      where: { dealId: opp.id },
    });

    expect(createdWo).not.toBeNull();
    expect(createdWo.workOrderType).toBe("Installation");
    expect(createdWo.accountId).toBe(testAccount.id);
    expect(createdWo.subject).toContain("Installation & Setup");
    expect(createdWo.description).toContain("Jubail Site Gate 3");
    expect(createdWo.city).toBe("Jubail");
    expect(createdWo.status).toBe("New");
  });

  test("3. Opportunity Closed Won WITHOUT createInstallationWorkOrder (Waste Disposal Deal) does NOT create any Work Order", async () => {
    const wasteDeal: any = await sequelize.models.Deal.create({
      id: crypto.randomUUID(),
      name: "Industrial Sewage Disposal - 6 Month Contract",
      amount: 120000,
      stage: "Negotiation",
      status: "OPEN",
      accountId: testAccount.id,
      contactId: testContact.id,
      ownerId: testRepUser.id,
    });

    const markWonRes = await request(app)
      .post(`/api/v1/opportunities/${wasteDeal.id}/mark-won`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        reason: "QUOTE_ACCEPTED",
        createInstallationWorkOrder: false, // Waste disposal does not need technician installation!
      });

    expect(markWonRes.status).toBe(200);

    // Verify NO Work Order was created for this deal
    const noWo = await sequelize.models.WorkOrder.findOne({
      where: { dealId: wasteDeal.id },
    });

    expect(noWo).toBeNull();
  });

  test("4. Asset breakdown repair dispatch creates Work Order with type 'Repair'", async () => {
    const res = await request(app)
      .post("/api/v1/work-orders")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        subject: `Repair & Fix: ${testAsset.name} (${testAsset.serialNumber})`,
        workOrderType: "Repair",
        priority: "Critical",
        accountId: testAccount.id,
        contactId: testContact.id,
        assetId: testAsset.id,
        description: "Generator smoking and shutdown automatically on customer site.",
      });

    expect(res.status).toBe(201);
    expect(res.body.workOrderType).toBe("Repair");
    expect(res.body.priority).toBe("Critical");
    expect(res.body.assetId).toBe(testAsset.id);
    expect(res.body.subject).toContain("Repair & Fix");
  });
});
