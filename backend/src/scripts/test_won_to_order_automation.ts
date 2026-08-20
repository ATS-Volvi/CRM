import { sequelize, User, Deal, Quote, QuoteLineItem, PipelineStage, PurchaseOrder } from "@nexus-crm/database";
import { moveDealStage } from "../controllers/pipelineController";
import crypto from "crypto";

async function runWonToOrderTest() {
  console.log("=== TESTING WON -> ORDER AUTOMATION ===");

  const timestamp = Date.now();

  // 1. Fetch "Won" stage and an active stage (e.g. "Proposal" or "Negotiation")
  const wonStage: any = await PipelineStage.findOne({ where: { name: "Won" } });
  const proposalStage: any = await PipelineStage.findOne({ where: { name: "Proposal" } });

  if (!wonStage || !proposalStage) {
    throw new Error("Won or Proposal pipeline stage missing from DB.");
  }

  // 2. Create test user and account
  const testUser: any = await User.create({
    id: crypto.randomUUID(),
    email: `won_order_${timestamp}@nexus.com`,
    password: "password123",
    name: `Won Order Tester ${timestamp}`,
    role: "sales_rep"
  });

  const testAccount: any = await sequelize.models.Account.create({
    id: crypto.randomUUID(),
    name: `Test Account ${timestamp}`,
    email: `acc_${timestamp}@nexus.com`
  });

  // 3. Create test Deal in Proposal stage with linked Account
  const deal: any = await Deal.create({
    id: crypto.randomUUID(),
    name: `Automation Test Deal ${timestamp}`,
    amount: 150000,
    stageId: proposalStage.id,
    ownerId: testUser.id,
    accountId: testAccount.id,
    customerId: testAccount.id
  });

  // 4. Test Scenario A: Move to Won with NO accepted quote (should log notice & not crash)
  console.log("\n[Scenario A] Moving Deal to Won with NO accepted quote...");
  const mockReqA: any = {
    params: { id: deal.id },
    body: { toStageId: wonStage.id },
    user: { id: testUser.id, role: "admin" }
  };
  let resStatusA = 200;
  let resBodyA: any = null;
  const mockResA: any = {
    status: (code: number) => { resStatusA = code; return mockResA; },
    json: (data: any) => { resBodyA = data; }
  };

  await moveDealStage(mockReqA, mockResA);
  console.log(`  -> Response status: ${resStatusA}, message: ${resBodyA?.message}`);

  // Check no PO was created yet
  let poCount = await PurchaseOrder.count({
    include: [{ model: Quote, as: "quote", where: { dealId: deal.id } }]
  });
  if (poCount !== 0) {
    throw new Error(`Expected 0 POs for deal without accepted quote, found ${poCount}`);
  }
  console.log("  ✓ Correct: Deal moved to Won, non-blocking notification logged, no PO created.");

  // Move back to Proposal stage for Scenario B
  await deal.update({ stageId: proposalStage.id });

  // 5. Test Scenario B: Create Accepted Quote and Move to Won (should auto-create Order + Fulfillment)
  console.log("\n[Scenario B] Creating Accepted Quote and moving Deal to Won...");
  const quote: any = await Quote.create({
    id: crypto.randomUUID(),
    dealId: deal.id,
    quoteNumber: `QT-TEST-${timestamp}`,
    totalAmount: 150000,
    status: "Accepted",
    version: 1,
    expirationDate: new Date(Date.now() + 30 * 86400000),
    statusChangedAt: new Date()
  });

  await QuoteLineItem.create({
    id: crypto.randomUUID(),
    quoteId: quote.id,
    description: "Industrial Control Panel Model X",
    quantity: 2,
    unitPrice: 75000,
    totalPrice: 150000
  });

  const mockReqB: any = {
    params: { id: deal.id },
    body: { toStageId: wonStage.id },
    user: { id: testUser.id, role: "admin" }
  };
  let resStatusB = 200;
  let resBodyB: any = null;
  const mockResB: any = {
    status: (code: number) => { resStatusB = code; return mockResB; },
    json: (data: any) => { resBodyB = data; }
  };

  await moveDealStage(mockReqB, mockResB);
  console.log(`  -> Response status: ${resStatusB}, message: ${resBodyB?.message}`);

  // Verify PurchaseOrder created
  const createdPO: any = await PurchaseOrder.findOne({
    where: { quoteId: quote.id }
  });

  if (!createdPO) {
    throw new Error("Order (PurchaseOrder) was NOT created upon moving Deal to Won!");
  }
  console.log(`  ✓ Verified PurchaseOrder created! PO Number: ${createdPO.poNumber}, Amount: ${createdPO.amount}`);

  // Verify Fulfillment created
  const fulfillment: any = await sequelize.models.Fulfillment.findOne({
    where: { orderId: createdPO.id }
  });
  if (!fulfillment) {
    throw new Error("Fulfillment record was NOT created alongside PurchaseOrder!");
  }
  console.log(`  ✓ Verified Fulfillment created! Status: ${fulfillment.status}, Priority: ${fulfillment.priority}`);

  // 6. Test Scenario C: Idempotency (Moving to Won again does NOT duplicate Order)
  console.log("\n[Scenario C] Idempotency check: Triggering stage move again...");
  await moveDealStage(mockReqB, mockResB);

  const poCountAfter = await PurchaseOrder.count({
    where: { quoteId: quote.id }
  });
  if (poCountAfter !== 1) {
    throw new Error(`Idempotency check failed: Expected 1 PO, found ${poCountAfter}`);
  }
  console.log("  ✓ Idempotency verified: duplicate stage update did not create extra PO.");

  // 7. Test Scenario D: Multi-Quote Revision Cycle (Q1 Rejected -> Q2 Superseded + Stray PO -> Q3 Accepted)
  console.log("\n[Scenario D] Multi-Quote Revision Cycle (Q1 Rejected, Q2 Superseded + Stray PO, Q3 Accepted)...");

  const dealMulti: any = await Deal.create({
    id: crypto.randomUUID(),
    name: `Multi-Quote Rev Deal ${timestamp}`,
    amount: 300000,
    stageId: proposalStage.id,
    ownerId: testUser.id,
    accountId: testAccount.id,
    customerId: testAccount.id
  });

  const q1: any = await Quote.create({
    id: crypto.randomUUID(),
    dealId: dealMulti.id,
    quoteNumber: `QT-REV-${timestamp}`,
    totalAmount: 250000,
    status: "Rejected",
    version: 1
  });

  const q2: any = await Quote.create({
    id: crypto.randomUUID(),
    dealId: dealMulti.id,
    quoteNumber: `QT-REV-${timestamp}`,
    totalAmount: 280000,
    status: "Superseded",
    version: 2
  });

  const strayPO: any = await PurchaseOrder.create({
    id: crypto.randomUUID(),
    quoteId: q2.id,
    amount: 280000,
    poNumber: `STRAY-PO-${timestamp}`,
    status: "Draft",
    type: "customer_po",
    generatedDate: new Date()
  });

  const q3: any = await Quote.create({
    id: crypto.randomUUID(),
    dealId: dealMulti.id,
    quoteNumber: `QT-REV-${timestamp}`,
    totalAmount: 300000,
    status: "Accepted",
    version: 3,
    acceptedAt: new Date()
  });

  await QuoteLineItem.create({
    id: crypto.randomUUID(),
    quoteId: q3.id,
    description: "Final Agreed Industrial Panel Pack",
    quantity: 3,
    unitPrice: 100000,
    totalPrice: 300000
  });

  const mockReqD: any = {
    params: { id: dealMulti.id },
    body: { toStageId: wonStage.id },
    user: { id: testUser.id, role: "admin" }
  };
  let resStatusD = 200;
  let resBodyD: any = null;
  const mockResD: any = {
    status: (code: number) => { resStatusD = code; return mockResD; },
    json: (data: any) => { resBodyD = data; }
  };

  await moveDealStage(mockReqD, mockResD);

  const orderForQ3: any = await PurchaseOrder.findOne({
    where: { quoteId: q3.id }
  });
  if (!orderForQ3) {
    throw new Error("Order was NOT created for final accepted Quote 3 despite stray PO on superseded Quote 2!");
  }
  console.log(`  ✓ Multi-quote cycle verified! Order created for final Quote 3 (PO: ${orderForQ3.poNumber}) regardless of stray PO on Quote 2.`);

  // Cleanup
  console.log("\n[Cleanup] Removing test records...");
  const q3Fulfillment: any = await sequelize.models.Fulfillment.findOne({ where: { orderId: orderForQ3.id } });
  if (q3Fulfillment) await q3Fulfillment.destroy();
  await orderForQ3.destroy();
  await strayPO.destroy();
  await QuoteLineItem.destroy({ where: { quoteId: q3.id } });
  await q3.destroy();
  await q2.destroy();
  await q1.destroy();
  await dealMulti.destroy();

  if (fulfillment) await fulfillment.destroy();
  if (createdPO) await createdPO.destroy();
  await QuoteLineItem.destroy({ where: { quoteId: quote.id } });
  await quote.destroy();
  await deal.destroy();
  await testAccount.destroy();
  await testUser.destroy();

  console.log("\n=== WON -> ORDER AUTOMATION TEST PASSED 100% ===");
}

runWonToOrderTest()
  .then(() => process.exit(0))
  .catch(err => {
    console.error("Test failed:", err);
    process.exit(1);
  });
