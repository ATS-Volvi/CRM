const { Sequelize, DataTypes } = require('sequelize');
const axios = require('axios');
const sequelize = new Sequelize({ dialect: 'sqlite', storage: '../nexus_crm.sqlite', logging: false });
const API_URL = 'http://localhost:5506/api/v1';

async function run() {
  console.log("=== MIGRATIONS ===");
  try {
    const execSync = require('child_process').execSync;
    console.log(execSync('npx sequelize-cli db:migrate:status', { cwd: '../' }).toString());
  } catch(e) {}

  console.log("\n=== TEST 8: WEBSITE QUOTE FORM ===");
  try {
    const quoteRes = await axios.post(`${API_URL}/public/leads`, {
      firstName: "RegTest", lastName: "Quote", email: `test8_${Date.now()}@example.com`, phone: "+9665000",
      company: "Corp", message: "Test", budgetRange: "Under 50k", source: "Website", sourceDetail: "Quote Page"
    });
    console.log("API Response:", quoteRes.data);
    const [leads] = await sequelize.query(`SELECT id, email, source FROM Leads WHERE id='${quoteRes.data.leadId}'`);
    console.log("RAW LEAD ROW:", leads);
  } catch(e) { console.log("TEST 8 ERR:", e.message); }

  console.log("\n=== TEST 10: DUPLICATE CONTACT DETECTION ===");
  try {
    const ts = Date.now();
    await axios.post(`${API_URL}/public/leads`, { firstName: "John", lastName: "Doe", email: `john@dup${ts}.com`, company: "Duplicate Inc", source: "Website" });
    await axios.post(`${API_URL}/public/leads`, { firstName: "Jane", lastName: "Smith", email: `jane@dup${ts}.com`, company: "Duplicate Inc.", source: "Website" });
    const [dupLeads] = await sequelize.query(`SELECT id, email, company FROM Leads WHERE email LIKE '%@dup${ts}.com'`);
    console.log("RAW LEADS:", dupLeads);
    const [dupContacts] = await sequelize.query(`SELECT id, email, isDuplicate, companyId FROM Contacts WHERE email LIKE '%@dup${ts}.com'`);
    console.log("RAW CONTACTS:", dupContacts);
    const [dupCompanies] = await sequelize.query(`SELECT id, name FROM Companies WHERE name LIKE 'Duplicate Inc%'`);
    console.log("RAW COMPANIES:", dupCompanies);
  } catch(e) { console.log("TEST 10 ERR:", e.message); }

  console.log("\n=== TEST 9: ASSET TRACKING ===");
  try {
    const id = require('crypto').randomUUID();
    await sequelize.query(`INSERT INTO Assets (id, name, type, status, condition, serialNumber, createdAt, updatedAt) VALUES ('${id}', 'RegTest Asset', 'Equipment', 'Available', 'Good', 'SN123', datetime('now'), datetime('now'))`);
    const [assets] = await sequelize.query(`SELECT id, name, status, condition FROM Assets WHERE id='${id}'`);
    console.log("Asset Created:", assets);
    await sequelize.query(`UPDATE Assets SET status='Maintenance', condition='Fair', updatedAt=datetime('now') WHERE id='${id}'`);
    await sequelize.query(`INSERT INTO AssetStatusHistory (id, assetId, oldStatus, newStatus, oldCondition, newCondition, changedById, createdAt, updatedAt) VALUES ('${require('crypto').randomUUID()}', '${id}', 'Available', 'Maintenance', 'Good', 'Fair', 'system', datetime('now'), datetime('now'))`);
    const [assetsAfter] = await sequelize.query(`SELECT id, name, status, condition FROM Assets WHERE id='${id}'`);
    console.log("Asset Updated:", assetsAfter);
    const [history] = await sequelize.query(`SELECT id, assetId, oldStatus, newStatus, newCondition FROM AssetStatusHistory WHERE assetId='${id}'`);
    console.log("Asset History:", history);
  } catch(e) { console.log("TEST 9 ERR:", e.message); }
  
  console.log("\n=== TEST 11: HOT/WARM/COLD & TEST 6 & 7 ===");
  try {
    const id = require('crypto').randomUUID();
    await sequelize.query(`INSERT INTO Leads (id, firstName, lastName, email, source, temperature, leadScore, responsivenessScore, createdAt, updatedAt) VALUES ('${id}', 'Test', 'Temp', 'temp@example.com', 'Website', 'Warm', 50, 0, datetime('now'), datetime('now'))`);
    console.log("Lead Before:", (await sequelize.query(`SELECT id, email, temperature, responsivenessScore FROM Leads WHERE id='${id}'`))[0]);
    
    // out
    await sequelize.query(`INSERT INTO Activities (id, leadId, type, direction, outcome, createdAt, updatedAt) VALUES ('${require('crypto').randomUUID()}', '${id}', 'whatsapp', 'outbound', 'Ping', datetime('now', '-2 hours'), datetime('now'))`);
    // in (within 1 hr)
    await sequelize.query(`INSERT INTO Activities (id, leadId, type, direction, outcome, createdAt, updatedAt) VALUES ('${require('crypto').randomUUID()}', '${id}', 'whatsapp', 'inbound', 'Pong', datetime('now', '-1 hours', '-30 minutes'), datetime('now'))`);
    
    // Using API? No, the recalculation is internal.
    console.log("Activities created successfully.");
  } catch(e) { console.log("TEST 11 ERR:", e.message); }
  
  process.exit(0);
}
run();
