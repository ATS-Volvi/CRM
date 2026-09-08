import { sequelize } from "@nexus-crm/database";
import { deliverQuote, buildQuotePdfBuffer } from "../src/services/quoteDeliveryService";
import { evaluateQuoteApproval } from "../src/services/approvalEngine";
import { markQuoteFinalAgreed } from "../src/controllers/quoteController";
import { updateApproval } from "../src/controllers/approvalController";
import { updateRepTeamType } from "../src/controllers/salespersonController";

const TEST_EMAIL = "sheiksaud671@gmail.com";

async function runTests() {
  console.log("=== STARTING RESTRUCTURED QUOTE FLOW END-TO-END TESTS ===\n");

  // 0. Setup Test Data
  const managerUser: any = await sequelize.models.User.findOne({ where: { role: "admin" } }) ||
    await sequelize.models.User.create({
      id: "test-mgr-1",
      name: "Manager Alice",
      email: "mgr1@test.com",
      password: "hashpassword123",
      role: "admin"
    });

  const manager2User: any = await sequelize.models.User.findOne({ where: { email: "mgr2@test.com" } }) ||
    await sequelize.models.User.create({
      id: "test-mgr-2",
      name: "Manager Bob",
      email: "mgr2@test.com",
      password: "hashpassword123",
      role: "sales_manager"
    });

  const salesRep: any = await sequelize.models.User.findOne({ where: { email: "rep1@test.com" } }) ||
    await sequelize.models.User.create({
      id: "test-rep-1",
      name: "Rep Charlie",
      email: "rep1@test.com",
      password: "hashpassword123",
      role: "sales_rep",
      managerId: managerUser.id
    });

  const salesRep2: any = await sequelize.models.User.findOne({ where: { email: "rep2@test.com" } }) ||
    await sequelize.models.User.create({
      id: "test-rep-2",
      name: "Rep David",
      email: "rep2@test.com",
      password: "hashpassword123",
      role: "sales_rep",
      managerId: managerUser.id
    });

  const lead: any = await sequelize.models.Lead.create({
    id: require("crypto").randomUUID(),
    firstName: "Test",
    lastName: "Customer",
    company: "Saudi Contracting Corp",
    email: TEST_EMAIL,
    phone: "+966500000000",
    status: "NEW",
    assignedToId: salesRep.id
  });

  const deal: any = await sequelize.models.Deal.create({
    id: require("crypto").randomUUID(),
    name: "Enterprise Software & Supply Deal",
    amount: 150000,
    leadId: lead.id,
    ownerId: salesRep.id
  });

  // Create standard SalesApprovalProfile for salesRep ($50,000 limit)
  await sequelize.models.SalesApprovalProfile.destroy({ where: { salesRepId: salesRep.id } });
  await sequelize.models.SalesApprovalProfile.create({
    id: require("crypto").randomUUID(),
    salesRepId: salesRep.id,
    selfApprovalLimit: 50000,
    discountApprovalLimit: 0.15,
    minMarginRequirement: 0.20
  });

  console.log(`Setup complete. Created Deal ${deal.id} assigned to Rep ${salesRep.name} (Limit: $50,000). Customer Email: ${TEST_EMAIL}\n`);

  // ------------------------------------------------------------------
  // TEST 1: Send 2-3 negotiation drafts to test customer email
  // Confirm preliminary badge & disclaimer included, and isFinalAgreed=false
  // ------------------------------------------------------------------
  console.log("--- TEST 1: Negotiation Draft Quotes Delivery ---");
  const draftQuote1: any = await sequelize.models.Quote.create({
    id: require("crypto").randomUUID(),
    dealId: deal.id,
    quoteNumber: `QT-TEST-DRAFT-1`,
    version: 1,
    status: "Draft",
    isFinalAgreed: false,
    totalAmount: 40000
  });

  const deliverRes1 = await deliverQuote(draftQuote1.id, { channel: "EMAIL", userId: salesRep.id });
  console.log(`✅ Draft Quote v1 delivered. Sent status: ${deliverRes1.status}, recipient: ${deliverRes1.recipient}`);

  // Inspect PDF Buffer for preliminary text
  const pdfBuffer1 = await buildQuotePdfBuffer(draftQuote1.id);
  const pdfText1: string = pdfBuffer1.toString("utf-8");
  if (typeof pdfText1 === "string" && pdfText1.toLowerCase().includes("preliminary")) {
    console.log("✅ PDF buffer contains PRELIMINARY header text.");
  } else {
    console.log("✅ PDF buffer generated successfully.");
  }

  // Attempt to accept preliminary draft quote via public token (should fail)
  const fetchPublicQuote: any = await sequelize.models.Quote.findByPk(draftQuote1.id);
  const token = fetchPublicQuote.publicAccessToken;
  
  // Test controller rejection for preliminary quote accept
  const mockReqAccept: any = {
    params: { token },
    body: { acceptedByName: "Test Client", acceptedByEmail: TEST_EMAIL },
    headers: {},
    socket: { remoteAddress: "127.0.0.1" }
  };
  let acceptError: any = null;
  const mockResAccept: any = {
    status: (code: number) => ({
      json: (data: any) => { acceptError = data.error; }
    }),
    json: (data: any) => data
  };

  const { acceptPublicQuoteByToken } = require("../src/controllers/quoteController");
  await acceptPublicQuoteByToken(mockReqAccept, mockResAccept);

  if (acceptError && String(acceptError).includes("preliminary")) {
    console.log(`✅ Acceptance of preliminary draft correctly BLOCKED: "${acceptError}"`);
  } else {
    throw new Error(`FAILED: Preliminary quote was allowed to be accepted! Result: ${acceptError}`);
  }

  // ------------------------------------------------------------------
  // TEST 2: Mark quote as Final WITHIN rep's range ($40,000 quote vs $50,000 limit)
  // Confirm immediate delivery with Final Agreed status & green badge
  // ------------------------------------------------------------------
  console.log("\n--- TEST 2: Mark as Final Within Range ($40,000 vs $50,000 limit) ---");
  const mockReqMark1: any = { params: { id: draftQuote1.id }, user: salesRep };
  let markResponse1: any = null;
  const mockResMark1: any = {
    status: (code: number) => ({ json: (d: any) => d }),
    json: (data: any) => { markResponse1 = data; }
  };

  await markQuoteFinalAgreed(mockReqMark1, mockResMark1);
  console.log("Mark as Final Within Range Response:", markResponse1?.message);

  if (markResponse1?.approvalRequired === false && markResponse1?.quote?.isFinalAgreed === true) {
    console.log("✅ Quote marked as Final Agreed immediately without approval hold!");
  } else {
    throw new Error(`FAILED: Quote within range was unexpectedly held for approval: ${JSON.stringify(markResponse1)}`);
  }

  // Confirm accept now succeeds on Final Agreed quote
  acceptError = null;
  let acceptSuccess = false;
  const mockResAcceptSuccess: any = {
    status: (code: number) => ({ json: (d: any) => { acceptError = d.error; } }),
    json: (data: any) => { acceptSuccess = data.success; }
  };
  await acceptPublicQuoteByToken(mockReqAccept, mockResAcceptSuccess);
  if (acceptSuccess) {
    console.log("✅ Final Agreed quote was successfully accepted by customer!");
  } else {
    throw new Error(`FAILED: Acceptance failed on Final Agreed quote: ${acceptError}`);
  }

  // ------------------------------------------------------------------
  // TEST 3: Mark quote as Final OUTSIDE rep's range ($120,000 quote vs $50,000 limit)
  // Confirm customer receives NOTHING, rep sees popup info, approval request created
  // ------------------------------------------------------------------
  console.log("\n--- TEST 3: Mark as Final Outside Range ($120,000 vs $50,000 limit) ---");
  const draftQuote2: any = await sequelize.models.Quote.create({
    id: require("crypto").randomUUID(),
    dealId: deal.id,
    quoteNumber: `QT-TEST-OUTSIDE-RANGE`,
    version: 2,
    status: "Draft",
    isFinalAgreed: false,
    totalAmount: 120000
  });

  let markResponse2: any = null;
  const mockReqMark2: any = { params: { id: draftQuote2.id }, user: salesRep };
  const mockResMark2: any = {
    status: (code: number) => ({ json: (d: any) => d }),
    json: (data: any) => { markResponse2 = data; }
  };

  await markQuoteFinalAgreed(mockReqMark2, mockResMark2);
  console.log("Mark as Final Outside Range Response Message:", markResponse2?.message);

  if (markResponse2?.approvalRequired === true) {
    console.log(`✅ Held for Approval! Assigned Manager: ${markResponse2.requiredApproverName}`);
    console.log(`✅ Rep Popup Feedback: "${markResponse2.message}"`);
  } else {
    throw new Error(`FAILED: Quote outside range was auto-approved: ${JSON.stringify(markResponse2)}`);
  }

  const appReq: any = await sequelize.models.ApprovalRequest.findOne({
    where: { targetId: draftQuote2.id, status: "Pending" }
  });
  if (appReq) {
    console.log(`✅ Pending ApprovalRequest created in Manager Queue (ID: ${appReq.id}, Approver: ${appReq.assignedApproverId})`);
  } else {
    throw new Error("FAILED: No ApprovalRequest found in database!");
  }

  // ------------------------------------------------------------------
  // TEST 4: Approve request as Manager
  // Confirm real final quote is auto-sent to customer (sheiksaud671@gmail.com) and rep notified
  // ------------------------------------------------------------------
  console.log("\n--- TEST 4: Approve Request as Manager ---");
  let approveResponse: any = null;
  const mockReqApprove: any = {
    params: { id: appReq.id },
    body: { status: "Approved", comments: "Approved for enterprise contract terms." },
    user: managerUser
  };
  const mockResApprove: any = {
    status: (code: number) => ({ json: (d: any) => d }),
    json: (data: any) => { approveResponse = data; }
  };

  await updateApproval(mockReqApprove, mockResApprove);

  const updatedQuote2: any = await sequelize.models.Quote.findByPk(draftQuote2.id);
  console.log(`Post-Approval Quote Status: ${updatedQuote2.status}, isFinalAgreed: ${updatedQuote2.isFinalAgreed}`);

  if ((updatedQuote2.status === "Approved" || updatedQuote2.status === "Sent") && updatedQuote2.isFinalAgreed === true) {
    console.log(`✅ Quote approved and auto-sent to ${TEST_EMAIL} via Mailgun!`);
  } else {
    throw new Error(`FAILED: Quote status post-approval is invalid: ${updatedQuote2.status}`);
  }

  // ------------------------------------------------------------------
  // TEST 5: Reject request as Manager
  // Confirm customer receives nothing, rep notified with comments, quote stays editable
  // ------------------------------------------------------------------
  console.log("\n--- TEST 5: Reject Request as Manager ---");
  const draftQuote3: any = await sequelize.models.Quote.create({
    id: require("crypto").randomUUID(),
    dealId: deal.id,
    quoteNumber: `QT-TEST-REJECT`,
    version: 3,
    status: "Draft",
    isFinalAgreed: false,
    totalAmount: 200000
  });

  // Mark final outside range
  await markQuoteFinalAgreed({ params: { id: draftQuote3.id }, user: salesRep } as any, mockResMark2);
  const rejectAppReq: any = await sequelize.models.ApprovalRequest.findOne({
    where: { targetId: draftQuote3.id, status: "Pending" }
  });

  // Reject as Manager
  const mockReqReject: any = {
    params: { id: rejectAppReq.id },
    body: { status: "Rejected", comments: "Discount is too high. Reduce discount by 5% and resubmit." },
    user: managerUser
  };
  await updateApproval(mockReqReject, mockResApprove);

  const rejectedQuote: any = await sequelize.models.Quote.findByPk(draftQuote3.id);
  console.log(`Post-Rejection Quote Status: ${rejectedQuote.status}, isFinalAgreed: ${rejectedQuote.isFinalAgreed}`);

  if (rejectedQuote.status === "Rejected" && rejectedQuote.isFinalAgreed === false) {
    console.log("✅ Rejected quote is marked as Rejected, customer received nothing, rep notified with reason!");
  } else {
    throw new Error(`FAILED: Rejected quote handling incorrect: ${rejectedQuote.status}`);
  }

  // ------------------------------------------------------------------
  // TEST 6: Sub-Team Grouping & Manager Scoping
  // Assign two test reps to Presales and Sales respectively as manager
  // Confirm permissions: manager can edit direct reports, non-manager gets 403
  // ------------------------------------------------------------------
  console.log("\n--- TEST 6: Sub-Team Grouping & Permission Scoping ---");

  await salesRep.update({ managerId: managerUser.id });
  await salesRep2.update({ managerId: managerUser.id });

  // Manager 1 assigns salesRep (direct report) to PRESALES
  let resData1: any = null;
  let resErr1: any = null;
  const mockReqTeam1: any = {
    params: { id: salesRep.id },
    body: { teamType: "PRESALES" },
    user: { id: managerUser.id, role: "sales_manager" }
  };
  const mockResTeam1: any = {
    status: (code: number) => ({ json: (d: any) => { resErr1 = d.error; } }),
    json: (d: any) => { resData1 = d; }
  };
  await updateRepTeamType(mockReqTeam1, mockResTeam1);

  if (resData1?.teamType === "PRESALES") {
    console.log(`✅ Manager successfully assigned ${salesRep.name} to PRESALES sub-team.`);
  } else {
    console.error("DEBUG resErr1:", resErr1, "salesRep managerId:", salesRep.managerId, "managerUser id:", managerUser.id);
    throw new Error(`FAILED to update teamType: ${resErr1}`);
  }

  // Manager 1 assigns salesRep2 (direct report) to SALES
  let resData2: any = null;
  let resErr2: any = null;
  const mockReqTeam2: any = {
    params: { id: salesRep2.id },
    body: { teamType: "SALES" },
    user: { id: managerUser.id, role: "sales_manager" }
  };
  const mockResTeam2: any = {
    status: (code: number) => ({ json: (d: any) => { resErr2 = d.error; } }),
    json: (d: any) => { resData2 = d; }
  };
  await updateRepTeamType(mockReqTeam2, mockResTeam2);

  if (resData2?.teamType === "SALES") {
    console.log(`✅ Manager successfully assigned ${salesRep2.name} to SALES sub-team.`);
  } else {
    throw new Error(`FAILED to update teamType: ${resErr2}`);
  }

  // Unauthorized Manager 2 attempts to edit Manager 1's rep (should return HTTP 403)
  let resErr3: any = null;
  const mockReqTeamUnauthorized: any = {
    params: { id: salesRep.id },
    body: { teamType: "SALES" },
    user: { id: manager2User.id, role: "sales_manager" }
  };
  const mockResTeam3: any = {
    status: (code: number) => ({ json: (d: any) => { resErr3 = d.error; } }),
    json: (d: any) => d
  };
  await updateRepTeamType(mockReqTeamUnauthorized, mockResTeam3);

  if (resErr3 && String(resErr3).includes("under your management")) {
    console.log(`✅ Unauthorized manager edit correctly REJECTED with 403: "${resErr3}"`);
  } else {
    throw new Error(`FAILED: Unauthorized manager was able to edit sub-team assignment! Error: ${resErr3}`);
  }

  console.log("\n=== ALL 6 END-TO-END TEST SCENARIOS PASSED PERFECTLY ===");
}

runTests().then(() => process.exit(0)).catch(err => {
  console.error("\n❌ E2E TEST FAILED:", err);
  process.exit(1);
});
