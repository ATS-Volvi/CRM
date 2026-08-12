import { ingestLead } from './src/services/leadIngestion';
import { Sequelize } from 'sequelize';
const db = require('../database/models/index');

async function run() {
  const ts = Date.now();
  console.log(`[TEST] Creating primary lead via Website...`);
  const leadId = await ingestLead({
    firstName: "TestPrimary",
    lastName: "Corp",
    email: `corp_${ts}@example.com`,
    company: "Test Corp",
    source: "Website",
  });
  console.log(`Primary Lead ID: ${leadId}`);

  console.log(`[TEST] Creating secondary contact via Instagram...`);
  const duplicateId = await ingestLead({
    firstName: "Second",
    lastName: "Guy",
    email: `second_${ts}@example.com`,
    company: "Test Corp",
    source: "Instagram",
    message: "Hey we need more info!"
  });

  const lead = await db.Lead.findByPk(leadId);
  console.log(`Lead Source in DB: ${lead.source}`);

  const contacts = await db.LeadContact.findAll({ where: { leadId } });
  contacts.forEach((c: any) => {
    console.log(`- Contact: ${c.firstName} | SourceChannel: ${c.sourceChannel}`);
  });

  process.exit(0);
}
run().catch(console.error);
