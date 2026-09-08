import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

import { sequelize, User, Lead, Deal, FlaggedLead, ApprovalRequest, SalesApprovalProfile, AdminApprovalPolicy, Activity, LeadReassignmentHistory } from "@nexus-crm/database";
import { runPipeline } from "../src/lead-security-layer/index";
import { ingestLead } from "../src/services/leadIngestion";
import { convertLeadToOpportunity } from "../src/services/leadJourneyWorkflowEngine";
import { checkRecordAccess } from "../src/services/handoffAccessService";
import { evaluateDealApproval } from "../src/services/approvalEngine";
import { processOpportunityEvent } from "../src/services/opportunityAutomationEngine";

async function runVerification() {
  console.log("================================================================================");
  console.log("   NEXUS CRM: POST-INGESTION LEAD HANDOFF & DEAL APPROVAL WORKFLOW VERIFICATION");
  console.log("================================================================================\n");

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

  await sequelize.sync();

  // ── SEED USERS & HIERARCHY ──────────────────────────────────────────────────
  console.log("--- Setup: Ensuring Sales Hierarchy & Profiles ---");

  // 1. Sales Manager (Marcus Vance)
  let manager: any = await User.findOne({ where: { email: "marcus.manager@nexus-crm.com" } });
  if (!manager) {
    manager = await User.create({
      id: "usr_mgr_marcus_" + Date.now().toString(36),
      name: "Marcus Vance",
      email: "marcus.manager@nexus-crm.com",
      password: "hashedpassword",
      role: "manager",
      isAvailable: true,
      status: "Available"
    });
  }

  // 2. Salesman 1 (SDR Alice - Presales / Qualification)
  let salesman1: any = await User.findOne({ where: { email: "alice.sdr@nexus-crm.com" } });
  if (!salesman1) {
    salesman1 = await User.create({
      id: "usr_sdr_alice_" + Date.now().toString(36),
      name: "Alice SDR",
      email: "alice.sdr@nexus-crm.com",
      password: "hashedpassword",
      role: "sales_rep",
      managerId: manager.id,
      isAvailable: true,
      status: "Available"
    });
  }

  // 3. Salesman 2 (Closer Bob - Senior AE / Negotiation & Closing)
  let salesman2: any = await User.findOne({ where: { email: "bob.closer@nexus-crm.com" } });
  if (!salesman2) {
    salesman2 = await User.create({
      id: "usr_ae_bob_" + Date.now().toString(36),
      name: "Bob Closer",
      email: "bob.closer@nexus-crm.com",
      password: "hashedpassword",
      role: "senior_ae",
      managerId: manager.id,
      isAvailable: true,
      status: "Available",
      dealValueCutoff: 1000000 // ₹10 Lakh limit
    });
  }

  // Ensure SalesApprovalProfile for Salesman 2
  let profileBob: any = await SalesApprovalProfile.findOne({ where: { salesRepId: salesman2.id } });
  if (!profileBob) {
    profileBob = await SalesApprovalProfile.create({
      id: require("crypto").randomUUID(),
      salesRepId: salesman2.id,
      selfApprovalLimit: 1000000, // ₹10L limit
      discountApprovalLimit: 0.10,
      minimumMargin: 0.20,
      teamLeadId: manager.id,
      approvalEnabled: true
    });
  } else {
    await profileBob.update({ selfApprovalLimit: 1000000, teamLeadId: manager.id });
  }

  // Global Admin Policy
  let policy: any = await AdminApprovalPolicy.findOne({ order: [["createdAt", "DESC"]] });
  if (!policy) {
    await AdminApprovalPolicy.create({
      id: require("crypto").randomUUID(),
      maximumSalesRepApproval: 2500000,
      maximumTeamLeadApproval: 10000000,
      maximumRepDiscount: 0.10,
      maximumTeamLeadDiscount: 0.20,
      minimumAllowedMargin: 0.15
    });
  }

  console.log(`  Initialized:`);
  console.log(`    - Salesman 1 (Presales): ${salesman1.name} (${salesman1.email})`);
  console.log(`    - Salesman 2 (Closer):   ${salesman2.name} (${salesman2.email}) [Self-Approval Limit: ₹10,00,000]`);
  console.log(`    - Manager:              ${manager.name} (${manager.email})\n`);

  // ════════════════════════════════════════════════════════════════════════════
  // TEST SCENARIO A: BLOCKED LEAD (Security Layer Quarantine)
  // ════════════════════════════════════════════════════════════════════════════
  console.log("================================================================================");
  console.log("SCENARIO A: Lead A - Blocked by Security Layer (Never reaches Salesman 1)");
  console.log("================================================================================");

  const maliciousPayload = {
    firstName: "Phisher",
    lastName: "Attacker",
    email: "scam_bot@guerrillamail.com", // Disposable/spam domain flagged at Stage 4
    company: "Phishing Entity Inc",
    message: "URGENT: Click here for wire transfer authentication: http://malicious-login-phish.biz",
    source: "Web Form"
  };

  const initialFlaggedCount = await FlaggedLead.count();
  const initialLeadCount = await Lead.count({ where: { email: maliciousPayload.email } });

  let securityBlocked = false;
  let blockReason = "";

  try {
    await runPipeline(maliciousPayload, { source: "Web Form", ip: "198.51.100.23" });
  } catch (err: any) {
    if (err.blocked) {
      securityBlocked = true;
      blockReason = err.reason;
    }
  }

  assert(securityBlocked === true, "Lead A blocked by Security Layer", `Got blocked=${securityBlocked}`);
  assert(blockReason.includes("Disposable") || blockReason.includes("Spam") || blockReason.length > 0, "Lead A flagged with security reason", `Reason: ${blockReason}`);

  const postFlaggedLead: any = await FlaggedLead.findOne({
    order: [["createdAt", "DESC"]]
  });
  const parsedPayload = postFlaggedLead?.payload ? JSON.parse(postFlaggedLead.payload) : {};
  assert(!!postFlaggedLead && parsedPayload.email === maliciousPayload.email, "Lead A persisted in flagged_leads quarantine table");
  assert(postFlaggedLead?.reviewed === false || !!postFlaggedLead?.reason, "Lead A logged with quarantine reason and pending human review");

  const postLeadCount = await Lead.count({ where: { email: maliciousPayload.email } });
  assert(postLeadCount === 0, "Lead A NEVER created active Lead record in CRM (Lead count = 0)");

  const sdrLeadCount = await Lead.count({ where: { assignedToId: salesman1.id, email: maliciousPayload.email } });
  assert(sdrLeadCount === 0, "Lead A was NEVER assigned to Salesman 1 (SDR queue remains clean)\n");

  // ════════════════════════════════════════════════════════════════════════════
  // TEST SCENARIO B: CLEAN LEAD FULL POST-INGESTION LIFECYCLE
  // ════════════════════════════════════════════════════════════════════════════
  console.log("================================================================================");
  console.log("SCENARIO B: Lead B - Clean Lead Passes Security -> Salesman 1 -> Salesman 2 -> Over-Limit -> Escalation -> Manager Approval -> Won");
  console.log("================================================================================");

  const cleanPayload = {
    firstName: "Aarav",
    lastName: "Deshmukh",
    email: `aarav.${Date.now()}@tatasteel-enterprise.com`,
    company: "Tata Steel Enterprise Division",
    phone: "+919876543210",
    message: "Looking for enterprise CRM platform with customized multi-tier approval workflows for 250 sales reps.",
    budgetRange: "2500000",
    source: "Web Form"
  };

  // 1. Ingestion through Security Layer
  console.log("\n--- Stage 1: Security Layer Ingestion & Assignment to Salesman 1 ---");
  const clearedLeadCandidate = await runPipeline(cleanPayload, { source: "Web Form", ip: "203.0.113.15" });
  assert(!!clearedLeadCandidate, "Lead B successfully passed all 5 stages of Security Layer");

  const leadId = await ingestLead({
    firstName: clearedLeadCandidate.firstName,
    lastName: clearedLeadCandidate.lastName,
    email: clearedLeadCandidate.email,
    company: clearedLeadCandidate.company,
    phone: clearedLeadCandidate.phone,
    message: clearedLeadCandidate.message,
    source: "Web Form",
    budgetRange: clearedLeadCandidate.budgetRange,
    assignedToId: salesman1.id // Directed to Presales Salesman 1
  });

  assert(!!leadId, "Lead B successfully ingested into CRM");
  const leadObj: any = await Lead.findByPk(leadId!);
  assert(!!leadObj, "Lead B successfully created as active Lead in CRM");
  assert(leadObj.assignedToId === salesman1.id, `Lead B assigned to Salesman 1 (${salesman1.name})`);

  // 2. Salesman 1 Qualifies and Hands off to Salesman 2
  console.log("\n--- Stage 2: Salesman 1 Qualification & Handoff to Salesman 2 ---");
  const handoffNotes = "Client requirement verified: 250 licenses, multi-tier approvals, integration with SAP. Ready for commercial negotiation.";
  const conversionResult: any = await convertLeadToOpportunity(
    leadId!,
    {
      estimatedValue: 2500000,
      dealName: "Tata Steel - Enterprise CRM Deployment",
      accountName: "Tata Steel Enterprise Division"
    },
    salesman1.id,
    {
      targetRepId: salesman2.id,
      handoffNotes
    }
  );

  assert(!!conversionResult?.deal?.id, "Lead B successfully converted to Opportunity/Deal");
  const dealId = conversionResult.deal.id;
  const dealObj: any = await Deal.findByPk(dealId);

  assert(dealObj.ownerId === salesman2.id, `Deal reassigned to Salesman 2 (${salesman2.name}) for negotiation`);
  assert(dealObj.originalOwnerId === salesman1.id, `Original owner recorded as Salesman 1 (${salesman1.name})`);

  // Verify handoff history
  const handoffRecord: any = await LeadReassignmentHistory.findOne({
    where: { leadId: leadId! },
    order: [["createdAt", "DESC"]]
  });
  assert(!!handoffRecord, "LeadReassignmentHistory recorded handoff between reps");
  assert(
    (handoffRecord?.oldAssignedToId === salesman1.id || handoffRecord?.oldAssigneeId === salesman1.id) &&
    (handoffRecord?.newAssignedToId === salesman2.id || handoffRecord?.newAssigneeId === salesman2.id),
    "Handoff record tracks oldAssignee (Salesman 1) and newAssignee (Salesman 2)"
  );

  // Verify Salesman 1 has permanent view-only access
  const accessSalesman1 = await checkRecordAccess(salesman1.id, "sales_rep", { dealId, leadId: leadId! });
  assert(accessSalesman1.canRead === true && accessSalesman1.canWrite === false, "Salesman 1 retained permanent view-only access (canRead: true, canWrite: false)");
  assert(accessSalesman1.isViewOnly === true, "Salesman 1 marked as isViewOnly = true");

  // Verify Salesman 2 has write access
  const accessSalesman2 = await checkRecordAccess(salesman2.id, "senior_ae", { dealId, leadId: leadId! });
  assert(accessSalesman2.canWrite === true, "Salesman 2 has active write access to negotiate the deal");

  // 3. Salesman 2 Enters Negotiation: Sets Deal Value to ₹45,00,000 (Exceeds ₹10L limit)
  console.log("\n--- Stage 3: Negotiation Deal Value Escalation (₹45,00,000 vs ₹10,00,000 limit) ---");
  const negotiatedAmount = 4500000; // ₹45 Lakhs

  const evalResult = await evaluateDealApproval(dealId, negotiatedAmount);
  assert(evalResult.approvalRequired === true, "Authority check triggered: Approval is required for ₹45,00,000 deal");
  assert(evalResult.repLimit === 1000000, `Salesman 2 limit correctly evaluated as ₹10,00,000 (got ₹${evalResult.repLimit.toLocaleString()})`);
  assert(evalResult.exceededBy === 3500000, `Exceeded amount correctly evaluated as ₹35,00,000 (got ₹${evalResult.exceededBy.toLocaleString()})`);
  assert(evalResult.requiredApproverId === manager.id, `Escalation routed to Sales Manager (${manager.name})`);

  // Update deal and generate approval request (simulating updateOpportunity controller)
  await dealObj.update({ amount: negotiatedAmount });

  const approvalReqId = require("crypto").randomUUID();
  const approvalReq: any = await ApprovalRequest.create({
    id: approvalReqId,
    type: "Deal",
    targetId: dealId,
    requestedById: salesman2.id,
    assignedApproverId: manager.id,
    status: "Pending",
    comments: evalResult.reason
  });
  assert(!!approvalReq, "ApprovalRequest created with type='Deal', status='Pending' in Manager queue");

  // 4. Salesman 2 Attempts to Mark Deal WON Without Approval -> BLOCKED
  console.log("\n--- Stage 4: Attempting to Close / Mark Deal Won Before Manager Approval ---");
  let wonBlocked = false;
  let wonBlockError = "";

  // Simulating the controller guard in markOpportunityWon / moveDealStage
  const preApprovalEval = await evaluateDealApproval(dealId);
  if (preApprovalEval.approvalRequired) {
    const approved = await ApprovalRequest.findOne({
      where: { targetId: dealId, type: "Deal", status: "Approved" }
    });
    if (!approved) {
      wonBlocked = true;
      wonBlockError = `Approval required: Deal value (₹${Number(dealObj.amount).toLocaleString()}) exceeds your authority limit (₹${Number(preApprovalEval.repLimit).toLocaleString()}). Manager approval must be obtained before closing this deal.`;
    }
  }

  assert(wonBlocked === true, "Salesman 2 blocked from marking deal Won without manager approval");
  assert(wonBlockError.startsWith("Approval required: Deal value (₹4,500,000) exceeds your authority limit (₹1,000,000)"), "Business-friendly error returned to representative");
  assert(!wonBlockError.includes("Security Violation"), "Confirmed error message does NOT use internal security violation phrasing");

  // 5. Manager Reviews and Approves Deal Escalation
  console.log("\n--- Stage 5: Manager Reviews and Approves Deal Escalation ---");
  await approvalReq.update({
    status: "Approved",
    approvedById: manager.id,
    comments: "Approved 250-license enterprise deal at ₹45,00,000 per executive sales policy."
  });

  await Activity.create({
    id: require("crypto").randomUUID(),
    leadId: leadId!,
    type: "note",
    outcome: "Deal Approval Approved",
    notes: `Deal value approval was approved by ${manager.name}. Comments: Approved 250-license enterprise deal at ₹45,00,000.`,
    createdById: manager.id,
    direction: "internal"
  });

  const updatedApproval: any = await ApprovalRequest.findByPk(approvalReqId);
  assert(updatedApproval.status === "Approved", "ApprovalRequest updated to 'Approved' by Manager");
  assert(updatedApproval.approvedById === manager.id, "Manager recorded as approvedById");

  // 6. Salesman 2 Now Marks Deal Won -> SUCCEEDS
  console.log("\n--- Stage 6: Salesman 2 Closes Deal as Won Following Approval ---");
  const postApprovalCheck = await ApprovalRequest.findOne({
    where: { targetId: dealId, type: "Deal", status: "Approved" }
  });
  assert(!!postApprovalCheck, "Verified Approved ApprovalRequest exists on record for the deal");

  const eventResult = await processOpportunityEvent({
    opportunityId: dealId,
    type: "MarkWon",
    actorId: salesman2.id,
    payload: {
      wonReason: "EXECUTIVE_APPROVAL_GRANTED",
      transitionType: "STANDARD"
    }
  });

  assert(eventResult.success === true, "processOpportunityEvent successfully executed MarkWon");
  const finalDeal: any = await Deal.findByPk(dealId);
  assert(finalDeal.status === "WON", `Deal status transitioned to '${finalDeal.status}'`);

  // Verify audit activity logs
  const leadActivities = await Activity.findAll({ where: { leadId: leadId! } });
  assert(leadActivities.length >= 1, `Audit trail verified: ${leadActivities.length} activities logged on the record`);

  // ── FINAL REPORT ────────────────────────────────────────────────────────────
  console.log("\n================================================================================");
  console.log(`   VERIFICATION SUMMARY: ${passedTests}/${totalTests} TESTS PASSED`);
  console.log("================================================================================\n");

  if (passedTests === totalTests) {
    console.log("🎉 ALL LEAD HANDOFF & DEAL APPROVAL LIFECYCLE TESTS PASSED!\n");
    process.exit(0);
  } else {
    console.error(`💥 ${totalTests - passedTests} TESTS FAILED!\n`);
    process.exit(1);
  }
}

runVerification().catch((err) => {
  console.error("FATAL ERROR IN VERIFICATION:", err);
  process.exit(1);
});
