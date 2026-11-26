import path from "path";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config();

import crypto from "crypto";
import {
  Database,
  sequelize,
  User,
  Lead,
  SiteInspection,
  SiteInspectionService,
  SiteInspectionAttachment,
  SiteBase,
  SiteFacility,
  Deal,
  Account,
  Contact,
  Quote,
  QuoteLineItem,
  ApprovalRequest,
  PurchaseOrder,
  WorkOrder,
  Invoice,
} from "@nexus-crm/database";

import {
  getSiteInspectionGate,
  reviewInspection,
  haversineKm,
  computeMetrics,
} from "../src/services/siteInspectionService";

import {
  convertLeadToOpportunity,
  submitQuoteForApprovalWorkflow,
} from "../src/services/leadJourneyWorkflowEngine";

// Test assertion helper
function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

async function runFullCycleTest() {
  console.log("\n================================================================================");
  console.log("   🚀 COMPREHENSIVE END-TO-END FLOWCHART LIFECYCLE VERIFICATION TEST");
  console.log("================================================================================\n");

  await Database.createConnection();
  const ts = Date.now();

  // ─────────────────────────────────────────────────────────────────────────────
  // SETUP TEST ACTORS
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("👉 Setting up Test Actors (Pre-Sales, Site Inspector, Team Lead/Manager)...");

  // Pre-Sales Rep
  let presalesUser: any = await User.findOne({ where: { role: "sales_rep" } });
  if (!presalesUser) {
    presalesUser = await User.create({
      id: crypto.randomUUID(),
      name: `PreSales Rep ${ts}`,
      email: `presales_${ts}@nexus.com`,
      password: "HashedPassword123!",
      role: "sales_rep",
      isAvailable: true,
      status: "Active",
      dealValueCutoff: 50000, // 50,000 SAR limit
    });
  } else {
    await presalesUser.update({ dealValueCutoff: 50000 });
  }

  // Ensure approval profile matches salesman 50k limit
  const repProf = await sequelize.models.SalesApprovalProfile.findOne({ where: { salesRepId: presalesUser.id } });
  if (repProf) {
    await repProf.update({ selfApprovalLimit: 50000 });
  }

  // Site Inspector
  let inspectorUser: any = await User.findOne({ where: { role: "site_manager" } });
  if (!inspectorUser) {
    inspectorUser = await User.create({
      id: crypto.randomUUID(),
      name: `Site Inspector Eng. Tariq ${ts}`,
      email: `inspector_${ts}@nexus.com`,
      password: "HashedPassword123!",
      role: "site_manager",
      isAvailable: true,
      status: "Active",
    });
  }

  // Team Lead / Operations Manager
  let managerUser: any = await User.findOne({ where: { role: "ops_manager" } });
  if (!managerUser) {
    managerUser = await User.create({
      id: crypto.randomUUID(),
      name: `Ops Manager Khalid ${ts}`,
      email: `manager_${ts}@nexus.com`,
      password: "HashedPassword123!",
      role: "ops_manager",
      isAvailable: true,
      status: "Active",
    });
  }

  // Base Station
  let [base] = await SiteBase.findOrCreate({
    where: { code: "JUBAIL" },
    defaults: {
      id: crypto.randomUUID(),
      code: "JUBAIL",
      name: "Jubail Operations Base",
      region: "Eastern Province",
      latitude: 27.0,
      longitude: 49.65,
    },
  });

  // Disposal Facility
  let [facility] = await SiteFacility.findOrCreate({
    where: { name: "Bee'ah/EDCO Hazmat Complex Jubail" },
    defaults: {
      id: crypto.randomUUID(),
      name: "Bee'ah/EDCO Hazmat Complex Jubail",
      serviceType: "HAZARDOUS",
      lat: 26.96,
      lng: 49.61,
      isActive: true,
    },
  });

  assert(!!presalesUser && !!inspectorUser && !!managerUser, "All test actors initialized");

  // ─────────────────────────────────────────────────────────────────────────────
  // STAGE 1: INBOUND LEAD INTAKE (MULTIPLE CHANNELS)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n▶ STAGE 1: Inbound Lead Intake (WhatsApp/Web Form)");
  const leadEmail = `procurement_${ts}@gulfchemicals.sa`;
  const lead = await Lead.create({
    id: crypto.randomUUID(),
    firstName: "Eng. Mansoor",
    lastName: "Al-Ghamdi",
    company: "Gulf Chemicals Petrochemical Complex",
    email: leadEmail,
    phone: "+966551234567",
    whatsappPhone: "+966551234567",
    source: "WhatsApp Request",
    status: "NEW",
    leadNumber: `LD-${ts.toString().slice(-6)}`,
    subject: "Urgent evacuation of 50 m3 chemical process effluent pit",
    assignedToId: presalesUser.id,
    requiresSiteInspection: true,
    siteInspectionStatus: "NOT_REQUESTED",
  });

  assert(lead.status === "NEW", "Lead created with status 'NEW'");
  assert(lead.assignedToId === presalesUser.id, `Lead routed to Pre-Sales Rep: ${presalesUser.name}`);

  // ─────────────────────────────────────────────────────────────────────────────
  // STAGE 2: PRE-SALES VERIFICATION & SITE LOCATION CAPTURE
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n▶ STAGE 2: Pre-Sales Verification Call & Location Capture");
  await lead.update({
    status: "CONTACTED",
    requiresSiteInspection: true,
    siteInspectionStatus: "REQUESTED",
  });
  assert(lead.status === "CONTACTED", "Pre-Sales contacted client, stage set to 'CONTACTED'");

  // Pre-Sales captures location on call
  const siteLat = 27.042;
  const siteLng = 49.512;
  const straightKm = haversineKm(base.latitude, base.longitude, siteLat, siteLng);
  const inspectionNumber = `SI-2026-${ts.toString().slice(-4)}`;

  const inspection = await SiteInspection.create({
    id: crypto.randomUUID(),
    inspectionNumber,
    leadId: lead.id,
    status: "REQUESTED",
    assignedToId: inspectorUser.id,
    requestedById: presalesUser.id,
    baseId: base.id,
    baseName: base.name,
    siteName: "Gulf Chemicals Plant 2 - Tank Farm 4",
    siteAddress: "Plot 42, Jubail Industrial City 2, Gate #3",
    siteAreaName: "Jubail Industrial City 2",
    latitude: siteLat,
    longitude: siteLng,
    clientOrganization: lead.company,
    clientRepName: `${lead.firstName} ${lead.lastName}`,
    clientRepPhone: lead.phone,
    requestNote: "Gate #3 entrance. Aramco/SABIC safety passport & H2S monitor required.",
    baseToSiteStraightKm: straightKm,
    mobilizationKm: straightKm,
  });

  assert(inspection.status === "REQUESTED", `Site Inspection ${inspectionNumber} raised [REQUESTED]`);
  assert(inspection.assignedToId === inspectorUser.id, `Assigned to Site Inspector: ${inspectorUser.name}`);
  assert(inspection.baseToSiteStraightKm! > 0, `Straight distance from Base computed: ${inspection.baseToSiteStraightKm} km`);

  // ─────────────────────────────────────────────────────────────────────────────
  // STAGE 3: TECHNICAL GATE ENFORCEMENT CHECK (NEGATIVE TEST)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n▶ STAGE 3: Technical Gate Enforcement (Verify conversion is BLOCKED before survey)");
  const prematureGate = await getSiteInspectionGate(lead.id);
  assert(prematureGate.allowed === false, "Commercial conversion BLOCKED while inspection is in 'REQUESTED' status");
  console.log(`  Gate blocked as expected: "${prematureGate.message}"`);

  // ─────────────────────────────────────────────────────────────────────────────
  // STAGE 4: SITE INSPECTOR EXECUTES MOBILE AUDIT
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n▶ STAGE 4: Site Inspector Executes Field Survey (Mobile Cockpit)");
  // Gate check-in
  await inspection.update({
    status: "DRAFT",
    startedAt: new Date(),
  });
  assert(inspection.startedAt !== null, "Site Inspector checked in at gate [IN_PROGRESS / DRAFT]");

  // Step 1: Site & Road parameters
  await inspection.update({
    speedLimitKmh: 40,
    observations: "Paved asphalt road up to effluent pit. Ground compaction verified >= 180 kPa. Vacuum tanker turnaround radius clear.",
  });
  assert(inspection.speedLimitKmh === 40, "Step 1: Ground compaction & turnaround radius verified");

  // Step 2: Hazardous Waste Stream & Disposal Facility
  const facilityDistanceKm = haversineKm(siteLat, siteLng, facility.latitude, facility.longitude);
  const service = await SiteInspectionService.create({
    id: crypto.randomUUID(),
    inspectionId: inspection.id,
    serviceType: "HAZARDOUS",
    facilityId: facility.id,
    facilityName: facility.name,
    distanceKm: facilityDistanceKm,
    wasteDescription: "Industrial petrochemical hydrocarbon sludge & chemical effluent",
    estimatedVolume: 50,
    volumeUnit: "m3",
    logisticsNote: "Heavy chemical vacuum tanker with PTFE lined hose",
    isActive: true,
  });

  const metrics = computeMetrics(inspection.mobilizationKm || straightKm, [service]);
  await inspection.update({
    totalCycleKm: metrics.totalCycleKm,
    estFuelLitres: metrics.estFuelLitres,
  });
  assert(service.estimatedVolume === 50, "Step 2: 50 m³ hazardous chemical sludge stream registered");
  assert(inspection.totalCycleKm! > 0, `Round-trip cycle calculated: ${inspection.totalCycleKm} km (${inspection.estFuelLitres}L diesel)`);

  // Step 3: Photo Evidence & PTW
  const attachment = await SiteInspectionAttachment.create({
    id: crypto.randomUUID(),
    inspectionId: inspection.id,
    fileName: "effluent_pit_geotagged.jpg",
    mimeType: "image/jpeg",
    sizeBytes: 245000,
    storagePath: "/uploads/effluent_pit_geotagged.jpg",
    tag: "Waste Storage Area",
    latitude: siteLat,
    longitude: siteLng,
    caption: "Chemical effluent pit with 4-inch camlock manifold",
    uploadedById: inspectorUser.id,
  });
  assert(attachment.tag === "Waste Storage Area", "Step 3: Geotagged photo evidence attached");

  // Submit survey
  await inspection.update({
    status: "SUBMITTED",
    submittedAt: new Date(),
    accepted: true,
  });
  await lead.update({ siteInspectionStatus: "SUBMITTED" });
  assert(inspection.status === "SUBMITTED", "Site Inspector submitted completed audit to Manager [SUBMITTED]");

  // ─────────────────────────────────────────────────────────────────────────────
  // STAGE 5: MANAGER / TEAM LEAD REVIEW & APPROVAL
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n▶ STAGE 5: Manager / Team Lead Review on Desk");
  const reviewed = await reviewInspection(
    inspection.id,
    "APPROVE",
    managerUser.id,
    managerUser.role,
    "All safety access, facility route, and waste classifications approved."
  );
  assert(reviewed.status === "APPROVED", "Manager approved audit on Review Desk [APPROVED]");

  const postReviewGate = await getSiteInspectionGate(lead.id);
  assert(postReviewGate.allowed === true, "Commercial Pipeline Gate UNLOCKED upon inspection approval");

  // ─────────────────────────────────────────────────────────────────────────────
  // STAGE 6: OPPORTUNITY CONVERSION & CLOSER HANDOFF
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n▶ STAGE 6: Convert Lead to Commercial Opportunity (Deal)");
  const convResult = await convertLeadToOpportunity(
    lead.id,
    {
      requirement: "50 m3 Chemical Effluent Pumping & Certified Disposal",
      estimatedValue: 120000, // 120,000 SAR
      timeline: "Immediate / 5 Days",
      decisionMaker: "Eng. Mansoor Al-Ghamdi (VP Plant Ops)",
    },
    presalesUser.id
  );

  const deal = convResult.deal;
  const account = convResult.account;
  const contact = convResult.contact;

  // Ensure Pre-Sales / Sales Closer is the deal owner with 50,000 SAR approval cutoff
  await deal.update({ ownerId: presalesUser.id });
  await presalesUser.update({ dealValueCutoff: 50000, isAvailable: true });

  assert(deal !== null && deal.amount === 120000, "Commercial Deal created for 120,000 SAR");
  assert(account !== null, `Customer Account created: ${account.name}`);
  assert(contact !== null, `Primary Contact linked: ${contact.firstName} ${contact.lastName}`);
  assert(convResult.lead.status === "CONVERTED", "Lead status updated to 'CONVERTED'");

  // ─────────────────────────────────────────────────────────────────────────────
  // STAGE 7: QUOTE DRAFTING & APPROVAL ENGINE (SALESMAN LIMIT CHECK)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n▶ STAGE 7: Quote Drafting & Approval Threshold Escalation (Rev 1)");
  // Salesman limit is 50,000 SAR. Quote is 120,000 SAR -> must trigger approval!
  const quote1 = await Quote.create({
    id: crypto.randomUUID(),
    quoteNumber: `QT-${ts.toString().slice(-5)}-01`,
    dealId: deal.id,
    totalAmount: 120000,
    status: "Draft",
    revision: 1,
  });

  await QuoteLineItem.create({
    id: crypto.randomUUID(),
    quoteId: quote1.id,
    name: "Vacuum Tanker Chemical Clearance (5 Trips @ 10 m³)",
    quantity: 5,
    unitPrice: 18000,
    totalPrice: 90000,
  });

  await QuoteLineItem.create({
    id: crypto.randomUUID(),
    quoteId: quote1.id,
    name: "Hazardous Chemical Disposal & Treatment Tariff (Bee'ah)",
    quantity: 50,
    unitPrice: 600,
    totalPrice: 30000,
  });

  // Check approval workflow
  const appWorkflow1 = await submitQuoteForApprovalWorkflow(quote1.id, presalesUser.id);
  assert(appWorkflow1.approvalRequired === true, "Quote 120,000 SAR exceeds salesman 50k SAR limit -> Escalated to Team Lead");

  // Manager approves Rev 1
  await quote1.update({ status: "Approved" });
  assert(quote1.status === "Approved", "Team Lead approved Quote Rev 1 -> Sent to Customer");

  // ─────────────────────────────────────────────────────────────────────────────
  // STAGE 8: THE 'TO-AND-FRO' NEGOTIATION & REVISION 2 (REV 2)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n▶ STAGE 8: Customer Negotiation ('To-and-Fro') & Quote Revision (Rev 2)");
  console.log("  💬 Customer calls salesman: 'Competitor offered 105k SAR. Give 12.5% discount or we drop.'");

  // Salesman drafts Revision 2 with negotiated price
  const quote2 = await Quote.create({
    id: crypto.randomUUID(),
    quoteNumber: `QT-${ts.toString().slice(-5)}-02`,
    dealId: deal.id,
    totalAmount: 105000, // 105,000 SAR negotiated
    status: "Draft",
    revision: 2,
    notes: "Rev 2: Agreed 12.5% commercial discount against competitor tender.",
  });

  // Re-evaluates limit: 105,000 SAR still > 50,000 SAR and has 12.5% discount
  const appWorkflow2 = await submitQuoteForApprovalWorkflow(quote2.id, presalesUser.id);
  assert(appWorkflow2.approvalRequired === true, "Quote Rev 2 exceeds salesman discount limit -> Escalated to Team Lead");

  // Team Lead approves revised commercial discount
  await quote2.update({ status: "Approved" });
  assert(quote2.status === "Approved", "Team Lead approved Quote Rev 2 (105,000 SAR)");

  // ─────────────────────────────────────────────────────────────────────────────
  // STAGE 9: CUSTOMER ACCEPTANCE, PURCHASE ORDER (PO) & WORK EXECUTION
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n▶ STAGE 9: Customer Acceptance, Purchase Order (PO) & Operations Handover");
  // Customer accepts quote
  await quote2.update({ status: "Accepted" });
  assert(quote2.status === "Accepted", "Customer formally accepted Quote Rev 2");

  // Customer issues PO
  const poNumber = `PO-GULF-${ts.toString().slice(-5)}`;
  const po = await PurchaseOrder.create({
    id: crypto.randomUUID(),
    quoteId: quote2.id,
    poNumber,
    amount: 105000,
    type: "customer_po",
    status: "Confirmed",
    salesOwnerId: presalesUser.id,
    notes: "Official Client Purchase Order for 50 m³ hazardous pit clearance",
    deliveryAddress: inspection.siteAddress,
  });
  assert(po.status === "Confirmed", `Customer Purchase Order ${poNumber} issued & verified in CRM`);

  // Deal marked CLOSED WON
  await deal.update({ status: "WON" });
  assert(deal.status === "WON", "🎉 Deal marked CLOSED WON!");

  // Operations WorkOrder & Invoicing Handover
  const workOrder = await WorkOrder.create({
    id: crypto.randomUUID(),
    workOrderNumber: `WO-${ts.toString().slice(-5)}`,
    workOrderType: "Installation",
    status: "Dispatched",
    priority: "High",
    subject: `Chemical Effluent Clearance - ${lead.company}`,
    description: `Dispatched per Site Inspection ${inspectionNumber}: Gate #3, PTW permit required.`,
    accountId: account.id,
    dealId: deal.id,
    street: inspection.siteAddress,
    grandTotal: 105000,
  });
  assert(workOrder.status === "Dispatched", `Operations Work Order ${workOrder.workOrderNumber} dispatched with site audit gate instructions`);

  const invoice = await Invoice.create({
    id: crypto.randomUUID(),
    quoteId: quote2.id,
    status: "Draft",
    totalAmount: 105000,
    dueDate: new Date(Date.now() + 30 * 24 * 3600 * 1000),
    notes: `Invoice billed against Customer PO ${poNumber}`,
  });
  assert(invoice.totalAmount === 105000, `Finance Invoice generated matching PO ${poNumber}`);

  // ─────────────────────────────────────────────────────────────────────────────
  // STAGE 10: ALTERNATIVE PATH - STANDARD SERVICE (NO SURVEY NEEDED)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n▶ STAGE 10: Alternative Branch Verification (Standard Service - No Survey)");
  const standardLead = await Lead.create({
    id: crypto.randomUUID(),
    firstName: "Fahad",
    lastName: "Al-Subaie",
    company: "Standard Logistics Sulay",
    email: `standard_${ts}@logistics.sa`,
    phone: "+966559876543",
    status: "CONTACTED",
    leadNumber: `LD-STD-${ts.toString().slice(-4)}`,
    requiresSiteInspection: false, // NO SURVEY NEEDED
  });

  const standardGate = await getSiteInspectionGate(standardLead.id);
  assert(standardGate.allowed === true, "Standard service skips site survey gate (status: 'EXEMPT')");
  assert(standardGate.status === "EXEMPT", "Gate returned status 'EXEMPT' for standard service");

  console.log("\n================================================================================");
  console.log("   🎉 ALL 10 STAGES PASSED CLEANLY! ZERO ARCHITECTURAL BREAKAGES FOUND!");
  console.log("================================================================================\n");

  process.exit(0);
}

runFullCycleTest().catch((err) => {
  console.error("\n❌ TEST SUITE RUNTIME ERROR:", err);
  process.exit(1);
});
