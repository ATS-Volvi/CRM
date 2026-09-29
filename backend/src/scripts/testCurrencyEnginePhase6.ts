import { sequelize } from "@nexus-crm/database";
import { 
  getExchangeRate, 
  convertToOrgCurrency, 
  aggregateAmountsInOrgCurrency,
  snapshotDealWonAmount,
  backfillWonDealsExchangeRates,
  resolveLimit
} from "../utils/exchangeRate";
import { evaluateQuoteApproval, evaluateDealApproval } from "../services/approvalEngine";
import { getOrgCurrency } from "../utils/orgSettings";
import { formatMoney } from "../utils/formatMoney";

async function runTests() {
  console.log("================================================================================");
  console.log("RIGOROUS CURRENCY & APPROVAL ENGINE BOUNDARY TEST SUITE");
  console.log("================================================================================\n");

  const orgCurr = await getOrgCurrency();
  console.log(`[Context] Organization Base Currency: ${orgCurr}`);
  console.log(`[Rule] Rounding Rule: All currency conversions are rounded to 2 decimals via Number(val.toFixed(2)).\n`);

  let testsPassed = 0;
  let totalTests = 0;

  function assertTest(
    testName: string,
    passed: boolean,
    details: { amount?: any; limit?: any; expected: any; actual: any; extra?: string }
  ) {
    totalTests++;
    if (passed) {
      console.log(`  ✅ PASS: ${testName}`);
      console.log(`     Amount: ${details.amount ?? "N/A"} | Limit: ${details.limit ?? "N/A"}`);
      console.log(`     Expected: ${details.expected} | Actual: ${details.actual}`);
      if (details.extra) console.log(`     Details: ${details.extra}`);
      testsPassed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      console.error(`     Amount: ${details.amount ?? "N/A"} | Limit: ${details.limit ?? "N/A"}`);
      console.error(`     Expected: ${details.expected} | Actual: ${details.actual}`);
      if (details.extra) console.error(`     Details: ${details.extra}`);
    }
  }

  // Load Admin Policy to dynamically derive test limits
  const adminPolicy: any = await sequelize.models.AdminApprovalPolicy.findOne({
    order: [["createdAt", "DESC"]]
  });
  const policyCurrency = adminPolicy?.currency || "INR";

  // Compute resolved base limits in org currency
  const repLimitStored = Number(adminPolicy?.repSelfApprovalDefault ?? 1000000);
  const repLimitRes = await resolveLimit(repLimitStored, policyCurrency, orgCurr);
  const repLimitOrg = repLimitRes.orgAmount;

  const tlLimitStored = Number(adminPolicy?.teamLeadApprovalDefault ?? 5000000);
  const tlLimitRes = await resolveLimit(tlLimitStored, policyCurrency, orgCurr);
  const tlLimitOrg = tlLimitRes.orgAmount;

  const execLimitStored = Number(adminPolicy?.repTierCutoffExecutive ?? 250000);
  const execLimitRes = await resolveLimit(execLimitStored, policyCurrency, orgCurr);
  const execLimitOrg = execLimitRes.orgAmount;

  const agentLimitStored = Number(adminPolicy?.repTierCutoffAgent ?? 50000);
  const agentLimitRes = await resolveLimit(agentLimitStored, policyCurrency, orgCurr);
  const agentLimitOrg = agentLimitRes.orgAmount;

  console.log("--------------------------------------------------------------------------------");
  console.log("DYNAMIC RESOLVED LIMITS SUMMARY");
  console.log("--------------------------------------------------------------------------------");
  console.log(`  • Rep Self-Approval Limit:    ${repLimitRes.display} [Numeric: ${repLimitOrg} ${orgCurr}]`);
  console.log(`  • Team Lead Approval Limit:   ${tlLimitRes.display} [Numeric: ${tlLimitOrg} ${orgCurr}]`);
  console.log(`  • Executive Tier Cutoff:      ${execLimitRes.display} [Numeric: ${execLimitOrg} ${orgCurr}]`);
  console.log(`  • Agent Tier Cutoff:          ${agentLimitRes.display} [Numeric: ${agentLimitOrg} ${orgCurr}]`);
  console.log("--------------------------------------------------------------------------------\n");

  // ─────────────────────────────────────────────────────────────────────────────
  // SUITE 1: Rep Self-Approval Strict Dynamic Boundary & Equality Tests (<= vs <)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("--- SUITE 1: Rep Self-Approval Boundary & Equality Tests (Same Currency) ---");

  // Case 1A: limit - 0.01 (Under limit -> Auto-Approved / SALES_REP)
  const repMinus = Number((repLimitOrg - 0.01).toFixed(2));
  const resMinus = await evaluateQuoteApproval("", {
    totalAmount: repMinus,
    currency: orgCurr,
    salesRepId: "mock-rep-default"
  });
  assertTest("Quote at (limit - 0.01) is within rep authority", 
    resMinus.approvalRequired === false && resMinus.approvalLevel === "SALES_REP",
    { amount: `${repMinus} ${orgCurr}`, limit: `${repLimitOrg} ${orgCurr}`, expected: "approvalRequired: false, level: SALES_REP", actual: `approvalRequired: ${resMinus.approvalRequired}, level: ${resMinus.approvalLevel}` }
  );

  // Case 1B: exactly limit (Equality test: pre-change <= must evaluate to true -> Auto-Approved)
  const repExact = repLimitOrg;
  const resExact = await evaluateQuoteApproval("", {
    totalAmount: repExact,
    currency: orgCurr,
    salesRepId: "mock-rep-default"
  });
  assertTest("Quote exactly at limit (equality <=) is within rep authority", 
    resExact.approvalRequired === false && resExact.approvalLevel === "SALES_REP",
    { amount: `${repExact} ${orgCurr}`, limit: `${repLimitOrg} ${orgCurr}`, expected: "approvalRequired: false, level: SALES_REP", actual: `approvalRequired: ${resExact.approvalRequired}, level: ${resExact.approvalLevel}` }
  );

  // Case 1C: limit + 0.01 (Over limit -> Escalates to TEAM_LEAD)
  const repPlus = Number((repLimitOrg + 0.01).toFixed(2));
  const resPlus = await evaluateQuoteApproval("", {
    totalAmount: repPlus,
    currency: orgCurr,
    salesRepId: "mock-rep-default"
  });
  assertTest("Quote at (limit + 0.01) exceeds rep limit and routes to TEAM_LEAD", 
    resPlus.approvalRequired === true && resPlus.approvalLevel === "TEAM_LEAD",
    { amount: `${repPlus} ${orgCurr}`, limit: `${repLimitOrg} ${orgCurr}`, expected: "approvalRequired: true, level: TEAM_LEAD", actual: `approvalRequired: ${resPlus.approvalRequired}, level: ${resPlus.approvalLevel}`, extra: resPlus.reason }
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // SUITE 2: Team Lead Ceiling Boundary Tests
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- SUITE 2: Team Lead Approval Ceiling Boundary Tests ---");

  // Case 2A: tlLimit - 0.01 (Under TL ceiling -> Requires TEAM_LEAD)
  const tlMinus = Number((tlLimitOrg - 0.01).toFixed(2));
  const resTLMinus = await evaluateQuoteApproval("", {
    totalAmount: tlMinus,
    currency: orgCurr,
    salesRepId: "mock-rep-default"
  });
  assertTest("Quote at (TL limit - 0.01) routes to TEAM_LEAD",
    resTLMinus.approvalRequired === true && resTLMinus.approvalLevel === "TEAM_LEAD",
    { amount: `${tlMinus} ${orgCurr}`, limit: `${tlLimitOrg} ${orgCurr}`, expected: "level: TEAM_LEAD", actual: `level: ${resTLMinus.approvalLevel}` }
  );

  // Case 2B: exactly tlLimit (Equality test: <= TL ceiling -> Requires TEAM_LEAD)
  const tlExact = tlLimitOrg;
  const resTLExact = await evaluateQuoteApproval("", {
    totalAmount: tlExact,
    currency: orgCurr,
    salesRepId: "mock-rep-default"
  });
  assertTest("Quote exactly at TL limit routes to TEAM_LEAD",
    resTLExact.approvalRequired === true && resTLExact.approvalLevel === "TEAM_LEAD",
    { amount: `${tlExact} ${orgCurr}`, limit: `${tlLimitOrg} ${orgCurr}`, expected: "level: TEAM_LEAD", actual: `level: ${resTLExact.approvalLevel}` }
  );

  // Case 2C: tlLimit + 0.01 (Exceeds TL ceiling -> Escalates to ADMIN)
  const tlPlus = Number((tlLimitOrg + 0.01).toFixed(2));
  const resTLPlus = await evaluateQuoteApproval("", {
    totalAmount: tlPlus,
    currency: orgCurr,
    salesRepId: "mock-rep-default"
  });
  assertTest("Quote at (TL limit + 0.01) exceeds TL ceiling and routes to ADMIN",
    resTLPlus.approvalRequired === true && resTLPlus.approvalLevel === "ADMIN",
    { amount: `${tlPlus} ${orgCurr}`, limit: `${tlLimitOrg} ${orgCurr}`, expected: "level: ADMIN", actual: `level: ${resTLPlus.approvalLevel}`, extra: resTLPlus.reason }
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // SUITE 3: Rep Experience Tier Cutoffs (Executive vs Agent)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- SUITE 3: Representative Tier Cutoffs (Executive vs Agent) ---");

  // Create temporary mock users for tier verification
  const execRep = { id: "mock-exec-rep", tier: "executive", role: "salesperson" };
  const agentRep = { id: "mock-agent-rep", tier: "agent", role: "salesperson" };

  // Executive tier tests (cutoff = execLimitOrg)
  const execUnder = Number((execLimitOrg - 0.01).toFixed(2));
  const execExact = execLimitOrg;
  const execOver = Number((execLimitOrg + 0.01).toFixed(2));

  const resExecUnder = await evaluateQuoteApproval("", { totalAmount: execUnder, currency: orgCurr, user: execRep });
  assertTest("Executive rep quote under executive cutoff is auto-approved",
    resExecUnder.approvalRequired === false && resExecUnder.approvalLevel === "SALES_REP",
    { amount: `${execUnder} ${orgCurr}`, limit: `${execLimitOrg} ${orgCurr}`, expected: "SALES_REP", actual: resExecUnder.approvalLevel }
  );

  const resExecExact = await evaluateQuoteApproval("", { totalAmount: execExact, currency: orgCurr, user: execRep });
  assertTest("Executive rep quote exactly at executive cutoff is auto-approved",
    resExecExact.approvalRequired === false && resExecExact.approvalLevel === "SALES_REP",
    { amount: `${execExact} ${orgCurr}`, limit: `${execLimitOrg} ${orgCurr}`, expected: "SALES_REP", actual: resExecExact.approvalLevel }
  );

  const resExecOver = await evaluateQuoteApproval("", { totalAmount: execOver, currency: orgCurr, user: execRep });
  assertTest("Executive rep quote exceeding executive cutoff requires TEAM_LEAD approval",
    resExecOver.approvalRequired === true && resExecOver.approvalLevel === "TEAM_LEAD",
    { amount: `${execOver} ${orgCurr}`, limit: `${execLimitOrg} ${orgCurr}`, expected: "TEAM_LEAD", actual: resExecOver.approvalLevel }
  );

  // Agent tier tests (cutoff = agentLimitOrg)
  const agentUnder = Number((agentLimitOrg - 0.01).toFixed(2));
  const agentExact = agentLimitOrg;
  const agentOver = Number((agentLimitOrg + 0.01).toFixed(2));

  const resAgentUnder = await evaluateQuoteApproval("", { totalAmount: agentUnder, currency: orgCurr, user: agentRep });
  assertTest("Agent rep quote under agent cutoff is auto-approved",
    resAgentUnder.approvalRequired === false && resAgentUnder.approvalLevel === "SALES_REP",
    { amount: `${agentUnder} ${orgCurr}`, limit: `${agentLimitOrg} ${orgCurr}`, expected: "SALES_REP", actual: resAgentUnder.approvalLevel }
  );

  const resAgentExact = await evaluateQuoteApproval("", { totalAmount: agentExact, currency: orgCurr, user: agentRep });
  assertTest("Agent rep quote exactly at agent cutoff is auto-approved",
    resAgentExact.approvalRequired === false && resAgentExact.approvalLevel === "SALES_REP",
    { amount: `${agentExact} ${orgCurr}`, limit: `${agentLimitOrg} ${orgCurr}`, expected: "SALES_REP", actual: resAgentExact.approvalLevel }
  );

  const resAgentOver = await evaluateQuoteApproval("", { totalAmount: agentOver, currency: orgCurr, user: agentRep });
  assertTest("Agent rep quote exceeding agent cutoff requires TEAM_LEAD approval",
    resAgentOver.approvalRequired === true && resAgentOver.approvalLevel === "TEAM_LEAD",
    { amount: `${agentOver} ${orgCurr}`, limit: `${agentLimitOrg} ${orgCurr}`, expected: "TEAM_LEAD", actual: resAgentOver.approvalLevel }
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // SUITE 4: Cross-Currency Quote Dynamic Conversion & Display Assertions
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- SUITE 4: Cross-Currency Quote Conversion & Display Validation ---");

  // INR Quote compared against SAR org currency policy
  const inrQuoteUnder = 999999;
  const inrQuoteExact = 1000000;
  const inrQuoteOver = 1000001;

  const resInrUnder = await evaluateQuoteApproval("", { totalAmount: inrQuoteUnder, currency: "INR" });
  assertTest("INR Quote below stored 1,000,000 INR limit auto-approves",
    resInrUnder.approvalRequired === false && resInrUnder.approvalLevel === "SALES_REP",
    { amount: `${inrQuoteUnder} INR`, limit: repLimitRes.display, expected: "SALES_REP", actual: resInrUnder.approvalLevel }
  );

  const resInrExact = await evaluateQuoteApproval("", { totalAmount: inrQuoteExact, currency: "INR" });
  assertTest("INR Quote exactly at stored 1,000,000 INR limit auto-approves",
    resInrExact.approvalRequired === false && resInrExact.approvalLevel === "SALES_REP",
    { amount: `${inrQuoteExact} INR`, limit: repLimitRes.display, expected: "SALES_REP", actual: resInrExact.approvalLevel }
  );

  const resInrOver = await evaluateQuoteApproval("", { totalAmount: inrQuoteOver, currency: "INR" });
  assertTest("INR Quote exceeding stored 1,000,000 INR limit routes to TEAM_LEAD with dual-currency display",
    resInrOver.approvalRequired === true && resInrOver.approvalLevel === "TEAM_LEAD" && resInrOver.reason.includes("limit set as"),
    { amount: `${inrQuoteOver} INR`, limit: repLimitRes.display, expected: "TEAM_LEAD with dual-currency display", actual: `${resInrOver.approvalLevel}`, extra: resInrOver.reason }
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // SUITE 5: Missing Exchange Rate Handling & Escalation
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- SUITE 5: Missing Exchange Rate Escalation ---");

  const quoteMissing = await evaluateQuoteApproval("", {
    totalAmount: 50000,
    currency: "JPY_UNCONFIGURED"
  });
  assertTest("Missing exchange rate escalates quote to ADMIN",
    quoteMissing.approvalRequired === true && quoteMissing.approvalLevel === "ADMIN" && quoteMissing.reason.includes("Exchange rate for JPY_UNCONFIGURED is missing; ask an admin"),
    { amount: "50,000 JPY_UNCONFIGURED", limit: "N/A", expected: "ADMIN with explicit error message", actual: `${quoteMissing.approvalLevel} - ${quoteMissing.reason}` }
  );

  const dealMissing = await evaluateDealApproval("", 50000, "JPY_UNCONFIGURED");
  assertTest("Missing exchange rate escalates deal to ADMIN",
    dealMissing.approvalRequired === true && dealMissing.approvalLevel === "ADMIN" && dealMissing.reason.includes("Exchange rate for JPY_UNCONFIGURED is missing; ask an admin"),
    { amount: "50,000 JPY_UNCONFIGURED", limit: "N/A", expected: "ADMIN with explicit error message", actual: `${dealMissing.approvalLevel} - ${dealMissing.reason}` }
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // SUITE 6: Deal Won Snapshot & Backfill Verification
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- SUITE 6: Deal Won Snapshot & Backfill ---");

  const snapshotUsd = await snapshotDealWonAmount({ amount: 10000, currency: "USD" }, "SAR");
  assertTest("Won deal snapshot converts USD to SAR at 3.75",
    snapshotUsd.exchangeRateToOrg === 3.75 && snapshotUsd.amountInOrgCurrency === 37500,
    { amount: "$10,000 USD", limit: "SAR Base", expected: "rate: 3.75, amount: 37,500.00 SAR", actual: `rate: ${snapshotUsd.exchangeRateToOrg}, amount: ${snapshotUsd.amountInOrgCurrency} SAR` }
  );

  const backfillCount = await backfillWonDealsExchangeRates();
  assertTest("Backfill runs cleanly without throwing",
    typeof backfillCount === "number",
    { amount: "All won deals", limit: "N/A", expected: "Number count >= 0", actual: `Backfilled: ${backfillCount}` }
  );

  console.log("\n================================================================================");
  console.log(`TEST SUMMARY: ${testsPassed}/${totalTests} tests passed.`);
  console.log("================================================================================\n");

  process.exit(testsPassed === totalTests ? 0 : 1);
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
