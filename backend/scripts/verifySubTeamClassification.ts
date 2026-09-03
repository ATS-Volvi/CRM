import { sequelize } from "@nexus-crm/database";
import bcrypt from "bcryptjs";
import crypto from "crypto";

process.env.USE_SQLITE = "true";

async function verifySubTeamClassification() {
  console.log("=== STARTING SUB-TEAM CLASSIFICATION ROUND-TRIP VERIFICATION ===\n");
  await sequelize.sync();

  const hashedPassword = await bcrypt.hash("password123", 10);

  // 1. SETUP TEST ADMIN AND REP
  let adminUser: any = await sequelize.models.User.findOne({ where: { role: "admin" } });
  if (!adminUser) {
    adminUser = await sequelize.models.User.create({
      id: crypto.randomUUID(),
      name: "Admin Tester",
      email: "admin_subteam@nexus.com",
      password: hashedPassword,
      role: "admin"
    });
  }

  let testRep: any = await sequelize.models.User.findOne({ where: { role: "sales_rep" } });
  if (!testRep) {
    testRep = await sequelize.models.User.create({
      id: crypto.randomUUID(),
      name: "SubTeam Rep Tester",
      email: "rep_subteam@nexus.com",
      password: hashedPassword,
      role: "sales_rep"
    });
  }

  const { updateRepTeamType, getAllSalespersons } = require("../src/controllers/salespersonController");
  const { getSalesApprovalProfiles } = require("../src/controllers/approvalController");

  let resStatus: number = 200;
  let resData: any = null;

  function mockReqRes(reqOpts: any = {}) {
    resStatus = 200;
    resData = null;
    const req: any = { body: {}, params: {}, query: {}, user: adminUser, ...reqOpts };
    const res: any = {
      status: (code: number) => {
        resStatus = code;
        return {
          json: (d: any) => { resData = d; return d; }
        };
      },
      json: (d: any) => { resData = d; return d; }
    };
    return { req, res };
  }

  const testValues = [
    { targetInput: "PRESALES", expectedInDb: "PRESALES", label: "Presales Team" },
    { targetInput: "SALES", expectedInDb: "SALES", label: "Sales Team" },
    { targetInput: "", expectedInDb: null, label: "Unassigned (Empty string)" },
    { targetInput: null, expectedInDb: null, label: "Unassigned (null)" }
  ];

  for (let i = 0; i < testValues.length; i++) {
    const test = testValues[i];
    console.log(`\n--- Test ${i + 1}: Update sub-team to "${test.label}" (Input: ${JSON.stringify(test.targetInput)}) ---`);

    // 1. PATCH request
    const patchCtx = mockReqRes({
      params: { id: testRep.id },
      body: { teamType: test.targetInput }
    });
    await updateRepTeamType(patchCtx.req, patchCtx.res);

    console.log(`PATCH Response Code: ${resStatus}`);
    console.log(`PATCH Response Payload:`, JSON.stringify(resData, null, 2));

    if (resStatus !== 200) {
      throw new Error(`PATCH /api/v1/users/${testRep.id}/team-type failed with status ${resStatus}`);
    }

    // 2. Fresh GET /salespersons
    const getCtx = mockReqRes();
    await getAllSalespersons(getCtx.req, getCtx.res);

    const fetchedUser = (resData || []).find((u: any) => u.id === testRep.id);
    console.log(`GET /salespersons returned teamType: "${fetchedUser?.teamType}"`);

    // 3. Fresh GET /sales-approval-profiles
    const profCtx = mockReqRes();
    await getSalesApprovalProfiles(profCtx.req, profCtx.res);

    const fetchedProf = (resData || []).find((p: any) => p.salesRepId === testRep.id || p.salesRep?.id === testRep.id);
    console.log(`GET /sales-approval-profiles returned salesRep.teamType: "${fetchedProf?.salesRep?.teamType}"`);

    if (fetchedUser?.teamType !== test.expectedInDb) {
      throw new Error(`Round-trip verification FAILED! Expected teamType: ${test.expectedInDb}, got: ${fetchedUser?.teamType}`);
    }

    if (fetchedProf?.salesRep?.teamType !== test.expectedInDb) {
      throw new Error(`Round-trip verification FAILED in approval profiles! Expected salesRep.teamType: ${test.expectedInDb}, got: ${fetchedProf?.salesRep?.teamType}`);
    }

    console.log(`✅ TEST ${i + 1} PASSED: Successfully persisted "${test.label}" and confirmed via fresh GET endpoints!`);
  }

  console.log("\n==========================================================================================");
  console.log("🎉 ALL SUB-TEAM CLASSIFICATION ROUND-TRIP TESTS PASSED WITH REAL ENDPOINT PERSISTENCE!");
  console.log("==========================================================================================");
}

verifySubTeamClassification().then(() => process.exit(0)).catch(err => {
  console.error("\n❌ VERIFICATION SCRIPT FAILED:", err);
  process.exit(1);
});
