const http = require("http");

async function apiRequest(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request({
      hostname: "localhost",
      port: 5506,
      path: `/api/v1${path}`,
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { "Authorization": `Bearer ${token}` } : {}),
        ...(data ? { "Content-Length": Buffer.byteLength(data) } : {})
      }
    }, (res) => {
      let resBody = "";
      res.on("data", chunk => resBody += chunk);
      res.on("end", () => {
        try {
          const json = JSON.parse(resBody);
          resolve({ status: res.statusCode, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, raw: resBody });
        }
      });
    });
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

async function runTests() {
  console.log("=== STARTING WORK ORDER LINKED PRICING & DISCOUNT POLICY VERIFICATION ===");

  // 1. Login
  const loginRes = await apiRequest("POST", "/auth/login", {
    email: "admin@nexus.com",
    password: "password123"
  });
  console.log(`1. Login status: ${loginRes.status}`);
  if (!loginRes.data || !loginRes.data.token) {
    throw new Error("Failed to login: " + JSON.stringify(loginRes));
  }
  const token = loginRes.data.token;

  // 2. Test Discount Policies Master Data API
  console.log("\n--- Testing Discount Policies Master Data API ---");
  const policiesRes = await apiRequest("GET", "/master-data/discount-rules", null, token);
  console.log(`2.1 GET /master-data/discount-rules status: ${policiesRes.status}, count: ${policiesRes.data.length}`);
  const repPolicy = policiesRes.data.find(p => p.role === "Sales Rep");
  const tlPolicy = policiesRes.data.find(p => p.role === "Team Lead");
  console.log(`    Sales Rep limit: ${repPolicy?.maxDiscountPercent}%, Team Lead limit: ${tlPolicy?.maxDiscountPercent}%`);

  if (!repPolicy || Number(repPolicy.maxDiscountPercent) !== 10) {
    throw new Error("Expected Sales Rep policy to be 10%");
  }
  if (!tlPolicy || Number(tlPolicy.maxDiscountPercent) !== 20) {
    throw new Error("Expected Team Lead policy to be 20%");
  }

  // 2.2 Test GET /approval-policy (previously missing route)
  const approvalPolicyRes = await apiRequest("GET", "/approval-policy", null, token);
  console.log(`2.2 GET /approval-policy status: ${approvalPolicyRes.status}`);
  if (approvalPolicyRes.status !== 200) {
    throw new Error("Expected GET /approval-policy to return 200");
  }

  // 3. Test PriceBookEntry Catalog API
  console.log("\n--- Testing PriceBookEntry Catalog API ---");
  const pbRes = await apiRequest("GET", "/price-book", null, token);
  const catalog = Array.isArray(pbRes.data) ? pbRes.data : pbRes.data.entries || [];
  console.log(`3.1 GET /price-book count: ${catalog.length} (Expected 225)`);
  if (catalog.length !== 225) {
    throw new Error(`Expected 225 catalog items, found ${catalog.length}`);
  }

  const sampleItem = catalog.find(item => item.sku === "CAB-001") || catalog[0];
  console.log(`3.2 Sample item: ${sampleItem.name} (${sampleItem.sku})`);
  console.log(`    Standard: ₹${sampleItem.unitPrice}, Min: ₹${sampleItem.minPrice}, Max: ₹${sampleItem.maxPrice}`);

  // 4. Test Work Order Line Item Linking & Price Guardrails
  console.log("\n--- Testing Work Order Line Item Creation ---");
  // Find or create a work order
  const wosRes = await apiRequest("GET", "/work-orders", null, token);
  let targetWO = wosRes.data && wosRes.data.length > 0 ? wosRes.data[0] : null;

  if (!targetWO) {
    const createWoRes = await apiRequest("POST", "/work-orders", {
      subject: "Test Work Order for Pricing Guardrails",
      priority: "Medium",
      status: "New"
    }, token);
    targetWO = createWoRes.data;
  }
  console.log(`4.1 Target Work Order: ${targetWO.workOrderNumber} (${targetWO.id})`);

  // Test A: Line item within catalog bracket (standard unitPrice)
  console.log("\n  [Test A: Within Bracket - Normal Save]");
  const normalPrice = Number(sampleItem.unitPrice);
  const itemARes = await apiRequest("POST", `/work-orders/${targetWO.id}/line-items`, {
    priceBookEntryId: sampleItem.id,
    description: sampleItem.name,
    quantity: 1,
    unitPrice: normalPrice,
    status: "New"
  }, token);
  console.log(`  Line item within bracket status: ${itemARes.status}`);
  console.log(`  Approval required: ${itemARes.data.approvalRequired || false}`);
  console.log(`  Linked priceBookEntryId: ${itemARes.data.priceBookEntryId}`);
  console.log(`  priceBookEntry sku: ${itemARes.data.priceBookEntry?.sku}`);

  if (itemARes.data.approvalRequired) {
    throw new Error("Expected within-bracket item to NOT require approval!");
  }
  if (itemARes.data.priceBookEntryId !== sampleItem.id) {
    throw new Error("Expected priceBookEntryId to match sampleItem.id!");
  }

  // Test B: Line item below minPrice floor (triggers ApprovalRequest)
  console.log("\n  [Test B: Below MinPrice - Triggers Approval Request]");
  const belowFloorPrice = Math.max(1, Number(sampleItem.minPrice) - 100);
  const itemBRes = await apiRequest("POST", `/work-orders/${targetWO.id}/line-items`, {
    priceBookEntryId: sampleItem.id,
    description: sampleItem.name,
    quantity: 1,
    unitPrice: belowFloorPrice,
    status: "New"
  }, token);
  console.log(`  Line item below floor status: ${itemBRes.status}`);
  console.log(`  Approval required: ${itemBRes.data.approvalRequired}`);
  console.log(`  Approval message: "${itemBRes.data.approvalMessage}"`);
  console.log(`  Line item status: ${itemBRes.data.status}`);

  if (!itemBRes.data.approvalRequired) {
    throw new Error("Expected below-floor price item to require approval!");
  }
  if (itemBRes.data.status !== "Pending Approval") {
    throw new Error("Expected line item status to be 'Pending Approval'!");
  }

  // Verify Work Order status became Pending Approval
  const woCheckRes = await apiRequest("GET", `/work-orders/${targetWO.id}`, null, token);
  console.log(`  Work Order status updated to: "${woCheckRes.data.status}" (Expected "Pending Approval")`);
  if (woCheckRes.data.status !== "Pending Approval") {
    throw new Error("Expected Work Order status to be 'Pending Approval'!");
  }

  // Test C: Verify ApprovalRequest exists in /approvals queue
  console.log("\n  [Test C: Verify Approval Request in /approvals]");
  const approvalsRes = await apiRequest("GET", "/approvals", null, token);
  const woApproval = approvalsRes.data.find(a => a.type === "WorkOrder" && a.targetId === targetWO.id && a.status === "Pending");
  console.log(`  Found WorkOrder approval in queue: id=${woApproval?.id}, status=${woApproval?.status}`);
  console.log(`  Target WO number: ${woApproval?.target?.workOrderNumber}`);
  console.log(`  Evaluation reason: ${woApproval?.evaluation?.reason}`);

  if (!woApproval) {
    throw new Error("Expected WorkOrder approval request to be in /approvals queue!");
  }

  // Test D: Approve the Work Order through /approvals/:id
  console.log("\n  [Test D: Manager Approves Work Order in /approvals/:id]");
  const approveRes = await apiRequest("PUT", `/approvals/${woApproval.id}`, {
    status: "Approved",
    comments: "Special discounted field pricing approved by Manager"
  }, token);
  console.log(`  Approval update status: ${approveRes.status}, approval status: ${approveRes.data.status}`);

  const woApprovedRes = await apiRequest("GET", `/work-orders/${targetWO.id}`, null, token);
  console.log(`  Work Order status after approval: "${woApprovedRes.data.status}" (Expected "Approved")`);
  if (woApprovedRes.data.status !== "Approved") {
    throw new Error("Expected Work Order status to be 'Approved'!");
  }

  // Test E: Free-text fallback line item without catalog link
  console.log("\n  [Test E: Free-text manual fallback line item]");
  const itemCRes = await apiRequest("POST", `/work-orders/${targetWO.id}/line-items`, {
    description: "Custom Ad-hoc On-site Welder Labor",
    quantity: 2,
    unitPrice: 1500,
    status: "New"
  }, token);
  console.log(`  Free-text item status: ${itemCRes.status}`);
  console.log(`  PriceBookEntryId: ${itemCRes.data.priceBookEntryId} (Expected null)`);
  console.log(`  Approval required: ${itemCRes.data.approvalRequired || false}`);

  if (itemCRes.data.priceBookEntryId !== null && itemCRes.data.priceBookEntryId !== undefined) {
    throw new Error("Expected free-text fallback item to have null priceBookEntryId!");
  }

  // 5. Verify Quote Approval Behavior is UNCHANGED (12% quote discount test)
  console.log("\n--- Testing Existing Quote 12% Discount Approval UNCHANGED ---");
  const approvalEnginePath = require("fs").existsSync(require("path").resolve(__dirname, "../../backend/build/backend/src/services/approvalEngine.js"))
    ? "../../backend/build/backend/src/services/approvalEngine.js"
    : "../../backend/build/src/services/approvalEngine.js";
  const { evaluateQuoteApproval } = require(approvalEnginePath);
  const testQuoteEval = await evaluateQuoteApproval("", {
    quoteValue: Math.round(Number(sampleItem.unitPrice) * 0.88),
    totalAmount: Math.round(Number(sampleItem.unitPrice) * 0.88),
    items: [{ productId: sampleItem.id, quantity: 1, unitPrice: Math.round(Number(sampleItem.unitPrice) * 0.88) }]
  });
  console.log(`5.1 12% Discount Quote Approval Required: ${testQuoteEval.approvalRequired} (Expected true)`);
  console.log(`    Approval Level: ${testQuoteEval.approvalLevel} (Expected "TEAM_LEAD")`);
  console.log(`    Reason: "${testQuoteEval.reason}"`);

  if (!testQuoteEval.approvalRequired || testQuoteEval.approvalLevel !== "TEAM_LEAD") {
    throw new Error("12% Quote Discount approval regression! Expected approvalRequired=true, level=TEAM_LEAD");
  }

  // 6. Verify Existing Work Order Features (phone resolution, appointments, resources)
  console.log("\n--- Testing Existing Work Order & Field Service Features ---");
  console.log(`6.1 Primary phone resolved: "${woApprovedRes.data.primaryPhone}", Source: "${woApprovedRes.data.phoneSource}"`);

  const srRes = await apiRequest("GET", "/service-resources", null, token);
  console.log(`6.2 Service Resources count: ${srRes.data.length}`);

  console.log("\n✅ ALL WORK ORDER LINKED PRICING AND DISCOUNT POLICY FLOW TESTS PASSED!");
}

runTests().catch(err => {
  console.error("\n❌ VERIFICATION TEST FAILED:", err);
  process.exit(1);
});
