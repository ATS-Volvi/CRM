import "dotenv/config";
import { sequelize } from "@nexus-crm/database";
import { sendForSignature, handleConnectWebhook } from "./src/controllers/docusignController";
import { Request, Response } from "express";

async function testDocuSign() {
  await sequelize.sync();
  
  const leadId = require('crypto').randomUUID();
  const dealId = require('crypto').randomUUID();
  const quoteId = require('crypto').randomUUID();

  // Create Lead
  await sequelize.models.Lead.create({
    id: leadId,
    firstName: "DocuSign",
    lastName: "User",
    email: "docusign@example.com",
    company: "Test Corp",
    status: "New Lead",
    source: "email"
  });

  // Create Deal
  await sequelize.models.Deal.create({
    id: dealId,
    name: "DocuSign Test Deal",
    amount: 5000,
    stageId: null,
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

  console.log(`Created Quote ${quoteId} in Draft status`);

  console.log("\n--- SIMULATING OUTBOUND SEND TO DOCUSIGN ---");
  const sendReq = {
    params: { quoteId }
  } as unknown as Request;
  
  const sendRes = {
    json: function(data: any) {
      console.log(`sendForSignature responded with:`, data);
      return this;
    },
    status: function(s: number) {
      console.log(`sendForSignature status: ${s}`);
      return this;
    }
  } as unknown as Response;

  await sendForSignature(sendReq, sendRes);

  console.log("\n--- VERIFYING QUOTE STATUS (SHOULD STILL BE DRAFT IF FAILED, OR SENT IF WE MOCKED CREDS) ---");
  let updatedQuote = await sequelize.models.Quote.findByPk(quoteId) as any;
  console.log(`Quote status is: ${updatedQuote.status}`);

  console.log("\n--- MANUALLY SETTING DOCUSIGN ENVELOPE ID FOR WEBHOOK TEST ---");
  updatedQuote.docusignEnvelopeId = "mock-env-12345";
  updatedQuote.status = "Sent";
  await updatedQuote.save();
  console.log(`Quote Envelope ID: ${updatedQuote.docusignEnvelopeId}, Status: ${updatedQuote.status}`);

  console.log("\n--- SIMULATING INCOMING DOCUSIGN CONNECT WEBHOOK (COMPLETED) ---");
  const hookReq = {
    body: {
      event: "envelope-completed",
      data: {
        envelopeId: "mock-env-12345",
        envelopeSummary: {
          status: "completed"
        }
      }
    }
  } as unknown as Request;

  const hookRes = {
    sendStatus: function(s: number) {
      console.log(`handleConnectWebhook responded with status ${s}`);
      return this;
    }
  } as unknown as Response;

  await handleConnectWebhook(hookReq, hookRes);

  console.log("\n--- VERIFYING QUOTE WAS UPDATED TO ACCEPTED ---");
  const finalQuote = await sequelize.models.Quote.findByPk(quoteId) as any;
  console.log(`Final Quote status is: ${finalQuote.status}`);

  console.log("\n--- VERIFYING ACTIVITY WAS CREATED ---");
  const activities = await sequelize.models.Activity.findAll({
    where: { leadId: leadId }
  });
  
  activities.forEach(a => {
    const act = a as any;
    console.log(`Activity [${act.type}]: ${act.notes} (Outcome: ${act.outcome})`);
  });
}

testDocuSign().then(() => setTimeout(() => process.exit(0), 3000));
