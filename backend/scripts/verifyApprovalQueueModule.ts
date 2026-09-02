import { sequelize } from "@nexus-crm/database";
import bcrypt from "bcryptjs";
import crypto from "crypto";

// Ensure SQLite is used locally for standalone script execution
process.env.USE_SQLITE = "true";

async function runApprovalModuleVerification() {
  console.log("=== STARTING APPROVAL QUEUE MODULE VERIFICATION ===");
  await sequelize.sync();

  const hashedPassword = await bcrypt.hash("password123", 10);

  // 1. SETUP USERS & HIERARCHY
  let adminUser: any = await sequelize.models.User.findOne({ where: { role: "admin" } });
  if (!adminUser) {
    adminUser = await sequelize.models.User.create({
      id: crypto.randomUUID(),
      name: "Admin User",
      email: "admin_test@nexus.com",
      password: hashedPassword,
      role: "admin"
    });
  } else {
    await adminUser.update({ password: hashedPassword });
  }

  let managerUser: any = await sequelize.models.User.findOne({ where: { role: "sales_manager" } });
  if (!managerUser) {
    managerUser = await sequelize.models.User.create({
      id: crypto.randomUUID(),
      name: "Manager User",
      email: "manager_test@nexus.com",
      password: hashedPassword,
      role: "sales_manager"
    });
  } else {
    await managerUser.update({ password: hashedPassword });
  }

  let repUser: any = await sequelize.models.User.findOne({ where: { role: "sales_rep" } });
  if (!repUser) {
    repUser = await sequelize.models.User.create({
      id: crypto.randomUUID(),
      name: "Rep Charlie",
      email: "rep_test@nexus.com",
      password: hashedPassword,
      role: "sales_rep",
      managerId: managerUser.id
    });
  } else {
    await repUser.update({ password: hashedPassword, managerId: managerUser.id });
  }

  // Clear existing approval records for clean test isolation
  await sequelize.models.ApprovalRequest.destroy({ where: {} });
  await sequelize.models.ApprovalAuditLog.destroy({ where: {} });

  const {
    getApprovals, updateApproval, submitQuoteForApproval,
    getAdminApprovalPolicy, updateAdminApprovalPolicy,
    getSalesApprovalProfiles, upsertSalesApprovalProfile,
    getApprovalAuditLogs, evaluateQuote
  } = require("../src/controllers/approvalController");

  let reqData: any, resData: any, resStatus: number = 200;

  function mockReqRes(reqOpts: any) {
    resStatus = 200;
    resData = null;
    const req = { body: {}, params: {}, query: {}, user: adminUser, ...reqOpts };
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

  // ------------------------------------------------------------------
  // SECTION 1: ADMIN POLICY TAB VERIFICATION
  // ------------------------------------------------------------------
  console.log("\n--- [1] ADMIN POLICY TAB TESTS ---");

  // GET Policy
  let { req, res } = mockReqRes({ user: adminUser });
  await getAdminApprovalPolicy(req, res);
  console.log("✅ Admin Policy GET returned status:", resStatus, "Limits:", resData?.maximumSalesRepApproval);
  if (!resData || resStatus !== 200) throw new Error("GET /approval-policy failed");

  // PUT Policy as Admin
  {
    const { req, res } = mockReqRes({
      user: adminUser,
      body: {
        maximumSalesRepApproval: 200000,
        maximumTeamLeadApproval: 500000,
        maximumRepDiscount: 0.15,
        maximumTeamLeadDiscount: 0.25,
        minimumAllowedMargin: 0.20
      }
    });
    await updateAdminApprovalPolicy(req, res);
    if (resStatus !== 200 || Number(resData?.maximumSalesRepApproval) !== 200000) {
      throw new Error(`PUT /approval-policy failed: ${JSON.stringify(resData)}`);
    }
    console.log("✅ PUT /approval-policy as Admin updated successfully!");
  }

  // PUT Policy as Non-Admin (should return 403)
  {
    const { req, res } = mockReqRes({
      user: repUser,
      body: { maximumSalesRepApproval: 9999999 }
    });
    await updateAdminApprovalPolicy(req, res);
    if (resStatus !== 403) {
      throw new Error(`Non-admin PUT /approval-policy did not return 403! Got: ${resStatus}`);
    }
    console.log("✅ PUT /approval-policy as non-admin correctly rejected with 403!");
  }

  // ------------------------------------------------------------------
  // SECTION 2: REP PROFILES TAB VERIFICATION
  // ------------------------------------------------------------------
  console.log("\n--- [2] REP PROFILES TAB TESTS ---");

  // GET Profiles
  {
    const { req, res } = mockReqRes({ user: adminUser });
    await getSalesApprovalProfiles(req, res);
    if (resStatus !== 200 || !Array.isArray(resData)) {
      throw new Error("GET /sales-approval-profiles failed");
    }
    console.log(`✅ GET /sales-approval-profiles returned ${resData.length} profiles.`);
  }

  // Upsert Profile capped by Admin Policy ceiling
  {
    const { req, res } = mockReqRes({
      user: adminUser,
      body: {
        salesRepId: repUser.id,
        selfApprovalLimit: 300000, // exceeds rep max 200000
        discountApprovalLimit: 0.10,
        minimumMargin: 0.20
      }
    });
    await upsertSalesApprovalProfile(req, res);
    if (resStatus !== 400 || !resData.error.includes("Admin Sales Rep Ceiling")) {
      throw new Error(`Profile limit exceeding Admin ceiling was not blocked! Status: ${resStatus}, Error: ${resData?.error}`);
    }
    console.log(`✅ Profile limit exceeding Admin ceiling correctly BLOCKED with 400: "${resData.error}"`);
  }

  // Valid profile upsert
  {
    const { req, res } = mockReqRes({
      user: adminUser,
      body: {
        salesRepId: repUser.id,
        selfApprovalLimit: 150000,
        discountApprovalLimit: 0.10,
        minimumMargin: 0.20
      }
    });
    await upsertSalesApprovalProfile(req, res);
    if (resStatus !== 200) {
      throw new Error(`Valid profile upsert failed: ${JSON.stringify(resData)}`);
    }
    console.log("✅ Valid profile upsert persisted successfully!");
  }

  // ------------------------------------------------------------------
  // SECTION 3: PENDING QUEUE TAB VERIFICATION
  // ------------------------------------------------------------------
  console.log("\n--- [3] PENDING QUEUE TAB TESTS ---");

  // Create Deal & Product for Quote
  const lead = await sequelize.models.Lead.create({
    id: crypto.randomUUID(),
    firstName: "Acme",
    lastName: "Corp Lead",
    email: "sheiksaud671@gmail.com",
    companyName: "Acme Corp"
  });

  const deal = await sequelize.models.Deal.create({
    id: crypto.randomUUID(),
    name: "Enterprise Software Deal",
    amount: 250000,
    leadId: lead.id,
    ownerId: repUser.id,
    status: "OPEN"
  });

  const product = await sequelize.models.PriceBookEntry.create({
    id: crypto.randomUUID(),
    name: "Software Suite",
    sku: `SW-${Date.now()}`,
    unitPrice: 250000,
    listPrice: 250000
  });

  const quote = await sequelize.models.Quote.create({
    id: crypto.randomUUID(),
    dealId: deal.id,
    quoteNumber: `QT-CHECKLIST-001`,
    version: 1,
    status: "Draft",
    isFinalAgreed: false,
    totalAmount: 250000
  });

  await sequelize.models.QuoteLineItem.create({
    id: crypto.randomUUID(),
    quoteId: quote.id,
    productId: product.id,
    description: "Software License",
    quantity: 2,
    unitPrice: 125000,
    subtotal: 250000,
    totalPrice: 250000
  });

  // Submit quote for approval
  {
    const { req, res } = mockReqRes({
      params: { id: quote.id },
      user: repUser
    });
    await submitQuoteForApproval(req, res);
    console.log("Submit Quote Response:", resData?.message || resData?.error);

    const updatedQuote: any = await sequelize.models.Quote.findByPk(quote.id);
    if (updatedQuote.status !== "Pending Approval") {
      throw new Error(`Quote status post-submission is invalid: ${updatedQuote.status}`);
    }

    const appReq: any = await sequelize.models.ApprovalRequest.findOne({ where: { targetId: quote.id, status: "Pending" } });
    if (!appReq) throw new Error("No ApprovalRequest created!");
    console.log(`✅ Quote submitted for approval! Created ApprovalRequest ID: ${appReq.id}`);
  }

  // Non-Admin without authority tries to approve (should return 403)
  const appReq: any = await sequelize.models.ApprovalRequest.findOne({ where: { targetId: quote.id, status: "Pending" } });
  {
    const { req, res } = mockReqRes({
      params: { id: appReq.id },
      body: { status: "Approved", comments: "Self-approval attempt" },
      user: repUser // sales rep role
    });
    await updateApproval(req, res);
    if (resStatus !== 403) {
      throw new Error(`Non-authorized user approval did not return 403! Got: ${resStatus}`);
    }
    console.log(`✅ Unauthorized approval attempt correctly REJECTED with 403: "${resData.error}"`);
  }

  // Approve Quote as Admin
  {
    const { req, res } = mockReqRes({
      params: { id: appReq.id },
      body: { status: "Approved", comments: "Approved for enterprise contract terms." },
      user: adminUser
    });
    await updateApproval(req, res);
    if (resStatus !== 200) {
      throw new Error(`Approve quote failed: ${JSON.stringify(resData)}`);
    }

    const updatedQuote: any = await sequelize.models.Quote.findByPk(quote.id);
    if (!updatedQuote.isFinalAgreed || (updatedQuote.status !== "Approved" && updatedQuote.status !== "Sent")) {
      throw new Error(`Quote state post-approval invalid: status=${updatedQuote.status}, isFinalAgreed=${updatedQuote.isFinalAgreed}`);
    }
    console.log(`✅ Quote Approved successfully! Status: ${updatedQuote.status}, isFinalAgreed: ${updatedQuote.isFinalAgreed}`);

    // Verify Invoice and InvoiceLineItem created with correct totalPrice
    const invoice: any = await sequelize.models.Invoice.findOne({
      where: { quoteId: quote.id },
      include: [{ model: sequelize.models.InvoiceLineItem, as: "lineItems" }]
    });

    if (!invoice) throw new Error("BUG 1 FAILED: Invoice was NOT created upon quote approval!");
    if (!invoice.lineItems || invoice.lineItems.length === 0) {
      throw new Error("BUG 1 FAILED: InvoiceLineItems were NOT created!");
    }

    for (const item of invoice.lineItems) {
      const expectedTotal = Number(item.quantity) * Number(item.unitPrice);
      if (Number(item.totalPrice) !== expectedTotal) {
        throw new Error(`BUG 1 FAILED: InvoiceLineItem.totalPrice mismatch! Expected ${expectedTotal}, got ${item.totalPrice}`);
      }
    }
    console.log(`✅ BUG 1 FIXED & VERIFIED! Invoice #${invoice.id} created with ${invoice.lineItems.length} InvoiceLineItem(s), all matching quantity * unitPrice (totalPrice: SAR ${invoice.lineItems[0].totalPrice}).`);
  }

  // Password Leak Security Check
  {
    const { req, res } = mockReqRes({ user: adminUser });
    await getApprovals(req, res);
    const jsonStr = JSON.stringify(resData);
    if (jsonStr.includes('"password":')) {
      throw new Error("SECURITY BUG 3 FAILED: Password hash leaked in GET /api/v1/approvals response payload!");
    }
    console.log("✅ SECURITY BUG 3 FIXED & VERIFIED! No password hashes present anywhere in GET /api/v1/approvals payload.");
  }

  // Reject Flow & Resubmission
  const quote2 = await sequelize.models.Quote.create({
    id: crypto.randomUUID(),
    dealId: deal.id,
    quoteNumber: `QT-CHECKLIST-002`,
    version: 2,
    status: "Draft",
    isFinalAgreed: false,
    totalAmount: 350000
  });

  // Submit quote 2
  await submitQuoteForApproval(mockReqRes({ params: { id: quote2.id }, user: repUser }).req, mockReqRes({}).res);
  const appReq2: any = await sequelize.models.ApprovalRequest.findOne({ where: { targetId: quote2.id, status: "Pending" } });

  // Reject quote 2
  {
    const { req, res } = mockReqRes({
      params: { id: appReq2.id },
      body: { status: "Rejected", comments: "Discount too high. Lower by 5% and resubmit." },
      user: adminUser
    });
    await updateApproval(req, res);
    const rejectedQuote: any = await sequelize.models.Quote.findByPk(quote2.id);
    if (rejectedQuote.status !== "Rejected" || rejectedQuote.isFinalAgreed) {
      throw new Error(`Rejection failed: quote status is ${rejectedQuote.status}`);
    }
    console.log("✅ Reject flow verified! Quote status: Rejected, isFinalAgreed: false.");
  }

  // Resubmit rejected quote
  {
    const { req, res } = mockReqRes({
      params: { id: quote2.id },
      user: repUser
    });
    await submitQuoteForApproval(req, res);
    const freshAppReq: any = await sequelize.models.ApprovalRequest.findOne({ where: { targetId: quote2.id, status: "Pending" } });
    if (!freshAppReq) throw new Error("Resubmitting rejected quote failed to create fresh Pending request!");
    console.log("✅ Resubmitting rejected quote created a fresh Pending request!");
  }

  // ------------------------------------------------------------------
  // SECTION 4: AUDIT TRAIL TAB VERIFICATION
  // ------------------------------------------------------------------
  console.log("\n--- [4] AUDIT TRAIL TAB TESTS ---");

  {
    const { req, res } = mockReqRes({ user: adminUser });
    await getApprovalAuditLogs(req, res);
    if (resStatus !== 200 || !Array.isArray(resData) || resData.length === 0) {
      throw new Error("GET /approval-audit-logs failed or returned empty logs!");
    }
    const log = resData[0];
    console.log(`✅ GET /approval-audit-logs returned ${resData.length} entries.`);
    console.log(`   Latest Log: Decision="${log.decision}", Approver="${log.approver?.name}", Reason="${log.reason}"`);
    if (!log.approver?.name) {
      throw new Error("Audit trail missing readable approver name!");
    }
  }

  console.log("\n=== ALL APPROVAL QUEUE MODULE CHECKLIST ITEMS PASSED PERFECTLY ===");
}

runApprovalModuleVerification().then(() => process.exit(0)).catch(err => {
  console.error("\n❌ E2E VERIFICATION FAILED:", err);
  process.exit(1);
});
