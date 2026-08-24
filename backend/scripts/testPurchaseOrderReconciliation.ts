import path from "path";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../backend/.env") });
dotenv.config();

import { Database, sequelize, Deal, Lead, User, Quote, PurchaseOrder, Notification, Activity, PipelineStage } from "@nexus-crm/database";
import { createPurchaseOrder, resolvePurchaseOrder } from "../src/controllers/purchaseOrderController";

// Helper mock req/res
function createMockReqRes(body: any, params: any = {}, user: any = null) {
  let statusCode = 200;
  let jsonResponse: any = null;

  const req: any = {
    body,
    params,
    user: user || { id: require("crypto").randomUUID() }
  };

  const res: any = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(data: any) {
      jsonResponse = data;
      return this;
    }
  };

  return { req, res, getStatus: () => statusCode, getJson: () => jsonResponse };
}

async function runTests() {
  console.log("============================================================");
  console.log("🧪 TESTING PURCHASE ORDER RECONCILIATION & RESOLUTION");
  console.log("============================================================");
  await Database.createConnection();

  // Setup stages if needed
  let wonStage: any = await PipelineStage.findOne({ where: { name: "Won" } });
  if (!wonStage) {
    wonStage = await PipelineStage.create({
      id: require("crypto").randomUUID(),
      name: "Won",
      order: 10,
      probability: 100
    });
  }

  let lostStage: any = await PipelineStage.findOne({ where: { name: "Lost" } });
  if (!lostStage) {
    lostStage = await PipelineStage.create({
      id: require("crypto").randomUUID(),
      name: "Lost",
      order: 11,
      probability: 0
    });
  }

  let openStage: any = await PipelineStage.findOne({ where: { name: "Negotiation" } });
  if (!openStage) {
    openStage = await PipelineStage.create({
      id: require("crypto").randomUUID(),
      name: "Negotiation",
      order: 4,
      probability: 70
    });
  }

  // Setup test manager & rep
  let manager: any = await User.findOne({ where: { role: "manager" } });
  if (!manager) {
    manager = await User.create({
      id: require("crypto").randomUUID(),
      name: "PO Manager",
      email: "po_manager@nexus.com",
      role: "manager",
      password: "HashedPassword123!",
      isAvailable: true
    });
  }

  let rep: any = await User.findOne({ where: { role: "sales_rep" } });
  if (!rep) {
    rep = await User.create({
      id: require("crypto").randomUUID(),
      name: "PO Rep",
      email: "po_rep@nexus.com",
      role: "sales_rep",
      managerId: manager.id,
      password: "HashedPassword123!",
      isAvailable: true
    });
  } else {
    await rep.update({ managerId: manager.id });
  }

  // ============================================================
  // TEST SCENARIO (a): Matching PO Amount -> Auto-triggers Won
  // ============================================================
  console.log("\n▶ TEST SCENARIO (a): Matching PO Amount (Exact Match)");

  const leadA = await Lead.create({
    id: require("crypto").randomUUID(),
    firstName: "Alice",
    lastName: "Smith",
    company: "Acme Corp",
    email: "alice@acme.com",
    status: "QUALIFIED"
  });

  const dealA = await Deal.create({
    id: require("crypto").randomUUID(),
    name: "Acme Corp ERP Expansion",
    amount: 100000,
    stageId: openStage.id,
    status: "OPEN",
    ownerId: rep.id,
    leadId: leadA.id
  });

  const quoteA = await Quote.create({
    id: require("crypto").randomUUID(),
    dealId: dealA.id,
    quoteNumber: `QT-MATCH-${Date.now()}`,
    version: 1,
    status: "Accepted",
    totalAmount: 100000,
    isFinalAgreed: true
  });

  const { req: reqA, res: resA, getStatus: getStatusA, getJson: getJsonA } = createMockReqRes({
    quoteId: quoteA.id,
    amount: 100000, // EXACT MATCH
    poNumber: `PO-MATCH-${Date.now()}`
  });

  await createPurchaseOrder(reqA, resA);
  const resultA = getJsonA();

  console.log("  Status Code:", getStatusA());
  console.log("  PO Status:", resultA?.purchaseOrder?.status);
  console.log("  Mismatch flag:", resultA?.mismatch);

  // Reload deal A to check stage
  await dealA.reload();
  console.log("  Deal A Stage ID:", dealA.stageId, "(Won Stage ID:", wonStage.id, ")");
  console.log("  Deal A Status:", dealA.status);

  if (resultA?.mismatch !== false) {
    throw new Error("Scenario (a) failed: Expected mismatch to be false for exact match.");
  }
  if (resultA?.purchaseOrder?.status !== "Accepted") {
    throw new Error(`Scenario (a) failed: Expected PO status 'Accepted', got '${resultA?.purchaseOrder?.status}'`);
  }
  if (dealA.stageId !== wonStage.id) {
    throw new Error("Scenario (a) failed: Deal stage was NOT auto-updated to Won.");
  }

  console.log("✓ SCENARIO (a) PASSED: Matching PO auto-marked deal Won and set PO status to Accepted.");

  // ============================================================
  // TEST SCENARIO (b): Mismatched PO Amount -> Does NOT Auto-trigger Won
  // ============================================================
  console.log("\n▶ TEST SCENARIO (b): Mismatched PO Amount (Quoted 200,000 vs Received 150,000)");

  const leadB = await Lead.create({
    id: require("crypto").randomUUID(),
    firstName: "Bob",
    lastName: "Taylor",
    company: "Beta Systems",
    email: "bob@beta.com",
    status: "QUALIFIED"
  });

  const dealB = await Deal.create({
    id: require("crypto").randomUUID(),
    name: "Beta Systems Cloud Migration",
    amount: 200000,
    stageId: openStage.id,
    status: "OPEN",
    ownerId: rep.id,
    leadId: leadB.id
  });

  const quoteB = await Quote.create({
    id: require("crypto").randomUUID(),
    dealId: dealB.id,
    quoteNumber: `QT-MISMATCH-${Date.now()}`,
    version: 1,
    status: "Sent",
    totalAmount: 200000, // Quoted 200k
    isFinalAgreed: false
  });

  const poNumberB = `PO-MISMATCH-${Date.now()}`;
  const { req: reqB, res: resB, getStatus: getStatusB, getJson: getJsonB } = createMockReqRes({
    quoteId: quoteB.id,
    amount: 150000, // Received 150k (MISMATCH)
    poNumber: poNumberB
  });

  await createPurchaseOrder(reqB, resB);
  const resultB = getJsonB();

  console.log("  Status Code:", getStatusB());
  console.log("  PO Status:", resultB?.purchaseOrder?.status);
  console.log("  Mismatch flag:", resultB?.mismatch);

  // Reload deal B to check stage
  await dealB.reload();
  console.log("  Deal B Stage ID:", dealB.stageId, "(Original Open Stage:", openStage.id, ", Won Stage:", wonStage.id, ")");
  console.log("  Deal B Status:", dealB.status);

  if (resultB?.mismatch !== true) {
    throw new Error("Scenario (b) failed: Expected mismatch to be true for unequal amounts.");
  }
  if (resultB?.purchaseOrder?.status !== "Flagged/Mismatch") {
    throw new Error(`Scenario (b) failed: Expected PO status 'Flagged/Mismatch', got '${resultB?.purchaseOrder?.status}'`);
  }
  if (dealB.stageId === wonStage.id || dealB.status === "WON") {
    throw new Error("Scenario (b) failed: Mismatched PO must NOT auto-update deal stage to Won!");
  }
  if (dealB.stageId !== openStage.id) {
    throw new Error("Scenario (b) failed: Deal stage should remain untouched at original Negotiation stage.");
  }

  // Check notifications generated for rep and manager
  const repNotifications = await Notification.findAll({
    where: { userId: rep.id },
    order: [["createdAt", "DESC"]],
    limit: 2
  });
  console.log("  Rep Notifications:", repNotifications.map((n: any) => n.title));

  const mgrNotifications = await Notification.findAll({
    where: { userId: manager.id },
    order: [["createdAt", "DESC"]],
    limit: 2
  });
  console.log("  Manager Notifications:", mgrNotifications.map((n: any) => n.title));

  const hasMismatchNotif = repNotifications.some((n: any) => n.title.includes("Mismatch") || n.message.includes("mismatch"));
  const hasMgrMismatchNotif = mgrNotifications.some((n: any) => n.title.includes("Mismatch") || n.message.includes("mismatch"));

  if (!hasMismatchNotif) {
    throw new Error("Scenario (b) failed: Deal owner did not receive Mismatch notification.");
  }
  if (!hasMgrMismatchNotif) {
    throw new Error("Scenario (b) failed: Manager did not receive Mismatch notification.");
  }

  console.log("✓ SCENARIO (b) PASSED: Mismatched PO flagged as Flagged/Mismatch, deal NOT moved to Won, owner + manager notified.");

  // ============================================================
  // TEST SCENARIO (c): Manual Resolution - Confirm Anyway (Moves deal to Won)
  // ============================================================
  console.log("\n▶ TEST RESOLUTION PATH 1: Confirm Anyway (Override Mismatch -> Won)");

  const poBId = resultB.purchaseOrder.id;
  const { req: reqResolveConfirm, res: resResolveConfirm, getJson: getJsonResolveConfirm } = createMockReqRes(
    {
      action: "CONFIRM_ANYWAY",
      resolutionNotes: "Approved acceptable variance for Phase 1 delivery."
    },
    { id: poBId },
    { id: manager.id }
  );

  await resolvePurchaseOrder(reqResolveConfirm, resResolveConfirm);
  const resolveConfirmResult = getJsonResolveConfirm();

  const poBUpdated: any = await PurchaseOrder.findByPk(poBId);
  await dealB.reload();

  console.log("  Updated PO Status:", poBUpdated?.status);
  console.log("  Updated Deal B Stage ID:", dealB.stageId, "(Won Stage ID:", wonStage.id, ")");
  console.log("  Updated Deal B Status:", dealB.status);

  if (poBUpdated?.status !== "Accepted") {
    throw new Error(`Expected PO status 'Accepted' after manual confirmation, got '${poBUpdated?.status}'`);
  }
  if (dealB.stageId !== wonStage.id || dealB.status !== "WON") {
    throw new Error("Expected deal to be moved to Won after CONFIRM_ANYWAY resolution.");
  }

  console.log("✓ RESOLUTION PATH 1 PASSED: CONFIRM_ANYWAY updated PO to Accepted and deal to Won.");

  // ============================================================
  // TEST SCENARIO (d): Manual Resolution - Reject / Deal Lost (Moves deal to Lost with Loss Reason)
  // ============================================================
  console.log("\n▶ TEST RESOLUTION PATH 2: Reject / Deal Lost (Mismatch Rejected -> Lost)");

  const leadC = await Lead.create({
    id: require("crypto").randomUUID(),
    firstName: "Carol",
    lastName: "Danvers",
    company: "Gamma Corp",
    email: "carol@gamma.com",
    status: "QUALIFIED"
  });

  const dealC = await Deal.create({
    id: require("crypto").randomUUID(),
    name: "Gamma Corp Security Suite",
    amount: 300000,
    stageId: openStage.id,
    status: "OPEN",
    ownerId: rep.id,
    leadId: leadC.id
  });

  const quoteC = await Quote.create({
    id: require("crypto").randomUUID(),
    dealId: dealC.id,
    quoteNumber: `QT-REJECT-${Date.now()}`,
    version: 1,
    status: "Sent",
    totalAmount: 300000
  });

  const { req: reqC, res: resC, getJson: getJsonC } = createMockReqRes({
    quoteId: quoteC.id,
    amount: 100000, // 33% value mismatch
    poNumber: `PO-REJECT-${Date.now()}`
  });

  await createPurchaseOrder(reqC, resC);
  const poCId = getJsonC().purchaseOrder.id;

  const { req: reqResolveReject, res: resResolveReject, getJson: getJsonResolveReject } = createMockReqRes(
    {
      action: "REJECT_LOST",
      lossReason: "Commercial Variance / Scope Reduced",
      lossNotes: "Customer reduced PO value by 66% without commercial approval."
    },
    { id: poCId },
    { id: manager.id }
  );

  await resolvePurchaseOrder(reqResolveReject, resResolveReject);
  const resolveRejectResult = getJsonResolveReject();

  const poCUpdated: any = await PurchaseOrder.findByPk(poCId);
  await dealC.reload();

  console.log("  Updated PO Status:", poCUpdated?.status);
  console.log("  Updated Deal C Status:", dealC.status);
  console.log("  Updated Deal C Loss Reason:", dealC.lossReason);

  if (poCUpdated?.status !== "Rejected") {
    throw new Error(`Expected PO status 'Rejected' after reject resolution, got '${poCUpdated?.status}'`);
  }
  if (dealC.status !== "LOST") {
    throw new Error("Expected deal to be moved to LOST after REJECT_LOST resolution.");
  }
  if (!dealC.lossReason || !dealC.lossReason.includes("Commercial Variance")) {
    throw new Error("Expected deal to have documented lossReason.");
  }

  console.log("✓ RESOLUTION PATH 2 PASSED: REJECT_LOST updated PO to Rejected and deal to Lost with documented loss reason.");

  console.log("\n============================================================");
  console.log("🎉 ALL PURCHASE ORDER RECONCILIATION TESTS PASSED (100% SUCCESS)");
  console.log("============================================================");
  process.exit(0);
}

runTests().catch((err) => {
  console.error("Test failed with error:", err);
  process.exit(1);
});
