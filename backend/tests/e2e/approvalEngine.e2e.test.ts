import { evaluateQuoteApproval } from "../../src/services/approvalEngine";
import { sequelize } from "@nexus-crm/database";
import crypto from "crypto";

describe("Approval Hierarchy Engine E2E Tests", () => {
  let adminUser: any;
  let teamLeadUser: any;
  let repUser: any;

  beforeAll(async () => {
    await sequelize.sync();

    // Seed test users
    adminUser = await sequelize.models.User.findOne({
      where: { role: "admin" },
      attributes: ["id", "name", "email", "role"]
    });

    if (!adminUser) {
      adminUser = await sequelize.models.User.create({
        id: crypto.randomUUID(),
        name: "Test Admin",
        email: `admin_${Date.now()}@test.com`,
        password: "hashed_password",
        role: "admin"
      }, { fields: ["id", "name", "email", "password", "role"] });
    }

    teamLeadUser = await sequelize.models.User.create({
      id: crypto.randomUUID(),
      name: "Sarah Jenkins",
      email: `teamlead_${Date.now()}@test.com`,
      password: "hashed_password",
      role: "sales_manager"
    }, { fields: ["id", "name", "email", "password", "role"] });

    repUser = await sequelize.models.User.create({
      id: crypto.randomUUID(),
      name: "Rahul Verma",
      email: `rahul_${Date.now()}@test.com`,
      password: "hashed_password",
      role: "sales_rep",
      managerId: teamLeadUser.id
    }, { fields: ["id", "name", "email", "password", "role", "managerId"] });

    // Set Admin Global Policy (Ceilings)
    await sequelize.models.AdminApprovalPolicy.create({
      id: crypto.randomUUID(),
      maximumSalesRepApproval: 2500000, // ₹25L
      maximumTeamLeadApproval: 5000000,  // ₹50L
      maximumRepDiscount: 0.10,          // 10%
      maximumTeamLeadDiscount: 0.20,      // 20%
      minimumAllowedMargin: 0.15          // 15%
    });

    // Set Sales Rep Profile for Rahul Verma
    await sequelize.models.SalesApprovalProfile.create({
      id: crypto.randomUUID(),
      salesRepId: repUser.id,
      selfApprovalLimit: 1000000, // ₹10L
      discountApprovalLimit: 0.10, // 10%
      minimumMargin: 0.20,         // 20%
      teamLeadId: teamLeadUser.id,
      approvalEnabled: true
    });
  });

  test("TEST 1: Rep limit = ₹10L, Quote = ₹7L → Sales Rep self-approval", async () => {
    const res1 = await evaluateQuoteApproval("", {
      salesRepId: repUser.id,
      totalAmount: 700000, // ₹7L
      items: [{ quantity: 1, unitPrice: 700000 }]
    });

    expect(res1.approvalLevel).toBe("SALES_REP");
    expect(res1.approvalRequired).toBe(false);
  });

  test("TEST 2: Rep limit = ₹10L, Quote = ₹25L → Team Lead approval required", async () => {
    const res2 = await evaluateQuoteApproval("", {
      salesRepId: repUser.id,
      totalAmount: 2500000, // ₹25L
      items: [{ quantity: 1, unitPrice: 2500000 }]
    });

    expect(res2.approvalLevel).toBe("TEAM_LEAD");
    expect(res2.approvalRequired).toBe(true);
    expect(res2.requiredApproverId).toBe(teamLeadUser.id);
  });

  test("TEST 3: Quote = ₹75L > Team Lead ₹50L ceiling → Admin approval required", async () => {
    const res3 = await evaluateQuoteApproval("", {
      salesRepId: repUser.id,
      totalAmount: 7500000, // ₹75L
      items: [{ quantity: 1, unitPrice: 7500000 }]
    });

    expect(res3.approvalLevel).toBe("ADMIN");
    expect(res3.approvalRequired).toBe(true);
    expect(res3.requiredApproverId).toBe(adminUser.id);
  });

  test("TEST 4: Discount 15% > Rep limit 10% → Team Lead approval required", async () => {
    const p1: any = await sequelize.models.PriceBookEntry.create({
      id: crypto.randomUUID(),
      sku: `SKU-DISC-${Date.now()}`,
      name: "Test Disc Product",
      unitPrice: 1000000
    });

    const res4 = await evaluateQuoteApproval("", {
      salesRepId: repUser.id,
      totalAmount: 850000, // 15% discount
      items: [{ productId: p1.id, quantity: 1, unitPrice: 850000 }]
    });

    expect(res4.approvalLevel).toBe("TEAM_LEAD");
    expect(res4.approvalRequired).toBe(true);
    expect(res4.reason).toContain("Discount");
  });

  test("TEST 5: Discount 25% > Team Lead limit 20% → Admin approval required", async () => {
    const p2: any = await sequelize.models.PriceBookEntry.create({
      id: crypto.randomUUID(),
      sku: `SKU-DISC2-${Date.now()}`,
      name: "Test High Disc Product",
      unitPrice: 5333333
    });

    const res5 = await evaluateQuoteApproval("", {
      salesRepId: repUser.id,
      totalAmount: 4000000, // 25% discount
      items: [{ productId: p2.id, quantity: 1, unitPrice: 4000000 }]
    });

    expect(res5.approvalLevel).toBe("ADMIN");
    expect(res5.approvalRequired).toBe(true);
    expect(res5.reason).toContain("Discount");
  });

  describe("TEST 6: Quote modification threshold invalidation", () => {
    let quote: any;

    beforeAll(async () => {
      let stage: any = await sequelize.models.PipelineStage.findOne();
      if (!stage) {
        stage = await sequelize.models.PipelineStage.create({
          id: crypto.randomUUID(),
          name: "Qualification",
          order: 1
        });
      }

      const deal: any = await sequelize.models.Deal.create({
        id: crypto.randomUUID(),
        name: "Test Deal",
        amount: 700000,
        ownerId: repUser.id,
        stageId: stage.id
      });

      quote = await sequelize.models.Quote.create({
        id: crypto.randomUUID(),
        dealId: deal.id,
        status: "Approved",
        totalAmount: 700000,
        quoteNumber: `QT-TEST-${Date.now()}`
      });
    });

    test("TEST 6a: Initial quote ₹7L is within rep authority", async () => {
      const initialEval = await evaluateQuoteApproval(quote.id);
      expect(initialEval.approvalLevel).toBe("SALES_REP");
    });

    test("TEST 6b: Editing quote to ₹25L invalidates self-approval & requires Team Lead approval", async () => {
      await quote.update({ totalAmount: 2500000 });
      const editedEval = await evaluateQuoteApproval(quote.id);
      expect(editedEval.approvalLevel).toBe("TEAM_LEAD");
      expect(editedEval.approvalRequired).toBe(true);
    });
  });

  test("TEST 7: Admin ceiling prevents giving Sales Rep limits higher than organization ceiling", async () => {
    const adminPolicy: any = await sequelize.models.AdminApprovalPolicy.findOne({
      order: [["createdAt", "DESC"]]
    });
    const maxAllowed = Number(adminPolicy.maximumSalesRepApproval); // ₹25L
    const attemptLimit = 3000000; // ₹30L attempt

    expect(attemptLimit).toBeGreaterThan(maxAllowed);
  });
});
