import "dotenv/config";
import { sequelize } from "@nexus-crm/database";
import { handleIncomingWebhook, sendMessage } from "./src/controllers/whatsappController";
import { Request, Response } from "express";

async function testWhatsApp() {
  await sequelize.sync();
  
  const leadId = require('crypto').randomUUID();

  // Create Lead
  await sequelize.models.Lead.create({
    id: leadId,
    firstName: "WhatsApp",
    lastName: "User",
    email: "whatsapp@example.com",
    company: "Test Corp",
    status: "New Lead",
    source: "whatsapp",
    phone: "15559998888" // the phone number to match
  });

  console.log(`Created Lead ${leadId} with phone 15559998888`);

  console.log("\n--- SIMULATING INCOMING WEBHOOK ---");
  const req = {
    body: {
      object: "whatsapp_business_account",
      entry: [{
        changes: [{
          value: {
            metadata: { phone_number_id: "12345" },
            messages: [{
              from: "15559998888",
              text: { body: "Hello, I am interested in your services." }
            }]
          }
        }]
      }]
    }
  } as unknown as Request;

  const res = {
    sendStatus: function(s: number) {
      console.log(`Webhook responded with status ${s}`);
      return this;
    }
  } as unknown as Response;

  await handleIncomingWebhook(req, res);

  console.log("\n--- VERIFYING ACTIVITY WAS CREATED ---");
  const activities = await sequelize.models.Activity.findAll({
    where: { leadId: leadId }
  });
  
  activities.forEach((a: any) => {
    const act = a as any;
    console.log(`Activity [${act.type}]: ${act.notes} (Outcome: ${act.outcome})`);
  });

  console.log("\n--- SIMULATING INCOMING WEBHOOK FROM UNKNOWN NUMBER ---");
  const reqUnknown = {
    body: {
      object: "whatsapp_business_account",
      entry: [{
        changes: [{
          value: {
            metadata: { phone_number_id: "12345" },
            messages: [{
              from: "15550001111",
              text: { body: "Is this the CRM system?" }
            }]
          }
        }]
      }]
    }
  } as unknown as Request;

  await handleIncomingWebhook(reqUnknown, res);
  
  console.log("\n--- VERIFYING NEW LEAD WAS CREATED ---");
  const newLead = await sequelize.models.Lead.findOne({
    where: { phone: "15550001111" },
    include: [{ model: sequelize.models.Activity, as: "activities" }]
  });
  
  if (newLead) {
    const nl = newLead as any;
    console.log(`Found auto-created lead: ${nl.firstName} ${nl.lastName} (${nl.phone})`);
    nl.activities.forEach((a: any) => {
      console.log(`  Activity [${a.type}]: ${a.notes} (Outcome: ${a.outcome})`);
    });
  }

  const leadIdFormatted = require('crypto').randomUUID();

  // Create Lead with formatted phone number
  await sequelize.models.Lead.create({
    id: leadIdFormatted,
    firstName: "Formatted",
    lastName: "PhoneUser",
    email: "formatted@example.com",
    company: "Formatted Inc",
    status: "New Lead",
    source: "whatsapp",
    phone: "+1 (555) 777-6666" // Formatted phone number
  });

  console.log(`Created Formatted Lead ${leadIdFormatted} with phone +1 (555) 777-6666`);

  console.log("\n--- SIMULATING INCOMING WEBHOOK FROM FORMATTED PHONE NUMBER ---");
  const reqFormatted = {
    body: {
      object: "whatsapp_business_account",
      entry: [{
        changes: [{
          value: {
            metadata: { phone_number_id: "12345" },
            messages: [{
              from: "15557776666",
              text: { body: "Replying from mobile phone!" }
            }]
          }
        }]
      }]
    }
  } as unknown as Request;

  await handleIncomingWebhook(reqFormatted, res);

  console.log("\n--- VERIFYING FORMATTED LEAD ACTIVITY WAS CREATED ---");
  const formattedActivities = await sequelize.models.Activity.findAll({
    where: { leadId: leadIdFormatted }
  });
  
  formattedActivities.forEach((a: any) => {
    const act = a as any;
    console.log(`Formatted Activity [${act.type}]: ${act.notes} (Outcome: ${act.outcome})`);
  });

  console.log("\n--- SIMULATING OUTBOUND SEND MESSAGE (EXPECTING FAILURE DUE TO NO CREDS) ---");
  
  const sendReq = {
    body: {
      leadId: leadIdFormatted,
      text: "Sure, let's schedule a meeting!"
    }
  } as unknown as Request;
  
  const sendRes = {
    json: function(data: any) {
      console.log(`SendMessage responded with:`, data);
      return this;
    },
    status: function(s: number) {
      console.log(`SendMessage status: ${s}`);
      return this;
    }
  } as unknown as Response;
  
  await sendMessage(sendReq, sendRes);

}

testWhatsApp().then(() => setTimeout(() => process.exit(0), 3000));
