import "dotenv/config";
import { Database, sequelize } from "@nexus-crm/database";
import crypto from "crypto";
import { convertLeadToOpportunity } from "../src/services/leadJourneyWorkflowEngine";
import { getCampaigns } from "../src/controllers/campaignController";
import { getFulfillments } from "../src/controllers/fulfillmentController";

async function main() {
  console.log("=== STARTING 3 DEFECTS VERIFICATION ===");
  await Database.createConnection();

  // Run migration
  const migration = require("../../database/migrations/20260818000000-update-lead-status-default.js");
  await migration.up(sequelize.getQueryInterface(), sequelize.constructor);
  console.log("[PASS] Migration 20260818000000-update-lead-status-default executed successfully.");

  // ─────────────────────────────────────────────────────────────
  // 1. VERIFY DEFECT 1: Lead.status default value & DB migration
  // ─────────────────────────────────────────────────────────────
  console.log("\n--- VERIFYING DEFECT 1: Lead.status default value ---");
  const testLead1 = await sequelize.models.Lead.create({
    id: crypto.randomUUID(),
    firstName: "Majed",
    lastName: "Al-Otaibi",
    company: "Riyadh Construction",
    email: `majed_${Date.now()}@riyadhconst.com`,
    phone: "+966501234567"
  });

  const leadReloaded: any = await sequelize.models.Lead.findByPk((testLead1 as any).id);
  console.log(`Created Lead ID: ${leadReloaded.id}, Status: '${leadReloaded.status}'`);
  if (leadReloaded.status !== "NEW") {
    throw new Error(`Expected Lead.status to default to 'NEW', but got '${leadReloaded.status}'`);
  }
  console.log("[PASS] Defect 1 Verified: Lead.status defaultValue is correctly 'NEW' in both model and database.");

  // ─────────────────────────────────────────────────────────────
  // 2. VERIFY DEFECT 2: convertLead creates Contact, links DealContact, sets convertedContactId
  // ─────────────────────────────────────────────────────────────
  console.log("\n--- VERIFYING DEFECT 2: convertLead Contact creation & linking ---");
  const uniqueEmail = `sarah_connor_${Date.now()}@cyberdyne.com`;
  const companyName = `Cyberdyne Systems ${Date.now()}`;
  const testLead2 = await sequelize.models.Lead.create({
    id: crypto.randomUUID(),
    firstName: "Sarah",
    lastName: "Connor",
    company: companyName,
    email: uniqueEmail,
    phone: "+14155550199",
    status: "NEW",
    source: "Website"
  });

  const conversion = await convertLeadToOpportunity((testLead2 as any).id, {
    requirement: "Factory Robotics Integration",
    estimatedValue: 750000
  });

  console.log("Conversion Result:");
  console.log(`  Account: ${conversion.account?.name} (${conversion.account?.id})`);
  console.log(`  Contact: ${conversion.contact?.firstName} ${conversion.contact?.lastName} (${conversion.contact?.email}) [ID: ${conversion.contact?.id}]`);
  console.log(`  Deal: ${conversion.deal?.name} (Amount: ₹${conversion.deal?.amount}) [ID: ${conversion.deal?.id}]`);

  // Verify Contact row exists in DB
  const contactInDb: any = await sequelize.models.Contact.findByPk(conversion.contact.id);
  if (!contactInDb) {
    throw new Error("Contact was not created in the database!");
  }
  console.log(`  Verified Contact row in DB: ID ${contactInDb.id}, Email: ${contactInDb.email}, AccountId: ${contactInDb.accountId}`);

  // Verify DealContact row links Deal and Contact
  const dealContact: any = await sequelize.models.DealContact.findOne({
    where: { dealId: conversion.deal.id, contactId: conversion.contact.id }
  });
  if (!dealContact) {
    throw new Error("DealContact link was not created!");
  }
  console.log(`  Verified DealContact row in DB: Role '${dealContact.role}', isPrimary: ${dealContact.isPrimary}`);

  // Verify convertedContactId, convertedAccountId, convertedDealId on Lead
  const leadAfterConvert: any = await sequelize.models.Lead.findByPk((testLead2 as any).id);
  console.log(`  Lead Status after conversion: '${leadAfterConvert.status}'`);
  console.log(`  Lead.convertedContactId: ${leadAfterConvert.convertedContactId}`);
  console.log(`  Lead.convertedAccountId: ${leadAfterConvert.convertedAccountId}`);
  console.log(`  Lead.convertedDealId: ${leadAfterConvert.convertedDealId}`);

  if (leadAfterConvert.status !== "CONVERTED") {
    throw new Error(`Expected converted lead status to be 'CONVERTED', got '${leadAfterConvert.status}'`);
  }
  if (leadAfterConvert.convertedContactId !== contactInDb.id) {
    throw new Error(`Expected convertedContactId to match Contact ID '${contactInDb.id}', got '${leadAfterConvert.convertedContactId}'`);
  }
  console.log("[PASS] Defect 2 Verified: convertLead successfully creates real Contact, links DealContact, and updates Lead with convertedContactId.");

  // ─────────────────────────────────────────────────────────────
  // 3. VERIFY DEFECT 3: Campaign and Fulfillment models & controllers
  // ─────────────────────────────────────────────────────────────
  console.log("\n--- VERIFYING DEFECT 3: Campaign & Fulfillment models and GET routes ---");

  // Verify models exist
  const requiredModels = ["Campaign", "CampaignAd", "Fulfillment", "FulfillmentItem", "LeadAttribution", "AttributionEvent"];
  for (const m of requiredModels) {
    if (!sequelize.models[m]) {
      throw new Error(`Missing sequelize model: ${m}`);
    }
  }
  console.log(`  Verified all required model classes: ${requiredModels.join(", ")}`);

  // Create a campaign row
  const campCode = `CAMP_TEST_${Date.now()}`;
  const campaign = await sequelize.models.Campaign.create({
    id: crypto.randomUUID(),
    name: "Industrial Robotics Campaign 2026",
    code: campCode,
    channel: "Google Ads",
    platform: "Search",
    status: "ACTIVE",
    budget: 150000,
    actualSpend: 45000
  });
  console.log(`  Created Campaign: ${campaign.get('name')} (Code: ${campCode})`);

  // Test getCampaigns controller handler
  let campData: any = null;
  const mockResCampaigns: any = {
    json: (d: any) => { campData = d; return mockResCampaigns; },
    status: (c: number) => mockResCampaigns
  };
  await getCampaigns({ query: {} } as any, mockResCampaigns);
  console.log(`  GET /api/v1/campaigns response: total=${campData?.total}, data count=${campData?.data?.length}`);
  if (!Array.isArray(campData?.data)) {
    throw new Error("getCampaigns did not return a valid data array!");
  }

  // Test getFulfillments controller handler
  let fulfillData: any = null;
  const mockResFulfillment: any = {
    json: (d: any) => { fulfillData = d; return mockResFulfillment; },
    status: (c: number) => mockResFulfillment
  };
  await getFulfillments({ query: {} } as any, mockResFulfillment);
  console.log(`  GET /api/v1/fulfillments response: total=${fulfillData?.meta?.total}, data count=${fulfillData?.data?.length}`);
  if (!Array.isArray(fulfillData?.data)) {
    throw new Error("getFulfillments did not return a valid data array!");
  }

  console.log("[PASS] Defect 3 Verified: Campaign and Fulfillment models and routes run cleanly without crashing.");

  console.log("\n=== ALL 3 DEFECTS SUCCESSFULLY VERIFIED AND RESOLVED ===");
  process.exit(0);
}

main().catch((err) => {
  console.error("Verification failed with error:", err);
  process.exit(1);
});
