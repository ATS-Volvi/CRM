import { ingestLead } from './src/services/leadIngestion';
import { Sequelize } from 'sequelize';
const db = require('../database/models/index');

async function run() {
  const ts = Date.now();
  const leadId = await ingestLead({
    firstName: "Test",
    lastName: "Company",
    email: `test_${ts}@company.com`,
    company: "Test Company",
    source: "Website",
  });

  const duplicateId = await ingestLead({
    firstName: "Jane",
    lastName: "Doe",
    email: `jane_${ts}@company.com`,
    company: "Test Company",
    source: "Website",
    message: "Need pricing for 4 portable cabins by next month. This is a very long message that should exceed one hundred characters so that we can verify the truncation logic works perfectly on the frontend UI without breaking."
  });

  const contacts = await db.LeadContact.findAll({ where: { leadId } });
  contacts.forEach((c: any) => {
    console.log(`- ${c.firstName} ${c.lastName} | Role: ${c.role} | Message: ${c.message ? c.message.substring(0, 30) + '...' : 'null'}`);
  });
  
  process.exit(0);
}
run().catch(console.error);
