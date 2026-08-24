import path from "path";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config();
import { Database, sequelize, User, Deal, DealSplit, DealOwner, WorkspaceSetting, Lead } from "@nexus-crm/database";
import { convertLeadToOpportunity } from "../src/services/leadJourneyWorkflowEngine";
import { updateWorkspaceSetting, getWorkspaceSetting } from "../src/controllers/dealOwnerController";
import crypto from "crypto";

async function runTests() {
  console.log("============================================================");
  console.log("🧪 TESTING SECOND-TIER CLOSER ASSIGNMENT & SETTINGS PERSISTENCE");
  console.log("============================================================");

  await Database.createConnection();
  console.log("✓ Database connection established");

  const runId = Date.now();

  // ─────────────────────────────────────────────────────────────
  // TEST 1: SETTINGS EDITABILITY & PERSISTENCE
  // ─────────────────────────────────────────────────────────────
  console.log("\n▶ TEST 1: Testing Settings read/write against WorkspaceSetting...");

  // Mock Express Request / Response for updateWorkspaceSetting
  let putStatus = 0;
  let putBody: any = null;
  const mockReqPutSplit: any = {
    user: { id: "admin-user", role: "admin" },
    params: { key: "default_qualifying_split_pct" },
    body: { value: "30.0", description: "Configured 30% SDR qualifying split" }
  };
  const mockResPutSplit: any = {
    status: (code: number) => { putStatus = code; return mockResPutSplit; },
    json: (data: any) => { putBody = data; }
  };
  await updateWorkspaceSetting(mockReqPutSplit, mockResPutSplit);
  console.log(`✓ Updated default_qualifying_split_pct to 30.0% (HTTP Status: ${putStatus || 200})`);

  let getStatus = 0;
  let getBody: any = null;
  const mockReqGetSplit: any = {
    params: { key: "default_qualifying_split_pct" }
  };
  const mockResGetSplit: any = {
    status: (code: number) => { getStatus = code; return mockResGetSplit; },
    json: (data: any) => { getBody = data; }
  };
  await getWorkspaceSetting(mockReqGetSplit, mockResGetSplit);
  console.log(`✓ Read default_qualifying_split_pct from DB: ${getBody?.value}%`);
  if (parseFloat(getBody?.value) !== 30.0) {
    throw new Error(`Expected 30.0%, got ${getBody?.value}`);
  }

  // Update closing_tier_names setting
  const mockReqPutTiers: any = {
    user: { id: "admin-user", role: "admin" },
    params: { key: "closing_tier_names" },
    body: { value: "senior_ae, Enterprise AE, Strategic AE", description: "Designated closer tiers" }
  };
  const mockResPutTiers: any = {
    status: (code: number) => { putStatus = code; return mockResPutTiers; },
    json: (data: any) => { putBody = data; }
  };
  await updateWorkspaceSetting(mockReqPutTiers, mockResPutTiers);
  console.log(`✓ Updated closing_tier_names (HTTP Status: ${putStatus || 200})`);

  const mockReqGetTiers: any = {
    params: { key: "closing_tier_names" }
  };
  const mockResGetTiers: any = {
    status: (code: number) => { getStatus = code; return mockResGetTiers; },
    json: (data: any) => { getBody = data; }
  };
  await getWorkspaceSetting(mockReqGetTiers, mockResGetTiers);
  console.log(`✓ Read closing_tier_names from DB: "${getBody?.value}"`);
  if (!getBody?.value?.includes("senior_ae")) {
    throw new Error(`Expected closing_tier_names to contain senior_ae, got ${getBody?.value}`);
  }

  // ─────────────────────────────────────────────────────────────
  // TEST 2: SECOND-TIER ASSIGNMENT WITH DISTINCT CLOSER-TIER REP
  // ─────────────────────────────────────────────────────────────
  console.log("\n▶ TEST 2: Converting Lead when distinct closer-tier rep exists...");

  // Create SDR / Qualifying Rep
  const qualifyingRep = await User.create({
    id: crypto.randomUUID(),
    name: `SDR Qualifying Rep ${runId}`,
    email: `sdr_${runId}@nexus.com`,
    password: "password123",
    role: "sales_rep",
    experienceTier: "Sales Representative",
    isAvailable: true
  });

  // Create Senior AE / Closing Rep
  const closingRep = await User.create({
    id: crypto.randomUUID(),
    name: `Senior Closer AE ${runId}`,
    email: `closer_${runId}@nexus.com`,
    password: "password123",
    role: "senior_ae",
    experienceTier: "Enterprise AE",
    isAvailable: true,
    dealValueCutoff: null,
    maxOpenDeals: null
  });

  // Create New Lead assigned to SDR
  const lead = await Lead.create({
    id: crypto.randomUUID(),
    firstName: "SecondTier",
    lastName: "LeadTest",
    email: `lead_${runId}@example.com`,
    status: "QUALIFIED",
    company: `Enterprise Corp ${runId}`,
    industry: "Technology",
    territory: "North America",
    expectedValue: 150000,
    assignedToId: qualifyingRep.id
  });

  console.log(`✓ Created lead ${lead.id} assigned to qualifying SDR: ${qualifyingRep.name} (${qualifyingRep.id})`);

  // Convert Lead to Opportunity
  const conversionResult = await convertLeadToOpportunity(
    lead.id,
    { requirement: "Enterprise Suite", estimatedValue: 150000 },
    qualifyingRep.id
  );

  const dealId = conversionResult.deal.id;
  const createdDeal: any = await Deal.findByPk(dealId);

  console.log(`✓ Opportunity Created: ${createdDeal.id}`);
  console.log(`  - Lead assignedToId (SDR): ${qualifyingRep.id}`);
  console.log(`  - Deal ownerId (Closing AE): ${createdDeal.ownerId}`);

  // Verification (a): Deal ownerId is genuinely different from qualifying SDR
  if (createdDeal.ownerId === qualifyingRep.id) {
    throw new Error(`FAIL: Deal ownerId (${createdDeal.ownerId}) matches lead assignedToId (${qualifyingRep.id}). Expected distinct closer!`);
  }
  console.log(`✓ Confirmed: Deal ownerId (${createdDeal.ownerId}) is genuinely different from qualifying rep (${qualifyingRep.id})`);

  // ─────────────────────────────────────────────────────────────
  // TEST 3: VERIFY DEALSPLIT & DEALOWNER COMMISSION SPLITS
  // ─────────────────────────────────────────────────────────────
  console.log("\n▶ TEST 3: Verifying DealSplit and DealOwner records created for the deal...");

  const splits = await DealSplit.findAll({ where: { dealId } });
  console.log(`✓ Found ${splits.length} DealSplit records:`);
  for (const s of splits as any[]) {
    console.log(`  - User: ${s.userId} | Split: ${s.splitPercentage}%`);
  }

  const sdrSplit = (splits as any[]).find((s) => s.userId === qualifyingRep.id);
  const closerSplit = (splits as any[]).find((s) => s.userId === createdDeal.ownerId);

  if (!sdrSplit || parseFloat(sdrSplit.splitPercentage) !== 30.0) {
    throw new Error(`FAIL: SDR split not 30.0%. Found: ${sdrSplit?.splitPercentage}`);
  }
  if (!closerSplit || parseFloat(closerSplit.splitPercentage) !== 70.0) {
    throw new Error(`FAIL: Closer AE split not 70.0%. Found: ${closerSplit?.splitPercentage}`);
  }
  console.log(`✓ Confirmed: DealSplit correctly allocated 30% to SDR and 70% to Closing AE.`);

  const owners = await DealOwner.findAll({ where: { dealId } });
  console.log(`✓ Found ${owners.length} DealOwner records:`);
  for (const o of owners as any[]) {
    console.log(`  - User: ${o.userId} | Role: ${o.role} | Split: ${o.splitPct}%`);
  }

  const sdrOwner = (owners as any[]).find((o) => o.role === "qualifying_rep");
  const closerOwner = (owners as any[]).find((o) => o.role === "closing_ae");

  if (!sdrOwner || sdrOwner.userId !== qualifyingRep.id || parseFloat(sdrOwner.splitPct) !== 30.0) {
    throw new Error(`FAIL: DealOwner qualifying_rep record incorrect. Found: ${JSON.stringify(sdrOwner)}`);
  }
  if (!closerOwner || closerOwner.userId !== createdDeal.ownerId || parseFloat(closerOwner.splitPct) !== 70.0) {
    throw new Error(`FAIL: DealOwner closing_ae record incorrect. Found: ${JSON.stringify(closerOwner)}`);
  }
  console.log(`✓ Confirmed: Both qualifying_rep and closing_ae roles exist in DealOwner with 30%/70% splits.`);

  // ─────────────────────────────────────────────────────────────
  // TEST 4: FALLBACK WHEN NO DISTINCT CLOSER IS AVAILABLE
  // ─────────────────────────────────────────────────────────────
  console.log("\n▶ TEST 4: Testing fallback when qualifying rep is sole eligible candidate...");

  // Restrict closer tiers temporarily to a non-existent tier
  await WorkspaceSetting.update(
    { value: "non_existent_tier_xyz" },
    { where: { key: "closing_tier_names" } }
  );

  const fallbackLead = await Lead.create({
    id: crypto.randomUUID(),
    firstName: "Fallback",
    lastName: "Lead",
    email: `fallback_${runId}@example.com`,
    status: "QUALIFIED",
    assignedToId: qualifyingRep.id
  });

  const fallbackConversion = await convertLeadToOpportunity(
    fallbackLead.id,
    { requirement: "Fallback Requirement", estimatedValue: 50000 },
    qualifyingRep.id
  );

  const fallbackDeal: any = await Deal.findByPk(fallbackConversion.deal.id);
  console.log(`✓ Fallback Deal ownerId: ${fallbackDeal.ownerId} (Lead assignedToId: ${qualifyingRep.id})`);
  if (fallbackDeal.ownerId !== qualifyingRep.id) {
    throw new Error(`Expected fallback deal ownerId to remain ${qualifyingRep.id}, got ${fallbackDeal.ownerId}`);
  }

  const fallbackSplits = await DealSplit.findAll({ where: { dealId: fallbackDeal.id } });
  console.log(`✓ Fallback DealSplits count: ${fallbackSplits.length}, Split: ${(fallbackSplits[0] as any)?.splitPercentage}%`);
  if (fallbackSplits.length !== 1 || parseFloat((fallbackSplits[0] as any)?.splitPercentage) !== 100.0) {
    throw new Error("Expected single 100% split on fallback");
  }
  console.log("✓ Confirmed: Fallback cleanly retained qualifying rep as 100% sole owner.");

  // Clean up test data
  await WorkspaceSetting.update(
    { value: "senior_ae, Senior Sales Representative, Enterprise AE, Strategic AE, Closer" },
    { where: { key: "closing_tier_names" } }
  );
  await WorkspaceSetting.update(
    { value: "20.0" },
    { where: { key: "default_qualifying_split_pct" } }
  );

  console.log("\n============================================================");
  console.log("🎉 ALL TESTS PASSED SUCCESSFULLY (100% VERIFIED)");
  console.log("============================================================");

  process.exit(0);
}

runTests().catch((err) => {
  console.error("\n❌ Test failed with error:", err);
  process.exit(1);
});
