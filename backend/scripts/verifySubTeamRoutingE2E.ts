import { sequelize } from "@nexus-crm/database";
import { Op } from "sequelize";
import bcrypt from "bcryptjs";
import crypto from "crypto";

process.env.USE_SQLITE = "true";

interface SubTeamTestResult {
  testId: number;
  description: string;
  passed: boolean;
  details?: any;
}

const testResults: SubTeamTestResult[] = [];

function recordTest(testId: number, description: string, passed: boolean, details?: any) {
  testResults.push({ testId, description, passed, details });
  if (passed) {
    console.log(`[PASS] Test ${testId} — ${description}`);
  } else {
    console.error(`[FAIL] Test ${testId} — ${description}`);
    if (details) console.error("FAILURE DETAILS:", JSON.stringify(details, null, 2));
  }
}

async function runSubTeamRoutingE2E() {
  console.log("=== STARTING SUB-TEAM ROUTING (PRESALES -> SALES HANDOFF) E2E VERIFICATION ===\n");
  await sequelize.sync();

  const hashedPassword = await bcrypt.hash("password123", 10);

  const { createLead, qualifyLeadEndpoint, convertLead } = require("../src/controllers/leadController");
  const { updateRepTeamType } = require("../src/controllers/salespersonController");

  function mockReqRes(reqOpts: any = {}) {
    let localStatus = 200;
    let localData: any = null;
    const req: any = { body: {}, params: {}, query: {}, user: null, ...reqOpts };
    const res: any = {
      status: (code: number) => {
        localStatus = code;
        return {
          json: (d: any) => { localData = d; return d; },
          send: (d: any) => { localData = d; return d; }
        };
      },
      json: (d: any) => { localData = d; return d; },
      send: (d: any) => { localData = d; return d; }
    };
    return { req, res, getStatus: () => localStatus, getData: () => localData };
  }

  // 1. SETUP TEST ACTORS: Alexander (Sales), Amelia (Presales), Rep C (Sales)
  let managerUser: any = await sequelize.models.User.findOne({ where: { role: "sales_manager" } });
  if (!managerUser) {
    managerUser = await sequelize.models.User.create({
      id: crypto.randomUUID(),
      name: "Manager Sarah",
      email: "manager_subteam_e2e@nexus.com",
      password: hashedPassword,
      role: "sales_manager"
    });
  }

  let alexander: any = await sequelize.models.User.findOne({ where: { email: "alexander@nexus.com" } });
  if (!alexander) {
    alexander = await sequelize.models.User.create({
      id: crypto.randomUUID(),
      name: "Alexander Wright",
      email: "alexander@nexus.com",
      password: hashedPassword,
      role: "sales_rep",
      teamType: "SALES",
      isAvailable: true,
      managerId: managerUser.id
    });
  } else {
    await alexander.update({ teamType: "SALES", isAvailable: true });
  }

  let amelia: any = await sequelize.models.User.create({
    id: crypto.randomUUID(),
    name: "Amelia Rodriguez",
    email: `amelia_${Date.now()}@nexus.com`,
    password: hashedPassword,
    role: "sales_rep",
    teamType: "PRESALES",
    isAvailable: true,
    managerId: managerUser.id
  });

  let repC: any = await sequelize.models.User.create({
    id: crypto.randomUUID(),
    name: "Charles Closer",
    email: `charles_${Date.now()}@nexus.com`,
    password: hashedPassword,
    role: "senior_ae",
    teamType: "SALES",
    isAvailable: true,
    managerId: managerUser.id
  });

  console.log(`Actors Created/Configured:`);
  console.log(` - Alexander Wright (${alexander.id}): teamType = SALES`);
  console.log(` - Amelia Rodriguez (${amelia.id}): teamType = PRESALES`);
  console.log(` - Charles Closer (${repC.id}): teamType = SALES\n`);

  // ------------------------------------------------------------------
  // TEST CASE 1: REAL-WORLD SCENARIO (Lead owned by Alexander converted -> assigned to Sales Rep C, NOT Amelia)
  // ------------------------------------------------------------------
  console.log("--- TEST CASE 1: Real-World Scenario (Sales Lead Converted -> Sales Team Closer) ---");
  {
    // Create Lead assigned to Alexander
    const createCtx = mockReqRes({
      user: alexander,
      body: {
        firstName: "Saudi",
        lastName: "Enterprise Corp",
        companyName: "Saudi Enterprise Automation Ltd",
        email: `enterprise_${Date.now()}@client.com`,
        assignedToId: alexander.id
      }
    });
    await createLead(createCtx.req, createCtx.res);
    const leadId = createCtx.getData().id;
    const leadObj: any = await sequelize.models.Lead.findByPk(leadId);
    await leadObj.update({ assignedToId: alexander.id });

    // Log discovery note
    await sequelize.models.Activity.create({
      id: crypto.randomUUID(),
      leadId: leadId,
      type: "note",
      outcome: "Discovery call completed by Alexander.",
      createdById: alexander.id
    });

    // Qualify Lead
    const qualCtx = mockReqRes({
      params: { id: leadId },
      user: managerUser,
      body: { notes: "Qualified for enterprise proposal." }
    });
    await qualifyLeadEndpoint(qualCtx.req, qualCtx.res);

    // Convert Lead
    const convCtx = mockReqRes({
      params: { id: leadId },
      user: managerUser,
      body: { dealName: "Enterprise Automation Deal", estimatedValue: 250000 }
    });
    await convertLead(convCtx.req, convCtx.res);

    const convResult = convCtx.getData();
    const autoAssignResult = convResult?.autoAssignResult;
    const dealOwnerId = autoAssignResult?.newOwnerId || convResult?.deal?.ownerId || convResult?.opportunity?.ownerId;
    const subTeamMethod = autoAssignResult?.subTeamRoutingMethod || autoAssignResult?.assignee?.subTeamRoutingMethod;

    console.log(`Converted Deal Owner ID: ${dealOwnerId}`);
    console.log(`Auto-Assign Routing Method: ${subTeamMethod}`);

    const isSalesCloser = String(dealOwnerId) === String(repC.id) || String(dealOwnerId) === String(alexander.id);
    const notPresalesRep = String(dealOwnerId) !== String(amelia.id);
    const isFiltered = subTeamMethod === "SUB_TEAM_FILTERED";

    if (isSalesCloser && notPresalesRep && isFiltered) {
      recordTest(1, "Converted Opportunity assigned to Sales Team rep (Sales Team Closer), NOT Presales rep (Amelia Rodriguez) with SUB_TEAM_FILTERED method", true);
    } else {
      recordTest(1, "Converted Opportunity assigned to Sales Team rep, NOT Presales rep", false, { dealOwnerId, autoAssignResult, subTeamMethod, ameliaId: amelia.id, repCId: repC.id, alexanderId: alexander.id });
    }
  }

  // ------------------------------------------------------------------
  // TEST CASE 2: DYNAMIC CLASSIFICATION SWAP VERIFICATION
  // ------------------------------------------------------------------
  console.log("\n--- TEST CASE 2: Dynamic Classification Swap (Amelia -> SALES, Charles & Alexander -> PRESALES) ---");
  {
    // Swap classifications: Set all reps EXCEPT Amelia & Alexander to PRESALES, making Amelia & Alexander the SALES reps
    await sequelize.models.User.update({ teamType: "PRESALES" }, { where: { id: { [Op.notIn]: [amelia.id, alexander.id] }, role: { [Op.ne]: "admin" } } });
    await amelia.update({ teamType: "SALES" });
    await alexander.update({ teamType: "SALES" });
    await repC.update({ teamType: "PRESALES" });

    // Create Lead assigned to Charles (Presales)
    const createCtx = mockReqRes({
      user: managerUser,
      body: {
        firstName: "Dynamic",
        lastName: "Swap Corp",
        companyName: "Dynamic Swap Systems",
        email: `swap_${Date.now()}@client.com`,
        assignedToId: repC.id
      }
    });
    await createLead(createCtx.req, createCtx.res);
    const leadId = createCtx.getData().id;
    const leadObj: any = await sequelize.models.Lead.findByPk(leadId);
    await leadObj.update({ assignedToId: repC.id });

    // Log activity
    await sequelize.models.Activity.create({
      id: crypto.randomUUID(),
      leadId: leadId,
      type: "note",
      outcome: "Discovery call by Charles.",
      createdById: repC.id
    });

    // Qualify & Convert by Manager
    const qualCtx = mockReqRes({ params: { id: leadId }, user: managerUser, body: { notes: "Qualified." } });
    await qualifyLeadEndpoint(qualCtx.req, qualCtx.res);

    const convCtx = mockReqRes({
      params: { id: leadId },
      user: managerUser,
      body: {
        dealName: "Dynamic Swap Deal",
        estimatedValue: 300000,
        ownerId: repC.id,
        qualificationData: { estimatedValue: 300000, ownerId: repC.id }
      }
    });
    await convertLead(convCtx.req, convCtx.res);

    const convResult = convCtx.getData();
    const autoAssignResult = convResult?.autoAssignResult;
    const subTeamMethod = autoAssignResult?.assignee?.subTeamRoutingMethod || autoAssignResult?.subTeamRoutingMethod;
    const isSalesRepWinner = [amelia.id, alexander.id].includes(autoAssignResult?.assignee?.repId || autoAssignResult?.newOwnerId || autoAssignResult?.oldOwnerId);

    if (isSalesRepWinner && subTeamMethod === "SUB_TEAM_FILTERED") {
      recordTest(2, "Dynamic Swap Verified: After classifying Amelia as SALES, converted Opportunity routed to Sales Team rep with SUB_TEAM_FILTERED", true);
    } else {
      recordTest(2, "Dynamic Swap Verified: Converted Opportunity routed to Amelia after classification swap", false, { autoAssignResult, ameliaId: amelia.id });
    }
  }

  // ------------------------------------------------------------------
  // TEST CASE 3: OBSERVABLE FALLBACK VERIFICATION
  // ------------------------------------------------------------------
  console.log("\n--- TEST CASE 3: Observable Fallback (All SALES reps unavailable -> SUB_TEAM_FALLBACK) ---");
  {
    // Mark all SALES reps unavailable
    await sequelize.models.User.update({ isAvailable: false }, { where: { teamType: "SALES" } });
    await alexander.update({ teamType: "SALES", isAvailable: false });
    await amelia.update({ teamType: "SALES", isAvailable: false });
    await repC.update({ teamType: "PRESALES", isAvailable: true });

    // Create Lead assigned to Manager Sarah
    const createCtx = mockReqRes({
      user: managerUser,
      body: {
        firstName: "Fallback",
        lastName: "Client",
        companyName: "Fallback Systems Ltd",
        email: `fallback_${Date.now()}@client.com`,
        assignedToId: managerUser.id
      }
    });
    await createLead(createCtx.req, createCtx.res);
    const leadId = createCtx.getData().id;
    const leadObj: any = await sequelize.models.Lead.findByPk(leadId);
    await leadObj.update({ assignedToId: managerUser.id });

    // Log activity
    await sequelize.models.Activity.create({
      id: crypto.randomUUID(),
      leadId: leadId,
      type: "note",
      outcome: "Discovery call note.",
      createdById: managerUser.id
    });

    // Qualify & Convert
    const qualCtx = mockReqRes({ params: { id: leadId }, user: managerUser, body: { notes: "Qualified." } });
    await qualifyLeadEndpoint(qualCtx.req, qualCtx.res);

    const convCtx = mockReqRes({ params: { id: leadId }, user: managerUser, body: { dealName: "Fallback Deal", estimatedValue: 150000 } });
    await convertLead(convCtx.req, convCtx.res);

    const convResult = convCtx.getData();
    const autoAssignResult = convResult?.autoAssignResult;
    const subTeamMethod = autoAssignResult?.subTeamRoutingMethod || autoAssignResult?.assignee?.subTeamRoutingMethod;

    if (subTeamMethod === "SUB_TEAM_FALLBACK" || autoAssignResult?.fallbackApplied) {
      recordTest(3, "Observable Fallback Verified: When no SALES rep is available, subTeamRoutingMethod reports SUB_TEAM_FALLBACK", true);
    } else {
      recordTest(3, "Observable Fallback Verified: When no SALES rep is available, subTeamRoutingMethod reports SUB_TEAM_FALLBACK", false, { convResult, autoAssignResult, subTeamMethod });
    }
  }

  // ------------------------------------------------------------------
  // SUMMARY TABLE OUTPUT
  // ------------------------------------------------------------------
  console.log("\n==========================================================================================");
  console.log("                      SUB-TEAM ROUTING E2E TEST SUMMARY TABLE                             ");
  console.log("==========================================================================================");
  console.log("Test | Status | Description");
  console.log("------------------------------------------------------------------------------------------");
  testResults.forEach(r => {
    const statusStr = r.passed ? "PASS" : "FAIL";
    console.log(`  ${r.testId}  |  ${statusStr}  | ${r.description}`);
  });
  console.log("==========================================================================================");

  const allPassed = testResults.every(r => r.passed);
  if (allPassed) {
    console.log("\n🎉 ALL SUB-TEAM ROUTING E2E TESTS PASSED CLEANLY!");
  } else {
    console.error("\n❌ ONE OR MORE SUB-TEAM ROUTING E2E TESTS FAILED!");
  }
}

runSubTeamRoutingE2E().then(() => process.exit(0)).catch(err => {
  console.error("\n❌ FATAL SCRIPT ERROR:", err);
  process.exit(1);
});
