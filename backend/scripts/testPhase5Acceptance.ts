import { sequelize } from "@nexus-crm/database";
import { Op } from "sequelize";
import crypto from "crypto";
import {
  recordLeadTouch,
  carryOverAttributionToOpportunity,
  getCampaignPerformance,
  getSourcePerformance
} from "../src/services/attributionService";
import { ingestLead } from "../src/services/leadIngestion";
import { convertLeadToOpportunity } from "../src/services/leadJourneyWorkflowEngine";
import { createOrderFromFinalQuote } from "../src/services/supplyFulfillmentService";

let totalPassed = 0;
let totalFailed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    totalPassed++;
    console.log(`  ✅ [PASS ${totalPassed}] ${message}`);
  } else {
    totalFailed++;
    console.error(`  ❌ [FAIL ${totalPassed + totalFailed}] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runPhase5AcceptanceTest() {
  console.log("\n=======================================================");
  console.log("🚀 STARTING PHASE 5 CAMPAIGN, LEAD SOURCE & ATTRIBUTION TEST");
  console.log("=======================================================\n");

  try {
    // -------------------------------------------------------------------
    // 1. SETUP USERS & ACCOUNTS
    // -------------------------------------------------------------------
    console.log("--- 1. Setting up Users and Base Accounts ---");
    let salesRep1 = await sequelize.models.User.findOne({ where: { role: "sales_rep" } });
    if (!salesRep1) {
      salesRep1 = await sequelize.models.User.create({
        id: crypto.randomUUID(),
        name: "Rahul Verma",
        email: `rahul.verma.${Date.now()}@nexuscrm.com`,
        password: "hashedpassword123",
        role: "sales_rep"
      });
    }

    let salesRep2 = await sequelize.models.User.findOne({
      where: { role: "sales_rep", id: { [Op.ne]: (salesRep1 as any).id } }
    });
    if (!salesRep2) {
      salesRep2 = await sequelize.models.User.create({
        id: crypto.randomUUID(),
        name: "Sarah Jenkins",
        email: `sarah.jenkins.${Date.now()}@nexuscrm.com`,
        password: "hashedpassword123",
        role: "sales_rep"
      });
    }

    const existingAccount = await sequelize.models.Account.create({
      id: crypto.randomUUID(),
      name: `Gulf Manufacturing Co. ${Date.now()}`,
      industry: "Manufacturing",
      email: `contact@gulfmanuf-${Date.now()}.com`
    });

    assert(Boolean(salesRep1 && salesRep2 && existingAccount), "Test users and existing customer Account created");

    // -------------------------------------------------------------------
    // 2. CAMPAIGN CREATION & DUPLICATE PROTECTION
    // -------------------------------------------------------------------
    console.log("\n--- 2. Testing Campaign Creation & Validation ---");
    const campaignCode = `ind_auto_${Date.now()}`;
    const campaign = await sequelize.models.Campaign.create({
      id: crypto.randomUUID(),
      name: "Industrial Automation Aug 2026",
      code: campaignCode,
      description: "Q3 Multi-channel Paid Social & Search Campaign",
      channel: "Meta Ads",
      platform: "Instagram & Facebook",
      status: "ACTIVE",
      startDate: new Date("2026-08-01"),
      endDate: new Date("2026-08-31"),
      budget: 100000,
      actualSpend: 45000,
      currency: "INR",
      targetAudience: "Plant Managers & Automation Engineers"
    });

    assert(Boolean(campaign), "Campaign created with code, budget, and spend");

    // Test Duplicate Campaign Code Protection
    let duplicateCampaignBlocked = false;
    try {
      await sequelize.models.Campaign.create({
        id: crypto.randomUUID(),
        name: "Duplicate Campaign Code",
        code: campaignCode,
        channel: "Google Ads"
      });
    } catch {
      duplicateCampaignBlocked = true;
    }
    assert(duplicateCampaignBlocked, "Duplicate campaign code blocked by unique constraint");

    // -------------------------------------------------------------------
    // 3. CAMPAIGN AD CREATION & DUPLICATE PROTECTION
    // -------------------------------------------------------------------
    console.log("\n--- 3. Testing Campaign Ad / Creative Management ---");
    const adExternalId = `ad_plc_${Date.now()}`;
    const ad = await sequelize.models.CampaignAd.create({
      id: crypto.randomUUID(),
      campaignId: (campaign as any).id,
      name: "PLC Panel Search & Carousel Ad",
      externalId: adExternalId,
      platform: "Instagram",
      creativeType: "Image Carousel",
      status: "ACTIVE"
    });

    assert(Boolean(ad), "Campaign Ad created and linked to parent Campaign");

    // -------------------------------------------------------------------
    // 4. WEBSITE INGESTION FROM INSTAGRAM AD (UTM & NORMALIZATION)
    // -------------------------------------------------------------------
    console.log("\n--- 4. Testing Website Attribution & Instagram Ad Ingestion ---");
    const lead1Id = await ingestLead({
      firstName: "Tariq",
      lastName: "Al-Mansoor",
      email: `tariq.${Date.now()}@emiratesautomation.com`,
      phone: "+971501234567",
      company: "Emirates Automation Solutions",
      source: "Website",
      sourceChannel: "Website",
      utmSource: "instagram",
      utmMedium: "paid_social",
      utmCampaign: campaignCode,
      utmContent: adExternalId,
      landingPage: "https://nexuscrm.com/industrial-automation",
      referrer: "https://l.instagram.com/",
      clickId: "ig_clk_998877",
      message: "Looking for 3 units of custom PLC control panels for plant modernization."
    });

    const lead1: any = await sequelize.models.Lead.findByPk(lead1Id);
    assert(Boolean(lead1), "Website lead ingested successfully with Instagram UTM parameters");
    assert(lead1.sourceChannel === "Website", "Technical Channel accurately recorded as Website");
    assert(lead1.sourceType === "Advertisement", "Source Type accurately normalized to Advertisement");
    assert(lead1.campaignId === (campaign as any).id, "Lead correctly resolved and linked to Campaign via utm_campaign code");
    assert(lead1.adId === (ad as any).id, "Lead correctly resolved and linked to Ad via utm_content externalId");

    const lead1Attributions = await sequelize.models.LeadAttribution.findAll({
      where: { leadId: lead1Id }
    });
    assert(lead1Attributions.length === 1, "LeadAttribution record created with touchType FIRST_TOUCH");
    assert((lead1Attributions[0] as any).utmSource === "instagram", "UTM Source persisted in attribution record");
    assert((lead1Attributions[0] as any).clickId === "ig_clk_998877", "Click ID persisted in attribution record");

    // -------------------------------------------------------------------
    // 5. LEAD QUALIFICATION & CONVERSION CARRYOVER TO OPPORTUNITY
    // -------------------------------------------------------------------
    console.log("\n--- 5. Testing Attribution Persistence across Sales Conversion ---");
    // Qualify and convert lead
    const qualResult = await convertLeadToOpportunity(
      lead1Id,
      {
        requirement: "Turnkey Industrial Automation Panels",
        estimatedValue: 420000,
        timeline: "Q3 2026",
        decisionMaker: "Tariq Al-Mansoor",
        notes: "High priority commercial prospect from Instagram Campaign"
      },
      (salesRep1 as any).id
    );

    assert(qualResult.lead.status === "CONVERTED", "Lead transitioned to CONVERTED");
    assert(Boolean(qualResult.deal), "Opportunity created from converted Lead");

    const deal: any = await sequelize.models.Deal.findByPk(qualResult.deal.id);
    assert(deal.campaignId === (campaign as any).id, "Opportunity inherited Campaign linkage from Lead");
    assert(deal.adId === (ad as any).id, "Opportunity inherited Ad linkage from Lead");
    assert(deal.sourceType === "Advertisement", "Opportunity inherited Source Type");
    assert(deal.sourceChannel === "Website", "Opportunity inherited Source Channel");
    assert(Boolean(deal.firstTouchAttribution), "Opportunity inherited First Touch Attribution JSON");

    // Verify Attribution Events Logged
    const events = await sequelize.models.AttributionEvent.findAll({
      where: { opportunityId: deal.id }
    });
    assert(events.length >= 1, "Attribution event timeline recorded Opportunity conversion linkage");

    // -------------------------------------------------------------------
    // 6. QUOTE -> ORDER CREATION & REVENUE TRACEABILITY
    // -------------------------------------------------------------------
    console.log("\n--- 6. Testing Marketing-to-Revenue Traceability ---");
    // Create product
    const product = await sequelize.models.PriceBookEntry.create({
      id: crypto.randomUUID(),
      sku: `SKU-PLC-${Date.now()}`,
      name: "PLC Industrial Panel",
      unitPrice: 140000,
      isAssetTracked: true
    });

    // Create final agreed quote for Opportunity
    const quote = await sequelize.models.Quote.create({
      id: crypto.randomUUID(),
      dealId: deal.id,
      quoteNumber: `Q-${Date.now()}`,
      version: 1,
      status: "Accepted",
      acceptedAt: new Date(),
      totalAmount: 420000
    });

    await sequelize.models.QuoteLineItem.create({
      id: crypto.randomUUID(),
      quoteId: (quote as any).id,
      productId: (product as any).id,
      quantity: 3,
      unitPrice: 140000,
      totalPrice: 420000
    });

    // Convert Final Quote into Order
    const orderResult = await createOrderFromFinalQuote((quote as any).id, (salesRep1 as any).id);
    assert(Boolean(orderResult.order), "Order created from Opportunity Quote");

    // Query Campaign Performance Report
    const perfReport: any = await getCampaignPerformance((campaign as any).id);
    assert(Boolean(perfReport), "Campaign performance report generated");
    assert(perfReport.metrics.totalLeads === 1, "Metrics: Total Leads = 1");
    assert(perfReport.metrics.qualifiedLeads === 1, "Metrics: Qualified Leads = 1");
    assert(perfReport.metrics.totalOpportunities === 1, "Metrics: Opportunities = 1");
    assert(perfReport.metrics.wonOrdersCount === 1, "Metrics: Won Orders = 1");
    assert(perfReport.metrics.totalRevenue === 420000, `Metrics: Won Revenue = ₹${perfReport.metrics.totalRevenue}`);
    assert(perfReport.metrics.costPerLead === 45000, `Metrics: Cost per Lead = ₹${perfReport.metrics.costPerLead}`);
    assert(perfReport.metrics.roas === 9.33, `Metrics: ROAS = ${perfReport.metrics.roas}x (₹420,000 / ₹45,000)`);
    assert(perfReport.metrics.roiPct === 833.33, `Metrics: ROI = ${perfReport.metrics.roiPct}%`);

    // -------------------------------------------------------------------
    // 7. MULTI-TOUCH ATTRIBUTION TEST (DIRECT VISIT NON-OVERWRITE)
    // -------------------------------------------------------------------
    console.log("\n--- 7. Testing Multi-Touch Attribution History ---");
    const multiLeadId = await ingestLead({
      firstName: "Vikram",
      lastName: "Malhotra",
      email: `vikram.${Date.now()}@apextech.com`,
      company: "Apex Tech Labs",
      source: "Google Ads",
      sourceType: "Advertisement",
      sourceName: "Google Ads",
      utmSource: "google",
      utmMedium: "cpc",
      utmCampaign: "search_industrial"
    });

    // Second Touch: User clicks an Instagram ad
    await recordLeadTouch({
      leadId: multiLeadId,
      channel: "Instagram",
      sourceType: "Advertisement",
      sourceName: "Instagram Sponsored Post",
      utmSource: "instagram",
      utmMedium: "paid_social",
      utmCampaign: "retargeting_q3"
    });

    // Third Touch: User visits direct website without UTMs
    await recordLeadTouch({
      leadId: multiLeadId,
      channel: "Website",
      sourceType: "Other",
      sourceName: "Direct Navigation",
      landingPage: "https://nexuscrm.com"
    });

    const multiLead: any = await sequelize.models.Lead.findByPk(multiLeadId);
    const firstTouch = JSON.parse(multiLead.firstTouchAttribution);
    const lastTouch = JSON.parse(multiLead.lastTouchAttribution);

    assert(firstTouch.utmSource === "google", "First Touch preserved as Google Ads");
    assert(lastTouch.utmSource === "instagram", "Last Marketing Touch preserved as Instagram (Direct visit did not overwrite marketing source)");

    const multiTouches = await sequelize.models.LeadAttribution.findAll({
      where: { leadId: multiLeadId },
      order: [["createdAt", "ASC"]]
    });
    assert(multiTouches.length === 3, "Complete 3-touch multi-touch history captured in LeadAttributions");

    // -------------------------------------------------------------------
    // 8. CUSTOMER REFERRAL TEST
    // -------------------------------------------------------------------
    console.log("\n--- 8. Testing Customer Referrals ---");
    const refLeadId = await ingestLead({
      firstName: "Sameer",
      lastName: "Khan",
      email: `sameer.${Date.now()}@emiratesfabrication.com`,
      company: "Emirates Steel Fabrication",
      source: "Referral",
      sourceType: "Company Referral",
      referringAccountId: (existingAccount as any).id,
      assignedToId: (salesRep2 as any).id
    });

    const refLead: any = await sequelize.models.Lead.findByPk(refLeadId, {
      include: [{ model: sequelize.models.Account, as: "referringAccount" }]
    });

    assert(refLead.sourceType === "Company Referral", "Source Type recorded as Company Referral");
    assert(refLead.referringAccountId === (existingAccount as any).id, "Referring Account ID explicitly linked");
    assert(refLead.referringAccount?.name === (existingAccount as any).name, "Account 360 can query referred leads");
    assert(refLead.assignedToId === (salesRep2 as any).id, "Lead assignment is independent of referral source");

    // -------------------------------------------------------------------
    // 9. MIDDLEMAN / AGENT TEST
    // -------------------------------------------------------------------
    console.log("\n--- 9. Testing Middleman / Agent Tracking ---");
    const agentLeadId = await ingestLead({
      firstName: "Farhan",
      lastName: "Qureshi",
      email: `farhan.${Date.now()}@dubaipower.com`,
      company: "Dubai Power Solutions",
      source: "Partner",
      sourceType: "Middleman / Agent",
      sourceName: "ABC Industrial Consultants",
      assignedToId: (salesRep1 as any).id
    });

    const agentLead: any = await sequelize.models.Lead.findByPk(agentLeadId);
    assert(agentLead.sourceType === "Middleman / Agent", "Source Type recorded as Middleman / Agent");
    assert(agentLead.sourceName === "ABC Industrial Consultants", "Middleman source entity captured as queryable field");

    // -------------------------------------------------------------------
    // 10. SALES REP REFERRAL TEST (SEPARATE FROM LEAD OWNER)
    // -------------------------------------------------------------------
    console.log("\n--- 10. Testing Sales Rep Referral vs Ownership Separation ---");
    const repRefLeadId = await ingestLead({
      firstName: "Zain",
      lastName: "Abbas",
      email: `zain.${Date.now()}@gulflogistics.com`,
      company: "Gulf Logistics Hub",
      source: "Referral",
      sourceType: "Sales Rep",
      sourceName: "Rahul Verma Referral",
      sourceEntityId: (salesRep1 as any).id, // Referred by Rahul
      assignedToId: (salesRep2 as any).id   // Owned by Sarah
    });

    const repRefLead: any = await sequelize.models.Lead.findByPk(repRefLeadId);
    assert(repRefLead.sourceType === "Sales Rep", "Source Type recorded as Sales Rep referral");
    const repRefFirstTouch = JSON.parse(repRefLead.firstTouchAttribution);
    assert(repRefFirstTouch.sourceEntityId === (salesRep1 as any).id, "Referred by Rahul Verma (salesRep1)");
    assert(repRefLead.assignedToId === (salesRep2 as any).id, "Owned by Sarah Jenkins (salesRep2) — Separation of Source vs Owner verified");

    // -------------------------------------------------------------------
    // 11. OVERALL LEAD SOURCE TAXONOMY & ANALYTICS AGGREGATOR
    // -------------------------------------------------------------------
    console.log("\n--- 11. Testing Source Taxonomy & Analytics Aggregator ---");
    const sourceAnalytics = await getSourcePerformance();
    assert(Array.isArray(sourceAnalytics.byChannel) && sourceAnalytics.byChannel.length > 0, "Aggregated performance by Channel");
    assert(Array.isArray(sourceAnalytics.bySourceType) && sourceAnalytics.bySourceType.length > 0, "Aggregated performance by Source Type");

    console.log("\n=======================================================");
    console.log(`🎉 ALL ${totalPassed}/${totalPassed} PHASE 5 ACCEPTANCE TESTS PASSED SUCCESSFULLY!`);
    console.log("=======================================================\n");
  } catch (error: any) {
    console.error("\n❌ PHASE 5 ACCEPTANCE TEST FAILED:", error);
    process.exit(1);
  }
}

runPhase5AcceptanceTest()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Fatal test runner error:", err);
    process.exit(1);
  });
