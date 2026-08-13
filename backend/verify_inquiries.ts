import { ingestLead } from './src/services/leadIngestion';
import { Sequelize } from 'sequelize';
const db = require('../database/models/index');

async function run() {
  const ts = Date.now();
  
  // 1. Primary Website Lead
  console.log(`[TEST] Creating primary lead via Website...`);
  const leadId = await ingestLead({
    firstName: "Original",
    lastName: "User",
    email: `orig_${ts}@volvitech.com`,
    company: "Volvitech",
    source: "Website",
    message: "We want to purchase the CRM software."
  });
  console.log(`Primary Lead ID: ${leadId}`);

  // 2. Secondary Instagram Contact
  console.log(`[TEST] Creating secondary contact via Instagram...`);
  await ingestLead({
    firstName: "Second",
    lastName: "User",
    email: `sec_${ts}@volvitech.com`,
    company: "Volvitech",
    source: "Instagram",
    message: "Saw your post, can we get a demo?"
  });

  // 3. Tertiary WhatsApp Contact
  console.log(`[TEST] Creating tertiary contact via WhatsApp...`);
  await ingestLead({
    firstName: "Third",
    lastName: "User",
    email: `third_${ts}@volvitech.com`,
    company: "Volvitech",
    source: "WhatsApp",
    message: "Is there a discount for annual billing?"
  });

  console.log(`\n--- VERIFICATION RESULTS ---`);
  
  const lead = await db.Lead.findByPk(leadId, {
    include: [{ model: db.LeadContact, as: 'contacts' }]
  });

  console.log(`\nLEAD DETAILS:`);
  console.log(`Lead ID: ${lead.id}`);
  console.log(`Company: ${lead.company}`);
  console.log(`Primary Source: ${lead.source}`);
  console.log(`Total Secondary Contacts: ${lead.contacts.length}`);
  
  console.log(`\nCONTACTS LIST:`);
  console.log(`1. [Primary] ${lead.firstName} ${lead.lastName} (Source: ${lead.source}) - Message: ${lead.rawPayload ? JSON.parse(lead.rawPayload).message : 'null'}`);
  
  lead.contacts.forEach((c: any, index: number) => {
    console.log(`${index + 2}. [Secondary] ${c.firstName} ${c.lastName} (SourceChannel: ${c.sourceChannel}) - Message: ${c.message}`);
  });

  process.exit(0);
}

run().catch(console.error);
