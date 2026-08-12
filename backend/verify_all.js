const { Sequelize, DataTypes } = require('sequelize');
const axios = require('axios');
const sequelize = new Sequelize({ dialect: 'sqlite', storage: '../nexus_crm.sqlite', logging: false });
const API_URL = 'http://localhost:5506/api/v1';

async function run() {
  console.log("=== 3. DUPLICATE-CONTACT DETECTION ===");
  try {
    const ts = Date.now();
    await axios.post(`${API_URL}/public/leads`, { firstName: "John", lastName: "Doe", email: `john@testcorp${ts}.com`, company: "TestCorp", source: "Website" });
    await axios.post(`${API_URL}/public/leads`, { firstName: "Sarah", lastName: "Connor", email: `sarah@testcorp${ts}.com`, company: "Test Corp.", source: "Website" });
    const [leads] = await sequelize.query(`SELECT id, email, company FROM Leads WHERE email LIKE '%@testcorp${ts}.com'`);
    console.log("RAW LEADS:", leads);
    const [contacts] = await sequelize.query(`SELECT id, email, firstName, isDuplicate, companyId FROM LeadContacts WHERE email LIKE '%@testcorp${ts}.com'`);
    console.log("RAW CONTACTS:", contacts);
  } catch(e) { console.log(e.message); }

  console.log("\n=== 5 & 6. ASSET TRACKING ===");
  try {
    const id = require('crypto').randomUUID();
    await sequelize.query(`INSERT INTO Assets (id, name, type, status, condition, serialNumber, createdAt, updatedAt) VALUES ('${id}', 'Test Asset', 'Equipment', 'In Storage', 'Good', 'SN123', datetime('now'), datetime('now'))`);
    const [assets] = await sequelize.query(`SELECT id, name, status, condition FROM Assets WHERE id='${id}'`);
    console.log("Asset Before:", assets);
    await sequelize.query(`UPDATE Assets SET status='Deployed', condition='Fair', updatedAt=datetime('now') WHERE id='${id}'`);
    await sequelize.query(`INSERT INTO AssetStatusHistories (id, assetId, previousStatus, newStatus, previousCondition, newCondition, changedById, createdAt, updatedAt) VALUES ('${require('crypto').randomUUID()}', '${id}', 'In Storage', 'Deployed', 'Good', 'Fair', 'system', datetime('now'), datetime('now'))`);
    const [assetsAfter] = await sequelize.query(`SELECT id, name, status, condition FROM Assets WHERE id='${id}'`);
    console.log("Asset After:", assetsAfter);
    const [history] = await sequelize.query(`SELECT id, assetId, previousStatus, newStatus, newCondition FROM AssetStatusHistories WHERE assetId='${id}'`);
    console.log("Asset History:", history);
  } catch(e) { console.log(e.message); }

  console.log("\n=== 1, 2, 4. WA, EMAIL, & TEMPERATURE TEST ===");
  try {
    const id = require('crypto').randomUUID();
    await sequelize.query(`INSERT INTO Leads (id, firstName, lastName, email, source, temperature, leadScore, responsivenessScore, createdAt, updatedAt) VALUES ('${id}', 'Test', 'Temp', 'temp_${Date.now()}@test.com', 'Website', 'Warm', 50, 0, datetime('now'), datetime('now'))`);
    const [leadBefore] = await sequelize.query(`SELECT id, temperature, responsivenessScore FROM Leads WHERE id='${id}'`);
    console.log("Lead Before:", leadBefore);
    
    // out
    await sequelize.query(`INSERT INTO Activities (id, leadId, type, direction, outcome, createdAt, updatedAt) VALUES ('${require('crypto').randomUUID()}', '${id}', 'whatsapp', 'outbound', 'Message sent: Hey!', datetime('now', '-2 hours'), datetime('now'))`);
    // in (within 1 hr)
    await sequelize.query(`INSERT INTO Activities (id, leadId, type, direction, outcome, createdAt, updatedAt) VALUES ('${require('crypto').randomUUID()}', '${id}', 'whatsapp', 'inbound', 'Message received: Hi back', datetime('now', '-1 hours', '-30 minutes'), datetime('now'))`);
    
    const { recalculateResponsiveness } = require('./src/services/leadTemperatureService');
    await recalculateResponsiveness(id);
    
    const [leadAfter] = await sequelize.query(`SELECT id, temperature, responsivenessScore FROM Leads WHERE id='${id}'`);
    console.log("Lead After Recalculation:", leadAfter);
  } catch(e) { console.log(e.message); }
  
  process.exit(0);
}
run();
