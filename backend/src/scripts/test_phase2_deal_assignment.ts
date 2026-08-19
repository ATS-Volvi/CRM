import { sequelize } from "@nexus-crm/database";
import { autoAssignDeal, manualReassignDeal, getOpenDealsCount } from "../services/dealAssignmentEngine";
import crypto from "crypto";

async function runPhase2Tests() {
  const { User, Deal, DealReassignmentHistory, PipelineStage } = sequelize.models;

  console.log("=== STARTING PHASE 2 DEAL AUTO-ASSIGNMENT & REASSIGNMENT TEST SUITE ===");

  let testRepA: any = null;
  let testRepB: any = null;
  let managerUser: any = null;
  const createdDealIds: string[] = [];

  try {
    // 0. Stages
    const allStages: any[] = await PipelineStage.findAll();
    const activeStage = allStages.find((s: any) => !["Won", "Lost", "Closed Won", "Closed Lost"].includes(s.name));
    const wonStage = allStages.find((s: any) => ["Won", "Closed Won"].includes(s.name));
    if (!activeStage || !wonStage) {
      throw new Error("Missing required pipeline stages in DB");
    }
    console.log(`[Setup] Using active stage '${activeStage.name}' (${activeStage.id}) and won stage '${wonStage.name}' (${wonStage.id})`);

    // 1. Create dedicated isolated test users
    managerUser = await User.create({
      id: crypto.randomUUID(),
      name: "Test Manager User",
      email: `test-manager-${Date.now()}@nexus.com`,
      password: "password123",
      role: "manager",
      isAvailable: true
    });

    testRepA = await User.create({
      id: crypto.randomUUID(),
      name: "Senior AE Alice",
      email: `senior-ae-alice-${Date.now()}@nexus.com`,
      password: "password123",
      role: "senior_ae",
      isAvailable: true,
      dealValueCutoff: 50000.00, // Capped at $50k
      maxOpenDeals: 3            // Capped at 3 open deals
    });

    testRepB = await User.create({
      id: crypto.randomUUID(),
      name: "Senior AE Bob",
      email: `senior-ae-bob-${Date.now()}@nexus.com`,
      password: "password123",
      role: "senior_ae",
      isAvailable: true,
      dealValueCutoff: 150000.00, // Capped at $150k
      maxOpenDeals: 5             // Capped at 5 open deals
    });

    // Temporarily make any other existing senior_ae unavailable so our test is 100% isolated
    const otherSeniorAes: any[] = await User.findAll({
      where: {
        role: "senior_ae"
      }
    });
    const originalAvailability = new Map<string, boolean>();
    for (const u of otherSeniorAes) {
      if (u.id !== testRepA.id && u.id !== testRepB.id) {
        originalAvailability.set(u.id, u.isAvailable);
        await u.update({ isAvailable: false });
      }
    }

    console.log("[Setup] Isolated test environment configured with Rep A ($50k cap, 3 deals) and Rep B ($150k cap, 5 deals).");

    // -------------------------------------------------------------
    // TEST 1: Least-Loaded Routing (Tie-Break)
    // -------------------------------------------------------------
    // Give Rep A 1 open deal, Rep B 2 open deals.
    const dealA1: any = await Deal.create({
      id: crypto.randomUUID(),
      name: "Rep A Open Deal 1",
      amount: 10000,
      ownerId: testRepA.id,
      stageId: activeStage.id
    });
    createdDealIds.push(dealA1.id);

    const dealB1: any = await Deal.create({
      id: crypto.randomUUID(),
      name: "Rep B Open Deal 1",
      amount: 10000,
      ownerId: testRepB.id,
      stageId: activeStage.id
    });
    const dealB2: any = await Deal.create({
      id: crypto.randomUUID(),
      name: "Rep B Open Deal 2",
      amount: 10000,
      ownerId: testRepB.id,
      stageId: activeStage.id
    });
    createdDealIds.push(dealB1.id, dealB2.id);

    // Rep A has 1 deal, Rep B has 2 deals. New deal of $20,000 (both eligible) should go to Rep A.
    const newDeal1: any = await Deal.create({
      id: crypto.randomUUID(),
      name: "Auto Deal 1 ($20k)",
      amount: 20000,
      ownerId: null,
      stageId: activeStage.id
    });
    createdDealIds.push(newDeal1.id);

    const res1 = await autoAssignDeal(newDeal1.id, managerUser.id);
    console.log("[Test 1] Least-loaded routing result:", res1.assignee?.name, "Expected: Senior AE Alice");
    if (!res1.assigned || res1.newOwnerId !== testRepA.id) {
      throw new Error(`Test 1 Failed: Expected assigned to Rep A (${testRepA.id}), got ${res1.newOwnerId}`);
    }

    // Verify audit history created
    const audit1: any = await DealReassignmentHistory.findOne({ where: { dealId: newDeal1.id } });
    if (!audit1 || audit1.assignmentType !== "AUTOMATIC" || audit1.newOwnerId !== testRepA.id || audit1.exceededCutoff || audit1.exceededCapacity) {
      throw new Error("Test 1 Failed: Audit history invalid");
    }
    console.log("  -> Audit log verified:", audit1.reason);

    // -------------------------------------------------------------
    // TEST 2: Hard Cutoff Filtering
    // -------------------------------------------------------------
    // Deal of $75,000. Rep A is capped at $50,000, so only Rep B is eligible (even though Rep B currently has 2 deals and Rep A has 2 deals).
    const newDeal2: any = await Deal.create({
      id: crypto.randomUUID(),
      name: "Auto Deal 2 ($75k)",
      amount: 75000,
      ownerId: null,
      stageId: activeStage.id
    });
    createdDealIds.push(newDeal2.id);

    const res2 = await autoAssignDeal(newDeal2.id, managerUser.id);
    console.log("[Test 2] Cutoff filtering result:", res2.assignee?.name, "Expected: Senior AE Bob");
    if (!res2.assigned || res2.newOwnerId !== testRepB.id) {
      throw new Error(`Test 2 Failed: Expected assigned to Rep B (${testRepB.id}) due to Rep A $50k cutoff, got ${res2.newOwnerId}`);
    }

    // -------------------------------------------------------------
    // TEST 3: Hard Capacity Filtering (maxOpenDeals)
    // -------------------------------------------------------------
    // Rep A currently has 2 open deals (dealA1, newDeal1). Let's give Rep A one more to hit maxOpenDeals (3).
    const dealA3: any = await Deal.create({
      id: crypto.randomUUID(),
      name: "Rep A Open Deal 3",
      amount: 5000,
      ownerId: testRepA.id,
      stageId: activeStage.id
    });
    createdDealIds.push(dealA3.id);

    const repAOpenCount = await getOpenDealsCount(testRepA.id);
    console.log(`[Test 3] Rep A open deals count: ${repAOpenCount} (maxOpenDeals: ${testRepA.maxOpenDeals})`);

    // New deal of $15,000 (well under Rep A's $50k cutoff). Since Rep A is at 3/3 capacity, it must go to Rep B.
    const newDeal3: any = await Deal.create({
      id: crypto.randomUUID(),
      name: "Auto Deal 3 ($15k)",
      amount: 15000,
      ownerId: null,
      stageId: activeStage.id
    });
    createdDealIds.push(newDeal3.id);

    const res3 = await autoAssignDeal(newDeal3.id, managerUser.id);
    console.log("[Test 3] Capacity filtering result:", res3.assignee?.name, "Expected: Senior AE Bob");
    if (!res3.assigned || res3.newOwnerId !== testRepB.id) {
      throw new Error(`Test 3 Failed: Expected assigned to Rep B because Rep A is at maxOpenDeals capacity, got ${res3.newOwnerId}`);
    }

    // -------------------------------------------------------------
    // TEST 4: Fallback when No Rep is Eligible
    // -------------------------------------------------------------
    // Deal of $250,000 (both Rep A capped at $50k and Rep B capped at $150k). Must return { assigned: false }, not throw, not force-assign.
    const newDeal4: any = await Deal.create({
      id: crypto.randomUUID(),
      name: "Auto Deal 4 ($250k Mega Deal)",
      amount: 250000,
      ownerId: null,
      stageId: activeStage.id
    });
    createdDealIds.push(newDeal4.id);

    const res4 = await autoAssignDeal(newDeal4.id, managerUser.id);
    console.log("[Test 4] No eligible rep fallback result:", res4.assigned, "Expected: false");
    if (res4.assigned !== false) {
      throw new Error("Test 4 Failed: Expected assigned = false for deal exceeding all rep cutoffs");
    }

    // -------------------------------------------------------------
    // TEST 5: Manual Reassignment with Exceeded Cutoff & Capacity
    // -------------------------------------------------------------
    // Manager manually reassigns $250,000 deal to Rep A (who is both over cutoff $50k AND at capacity 3/3).
    // Reason is REQUIRED.
    let blankReasonErrorCaught = false;
    try {
      await manualReassignDeal(newDeal4.id, testRepA.id, "   ", managerUser.id);
    } catch (err: any) {
      blankReasonErrorCaught = true;
      console.log("[Test 5a] Blank reason validation passed:", err.message);
    }
    if (!blankReasonErrorCaught) {
      throw new Error("Test 5a Failed: Blank reason was not rejected");
    }

    const manualReason = "Strategic executive override: Rep A has personal relationship with client.";
    const manualRes = await manualReassignDeal(newDeal4.id, testRepA.id, manualReason, managerUser.id);
    console.log("[Test 5b] Manual reassignment result:", {
      success: manualRes.success,
      exceededCutoff: manualRes.exceededCutoff,
      exceededCapacity: manualRes.exceededCapacity
    });

    if (!manualRes.success || !manualRes.exceededCutoff || !manualRes.exceededCapacity) {
      throw new Error("Test 5b Failed: Expected exceededCutoff=true and exceededCapacity=true for manual override");
    }

    const manualAudit: any = await DealReassignmentHistory.findOne({
      where: { dealId: newDeal4.id, assignmentType: "MANUAL" }
    });
    if (!manualAudit || !manualAudit.exceededCutoff || !manualAudit.exceededCapacity || manualAudit.reason !== manualReason) {
      throw new Error("Test 5b Failed: Manual audit record missing or invalid");
    }
    console.log("  -> Manual audit log verified:", manualAudit.toJSON());

    // -------------------------------------------------------------
    // TEST 6: Associations Verification
    // -------------------------------------------------------------
    const dealWithHistory: any = await Deal.findByPk(newDeal4.id, {
      include: [
        {
          model: DealReassignmentHistory,
          as: "reassignmentHistory",
          include: [
            { model: User, as: "newOwner" },
            { model: User, as: "changedByUser" }
          ]
        }
      ]
    });

    if (!dealWithHistory.reassignmentHistory || dealWithHistory.reassignmentHistory.length === 0) {
      throw new Error("Test 6 Failed: Deal.hasMany(DealReassignmentHistory, as: 'reassignmentHistory') association failed");
    }
    console.log("[Test 6] Model associations verified successfully!");

    // Clean up test data
    console.log("\n[Cleanup] Cleaning up test records...");
    await DealReassignmentHistory.destroy({ where: { dealId: createdDealIds } });
    await Deal.destroy({ where: { id: createdDealIds } });
    await User.destroy({ where: { id: [testRepA.id, testRepB.id, managerUser.id] } });

    // Restore other reps availability
    for (const [id, avail] of originalAvailability.entries()) {
      await User.update({ isAvailable: avail }, { where: { id } });
    }

    console.log("=== ALL PHASE 2 TESTS PASSED PERFECTLY ===");
    process.exit(0);
  } catch (error) {
    console.error("Test Suite Failed:", error);

    // Attempt cleanup
    try {
      if (createdDealIds.length > 0) {
        await DealReassignmentHistory.destroy({ where: { dealId: createdDealIds } });
        await Deal.destroy({ where: { id: createdDealIds } });
      }
      if (testRepA && testRepB && managerUser) {
        await User.destroy({ where: { id: [testRepA.id, testRepB.id, managerUser.id] } });
      }
    } catch (cleanErr) {
      // Ignore
    }

    process.exit(1);
  }
}

runPhase2Tests();
