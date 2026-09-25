const http = require("http");

function apiRequest(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : null;
    const options = {
      hostname: "127.0.0.1",
      port: 5506,
      path: `/api/v1${path}`,
      method: method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { "Authorization": `Bearer ${token}` } : {}),
        ...(postData ? { "Content-Length": Buffer.byteLength(postData) } : {})
      }
    };

    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on("error", (err) => reject(err));
    if (postData) req.write(postData);
    req.end();
  });
}

async function verifyBothApprovalTypes() {
  console.log("=== STARTING DUAL APPROVAL & REGRESSION VERIFICATION ===");

  // 1. Login
  const loginRes = await apiRequest("POST", "/auth/login", {
    email: "admin@nexus.com",
    password: "password123"
  });
  console.log(`1. Login status: ${loginRes.status}`);
  if (!loginRes.data || !loginRes.data.token) {
    throw new Error("Login failed: " + JSON.stringify(loginRes));
  }
  const token = loginRes.data.token;

  // 2. Fetch existing Deal and trigger a Deal escalation
  console.log("\n--- Step 2: Trigger Deal Escalation Approval ---");
  const dealsRes = await apiRequest("GET", "/deals", null, token);
  const targetDeal = Array.isArray(dealsRes.data) && dealsRes.data.length > 0 ? dealsRes.data[0] : null;
  if (!targetDeal) throw new Error("No existing deal found to test!");
  console.log(`2.1 Target Deal: "${targetDeal.name}" (${targetDeal.id}), current amount: ₹${targetDeal.amount}`);

  // Update deal amount to ₹25,00,000 (exceeds default rep limit of ₹10,00,000)
  const updateDealRes = await apiRequest("PUT", `/opportunities/${targetDeal.id}`, {
    amount: 2500000
  }, token);
  console.log(`2.2 Updated deal amount to ₹25,00,000. Status: ${updateDealRes.status}`);

  // 3. Trigger Work Order below-floor pricing approval
  console.log("\n--- Step 3: Trigger Work Order Below-Floor Approval ---");
  const woRes = await apiRequest("GET", "/work-orders", null, token);
  const targetWO = woRes.data[0];
  console.log(`3.1 Target Work Order: ${targetWO.workOrderNumber} (${targetWO.id})`);

  const pbRes = await apiRequest("GET", "/price-book", null, token);
  const sampleItem = pbRes.data.find(i => i.minPrice && i.unitPrice);
  console.log(`3.2 Catalog item: ${sampleItem.name} (${sampleItem.sku}), standard: ₹${sampleItem.unitPrice}, min: ₹${sampleItem.minPrice}`);

  const belowFloorPrice = Math.max(1, Math.floor(Number(sampleItem.minPrice) - 100));
  const lineItemRes = await apiRequest("POST", `/work-orders/${targetWO.id}/line-items`, {
    priceBookEntryId: sampleItem.id,
    description: sampleItem.name,
    quantity: 1,
    unitPrice: belowFloorPrice,
    status: "New"
  }, token);
  console.log(`3.3 Below-floor line item status: ${lineItemRes.status}, approvalRequired: ${lineItemRes.data.approvalRequired}`);

  // 4. Verify BOTH appear simultaneously in /approvals queue
  console.log("\n--- Step 4: Verify Both Coexist in /approvals Queue ---");
  const queueRes = await apiRequest("GET", "/approvals", null, token);
  console.log(`4.1 Total queue items: ${queueRes.data.length}`);

  const pendingDealApproval = queueRes.data.find(a => a.type === "Deal" && a.targetId === targetDeal.id && a.status === "Pending");
  const pendingWOApproval = queueRes.data.find(a => a.type === "WorkOrder" && a.targetId === targetWO.id && a.status === "Pending");

  console.log(`4.2 Found Deal approval: ${!!pendingDealApproval} (id=${pendingDealApproval?.id}, level=${pendingDealApproval?.evaluation?.approvalLevel})`);
  console.log(`    Deal evaluation reason: "${pendingDealApproval?.evaluation?.reason || pendingDealApproval?.comments}"`);
  console.log(`4.3 Found WorkOrder approval: ${!!pendingWOApproval} (id=${pendingWOApproval?.id})`);
  console.log(`    WO evaluation reason: "${pendingWOApproval?.evaluation?.reason}"`);

  if (!pendingDealApproval) {
    throw new Error("Deal escalation approval request missing from queue!");
  }
  if (!pendingWOApproval) {
    throw new Error("Work Order pricing approval request missing from queue!");
  }

  // 5. Test Manager Approval on Deal
  console.log("\n--- Step 5: Test Manager Approval on Deal ---");
  const approveDealRes = await apiRequest("PUT", `/approvals/${pendingDealApproval.id}`, {
    status: "Approved",
    comments: "Deal Value Escalation Approved by Manager"
  }, token);
  console.log(`5.1 Deal approval update status: ${approveDealRes.status}, status: ${approveDealRes.data.status}`);
  if (approveDealRes.data.status !== "Approved") throw new Error("Expected Deal approval status to be 'Approved'!");

  // 6. Test Manager Approval on Work Order
  console.log("\n--- Step 6: Test Manager Approval on Work Order ---");
  const approveWORes = await apiRequest("PUT", `/approvals/${pendingWOApproval.id}`, {
    status: "Approved",
    comments: "Work Order Pricing Approved by Manager"
  }, token);
  console.log(`6.1 WO approval update status: ${approveWORes.status}, status: ${approveWORes.data.status}`);
  const woApprovedCheck = await apiRequest("GET", `/work-orders/${targetWO.id}`, null, token);
  console.log(`6.2 Work Order status after approval: "${woApprovedCheck.data.status}" (Expected "Approved")`);
  if (woApprovedCheck.data.status !== "Approved") throw new Error("Expected Work Order to be 'Approved'!");

  // 7. Test Manager Rejection on Work Order
  console.log("\n--- Step 7: Test Manager Rejection on Work Order ---");
  const rejectItemRes = await apiRequest("POST", `/work-orders/${targetWO.id}/line-items`, {
    priceBookEntryId: sampleItem.id,
    description: sampleItem.name,
    quantity: 1,
    unitPrice: 50, // Heavily discounted
    status: "New"
  }, token);

  const queueRes2 = await apiRequest("GET", "/approvals", null, token);
  const rejectWOApproval = queueRes2.data.find(a => a.type === "WorkOrder" && a.targetId === targetWO.id && a.status === "Pending");
  const rejectWORes = await apiRequest("PUT", `/approvals/${rejectWOApproval.id}`, {
    status: "Rejected",
    comments: "Work Order Pricing Rejected by Manager: unit price ₹50 is far below cost."
  }, token);
  console.log(`7.1 WO rejection status: ${rejectWORes.status}, status: ${rejectWORes.data.status}`);
  const woRejectedCheck = await apiRequest("GET", `/work-orders/${targetWO.id}`, null, token);
  console.log(`7.2 Work Order status after rejection: "${woRejectedCheck.data.status}" (Expected "Rejected")`);
  const rejectedLineItem = woRejectedCheck.data.lineItems?.find(li => li.id === rejectItemRes.data.id);
  console.log(`7.3 Rejected line item stays attached: ${!!rejectedLineItem}, status: "${rejectedLineItem?.status}" (Expected "Rejected")`);
  if (woRejectedCheck.data.status !== "Rejected" || rejectedLineItem?.status !== "Rejected") {
    throw new Error("Work order rejection flow failed!");
  }

  // 8. Test Quote 12% discount approval behavior is UNCHANGED
  console.log("\n--- Step 8: Verify Existing Quote 12% Discount Approval ---");
  const { evaluateQuoteApproval } = require("../../backend/build/backend/src/services/approvalEngine");
  const testQuoteEval = await evaluateQuoteApproval("", {
    quoteValue: Math.round(Number(sampleItem.unitPrice) * 0.88),
    totalAmount: Math.round(Number(sampleItem.unitPrice) * 0.88),
    items: [{ productId: sampleItem.id, quantity: 1, unitPrice: Math.round(Number(sampleItem.unitPrice) * 0.88) }]
  });
  console.log(`8.1 12% Quote Discount requires approval: ${testQuoteEval.approvalRequired} (Expected true), level: ${testQuoteEval.approvalLevel} (Expected "TEAM_LEAD")`);
  if (!testQuoteEval.approvalRequired || testQuoteEval.approvalLevel !== "TEAM_LEAD") {
    throw new Error("Quote 12% discount approval logic regressed!");
  }

  // 9. Master data Discount Rules API
  console.log("\n--- Step 9: Verify Discount Rules Master Data API ---");
  const discountRulesRes = await apiRequest("GET", "/master-data/discount-rules", null, token);
  console.log(`9.1 GET /master-data/discount-rules status: ${discountRulesRes.status}, count: ${discountRulesRes.data.length}`);
  if (discountRulesRes.status !== 200 || discountRulesRes.data.length < 3) {
    throw new Error("Discount rules API failed!");
  }

  // 10. Service Resources & Phone Resolution
  console.log("\n--- Step 10: Verify Service Resources & Phone Resolution ---");
  const srRes = await apiRequest("GET", "/service-resources", null, token);
  console.log(`10.1 GET /service-resources status: ${srRes.status}, count: ${srRes.data.length}`);
  console.log(`10.2 Work Order phone resolution: primary="${woApprovedCheck.data.primaryPhone}", source="${woApprovedCheck.data.phoneSource}"`);

  console.log("\n✅ ALL DUAL-APPROVAL AND REGRESSION CHECKS PASSED PERFECTLY!");
}

verifyBothApprovalTypes().catch(err => {
  console.error("\n❌ VERIFICATION TEST FAILED:", err);
  process.exit(1);
});
