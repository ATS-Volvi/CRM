const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();
const { promisify } = require('util');
const db = new sqlite3.Database('../nexus_crm.sqlite');
const get = promisify(db.get.bind(db));
const all = promisify(db.all.bind(db));
const run = promisify(db.run.bind(db));

async function executeTests() {
  const ts = Date.now();
  console.log("=== 1. WHATSAPP TEST ===");
  try {
    const w1 = await axios.post(`http://localhost:5506/api/v1/public/leads`, { firstName: "WA", lastName: "Test", email: `wa@test${ts}.com`, phone: "+966500000000", source: "Website" });
    const waLeadId = w1.data.leadId;
    console.log("WA Lead Created");
    await run(`INSERT INTO Activities (id, leadId, type, direction, outcome, createdAt, updatedAt) VALUES ('${require('crypto').randomUUID()}', '${waLeadId}', 'whatsapp', 'outbound', 'Test WA Outbound Message', datetime('now'), datetime('now'))`);
    await run(`INSERT INTO Activities (id, leadId, type, direction, outcome, createdAt, updatedAt) VALUES ('${require('crypto').randomUUID()}', '${waLeadId}', 'whatsapp', 'inbound', 'Test WA Inbound Message', datetime('now'), datetime('now'))`);
    const waActs = await all(`SELECT direction, outcome, type FROM Activities WHERE leadId='${waLeadId}' AND type='whatsapp'`);
    console.log("Raw WA Activities:", waActs);
  } catch(e) { console.log("WA Error", e.message); }

  console.log("\n=== 2. EMAIL TEST ===");
  try {
    const e1 = await axios.post(`http://localhost:5506/api/v1/public/leads`, { firstName: "Em", lastName: "Test", email: `email@test${ts}.com`, source: "Website" });
    const emLeadId = e1.data.leadId;
    console.log("Email Lead Created");
    await run(`INSERT INTO Activities (id, leadId, type, direction, outcome, createdAt, updatedAt) VALUES ('${require('crypto').randomUUID()}', '${emLeadId}', 'email', 'outbound', 'Test Email Outbound', datetime('now'), datetime('now'))`);
    await run(`INSERT INTO Activities (id, leadId, type, direction, outcome, createdAt, updatedAt) VALUES ('${require('crypto').randomUUID()}', '${emLeadId}', 'email', 'inbound', 'Test Email Inbound', datetime('now'), datetime('now'))`);
    const emActs = await all(`SELECT direction, outcome, type FROM Activities WHERE leadId='${emLeadId}' AND type='email'`);
    console.log("Raw Email Activities:", emActs);
  } catch(e) { console.log("Email Error", e.message); }

  console.log("\n=== 3. DUPLICATE-CONTACT DETECTION ===");
  try {
    const d1 = await axios.post(`http://localhost:5506/api/v1/public/leads`, { firstName: "John", lastName: "Doe", email: `john@testcorp${ts}.com`, company: "TestCorp", source: "Website" });
    const d2 = await axios.post(`http://localhost:5506/api/v1/public/leads`, { firstName: "Sarah", lastName: "Connor", email: `sarah@testcorp${ts}.com`, company: "Test Corp.", source: "Website" });
    
    console.log("RAW Leads for Domain:");
    const leads = await all(`SELECT id, email, company FROM Leads WHERE email LIKE '%@testcorp${ts}.com'`);
    console.log(leads);
    
    console.log("RAW LeadContacts for Domain:");
    const contacts = await all(`SELECT id, email, firstName, lastName FROM LeadContacts WHERE email LIKE '%@testcorp${ts}.com'`);
    console.log(contacts);
  } catch(e) { console.log("Duplicate Error", e.message); }

  console.log("\n=== 4. TEMPERATURE TEST ===");
  try {
    const t1 = await axios.post(`http://localhost:5506/api/v1/public/leads`, { firstName: "Temp", lastName: "Test", email: `temp@test${ts}.com`, source: "Website" });
    const tLeadId = t1.data.leadId;
    
    console.log("Lead Before (Notice responsivenessScore = 0):");
    console.log(await get(`SELECT id, temperature, responsivenessScore FROM Leads WHERE id='${tLeadId}'`));
    
    // Simulate Outbound 1hr ago
    await run(`INSERT INTO Activities (id, leadId, type, direction, outcome, createdAt, updatedAt) VALUES ('${require('crypto').randomUUID()}', '${tLeadId}', 'email', 'outbound', 'Ping', datetime('now', '-1 hours'), datetime('now'))`);
    
    // Simulate Inbound 50m ago (fast reply, 10 min gap)
    await run(`INSERT INTO Activities (id, leadId, type, direction, outcome, createdAt, updatedAt) VALUES ('${require('crypto').randomUUID()}', '${tLeadId}', 'email', 'inbound', 'Reply', datetime('now', '-50 minutes'), datetime('now'))`);
    
    // Recalculate
    const leadTempSvc = require('./src/services/leadTemperatureService');
    await leadTempSvc.recalculateResponsiveness(tLeadId);
    
    console.log("Lead After Recalculation:");
    console.log(await get(`SELECT id, temperature, responsivenessScore FROM Leads WHERE id='${tLeadId}'`));
  } catch(e) { console.log("Temperature Error", e.message); }
}

executeTests();
