import { sequelize, User, Deal, DealSplit, PipelineStage } from "@nexus-crm/database";
import {
  getTeamForManager,
  getDealSplits,
  setDealSplits,
  deleteDealSplits
} from "../services/dealSplitService";
import crypto from "crypto";

async function runTests() {
  console.log("=== RUNNING DEAL SPLIT SERVICE & MODEL TESTS ===");

  // 1. Setup test manager and team members
  const testRunId = Date.now();
  const manager = await User.create({
    id: crypto.randomUUID(),
    email: `manager_${testRunId}@nexus.com`,
    password: "password123",
    name: `Manager Test ${testRunId}`,
    role: "manager",
    isAvailable: true
  });

  const repOnTeam1 = await User.create({
    id: crypto.randomUUID(),
    email: `rep1_${testRunId}@nexus.com`,
    password: "password123",
    name: `Rep Team 1 ${testRunId}`,
    role: "senior_ae",
    managerId: manager.id,
    isAvailable: true
  });

  const repOnTeam2 = await User.create({
    id: crypto.randomUUID(),
    email: `rep2_${testRunId}@nexus.com`,
    password: "password123",
    name: `Rep Team 2 ${testRunId}`,
    role: "sales_rep",
    managerId: manager.id,
    isAvailable: true
  });

  const crossTeamRep = await User.create({
    id: crypto.randomUUID(),
    email: `crossrep_${testRunId}@nexus.com`,
    password: "password123",
    name: `Cross Rep ${testRunId}`,
    role: "senior_ae",
    managerId: null, // different manager / none
    isAvailable: true
  });

  // Create a stage & test deal
  const stage = await PipelineStage.findOne();
  const deal = await Deal.create({
    id: crypto.randomUUID(),
    name: `Deal Split Test ${testRunId}`,
    amount: 150000.0,
    ownerId: repOnTeam1.id,
    stageId: stage?.id || null
  });

  console.log("✓ Test users & deal created");

  // Test 1: getTeamForManager
  const team = await getTeamForManager(manager.id);
  if (team.length !== 2) {
    throw new Error(`Expected 2 team members for manager, got ${team.length}`);
  }
  console.log(`✓ Test 1: getTeamForManager returned ${team.length} direct reports (Rep1, Rep2)`);

  // Test 2: getDealSplits unconfigured (default synthesis)
  const defaultSplits = await getDealSplits(deal.id);
  if (!defaultSplits.isDefault || defaultSplits.splits.length !== 1 || defaultSplits.splits[0].splitPercentage !== 100) {
    throw new Error(`Expected default single 100% split, got: ${JSON.stringify(defaultSplits)}`);
  }
  console.log("✓ Test 2: getDealSplits returned synthesized default 100% split to deal owner");

  // Test 3: Validation failure when sum != 100
  try {
    await setDealSplits(deal.id, [
      { userId: repOnTeam1.id, splitPercentage: 60 },
      { userId: repOnTeam2.id, splitPercentage: 30 }
    ], manager.id);
    throw new Error("Validation should have failed for 90% sum!");
  } catch (err: any) {
    if (!err.message.includes("must sum to exactly 100.00%")) {
      throw err;
    }
    console.log("✓ Test 3: Percentage validation rejected non-100% sum (90%)");
  }

  // Test 4: Configure split with same-team and cross-team rep (70% rep1, 30% crossRep)
  const configured = await setDealSplits(deal.id, [
    { userId: repOnTeam1.id, splitPercentage: 70 },
    { userId: crossTeamRep.id, splitPercentage: 30 }
  ], manager.id);

  if (configured.isDefault || configured.splits.length !== 2) {
    throw new Error(`Expected 2 configured splits, got: ${JSON.stringify(configured)}`);
  }

  const s1 = configured.splits.find((s: any) => s.userId === repOnTeam1.id);
  const s2 = configured.splits.find((s: any) => s.userId === crossTeamRep.id);

  if (!s1 || s1.splitPercentage !== 70 || s1.isCrossTeam !== false) {
    throw new Error(`Same-team rep split invalid: ${JSON.stringify(s1)}`);
  }
  if (!s2 || s2.splitPercentage !== 30 || s2.isCrossTeam !== true) {
    throw new Error(`Cross-team rep split invalid (expected isCrossTeam: true): ${JSON.stringify(s2)}`);
  }
  console.log("✓ Test 4: Successfully saved 70/30 split. Cross-team flag correctly set to true for cross-team rep and false for direct report");

  // Test 5: Re-fetching deal splits returns the configured records
  const fetched = await getDealSplits(deal.id);
  if (fetched.isDefault || fetched.splits.length !== 2) {
    throw new Error(`Re-fetch failed: ${JSON.stringify(fetched)}`);
  }
  console.log("✓ Test 5: getDealSplits returns active configured splits (isDefault: false)");

  // Test 6: deleteDealSplits reverts back to default 100%
  const reverted = await deleteDealSplits(deal.id);
  if (!reverted.isDefault || reverted.splits.length !== 1 || reverted.splits[0].splitPercentage !== 100) {
    throw new Error(`Revert failed: ${JSON.stringify(reverted)}`);
  }
  console.log("✓ Test 6: deleteDealSplits successfully reverted deal back to default 100% to owner");

  // Clean up test data
  await DealSplit.destroy({ where: { dealId: deal.id } });
  await deal.destroy();
  await repOnTeam1.destroy();
  await repOnTeam2.destroy();
  await crossTeamRep.destroy();
  await manager.destroy();

  console.log("\n=== ALL DEAL SPLIT TESTS PASSED SUCCESSFULLY! ===");
}

runTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Test failed:", err);
    process.exit(1);
  });
