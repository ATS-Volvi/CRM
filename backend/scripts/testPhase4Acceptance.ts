import { sequelize } from "@nexus-crm/database";
import crypto from "crypto";
import {
  createOrderFromFinalQuote,
  updateFulfillmentStatus,
  updateFulfillmentItem
} from "../src/services/supplyFulfillmentService";

async function runPhase4AcceptanceTest() {
  console.log("\n=======================================================");
  console.log("🚀 STARTING PHASE 4 SUPPLY, FULFILLMENT & ASSET ACCEPTANCE TEST");
  console.log("=======================================================\n");

  let testPassed = 0;
  let testTotal = 0;

  function assert(condition: boolean, message: string) {
    testTotal++;
    if (condition) {
      testPassed++;
      console.log(`  ✅ [PASS ${testPassed}/${testTotal}] ${message}`);
    } else {
      console.error(`  ❌ [FAIL ${testTotal}] ${message}`);
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  // 1. Setup Master Data / Users
  console.log("--- 1. Setting up Users, Account, Contact, and PriceBook ---");
  let salesRep = await sequelize.models.User.findOne({ where: { role: "sales_rep" } });
  if (!salesRep) {
    salesRep = await sequelize.models.User.create({
      id: crypto.randomUUID(),
      name: "Rahul Verma",
      email: `rahul.verma.${Date.now()}@nexuscrm.com`,
      password: "hashedpassword123",
      role: "sales_rep"
    });
  }

  let supplyUser = await sequelize.models.User.findOne({ where: { role: "admin" } });

  // Create PriceBook entries: 1 asset-tracked, 1 non-asset-tracked
  const trackedProduct = await sequelize.models.PriceBookEntry.create({
    id: crypto.randomUUID(),
    sku: `SKU-CP-${Date.now()}`,
    name: "Industrial Automation Control Panel",
    description: "Heavy-duty PLC automation enclosure",
    category: "Control Systems",
    uom: "nos",
    unitPrice: 150000,
    isAssetTracked: true
  });

  const serviceProduct = await sequelize.models.PriceBookEntry.create({
    id: crypto.randomUUID(),
    sku: `SKU-SRV-${Date.now()}`,
    name: "On-Site Commissioning & Operator Training",
    description: "Field deployment training service",
    category: "Professional Services",
    uom: "days",
    unitPrice: 25000,
    isAssetTracked: false
  });

  assert(Boolean(trackedProduct && serviceProduct), "PriceBook entries created (1 tracked product, 1 service charge)");

  // 2. Create Account & Contact
  const account = await sequelize.models.Account.create({
    id: crypto.randomUUID(),
    name: `Emirates Steel Industries ${Date.now()}`,
    industry: "Manufacturing",
    email: `procurement@emiratessteel-${Date.now()}.com`,
    phone: "+971501234567"
  });

  const contact = await sequelize.models.Contact.create({
    id: crypto.randomUUID(),
    accountId: (account as any).id,
    customerId: (account as any).id,
    firstName: "Tariq",
    lastName: "Al-Falasi",
    email: `tariq@emiratessteel-${Date.now()}.com`,
    isPrimary: true
  });

  assert(Boolean(account && contact), "Account and Contact created successfully");

  // 3. Create Opportunity
  const deal = await sequelize.models.Deal.create({
    id: crypto.randomUUID(),
    name: "Emirates Steel Plant Modernization Phase 1",
    amount: 500000,
    stage: "Negotiation",
    customerId: (account as any).id,
    accountId: (account as any).id,
    ownerId: (salesRep as any).id
  });

  assert(Boolean(deal), "Commercial Opportunity created with Account and Sales Rep linkage");

  // 4. Create Quote Revisions v1 and v2
  const quoteV1 = await sequelize.models.Quote.create({
    id: crypto.randomUUID(),
    quoteNumber: `QT-2026-${Date.now().toString().slice(-4)}-01`,
    version: 1,
    status: "Superseded",
    dealId: (deal as any).id,
    totalAmount: 475000,
    isFinalAgreed: false
  });

  const quoteV2 = await sequelize.models.Quote.create({
    id: crypto.randomUUID(),
    quoteNumber: `QT-2026-${Date.now().toString().slice(-4)}-02`,
    version: 2,
    parentQuoteId: (quoteV1 as any).id,
    status: "Accepted",
    dealId: (deal as any).id,
    totalAmount: 475000,
    isFinalAgreed: true
  });

  // Quote Line Items: 3 Control Panels (tracked), 1 Training Service (not tracked)
  const lineItem1 = await sequelize.models.QuoteLineItem.create({
    id: crypto.randomUUID(),
    quoteId: (quoteV2 as any).id,
    productId: (trackedProduct as any).id,
    catalogItemId: (trackedProduct as any).id,
    quantity: 3,
    unitPrice: 150000,
    totalPrice: 450000
  });

  const lineItem2 = await sequelize.models.QuoteLineItem.create({
    id: crypto.randomUUID(),
    quoteId: (quoteV2 as any).id,
    productId: (serviceProduct as any).id,
    catalogItemId: (serviceProduct as any).id,
    quantity: 1,
    unitPrice: 25000,
    totalPrice: 25000
  });

  assert(Boolean(quoteV1 && quoteV2 && lineItem1 && lineItem2), "Quote v1 (Superseded) and final Quote v2 (Accepted) created with line items");

  // 5. Block Order Creation on Superseded Quote
  console.log("--- 2. Validating Business Rules on Order Creation ---");
  let supersededBlocked = false;
  try {
    await createOrderFromFinalQuote((quoteV1 as any).id);
  } catch (err: any) {
    supersededBlocked = true;
  }
  assert(supersededBlocked, "Blocked order creation from Superseded Quote v1");

  // 6. Create Order from Final Agreed Quote v2
  const orderResult = await createOrderFromFinalQuote((quoteV2 as any).id, (salesRep as any).id, {
    deliveryAddress: "Warehouse 4, Industrial Area 1, Abu Dhabi",
    requestedDeliveryDate: new Date(Date.now() + 14 * 86400000),
    notes: "Express freight delivery required"
  });

  assert(Boolean(orderResult.order && orderResult.fulfillment), "Order and Fulfillment created from Final Quote v2");
  assert((orderResult.order as any).poNumber.startsWith("ORD-"), `Generated valid canonical Order number: ${(orderResult.order as any).poNumber}`);
  assert(orderResult.fulfillment.status === "PENDING", "Fulfillment status is initialized to PENDING");
  assert(orderResult.fulfillmentItems?.length === 2, "Created 2 operational FulfillmentItems snapshot from QuoteLineItems");

  // 7. Idempotency Check: Calling createOrderFromFinalQuote again returns existing Order
  const repeatOrderResult = await createOrderFromFinalQuote((quoteV2 as any).id, (salesRep as any).id);
  assert(repeatOrderResult.isExisting === true, "Idempotency verified: repeated order creation returns existing order without duplicates");
  assert((repeatOrderResult.order as any).id === (orderResult.order as any).id, "Existing order ID matches initial creation");

  // 8. Test Invalid Stage Skipping (PENDING -> READY must be blocked)
  console.log("--- 3. Testing Fulfillment State Machine & Transitions ---");
  const fulfillmentId = orderResult.fulfillment.id;
  let skippedBlocked = false;
  try {
    await updateFulfillmentStatus(fulfillmentId, "READY");
  } catch (err: any) {
    skippedBlocked = true;
  }
  assert(skippedBlocked, "Illegal transition PENDING → READY blocked by validation");

  // 9. Move Through Operational Lifecycle
  // Step A: PENDING -> PLANNING
  const step1 = await updateFulfillmentStatus(fulfillmentId, "PLANNING", {
    assignedUserId: (supplyUser as any)?.id,
    plannedStartDate: new Date(),
    plannedCompletionDate: new Date(Date.now() + 10 * 86400000)
  });
  assert(step1.newStatus === "PLANNING", "Transitioned PENDING → PLANNING with supply assignment");

  // Step B: PLANNING -> PROCUREMENT
  const step2 = await updateFulfillmentStatus(fulfillmentId, "PROCUREMENT", {
    notes: "BOM ordered from Siemens supplier",
    reason: "Components procurement initiated"
  });
  assert(step2.newStatus === "PROCUREMENT", "Transitioned PLANNING → PROCUREMENT");

  // Step C: PROCUREMENT -> IN_PRODUCTION
  const step3 = await updateFulfillmentStatus(fulfillmentId, "IN_PRODUCTION", {
    actualStartDate: new Date()
  });
  assert(step3.newStatus === "IN_PRODUCTION", "Transitioned PROCUREMENT → IN_PRODUCTION");

  // Step D: IN_PRODUCTION -> READY
  const step4 = await updateFulfillmentStatus(fulfillmentId, "READY", {
    notes: "All 3 control panels assembled and quality QA passed"
  });
  assert(step4.newStatus === "READY", "Transitioned IN_PRODUCTION → READY");

  // Step E: READY -> DISPATCHED (requires dispatchReference)
  let missingRefBlocked = false;
  try {
    await updateFulfillmentStatus(fulfillmentId, "DISPATCHED");
  } catch (err: any) {
    missingRefBlocked = true;
  }
  assert(missingRefBlocked, "DISPATCHED transition without tracking reference blocked");

  const step5 = await updateFulfillmentStatus(fulfillmentId, "DISPATCHED", {
    dispatchReference: "DHL-EXP-9928120",
    carrier: "DHL Express Logistics"
  });
  assert(step5.newStatus === "DISPATCHED", "Transitioned READY → DISPATCHED with valid carrier tracking");

  // Step F: DISPATCHED -> DELIVERED (generates Assets)
  console.log("--- 4. Testing Delivery & Asset Generation ---");
  const step6 = await updateFulfillmentStatus(fulfillmentId, "DELIVERED", {
    actualDeliveryDate: new Date()
  });
  assert(step6.newStatus === "DELIVERED", "Transitioned DISPATCHED → DELIVERED");

  // Verify Assets created: 3 control panels (isAssetTracked: true), 0 services (isAssetTracked: false)
  const createdAssets = await sequelize.models.Asset.findAll({
    where: { orderId: (orderResult.order as any).id }
  });

  assert(createdAssets.length === 3, `Created exactly 3 assets for 3 quantity-based tracked panels (Got: ${createdAssets.length})`);
  assert(createdAssets.every((a: any) => a.customerId === (account as any).id), "All created assets belong to Account");
  assert(createdAssets.every((a: any) => a.status === "Active" && a.serialNumber?.startsWith("SN-")), "Assets have valid Active status and serial numbers");
  assert(createdAssets.every((a: any) => a.warrantyEnd !== null), "Assets have warranty dates configured");

  // Step G: Test Asset Idempotency (transitioning again or calling COMPLETED does NOT create duplicate assets)
  const step7 = await updateFulfillmentStatus(fulfillmentId, "COMPLETED");
  assert(step7.newStatus === "COMPLETED", "Transitioned DELIVERED → COMPLETED");

  const assetsAfterComplete = await sequelize.models.Asset.findAll({
    where: { orderId: (orderResult.order as any).id }
  });
  assert(assetsAfterComplete.length === 3, "Idempotency verified: COMPLETED transition did not generate duplicate assets (Still exactly 3)");

  // 10. Verify Full Traceability & Account 360 Relations
  console.log("--- 5. Verifying Traceability & Ownership ---");
  const accountWithRelations: any = await sequelize.models.Account.findByPk((account as any).id, {
    include: [
      { model: sequelize.models.Asset, as: "assets" },
      { model: sequelize.models.Contact, as: "contacts" }
    ]
  });

  const ordersForAccount = await sequelize.models.PurchaseOrder.findAll({
    include: [
      {
        model: sequelize.models.Quote,
        as: "quote",
        include: [{ model: sequelize.models.Deal, as: "deal" }]
      }
    ]
  });
  const accountOrders = ordersForAccount.filter((o: any) =>
    o.quote?.deal?.accountId === (account as any).id || o.quote?.deal?.customerId === (account as any).id
  );

  assert(accountWithRelations.assets.length === 3, "Account 360 successfully aggregates customer Assets");
  assert(accountOrders.length >= 1, `Account successfully queries linked Orders (Found: ${accountOrders.length})`);

  // Verify original quote v1 and v2 were not mutated into orders
  const quoteV1Check: any = await sequelize.models.Quote.findByPk((quoteV1 as any).id);
  const quoteV2Check: any = await sequelize.models.Quote.findByPk((quoteV2 as any).id);
  assert(quoteV1Check.status === "Superseded", "Original Quote v1 remains unchanged (Superseded)");
  assert(quoteV2Check.status === "Accepted", "Final Quote v2 remains unchanged (Accepted)");

  // Verify ownership separation
  const updatedOrder: any = await sequelize.models.PurchaseOrder.findByPk((orderResult.order as any).id);
  const updatedFulfillment: any = await sequelize.models.Fulfillment.findByPk(fulfillmentId);
  assert(updatedOrder.salesOwnerId === (salesRep as any).id, "Sales Rep Rahul Verma remains commercial owner on Order");
  assert(updatedFulfillment.assignedTeam === "Operations / Supply", "Supply Team owns operational Fulfillment");

  // Verify universal activity audit log exists
  const activities = await sequelize.models.Activity.findAll({
    where: { customerId: (account as any).id }
  });
  assert(activities.length >= 2, `Audit trail recorded ${activities.length} activity events across lifecycle`);

  console.log("\n=======================================================");
  console.log(`🎉 ALL ${testPassed}/${testTotal} PHASE 4 ACCEPTANCE TESTS PASSED SUCCESSFULLY!`);
  console.log("=======================================================\n");

  process.exit(0);
}

runPhase4AcceptanceTest().catch((err) => {
  console.error("\n❌ PHASE 4 ACCEPTANCE TEST FAILED:", err);
  process.exit(1);
});
