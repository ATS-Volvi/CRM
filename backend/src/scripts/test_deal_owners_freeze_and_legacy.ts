import { sequelize, User, Deal, DealSplit, DealOwner } from "@nexus-crm/database";
import { setDealSplitsHandler } from "../controllers/dealSplitController";
import { getDealOwners, updateDealOwners } from "../controllers/dealOwnerController";
import crypto from "crypto";

async function runVerification() {
  console.log("=================================================================");
  console.log("VERIFYING DEALOWNERS IMMUTABILITY & LEGACY DELEGATION SHIM");
  console.log("=================================================================\n");

  const testRunId = Date.now();

  // Create test manager and sales rep
  const manager = await User.create({
    id: crypto.randomUUID(),
    email: `mgr_freeze_${testRunId}@nexus.com`,
    password: "password123",
    name: `Manager FreezeTest ${testRunId}`,
    role: "manager",
    isAvailable: true
  });

  const rep1 = await User.create({
    id: crypto.randomUUID(),
    email: `rep1_freeze_${testRunId}@nexus.com`,
    password: "password123",
    name: `Rep 1 FreezeTest ${testRunId}`,
    role: "senior_ae",
    isAvailable: true
  });

  const rep2 = await User.create({
    id: crypto.randomUUID(),
    email: `rep2_freeze_${testRunId}@nexus.com`,
    password: "password123",
    name: `Rep 2 FreezeTest ${testRunId}`,
    role: "sales_rep",
    isAvailable: true
  });

  const deal = await Deal.create({
    id: crypto.randomUUID(),
    name: `Freeze & Legacy Deal ${testRunId}`,
    amount: 500000.0,
    ownerId: rep1.id
  });

  // ---------------------------------------------------------------------------
  // 1. DealOwners Row-Count Check (Before vs After PUT /deals/:dealId/splits)
  // ---------------------------------------------------------------------------
  console.log("--- TEST 1: DealOwners Table Immutability on PUT /deals/:dealId/splits ---");
  const dealOwnersBefore = await DealOwner.count();
  console.log(`[Before PUT /splits] Total DealOwners rows in database: ${dealOwnersBefore}`);

  const reqSplits: any = {
    params: { dealId: deal.id },
    body: {
      splits: [
        { userId: rep1.id, splitPercentage: 70 },
        { userId: rep2.id, splitPercentage: 30 }
      ]
    },
    user: { id: manager.id, role: "manager" }
  };

  let splitsResStatus = 200;
  let splitsResData: any = null;
  const resSplits: any = {
    status: (code: number) => { splitsResStatus = code; return { json: (d: any) => { splitsResData = d; } }; },
    json: (d: any) => { splitsResData = d; }
  };

  await setDealSplitsHandler(reqSplits, resSplits);

  const dealOwnersAfter = await DealOwner.count();
  const dealSplitsAfter = await DealSplit.count({ where: { dealId: deal.id } });

  console.log(`[After PUT /splits]  Total DealOwners rows in database: ${dealOwnersAfter}`);
  console.log(`[After PUT /splits]  DealSplits rows for this deal:    ${dealSplitsAfter}`);

  if (dealOwnersBefore !== dealOwnersAfter) {
    throw new Error(`DealOwners row count changed! Before: ${dealOwnersBefore}, After: ${dealOwnersAfter}`);
  }
  if (dealSplitsAfter !== 2) {
    throw new Error(`Expected 2 DealSplits rows, found ${dealSplitsAfter}`);
  }
  console.log(`✓ Test 1 Passed: DealOwners count remained exactly ${dealOwnersBefore} -> ${dealOwnersAfter} (GENUINELY UNTOUCHED).\n`);

  // ---------------------------------------------------------------------------
  // 2. Legacy GET /deals/:dealId/owners Delegation Call & Response Shape
  // ---------------------------------------------------------------------------
  console.log("--- TEST 2: Legacy GET /deals/:dealId/owners Delegation Call ---");
  let legacyGetRes: any = null;
  const reqLegacyGet: any = {
    params: { dealId: deal.id },
    user: { id: manager.id, role: "manager" }
  };
  const resLegacyGet: any = {
    status: (code: number) => ({ json: (d: any) => { legacyGetRes = d; } }),
    json: (d: any) => { legacyGetRes = d; }
  };

  await getDealOwners(reqLegacyGet, resLegacyGet);

  console.log("Legacy GET /deals/:dealId/owners Raw Output:");
  console.log(JSON.stringify(legacyGetRes, null, 2));

  if (!legacyGetRes || !Array.isArray(legacyGetRes.owners) || legacyGetRes.owners.length !== 2) {
    throw new Error("Legacy GET /deals/:dealId/owners failed to return expected 2 owners array");
  }
  if (legacyGetRes.owners[0].splitPct !== 70 || legacyGetRes.owners[1].splitPct !== 30) {
    throw new Error(`Unexpected splitPct values in legacy output: ${JSON.stringify(legacyGetRes.owners)}`);
  }
  console.log("✓ Test 2 Passed: Legacy GET correctly returned DealSplit data in legacy { dealId, owners } shape.\n");

  // ---------------------------------------------------------------------------
  // 3. Legacy PUT /deals/:dealId/owners Delegation Call & Response Shape
  // ---------------------------------------------------------------------------
  console.log("--- TEST 3: Legacy PUT /deals/:dealId/owners Delegation Call ---");
  let legacyPutRes: any = null;
  const reqLegacyPut: any = {
    params: { dealId: deal.id },
    body: {
      owners: [
        { userId: rep1.id, splitPct: 50 },
        { userId: rep2.id, splitPct: 50 }
      ]
    },
    user: { id: manager.id, role: "manager" }
  };
  const resLegacyPut: any = {
    status: (code: number) => ({ json: (d: any) => { legacyPutRes = d; } }),
    json: (d: any) => { legacyPutRes = d; }
  };

  await updateDealOwners(reqLegacyPut, resLegacyPut);

  console.log("Legacy PUT /deals/:dealId/owners Raw Output:");
  console.log(JSON.stringify(legacyPutRes, null, 2));

  const updatedSplits = await DealSplit.findAll({ where: { dealId: deal.id } });
  console.log("\nDirect DealSplits DB Inspection after legacy PUT:");
  for (const s of updatedSplits) {
    console.log(`  - UserId: ${s.userId} | splitPercentage: ${s.splitPercentage}%`);
  }

  if (Number(updatedSplits[0].splitPercentage) !== 50 || Number(updatedSplits[1].splitPercentage) !== 50) {
    throw new Error("DealSplits was not updated by legacy PUT handler!");
  }

  const finalDealOwnersCount = await DealOwner.count();
  console.log(`\nFinal DealOwners count across entire test: ${finalDealOwnersCount} (initial: ${dealOwnersBefore})`);
  if (finalDealOwnersCount !== dealOwnersBefore) {
    throw new Error(`DealOwners count altered during legacy PUT! Initial: ${dealOwnersBefore}, Final: ${finalDealOwnersCount}`);
  }
  console.log("✓ Test 3 Passed: Legacy PUT seamlessly updated DealSplits to 50/50 without modifying DealOwners table.\n");

  // Clean up test data
  await DealSplit.destroy({ where: { dealId: deal.id } });
  await deal.destroy();
  await rep1.destroy();
  await rep2.destroy();
  await manager.destroy();

  console.log("=================================================================");
  console.log("ALL IMMUTABILITY & LEGACY DELEGATION TESTS PASSED 100%");
  console.log("=================================================================");
}

runVerification()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Test failed:", err);
    process.exit(1);
  });
