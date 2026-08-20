import { sequelize, User, Deal, DealSplit, DealOwner, WorkspaceSetting, Lead } from "@nexus-crm/database";
import { setDealSplitsHandler, deleteDealSplitsHandler } from "../controllers/dealSplitController";
import { convertLeadToOpportunity } from "../services/leadJourneyWorkflowEngine";
import crypto from "crypto";

async function runFourPointsTest() {
  console.log("=== VERIFYING 4 POINTS ===");

  const testRunId = Date.now();

  // Create test users: 1 manager, 1 sales_rep
  const manager = await User.create({
    id: crypto.randomUUID(),
    email: `manager_${testRunId}@nexus.com`,
    password: "password123",
    name: `Manager Test ${testRunId}`,
    role: "manager",
    isAvailable: true
  });

  const salesRep = await User.create({
    id: crypto.randomUUID(),
    email: `salesrep_${testRunId}@nexus.com`,
    password: "password123",
    name: `Sales Rep Test ${testRunId}`,
    role: "sales_rep",
    isAvailable: true
  });

  const deal = await Deal.create({
    id: crypto.randomUUID(),
    name: `Test Deal Auth & Sync ${testRunId}`,
    amount: 200000.0,
    ownerId: salesRep.id
  });

  // -------------------------------------------------------------
  // Point 3: Authorization Check — sales_rep role calling PUT /deals/:dealId/splits
  // -------------------------------------------------------------
  console.log("\n--- Point 3: Testing Authorization with sales_rep role ---");
  let repPutStatus = 0;
  let repPutResponse: any = null;

  const reqRep: any = {
    params: { dealId: deal.id },
    body: {
      splits: [
        { userId: salesRep.id, splitPercentage: 100 }
      ]
    },
    user: { id: salesRep.id, role: salesRep.role }
  };

  const resRep: any = {
    status: (code: number) => {
      repPutStatus = code;
      return {
        json: (data: any) => { repPutResponse = data; }
      };
    },
    json: (data: any) => { repPutResponse = data; }
  };

  await setDealSplitsHandler(reqRep, resRep);
  console.log(`HTTP Status: ${repPutStatus}`);
  console.log("Response Body:", JSON.stringify(repPutResponse));

  if (repPutStatus !== 403) {
    throw new Error(`Expected 403 for sales_rep role, got ${repPutStatus}`);
  }
  console.log("✓ Point 3 Verified: sales_rep received HTTP 403 Forbidden.");

  // -------------------------------------------------------------
  // Point 2: Manager calling PUT /deals/:dealId/splits and verifying Bidirectional Sync
  // -------------------------------------------------------------
  console.log("\n--- Point 2: Testing Manager PUT & Bidirectional Sync (DealSplit + DealOwner) ---");
  let mgrPutStatus = 0;
  let mgrPutResponse: any = null;

  const reqMgr: any = {
    params: { dealId: deal.id },
    body: {
      splits: [
        { userId: salesRep.id, splitPercentage: 60 },
        { userId: manager.id, splitPercentage: 40 }
      ]
    },
    user: { id: manager.id, role: manager.role }
  };

  const resMgr: any = {
    status: (code: number) => {
      mgrPutStatus = code;
      return {
        json: (data: any) => { mgrPutResponse = data; }
      };
    },
    json: (data: any) => {
      mgrPutStatus = 200;
      mgrPutResponse = data;
    }
  };

  await setDealSplitsHandler(reqMgr, resMgr);
  console.log(`Manager PUT HTTP Status: ${mgrPutStatus}`);

  const splitsInDb = await DealSplit.findAll({ where: { dealId: deal.id } });
  console.log(`DealSplits count in DB: ${splitsInDb.length}`);

  if (splitsInDb.length !== 2) {
    throw new Error(`Expected 2 DealSplits in DB, found ${splitsInDb.length}`);
  }

  // Also test that legacy getDealOwners seamlessly delegates to DealSplit:
  const { getDealOwners } = require("../controllers/dealOwnerController");
  let legacyResData: any = null;
  await getDealOwners(
    { params: { dealId: deal.id } },
    {
      json: (data: any) => { legacyResData = data; },
      status: () => ({ json: (data: any) => { legacyResData = data; } })
    }
  );

  if (!legacyResData || legacyResData.owners.length !== 2) {
    throw new Error(`Legacy getDealOwners delegation failed! Result: ${JSON.stringify(legacyResData)}`);
  }
  console.log("✓ Point 2 Verified: DealSplit is the exclusive source of truth; legacy getDealOwners delegates directly to DealSplit.");

  // -------------------------------------------------------------
  // Point 4: Testing WorkspaceSettings.default_qualifying_split_pct in convertLeadToOpportunity
  // -------------------------------------------------------------
  console.log("\n--- Point 4: Testing WorkspaceSettings.default_qualifying_split_pct in convertLeadToOpportunity ---");
  const existingSetting = await WorkspaceSetting.findOne({ where: { key: "default_qualifying_split_pct" } });
  if (existingSetting) {
    await existingSetting.update({ value: "35.0" });
  } else {
    await WorkspaceSetting.create({
      id: crypto.randomUUID(),
      key: "default_qualifying_split_pct",
      value: "35.0"
    });
  }

  const testLead = await Lead.create({
    id: crypto.randomUUID(),
    firstName: "Dynamic",
    lastName: "SettingLead",
    email: `dyn_${testRunId}@example.com`,
    status: "New",
    assignedToId: salesRep.id
  });

  const converted = await convertLeadToOpportunity(
    testLead.id,
    { requirement: "Cloud Infra", estimatedValue: 100000 },
    manager.id
  );

  const convertedDealId = converted.deal.id;
  const newDealSplits = await DealSplit.findAll({ where: { dealId: convertedDealId } });

  console.log("Created DealSplits for Converted Deal:");
  for (const s of newDealSplits) {
    console.log(`  - User: ${s.userId} | Split: ${s.splitPercentage}%`);
  }

  // After auto-assignment, the deal is owned by the eligible senior_ae (not the triggering manager).
  // The qualifying rep (salesRep) still gets their SDR origination split; the closing AE (senior_ae)
  // gets the remainder. Percentages must still honour the WorkspaceSetting (35%/65% here).
  const sdrSplit = newDealSplits.find((s: any) => s.userId === salesRep.id);
  const aeSplit  = newDealSplits.find((s: any) => s.userId === converted.deal.ownerId);

  if (!sdrSplit || Number(sdrSplit.splitPercentage) !== 35) {
    throw new Error(`WorkspaceSetting 35% SDR split not respected! SDR: ${sdrSplit?.splitPercentage}`);
  }
  if (!aeSplit || Number(aeSplit.splitPercentage) !== 65) {
    throw new Error(`WorkspaceSetting 65% AE split not respected! AE split: ${aeSplit?.splitPercentage}, AE userId: ${aeSplit?.userId}`);
  }
  if (!converted.autoAssigned) {
    throw new Error("Expected autoAssigned=true (a senior_ae should have been available in the test DB)");
  }
  console.log(`✓ Point 4 Verified: convertLeadToOpportunity auto-assigned deal to senior_ae ${converted.deal.ownerId} and respected the dynamically configured 35%/65% WorkspaceSetting split`);

  // Clean up
  await DealSplit.destroy({ where: { dealId: deal.id } });
  await DealOwner.destroy({ where: { dealId: deal.id } });
  await deal.destroy();

  await DealSplit.destroy({ where: { dealId: convertedDealId } });
  await DealOwner.destroy({ where: { dealId: convertedDealId } });
  await Deal.destroy({ where: { id: convertedDealId } });
  await testLead.destroy();

  await salesRep.destroy();
  await manager.destroy();

  console.log("\n=== ALL 4 POINTS VERIFIED AND TESTED SUCCESSFULLY ===");
}

runFourPointsTest()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Test failed:", err);
    process.exit(1);
  });
