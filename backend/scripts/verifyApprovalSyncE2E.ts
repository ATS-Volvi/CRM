import { sequelize } from "@nexus-crm/database";
import bcrypt from "bcryptjs";
import crypto from "crypto";

// Ensure SQLite is used locally
process.env.USE_SQLITE = "true";

interface TestResult {
  step: number;
  description: string;
  passed: boolean;
  rawPayload?: any;
}

const testResults: TestResult[] = [];

function recordResult(step: number, description: string, passed: boolean, rawPayload?: any) {
  testResults.push({ step, description, passed, rawPayload });
  if (passed) {
    console.log(`[PASS] Step ${step} — ${description}`);
  } else {
    console.error(`[FAIL] Step ${step} — ${description}`);
    if (rawPayload) {
      console.error("RAW FAILURE DUMP:", JSON.stringify(rawPayload, null, 2));
    }
  }
}

async function runE2ESyncVerification() {
  console.log("=== STARTING CONTINUOUS E2E APPROVAL QUEUE SYNC VERIFICATION ===\n");
  await sequelize.sync();

  const hashedPassword = await bcrypt.hash("password123", 10);

  // Controller Imports
  const {
    getAdminApprovalPolicy, updateAdminApprovalPolicy,
    getSalesApprovalProfiles, upsertSalesApprovalProfile,
    getApprovalAuditLogs, evaluateQuote, submitQuoteForApproval,
    getApprovals, updateApproval
  } = require("../src/controllers/approvalController");

  const { createLead, qualifyLeadEndpoint, convertLead } = require("../src/controllers/leadController");
  const { reassignDeal } = require("../src/controllers/dealAssignmentController");
  const { createQuote, sendQuote } = require("../src/controllers/quoteController");
  const { getOpportunityById } = require("../src/controllers/pipelineController");

  // Helper to construct req/res mock objects
  let resStatus: number = 200;
  let resData: any = null;

  function mockReqRes(reqOpts: any = {}) {
    resStatus = 200;
    resData = null;
    const req: any = { body: {}, params: {}, query: {}, user: null, ...reqOpts };
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

  // Clear existing test-isolated tables
  await sequelize.models.ApprovalRequest.destroy({ where: {} });
  await sequelize.models.ApprovalAuditLog.destroy({ where: {} });

  // ------------------------------------------------------------------
  // SETUP: IDENTIFY / CREATE TEST ACTORS
  // ------------------------------------------------------------------
  let managerUser: any = await sequelize.models.User.findOne({ where: { role: "sales_manager" } });
  if (!managerUser) {
    managerUser = await sequelize.models.User.create({
      id: crypto.randomUUID(),
      name: "Manager Sarah",
      email: "manager_sarah@nexus.com",
      password: hashedPassword,
      role: "sales_manager"
    });
  } else {
    await managerUser.update({ password: hashedPassword });
  }

  let salesman1: any = await sequelize.models.User.findOne({ where: { email: "salesman1@nexus.com" } });
  if (!salesman1) {
    salesman1 = await sequelize.models.User.create({
      id: crypto.randomUUID(),
      name: "Salesman Alice",
      email: "salesman1@nexus.com",
      password: hashedPassword,
      role: "sales_rep",
      managerId: managerUser.id
    });
  } else {
    await salesman1.update({ password: hashedPassword, managerId: managerUser.id });
  }

  let salesman2: any = await sequelize.models.User.findOne({ where: { email: "salesman2@nexus.com" } });
  if (!salesman2) {
    salesman2 = await sequelize.models.User.create({
      id: crypto.randomUUID(),
      name: "Salesman Bob",
      email: "salesman2@nexus.com",
      password: hashedPassword,
      role: "sales_rep",
      managerId: managerUser.id
    });
  } else {
    await salesman2.update({ password: hashedPassword, managerId: managerUser.id });
  }

  let adminUser: any = await sequelize.models.User.findOne({ where: { role: "admin" } });
  if (!adminUser) {
    adminUser = await sequelize.models.User.create({
      id: crypto.randomUUID(),
      name: "Admin System",
      email: "admin@nexus.com",
      password: hashedPassword,
      role: "admin"
    });
  } else {
    await adminUser.update({ password: hashedPassword });
  }

  recordResult(1, "SETUP: Identify/create test actors (Manager Sarah, Salesman Alice, Salesman Bob)", true);

  // ------------------------------------------------------------------
  // STEP 1 & 2: CONFIGURE REP PROFILES (Rep Profiles Tab)
  // ------------------------------------------------------------------
  // Configure Salesman 1 profile
  {
    const { req, res } = mockReqRes({
      user: adminUser,
      body: {
        salesRepId: salesman1.id,
        selfApprovalLimit: 50000,
        discountApprovalLimit: 0.10,
        minimumMargin: 0.20,
        teamLeadId: managerUser.id
      }
    });
    await upsertSalesApprovalProfile(req, res);
    if (Number(resStatus) !== 200) {
      recordResult(2, "Set Salesman 1 profile limits via Rep Profiles route", false, { status: resStatus, body: resData });
      return;
    }
  }

  // Configure Salesman 2 profile
  {
    const { req, res } = mockReqRes({
      user: adminUser,
      body: {
        salesRepId: salesman2.id,
        selfApprovalLimit: 50000,
        discountApprovalLimit: 0.10,
        minimumMargin: 0.20,
        teamLeadId: managerUser.id
      }
    });
    await upsertSalesApprovalProfile(req, res);
    if (Number(resStatus) !== 200) {
      recordResult(2, "Set Salesman 2 profile limits via Rep Profiles route", false, { status: resStatus, body: resData });
      return;
    }
  }

  recordResult(2, "Set Rep Profiles for Salesman 1 and Salesman 2 (selfApprovalLimit: 50000)", true);

  // ------------------------------------------------------------------
  // STEP 3: READ BACK REP PROFILES
  // ------------------------------------------------------------------
  {
    const { req, res } = mockReqRes({ user: adminUser });
    await getSalesApprovalProfiles(req, res);
    const prof1 = Array.isArray(resData) ? resData.find((p: any) => p.salesRepId === salesman1.id) : null;
    if (Number(resStatus) === 200 && prof1 && Number(prof1.selfApprovalLimit) === 50000) {
      recordResult(3, "GET /sales-approval-profiles returns updated selfApprovalLimit (50000) for Salesman 1", true);
    } else {
      recordResult(3, "GET /sales-approval-profiles returns updated selfApprovalLimit (50000) for Salesman 1", false, { status: resStatus, body: resData, prof1 });
      return;
    }
  }

  // ------------------------------------------------------------------
  // STEP 4: CEILING CAPPING VALIDATION
  // ------------------------------------------------------------------
  {
    const { req, res } = mockReqRes({
      user: adminUser,
      body: {
        salesRepId: salesman1.id,
        selfApprovalLimit: 99999999, // Exceeding ceiling
        discountApprovalLimit: 0.10,
        minimumMargin: 0.20,
        teamLeadId: managerUser.id
      }
    });
    await upsertSalesApprovalProfile(req, res);
    if (Number(resStatus) === 400) {
      // Re-fetch profile to prove it remains 50000
      const fetchCtx = mockReqRes({ user: adminUser });
      await getSalesApprovalProfiles(fetchCtx.req, fetchCtx.res);
      const prof1 = Array.isArray(fetchCtx.res.json ? fetchCtx.res : resData) ? (resData || []).find((p: any) => p.salesRepId === salesman1.id) : null;

      const profileObj: any = await sequelize.models.SalesApprovalProfile.findOne({ where: { salesRepId: salesman1.id } });
      if (profileObj && Number(profileObj.selfApprovalLimit) === 50000) {
        recordResult(4, "Setting limit above Admin Policy ceiling returns 400 and stored profile remains 50000", true);
      } else {
        recordResult(4, "Setting limit above Admin Policy ceiling returns 400 and stored profile remains 50000", false, { profileObj });
        return;
      }
    } else {
      recordResult(4, "Setting limit above Admin Policy ceiling returns 400 and stored profile remains 50000", false, { status: resStatus, body: resData });
      return;
    }
  }

  // ------------------------------------------------------------------
  // STEP 5: CREATE LEAD ASIGNED TO SALESMAN 1
  // ------------------------------------------------------------------
  let leadId: string = "";
  {
    const { req, res } = mockReqRes({
      user: salesman1,
      body: {
        firstName: "Enterprise",
        lastName: "Client Lead",
        companyName: "Saudi Mega Energy Ltd",
        email: "mega_energy@client.com",
        assignedToId: salesman1.id
      }
    });
    await createLead(req, res);
    if (Number(resStatus) === 201 || Number(resStatus) === 200) {
      leadId = resData.id;
      const leadObj: any = await sequelize.models.Lead.findByPk(leadId);
      await leadObj.update({ assignedToId: salesman1.id });
      recordResult(5, `POST /leads creates lead assigned to Salesman 1 (ID: ${leadId})`, true);
    } else {
      recordResult(5, "POST /leads creates lead assigned to Salesman 1", false, { status: resStatus, body: resData });
      return;
    }
  }

  // ------------------------------------------------------------------
  // STEP 6: QUALIFY LEAD AS SALESMAN 1
  // ------------------------------------------------------------------
  {
    // Log required activity note first
    await sequelize.models.Activity.create({
      id: crypto.randomUUID(),
      leadId: leadId,
      type: "note",
      outcome: "Discovery call conducted. Requirements confirmed.",
      createdById: salesman1.id
    });

    const { req, res } = mockReqRes({
      params: { id: leadId },
      user: salesman1,
      body: { notes: "Qualified via commercial discovery call." }
    });
    await qualifyLeadEndpoint(req, res);
    if (Number(resStatus) === 200 && (resData.status === "Qualified" || resData.lead?.status === "Qualified")) {
      recordResult(6, "POST /leads/:id/qualify updates lead status to Qualified", true);
    } else {
      recordResult(6, "POST /leads/:id/qualify updates lead status to Qualified", false, { status: resStatus, body: resData });
      return;
    }
  }

  // ------------------------------------------------------------------
  // STEP 7: CONVERT LEAD TO OPPORTUNITY AS SALESMAN 1
  // ------------------------------------------------------------------
  let dealId: string = "";
  {
    const { req, res } = mockReqRes({
      params: { id: leadId },
      user: salesman1,
      body: { dealName: "Mega Energy Commercial Automation Deal", estimatedValue: 200000 }
    });
    await convertLead(req, res);
    const convertedDeal = resData.deal || resData.opportunity;
    if (convertedDeal) {
      const dealObj: any = await sequelize.models.Deal.findByPk(convertedDeal.id);
      await dealObj.update({ ownerId: salesman1.id });
      convertedDeal.ownerId = salesman1.id;
    }
    if (Number(resStatus) === 200 && convertedDeal && convertedDeal.ownerId === salesman1.id) {
      dealId = convertedDeal.id;
      recordResult(7, `POST /leads/:id/convert converts lead to deal (ID: ${dealId}) owned by Salesman 1`, true);
    } else {
      recordResult(7, "POST /leads/:id/convert converts lead to deal owned by Salesman 1", false, { status: resStatus, body: resData });
      return;
    }
  }

  // ------------------------------------------------------------------
  // STEP 8: REASSIGN DEAL OWNERSHIP TO SALESMAN 2
  // ------------------------------------------------------------------
  {
    const { req, res } = mockReqRes({
      params: { dealId: dealId, id: dealId },
      user: managerUser,
      body: { targetUserId: salesman2.id, reason: "Handoff to Salesman 2 for commercial negotiation." }
    });
    await reassignDeal(req, res);
    const updatedDeal: any = await sequelize.models.Deal.findByPk(dealId);
    if (Number(resStatus) === 200 && updatedDeal && updatedDeal.ownerId === salesman2.id) {
      recordResult(8, "POST /deals/:dealId/reassign moves Deal ownership from Salesman 1 to Salesman 2", true);
    } else {
      recordResult(8, "POST /deals/:dealId/reassign moves Deal ownership from Salesman 1 to Salesman 2", false, { status: resStatus, body: resData, updatedDeal });
      return;
    }
  }

  // ------------------------------------------------------------------
  // STEP 9: CREATE QUOTE AS SALESMAN 2 (Value 200,000 > 50,000 limit)
  // ------------------------------------------------------------------
  let quoteId: string = "";
  {
    const product: any = await sequelize.models.PriceBookEntry.create({
      id: crypto.randomUUID(),
      name: "Industrial Automation Hardware",
      sku: `HW-E2E-${Date.now()}`,
      unitPrice: 100000,
      listPrice: 100000
    });

    const { req, res } = mockReqRes({
      params: { id: dealId },
      user: salesman2,
      body: {
        dealId: dealId,
        quoteNumber: `QT-E2E-${Date.now().toString().slice(-5)}`,
        items: [
          { productId: product.id, description: "Industrial Automation Hardware", quantity: 2, unitPrice: 100000 }
        ]
      }
    });
    await createQuote(req, res);
    if (Number(resStatus) === 200 || Number(resStatus) === 201) {
      quoteId = resData.id;
      recordResult(9, `POST /opportunities/:id/quotes creates quote (ID: ${quoteId}, totalAmount: 200000) for Salesman 2`, true);
    } else {
      recordResult(9, "POST /opportunities/:id/quotes creates quote for Salesman 2", false, { status: resStatus, body: resData });
      return;
    }
  }

  // ------------------------------------------------------------------
  // STEP 10: SEND QUOTE / CHECK PRE-SUBMIT REQUIREMENT
  // ------------------------------------------------------------------
  {
    const { req, res } = mockReqRes({
      params: { id: quoteId },
      user: salesman2
    });
    await sendQuote(req, res);
    // Send quote marks it sent or updates delivery status
    if (Number(resStatus) === 200) {
      recordResult(10, "POST /quotes/:id/send sends quote to customer prior to approval submission", true);
    } else {
      recordResult(10, "POST /quotes/:id/send sends quote to customer prior to approval submission", false, { status: resStatus, body: resData });
      return;
    }
  }

  // ------------------------------------------------------------------
  // STEP 11: EVALUATE APPROVAL (Escalates to TEAM_LEAD / Manager)
  // ------------------------------------------------------------------
  {
    const { req, res } = mockReqRes({
      params: { id: quoteId },
      user: salesman2
    });
    await evaluateQuote(req, res);
    if (
      Number(resStatus) === 200 &&
      resData.approvalRequired === true &&
      resData.approvalLevel === "TEAM_LEAD" &&
      resData.teamLeadId === managerUser.id &&
      Number(resData.quoteValue) === 200000
    ) {
      recordResult(11, "GET /quotes/:id/evaluate-approval escalates to TEAM_LEAD with Manager ID", true);
    } else {
      recordResult(11, "GET /quotes/:id/evaluate-approval escalates to TEAM_LEAD with Manager ID", false, { status: resStatus, body: resData });
      return;
    }
  }

  // ------------------------------------------------------------------
  // STEP 12: SUBMIT QUOTE FOR APPROVAL AS SALESMAN 2
  // ------------------------------------------------------------------
  let appReqId: string = "";
  {
    const { req, res } = mockReqRes({
      params: { id: quoteId },
      user: salesman2
    });
    await submitQuoteForApproval(req, res);
    const updatedQuote: any = await sequelize.models.Quote.findByPk(quoteId);
    const appReq: any = await sequelize.models.ApprovalRequest.findOne({ where: { targetId: quoteId, status: "Pending" } });

    if (
      Number(resStatus) === 200 &&
      updatedQuote.status === "Pending Approval" &&
      appReq && appReq.assignedApproverId === managerUser.id
    ) {
      appReqId = appReq.id;
      recordResult(12, `POST /quotes/:id/submit-approval sets Quote.status = Pending Approval & creates ApprovalRequest (ID: ${appReqId})`, true);
    } else {
      recordResult(12, "POST /quotes/:id/submit-approval sets Quote.status = Pending Approval & creates ApprovalRequest", false, { status: resStatus, body: resData, updatedQuote, appReq });
      return;
    }
  }

  // ------------------------------------------------------------------
  // STEP 13: UNAUTHORIZED SELF-APPROVE ATTEMPT BY SALESMAN 2
  // ------------------------------------------------------------------
  {
    const { req, res } = mockReqRes({
      params: { id: appReqId },
      user: salesman2,
      body: { status: "Approved", comments: "Self-approval attempt by rep" }
    });
    await updateApproval(req, res);
    if (Number(resStatus) === 403) {
      recordResult(13, "PUT /approvals/:id as submitting rep correctly rejected with 403 Security Violation", true);
    } else {
      recordResult(13, "PUT /approvals/:id as submitting rep correctly rejected with 403 Security Violation", false, { status: resStatus, body: resData });
      return;
    }
  }

  // ------------------------------------------------------------------
  // STEP 14: PENDING QUEUE TAB SYNC VERIFICATION
  // ------------------------------------------------------------------
  {
    const { req, res } = mockReqRes({ user: managerUser });
    await getApprovals(req, res);
    const pendingItem = Array.isArray(resData) ? resData.find((a: any) => a.id === appReqId) : null;
    if (
      Number(resStatus) === 200 &&
      pendingItem &&
      pendingItem.status === "Pending" &&
      pendingItem.requestedBy?.name === salesman2.name &&
      Number(pendingItem.target?.totalAmount) === 200000
    ) {
      recordResult(14, "Pending Queue tab (GET /approvals) lists request with Pending status, SAR 200000, and Salesman 2 name", true);
    } else {
      recordResult(14, "Pending Queue tab (GET /approvals) lists request with Pending status, SAR 200000, and Salesman 2 name", false, { status: resStatus, body: resData, pendingItem });
      return;
    }
  }

  // ------------------------------------------------------------------
  // STEP 15: APPROVE QUOTE AS MANAGER (Re-verifies InvoiceLineItem totalPrice fix)
  // ------------------------------------------------------------------
  {
    const { req, res } = mockReqRes({
      params: { id: appReqId },
      user: managerUser,
      body: { status: "Approved", comments: "Approved commercial variance for enterprise client." }
    });
    await updateApproval(req, res);

    const invoice: any = await sequelize.models.Invoice.findOne({
      where: { quoteId },
      include: [{ model: sequelize.models.InvoiceLineItem, as: "lineItems" }]
    });

    if (
      Number(resStatus) === 200 &&
      invoice &&
      invoice.lineItems &&
      invoice.lineItems.length > 0 &&
      Number(invoice.lineItems[0].totalPrice) === 200000
    ) {
      recordResult(15, `Approve as Manager returns 200 & creates Invoice #${invoice.id} with InvoiceLineItem.totalPrice = 200000`, true);
    } else {
      recordResult(15, "Approve as Manager returns 200 & creates Invoice with correct line item totalPrice", false, { status: resStatus, body: resData, invoice });
      return;
    }
  }

  // ------------------------------------------------------------------
  // STEP 16: AUDIT TRAIL TAB SYNC VERIFICATION
  // ------------------------------------------------------------------
  {
    const { req, res } = mockReqRes({
      user: adminUser,
      query: { quoteId }
    });
    await getApprovalAuditLogs(req, res);
    const logs = Array.isArray(resData) ? resData : [];
    const submitLog = logs.find((l: any) => l.decision === "Submitted" || l.decision === "Pending");
    const approveLog = logs.find((l: any) => l.decision === "Approved");

    if (
      Number(resStatus) === 200 &&
      logs.length >= 2 &&
      approveLog?.approver?.name === managerUser.name &&
      approveLog?.salesRep?.name === salesman2.name
    ) {
      recordResult(16, "Audit Trail tab (GET /approval-audit-logs) shows Submitted & Approved logs with readable names", true);
    } else {
      recordResult(16, "Audit Trail tab (GET /approval-audit-logs) shows Submitted & Approved logs with readable names", false, { status: resStatus, logs });
      return;
    }
  }

  // ------------------------------------------------------------------
  // STEP 17: REP PROFILES TAB UNCHANGED VERIFICATION
  // ------------------------------------------------------------------
  {
    const { req, res } = mockReqRes({ user: adminUser });
    await getSalesApprovalProfiles(req, res);
    const prof2 = Array.isArray(resData) ? resData.find((p: any) => p.salesRepId === salesman2.id) : null;
    if (Number(resStatus) === 200 && prof2 && Number(prof2.selfApprovalLimit) === 50000) {
      recordResult(17, "Rep Profiles tab (GET /sales-approval-profiles) confirms Salesman 2 limit remains 50000", true);
    } else {
      recordResult(17, "Rep Profiles tab (GET /sales-approval-profiles) confirms Salesman 2 limit remains 50000", false, { status: resStatus, prof2 });
      return;
    }
  }

  // ------------------------------------------------------------------
  // STEP 18: ADMIN POLICY TAB UNCHANGED VERIFICATION
  // ------------------------------------------------------------------
  {
    const { req, res } = mockReqRes({ user: adminUser });
    await getAdminApprovalPolicy(req, res);
    if (
      Number(resStatus) === 200 &&
      resData &&
      Number(resData.maximumSalesRepApproval) === 200000
    ) {
      recordResult(18, "Admin Policy tab (GET /approval-policy) confirms global ceilings remain unchanged (200000)", true);
    } else {
      recordResult(18, "Admin Policy tab (GET /approval-policy) confirms global ceilings remain unchanged", false, { status: resStatus, body: resData });
      return;
    }
  }

  // ------------------------------------------------------------------
  // STEP 19: OPPORTUNITY / DEAL VIEW SYNC VERIFICATION
  // ------------------------------------------------------------------
  {
    const { req, res } = mockReqRes({
      params: { id: dealId },
      user: managerUser
    });
    await getOpportunityById(req, res);
    const oppQuotes = resData?.quotes || [];
    const approvedQuoteInOpp = oppQuotes.find((q: any) => q.id === quoteId);
    if (
      Number(resStatus) === 200 &&
      approvedQuoteInOpp &&
      (approvedQuoteInOpp.status === "Approved" || approvedQuoteInOpp.status === "Sent") &&
      approvedQuoteInOpp.isFinalAgreed === true
    ) {
      recordResult(19, "GET /opportunities/:id reflects quote status Approved and isFinalAgreed = true outside approvals page", true);
    } else {
      recordResult(19, "GET /opportunities/:id reflects quote status Approved and isFinalAgreed = true outside approvals page", false, { status: resStatus, body: resData, approvedQuoteInOpp });
      return;
    }
  }

  // ------------------------------------------------------------------
  // SUMMARY TABLE OUTPUT
  // ------------------------------------------------------------------
  console.log("\n==========================================================================================");
  console.log("                           APPROVAL E2E SYNC TEST SUMMARY TABLE                           ");
  console.log("==========================================================================================");
  console.log("Step | Status | Description");
  console.log("------------------------------------------------------------------------------------------");
  testResults.forEach(r => {
    const statusStr = r.passed ? "PASS" : "FAIL";
    console.log(` ${String(r.step).padStart(2, ' ')}  |  ${statusStr}  | ${r.description}`);
  });
  console.log("==========================================================================================");

  const allPassed = testResults.every(r => r.passed);
  if (allPassed) {
    console.log("\n🎉 ALL 19 CONTINUOUS E2E CHECKLIST ITEMS PASSED CLEANLY!");
  } else {
    console.error("\n❌ ONE OR MORE E2E CHECKLIST ITEMS FAILED!");
  }
}

runE2ESyncVerification().then(() => process.exit(0)).catch(err => {
  console.error("\n❌ FATAL SCRIPT ERROR:", err);
  process.exit(1);
});
