const { Sequelize, DataTypes } = require('sequelize');
const { ingestLead } = require('./src/services/leadIngestion');
const sequelize = new Sequelize({ dialect: 'sqlite', storage: '../nexus_crm.sqlite', logging: false });
require('./src/models/initModels').initModels(sequelize);

async function run() {
  await sequelize.authenticate();
  const db = require('../database/models/index');
  
  // 1. Create a lead
  const leadId = await ingestLead({
    firstName: "Test",
    lastName: "Company",
    email: "test@company.com",
    company: "Test Company",
    source: "Website",
    sourceDetail: "Test",
    campaign: "Test",
  });
  console.log("Created primary lead:", leadId);

  // 2. Submit a duplicate from a secondary contact with a long message
  const duplicateId = await ingestLead({
    firstName: "Jane",
    lastName: "Doe",
    email: "jane@company.com", // same domain, should merge
    company: "Test Company",
    source: "Website",
    sourceDetail: "Duplicate Form",
    campaign: "Test",
    message: "Need pricing for 4 portable cabins by next month. This is a very long message that should exceed one hundred characters so that we can verify the truncation logic works perfectly on the frontend UI without breaking."
  });
  console.log("Submitted duplicate lead. Returned ID:", duplicateId);

  // 3. Verify Database LeadContacts
  const contacts = await db.LeadContact.findAll({ where: { leadId } });
  console.log("\nLeadContacts in Database:");
  contacts.forEach(c => {
    console.log(`- ${c.firstName} ${c.lastName} | Role: ${c.role} | Message: ${c.message ? c.message.substring(0, 30) + '...' : 'null'}`);
  });

  // 4. Verify Activity Log
  const activities = await db.Activity.findAll({ where: { leadId }, order: [['createdAt', 'DESC']] });
  console.log("\nRecent Activity Logs:");
  activities.forEach(a => {
    console.log(`- [${a.type}] ${a.outcome}`);
  });

  process.exit(0);
}
run().catch(console.error);
