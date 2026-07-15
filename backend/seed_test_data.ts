import "dotenv/config";
import { sequelize } from "@nexus-crm/database";
import { processQuoteFollowUps } from "./src/services/emailService";
import { updateQuote } from "./src/controllers/quoteController";
import { Request, Response } from "express";

async function testQuoteFollowUp() {
  await sequelize.sync();
  
  const leadId = require('crypto').randomUUID();
  const dealId = require('crypto').randomUUID();
  const quoteId = require('crypto').randomUUID();

  // Find or create a User
  let user = await sequelize.models.User.findOne();
  if (!user) {
    user = await sequelize.models.User.create({
      id: require('crypto').randomUUID(),
      name: "Test User",
      email: "testuser@example.com",
      password: "password",
      role: "sales_rep"
    });
  }

  // Find or create a PipelineStage
  let stage = await sequelize.models.PipelineStage.findOne();
  if (!stage) {
    stage = await sequelize.models.PipelineStage.create({
      id: require('crypto').randomUUID(),
      name: "New",
      order: 1,
      probability: 10
    });
  }

  // Create Lead
  await sequelize.models.Lead.create({
    id: leadId,
    firstName: "QuoteFollowup",
    lastName: "User",
    email: "quote@example.com",
    company: "Test Corp",
    status: "New Lead",
    source: "email"
  });

  // Create Deal
  await sequelize.models.Deal.create({
    id: dealId,
    name: "Quote Followup Deal",
    amount: 5000,
    stageId: (stage as any).id,
    ownerId: (user as any).id,
    leadId: leadId
  });

  // Create Quote
  await sequelize.models.Quote.create({
    id: quoteId,
    dealId: dealId,
    status: "Draft",
    totalAmount: 12500,
    statusChangedAt: new Date()
  });

  console.log(`Created Quote ${quoteId}`);

  // Mock Request to update quote to "Sent"
  const req = {
    params: { id: quoteId },
    body: { status: "Sent" }
  } as unknown as Request;

  const res = {
    json: function(data: any) {
      console.log(`Quote updated successfully.`);
    },
    status: function(s: number) {
      return this;
    }
  } as unknown as Response;

  console.log("Calling updateQuote to set status = Sent...");
  await updateQuote(req, res);

  // Manipulate time to simulate 6 days passing (QUOTE_FOLLOWUP_DAYS defaults to 5)
  const q = await sequelize.models.Quote.findByPk(quoteId) as any;
  const backdated = new Date();
  backdated.setDate(backdated.getDate() - 6);
  q.statusChangedAt = backdated;
  await q.save();
  
  console.log(`Backdated Quote statusChangedAt to: ${q.statusChangedAt}`);
  
  // RUN 1
  console.log("\n--- RUNNING CRON JOB (FIRST TIME) ---");
  await processQuoteFollowUps();
  
  // RUN 2
  console.log("\n--- RUNNING CRON JOB (SECOND TIME) ---");
  await processQuoteFollowUps();
  
}

testQuoteFollowUp().then(() => setTimeout(() => process.exit(0), 3000));
