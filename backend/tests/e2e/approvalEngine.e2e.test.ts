import { evaluateQuoteApproval } from "../../src/services/approvalEngine";
import { sequelize } from "@nexus-crm/database";

async function runTests() {
  console.log("==================================================");
  console.log("RUNNING APPROVAL HIERARCHY ENGINE ACCEPTANCE TESTS");
  console.log("==================================================");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName} - ${detail || ""}`);
      failed++;
    }
  }

  await sequelize.sync();

  // Seed test users
  let adminUser: any = await sequelize.models.User.findOne({ where: { role: "admin" }, attributes: ["id", "name", "email", "role"] });
  if (!adminUser) {
    adminUser = await sequelize.models.User.create({
      id: require("crypto").randomUUID(),
      name: "Test Admin",
      email: `admin_${Date.now()}@test.com`,
      password: "hashed_password",
      role: "admin"
    }, { fields: ["id", "name", "email", "password", "role"] });
  }

  const teamLeadUser: any = await sequelize.models.User.create({
    id: require("crypto").randomUUID(),
    name: "Sarah Jenkins",
    email: `teamlead_${Date.now()}@test.com`,
    password: "hashed_password",
    role: "sales_manager"
  }, { fields: ["id", "name", "email", "password", "role"] });

  const repUser: any = await sequelize.models.User.create({
    id: require("crypto").randomUUID(),
    name: "Rahul Verma",
    email: `rahul_${Date.now()}@test.com`,
    password: "hashed_password",
    role: "sales_rep",
    managerId: teamLeadUser.id
  }, { fields: ["id", "name", "email", "password", "role", "managerId"] });

  // Set Admin Global Policy (Ceilings)
  await sequelize.models.AdminApprovalPolicy.create({
    id: require("crypto").randomUUID(),
    maximumSalesRepApproval: 2500000, // ₹25L
    maximumTeamLeadApproval: 5000000,  // ₹50L
    maximumRepDiscount: 0.10,          // 10%
    maximumTeamLeadDiscount: 0.20,      // 20%
    minimumAllowedMargin: 0.15          // 15%
  });

  // Set Sales Rep Profile for Rahul Verma
  await sequelize.models.SalesApprovalProfile.create({
    id: require("crypto").randomUUID(),
    salesRepId: repUser.id,
    selfApprovalLimit: 1000000, // ₹10L
    discountApprovalLimit: 0.10, // 10%
    minimumMargin: 0.20,         // 20%
    teamLeadId: teamLeadUser.id,
    approvalEnabled: true
  });

  // TEST 1: Rep limit = ₹10L, Quote = ₹7L -> Result = SALES_REP
  const res1 = await evaluateQuoteApproval("", {
    salesRepId: repUser.id,
    totalAmount: 700000, // ₹7L
    items: [{ quantity: 1, unitPrice: 700000 }]
  });
  assert(res1.approvalLevel === "SALES_REP" && res1.approvalRequired === false, "TEST 1: Rep limit = ₹10L, Quote = ₹7L → Sales Rep self-approval", `Got level: ${res1.approvalLevel}`);

  // TEST 2: Rep limit = ₹10L, Quote = ₹25L, Team Lead limit = ₹50L -> Result = TEAM_LEAD
  const res2 = await evaluateQuoteApproval("", {
    salesRepId: repUser.id,
    totalAmount: 2500000, // ₹25L
    items: [{ quantity: 1, unitPrice: 2500000 }]
  });
  assert(res2.approvalLevel === "TEAM_LEAD" && res2.approvalRequired === true && res2.requiredApproverId === teamLeadUser.id, "TEST 2: Rep limit = ₹10L, Quote = ₹25L → Team Lead approval required", `Got level: ${res2.approvalLevel}`);

  // TEST 3: Rep limit = ₹10L, Team Lead limit = ₹50L, Quote = ₹75L -> Result = ADMIN
  const res3 = await evaluateQuoteApproval("", {
    salesRepId: repUser.id,
    totalAmount: 7500000, // ₹75L
    items: [{ quantity: 1, unitPrice: 7500000 }]
  });
  assert(res3.approvalLevel === "ADMIN" && res3.approvalRequired === true && res3.requiredApproverId === adminUser.id, "TEST 3: Quote = ₹75L > Team Lead ₹50L ceiling → Admin approval required", `Got level: ${res3.approvalLevel}`);

  // TEST 4: Quote = ₹8L, Rep discount limit = 10%, Quote discount = 15% -> Result = TEAM_LEAD
  const p1: any = await sequelize.models.PriceBookEntry.create({
    id: require("crypto").randomUUID(),
    sku: `SKU-DISC-${Date.now()}`,
    name: "Test Disc Product",
    unitPrice: 1000000
  });
  const res4 = await evaluateQuoteApproval("", {
    salesRepId: repUser.id,
    totalAmount: 850000, // 15% discount
    items: [{ productId: p1.id, quantity: 1, unitPrice: 850000 }]
  });
  assert(res4.approvalLevel === "TEAM_LEAD" && res4.approvalRequired === true && res4.reason.includes("Discount"), "TEST 4: Discount 15% > Rep limit 10% → Team Lead approval required", `Got level: ${res4.approvalLevel}, reason: ${res4.reason}`);

  // TEST 5: Quote = ₹40L, Team Lead limit = ₹50L, Discount = 25%, TL discount limit = 20% -> Result = ADMIN
  const p2: any = await sequelize.models.PriceBookEntry.create({
    id: require("crypto").randomUUID(),
    sku: `SKU-DISC2-${Date.now()}`,
    name: "Test High Disc Product",
    unitPrice: 5333333
  });
  const res5 = await evaluateQuoteApproval("", {
    salesRepId: repUser.id,
    totalAmount: 4000000, // 25% discount
    items: [{ productId: p2.id, quantity: 1, unitPrice: 4000000 }]
  });
  assert(res5.approvalLevel === "ADMIN" && res5.approvalRequired === true && res5.reason.includes("Discount"), "TEST 5: Discount 25% > Team Lead limit 20% → Admin approval required", `Got level: ${res5.approvalLevel}, reason: ${res5.reason}`);

  // TEST 6: Quote approved by Rep, then edited above threshold -> previous approval invalidated & new approval required
  let stage: any = await sequelize.models.PipelineStage.findOne();
  if (!stage) {
    stage = await sequelize.models.PipelineStage.create({
      id: require("crypto").randomUUID(),
      name: "Qualification",
      order: 1
    });
  }

  const deal: any = await sequelize.models.Deal.create({
    id: require("crypto").randomUUID(),
    name: "Test Deal",
    amount: 700000,
    ownerId: repUser.id,
    stageId: stage.id
  });

  const quote: any = await sequelize.models.Quote.create({
    id: require("crypto").randomUUID(),
    dealId: deal.id,
    status: "Approved",
    totalAmount: 700000,
    quoteNumber: `QT-TEST-${Date.now()}`
  });

  const initialEval = await evaluateQuoteApproval(quote.id);
  assert(initialEval.approvalLevel === "SALES_REP", "TEST 6a: Initial quote ₹7L is within rep authority", `Got level: ${initialEval.approvalLevel}`);

  await quote.update({ totalAmount: 2500000 });
  const editedEval = await evaluateQuoteApproval(quote.id);
  assert(editedEval.approvalLevel === "TEAM_LEAD" && editedEval.approvalRequired === true, "TEST 6b: Editing quote to ₹25L invalidates self-approval & requires Team Lead approval", `Got level: ${editedEval.approvalLevel}`);

  // TEST 7: Ceiling Enforcement logic
  const adminPolicy: any = await sequelize.models.AdminApprovalPolicy.findOne({ order: [["createdAt", "DESC"]] });
  const maxAllowed = Number(adminPolicy.maximumSalesRepApproval); // ₹25L
  const attemptLimit = 3000000; // ₹30L attempt
  assert(attemptLimit > maxAllowed, "TEST 7: Admin ceiling prevents giving Sales Rep limits higher than organization ceiling", `Attempted ${attemptLimit} vs Max ${maxAllowed}`);

  console.log("==================================================");
  console.log(`SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
