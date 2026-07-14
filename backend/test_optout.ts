import "dotenv/config";
import { sequelize } from "@nexus-crm/database";
import { triggerTemplatedEmail } from "./src/services/emailService";
import { handleUnsubscribe } from "./src/controllers/leadController";
import { Request, Response } from "express";

async function testOptOut() {
  await sequelize.sync();
  
  const leadId = require('crypto').randomUUID();

  // Create a fresh Lead
  await sequelize.models.Lead.create({
    id: leadId,
    firstName: "OptOut",
    lastName: "Tester",
    email: "optout@example.com",
    company: "Test Co"
  });

  // Ensure template exists
  await sequelize.models.MessageTemplate.findOrCreate({
    where: { name: 'lead_acknowledgement' },
    defaults: {
      id: require('crypto').randomUUID(),
      name: 'lead_acknowledgement',
      channel: 'email',
      subject: 'Welcome',
      body: 'Hi {{lead_name}}!'
    }
  });

  console.log(`\n--- SENDING EMAIL TO NEW LEAD ---`);
  // This should succeed and render the Unsubscribe link at the bottom
  await triggerTemplatedEmail("lead_acknowledgement", "optout@example.com", {
    lead_name: "OptOut Tester"
  }, leadId);

  console.log(`\n--- SIMULATING USER CLICKING UNSUBSCRIBE ---`);
  const req = { params: { id: leadId } } as unknown as Request;
  const res = {
    send: (html: string) => console.log(`Unsubscribe Response:\n`, html.substring(0, 150) + "..."),
    status: function() { return this; }
  } as unknown as Response;
  await handleUnsubscribe(req, res);

  console.log(`\n--- VERIFYING LEAD STATE ---`);
  const updatedLead: any = await sequelize.models.Lead.findByPk(leadId);
  console.log(`optedOutEmail:`, updatedLead.optedOutEmail);

  console.log(`\n--- VERIFYING ACTIVITY LOG ---`);
  const activities = await sequelize.models.Activity.findAll({ where: { leadId } });
  console.log(`Activity Count:`, activities.length);
  if (activities.length > 0) {
    console.log(`Activity Notes:`, (activities[0] as any).notes);
  }

  console.log(`\n--- SENDING SECOND EMAIL (SHOULD BE BLOCKED) ---`);
  await triggerTemplatedEmail("lead_acknowledgement", "optout@example.com", {
    lead_name: "OptOut Tester"
  }, leadId);

  console.log(`\nTest Finished.`);
}

testOptOut().then(() => setTimeout(() => process.exit(0), 3000));
