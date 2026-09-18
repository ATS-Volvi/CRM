import jwt from "jsonwebtoken";
import { sequelize } from "@nexus-crm/database";
import { getAdminApprovalPolicy, getSalesApprovalProfiles, upsertSalesApprovalProfile, getApprovals, updateApproval, getApprovalAuditLogs } from "../src/controllers/approvalController";

function createMockReqRes({ user, body = {}, params = {}, query = {}, method = "GET", headers = {} }: any) {
  let statusCode = 200;
  let responseData: any = null;

  const plainUser = user ? (typeof user.toJSON === "function" ? user.toJSON() : { ...user }) : null;

  const req: any = {
    user: plainUser,
    body,
    params,
    query,
    method,
    headers: {
      authorization: plainUser ? `Bearer ${jwt.sign(plainUser, process.env.JWT_SECRET || "default_secret")}` : undefined,
      ...headers
    }
  };

  const res: any = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(data: any) {
      responseData = data;
      return this;
    },
    send(data: any) {
      responseData = data;
      return this;
    }
  };

  return { req, res, getResult: () => ({ status: statusCode, body: responseData }) };
}

async function runRBACVerification() {
  console.log("=== EXPANDED APPROVAL QUEUE & LIMITS RBAC E2E VERIFICATION ===\n");

  const users: any[] = await sequelize.models.User.findAll({ attributes: ["id", "name", "email", "role", "managerId"] });

  const adminUser = users.find((u) => u.role === "admin") || users[0];
  
  // Find two distinct managers (Manager A and Manager B)
  const managers = users.filter((u) => u.role === "manager" || u.role === "sales_manager");
  const managerA = managers[0] || users[1];
  const managerB = managers[1] || users[2] || adminUser;

  let repUser = users.find((u) => u.role === "sales_rep") || users[3] || adminUser;
  let otherRepUser = users.find((u) => u.role === "sales_rep" && u.id !== repUser?.id) || users[4] || repUser;

  // Set repUser's HR managerId to Manager A
  await sequelize.models.User.update({ managerId: managerA.id }, { where: { id: repUser.id } });

  async function setRepTeamLead(salesRepId: string, teamLeadId: string) {
    let p: any = await sequelize.models.SalesApprovalProfile.findOne({ where: { salesRepId } });
    if (p) {
      await p.update({ teamLeadId, selfApprovalLimit: 1000000, discountApprovalLimit: 0.10, minimumMargin: 0.20, approvalEnabled: true });
    } else {
      await sequelize.models.SalesApprovalProfile.create({
        id: require("crypto").randomUUID(),
        salesRepId,
        teamLeadId,
        selfApprovalLimit: 1000000,
        discountApprovalLimit: 0.10,
        minimumMargin: 0.20,
        approvalEnabled: true
      });
    }
  }

  // Set initial teamLeadId to Manager A
  await setRepTeamLead(repUser.id, managerA.id);

  console.log(`Auditing with DB Users:`);
  console.log(`  Admin: ${adminUser.name} (${adminUser.id})`);
  console.log(`  Manager A (HR managerId): ${managerA.name} (${managerA.id})`);
  console.log(`  Manager B (Reassigned teamLeadId): ${managerB.name} (${managerB.id})`);
  console.log(`  Team Rep: ${repUser.name} (${repUser.id})\n`);

  let totalTests = 0;
  let passedTests = 0;

  function assert(condition: boolean, testName: string, detail: string = "") {
    totalTests++;
    if (condition) {
      passedTests++;
      console.log(`  ✅ [PASS] ${testName}`);
    } else {
      console.error(`  ❌ [FAIL] ${testName} - ${detail}`);
    }
  }

  // ── TEST GROUP 1: SALES REP RESTRICTIONS ──────────────────────────
  console.log("--- TEST GROUP 1: Sales Rep Access Restrictions ---");

  // 1.1 PUT /approval-policy as Sales Rep -> 403
  {
    const { req, res, getResult } = createMockReqRes({ user: repUser, method: "PUT", body: { maximumSalesRepApproval: 9999999 } });
    await require("../src/controllers/approvalController").updateAdminApprovalPolicy(req, res);
    const { status, body } = getResult();
    assert(status === 403, "PUT /approval-policy as Sales Rep returns 403 Forbidden", `Got ${status}: ${JSON.stringify(body)}`);
  }

  // 1.2 POST /sales-approval-profiles as Sales Rep -> 403 via route middleware
  {
    const { req, res, getResult } = createMockReqRes({ user: repUser, method: "POST", body: { salesRepId: repUser.id, selfApprovalLimit: 999999 } });
    await require("../src/middleware/auth").requireAdminOrManager(req, res, () => {});
    const { status, body } = getResult();
    assert(status === 403, "POST /sales-approval-profiles route guard blocks Sales Rep with 403", `Got ${status}: ${JSON.stringify(body)}`);
  }

  // 1.3 PUT /approvals/:id as Sales Rep -> 403
  {
    const { req, res, getResult } = createMockReqRes({ user: repUser, params: { id: "test-approval-id" }, method: "PUT", body: { status: "Approved" } });
    await updateApproval(req, res);
    const { status, body } = getResult();
    assert(status === 403, "PUT /approvals/:id (Approve/Reject) as Sales Rep returns 403 Forbidden", `Got ${status}: ${JSON.stringify(body)}`);
  }

  // 1.4 GET /approvals as Sales Rep -> pre-filtered to own requestedById
  {
    const { req, res, getResult } = createMockReqRes({ user: repUser, method: "GET" });
    await getApprovals(req, res);
    const { status, body } = getResult();
    const isFiltered = Array.isArray(body) && body.every((item: any) => item.requestedById === repUser.id);
    assert(status === 200 && isFiltered, "GET /approvals as Sales Rep returns 200 with queue pre-filtered to own submissions", `Got ${status}, count: ${body?.length}`);
  }

  // 1.5 GET /approval-audit-logs as Sales Rep -> pre-filtered to own salesRepId regardless of query param
  {
    const { req, res, getResult } = createMockReqRes({ user: repUser, query: { salesRepId: "other-user-id" }, method: "GET" });
    await getApprovalAuditLogs(req, res);
    const { status, body } = getResult();
    const isFiltered = Array.isArray(body) && body.every((item: any) => item.salesRepId === repUser.id);
    assert(status === 200 && isFiltered, "GET /approval-audit-logs as Sales Rep ignores spoofed query params and forces own salesRepId", `Got ${status}, count: ${body?.length}`);
  }

  // ── TEST GROUP 2: REASSIGNMENT & PRIMARY teamLeadId SOURCE OF TRUTH ──
  console.log("\n--- TEST GROUP 2: Reassignment & Primary teamLeadId Source of Truth ---");

  // Reassign rep's profile.teamLeadId from Manager A to Manager B (leave HR managerId pointing at Manager A)
  await setRepTeamLead(repUser.id, managerB.id);

  // 2.1 Reassigned Rep Profiles Access: Manager A gets 403 on edit, Manager B gets 200 OK
  {
    const { req: reqA, res: resA, getResult: getResultA } = createMockReqRes({
      user: managerA,
      method: "POST",
      body: { salesRepId: repUser.id, selfApprovalLimit: 500000 }
    });
    await upsertSalesApprovalProfile(reqA, resA);
    const { status: statusA } = getResultA();
    assert(statusA === 403, "Manager A gets 403 Forbidden on editing rep after profile.teamLeadId is reassigned to Manager B", `Got ${statusA}`);

    const { req: reqB, res: resB, getResult: getResultB } = createMockReqRes({
      user: managerB,
      method: "POST",
      body: { salesRepId: repUser.id, selfApprovalLimit: 600000 }
    });
    await upsertSalesApprovalProfile(reqB, resB);
    const { status: statusB } = getResultB();
    assert(statusB === 200, "Manager B gets 200 OK full access to edit rep after profile.teamLeadId reassignment", `Got ${statusB}`);
  }

  // 2.2 Reassigned Queue Access: Manager A sees 0 requests, Manager B sees rep's request
  {
    const testReq = await sequelize.models.ApprovalRequest.create({
      id: require("crypto").randomUUID(),
      targetId: require("crypto").randomUUID(),
      type: "Quote",
      status: "Pending",
      requestedById: repUser.id,
      assignedApproverId: null, // Unassigned approver ID
      comments: "Reassignment Queue Scoping Test"
    });

    const { req: reqA, res: resA, getResult: getResultA } = createMockReqRes({ user: managerA, method: "GET" });
    await getApprovals(reqA, resA);
    const { body: bodyA } = getResultA();
    const inA = Array.isArray(bodyA) && bodyA.some((item: any) => item.id === (testReq as any).id);
    assert(!inA, "Manager A (previous team lead / HR managerId) does NOT see rep's request after reassignment", `In A: ${inA}`);

    const { req: reqB, res: resB, getResult: getResultB } = createMockReqRes({ user: managerB, method: "GET" });
    await getApprovals(reqB, resB);
    const { body: bodyB } = getResultB();
    const inB = Array.isArray(bodyB) && bodyB.some((item: any) => item.id === (testReq as any).id);
    assert(inB, "Manager B (new teamLeadId) DOES see rep's request in their queue", `In B: ${inB}`);

    await (testReq as any).destroy();
  }

  // ── TEST GROUP 3: BULK ENDPOINT VERIFICATION (POST /approvals/profiles) ──
  console.log("\n--- TEST GROUP 3: Bulk Set Limits Endpoint Verification ---");

  // 3.1 POST /approvals/profiles as Admin with salesRepIds array -> 200 OK
  {
    const { req, res, getResult } = createMockReqRes({
      user: adminUser,
      method: "POST",
      body: { salesRepIds: [repUser.id], selfApprovalLimit: 800000, discountApprovalLimit: 0.10 }
    });
    await upsertSalesApprovalProfile(req, res);
    const { status, body } = getResult();
    assert(status === 200, "POST /approvals/profiles (Bulk Set Limits) as Admin returns 200 OK", `Got ${status}: ${JSON.stringify(body)}`);
  }

  // 3.2 POST /approvals/profiles as Manager B for direct report -> 200 OK
  {
    const { req, res, getResult } = createMockReqRes({
      user: managerB,
      method: "POST",
      body: { salesRepIds: [repUser.id], selfApprovalLimit: 750000, discountApprovalLimit: 0.08 }
    });
    await upsertSalesApprovalProfile(req, res);
    const { status, body } = getResult();
    assert(status === 200, "POST /approvals/profiles as Manager B for direct report returns 200 OK", `Got ${status}: ${JSON.stringify(body)}`);
  }

  // 3.3 POST /approvals/profiles as Manager A targeting rep assigned to Manager B -> 403 Forbidden
  {
    const { req, res, getResult } = createMockReqRes({
      user: managerA,
      method: "POST",
      body: { salesRepIds: [repUser.id], selfApprovalLimit: 900000 }
    });
    await upsertSalesApprovalProfile(req, res);
    const { status, body } = getResult();
    assert(status === 403, "POST /approvals/profiles as Manager A targeting rep assigned to Manager B returns 403 Forbidden", `Got ${status}: ${JSON.stringify(body)}`);
  }

  // ── TEST GROUP 4: ADMIN UNRESTRICTED ACCESS ─────────────────────────
  console.log("\n--- TEST GROUP 4: Admin Unrestricted Access ---");

  // 4.1 PUT /approval-policy as Admin -> 200 OK
  {
    const { req, res, getResult } = createMockReqRes({ user: adminUser, method: "PUT", body: { maximumSalesRepApproval: 2500000, maximumTeamLeadApproval: 10000000 } });
    await require("../src/controllers/approvalController").updateAdminApprovalPolicy(req, res);
    const { status, body } = getResult();
    assert(status === 200, "PUT /approval-policy as Admin succeeds with 200 OK", `Got ${status}: ${JSON.stringify(body)}`);
  }

  // 4.2 GET /sales-approval-profiles as Admin -> 200 OK (all profiles)
  {
    const { req, res, getResult } = createMockReqRes({ user: adminUser, method: "GET" });
    await getSalesApprovalProfiles(req, res);
    const { status, body } = getResult();
    assert(status === 200 && Array.isArray(body), "GET /sales-approval-profiles as Admin returns 200 OK with all profiles", `Got ${status}, count: ${body?.length}`);
  }

  // 4.3 GET /approvals as Admin -> 200 OK (all queue items)
  {
    const { req, res, getResult } = createMockReqRes({ user: adminUser, method: "GET" });
    await getApprovals(req, res);
    const { status, body } = getResult();
    assert(status === 200 && Array.isArray(body), "GET /approvals as Admin returns 200 OK with full queue", `Got ${status}, count: ${body?.length}`);
  }

  // ── TEST GROUP 5: ADMIN APPROVAL POLICY ACCESS CONTROLS (ADMIN-ONLY) ──
  console.log("\n--- TEST GROUP 5: Admin Approval Policy Access Controls (Admin-Only) ---");

  // 5.1 GET /approval-policy as Director -> 403 Forbidden via requireAdmin
  {
    const directorUser = { id: "dir-test-id", name: "Director Test", email: "director@nexus.com", role: "director" };
    const { req, res, getResult } = createMockReqRes({ user: directorUser, method: "GET" });
    require("../src/middleware/auth").requireAdmin(req, res, () => {});
    const { status, body } = getResult();
    assert(status === 403, "GET /approval-policy as Director returns 403 Forbidden (tightened to admin-only)", `Got ${status}: ${JSON.stringify(body)}`);
  }

  // 5.2 GET /approval-policy as Manager -> 403 Forbidden via requireAdmin
  {
    const { req, res, getResult } = createMockReqRes({ user: managerA, method: "GET" });
    require("../src/middleware/auth").requireAdmin(req, res, () => {});
    const { status, body } = getResult();
    assert(status === 403, "GET /approval-policy as Manager returns 403 Forbidden (tightened to admin-only)", `Got ${status}: ${JSON.stringify(body)}`);
  }

  // 5.3 GET /approval-policy as Admin -> 200 OK
  {
    const { req, res, getResult } = createMockReqRes({ user: adminUser, method: "GET" });
    let passedMiddleware = false;
    require("../src/middleware/auth").requireAdmin(req, res, () => { passedMiddleware = true; });
    assert(passedMiddleware, "GET /approval-policy route guard allows Admin through");
    if (passedMiddleware) {
      await getAdminApprovalPolicy(req, res);
      const { status, body } = getResult();
      assert(status === 200 && body?.maximumSalesRepApproval !== undefined, "GET /approval-policy as Admin succeeds with 200 OK and policy data", `Got ${status}`);
    }
  }

  console.log(`\n==================================================`);
  console.log(`FINAL RESULT: ${passedTests}/${totalTests} RBAC E2E verification checks passed.`);
  console.log(`==================================================`);

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runRBACVerification().then(() => process.exit(0)).catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
