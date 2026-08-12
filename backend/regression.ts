import axios from 'axios';
import { execSync } from 'child_process';
import sequelize from './src/config/database';
import { v4 as uuidv4 } from 'uuid';
import Lead from './src/models/leadModel';
import Activity from './src/models/activityModel';
import Asset from './src/models/assetModel';
import AssetStatusHistory from './src/models/assetStatusHistoryModel';
import Contact from './src/models/contactModel';

const API_URL = 'http://localhost:5506/api/v1';

async function runRegressionTests() {
  console.log("=========================================");
  console.log("STARTING REGRESSION TEST SUITE");
  console.log("=========================================\n");

  // TEST 12: Migrations
  console.log("--- TEST 12: MIGRATION STATUS ---");
  try {
    const migrateStatus = execSync('npx sequelize-cli db:migrate:status').toString();
    console.log(migrateStatus);
  } catch (err: any) {
    console.log("Migration status failed:", err.message);
  }

  // Ensure DB connection
  await sequelize.authenticate();

  // Helper to wait for background processing
  const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // TEST 8: Website Quote Form
  console.log("\n--- TEST 8: WEBSITE QUOTE FORM ---");
  try {
    const quotePayload = {
      firstName: "Regression",
      lastName: "Tester",
      email: `test_quote_${Date.now()}@example.com`,
      phone: "+966500000001",
      company: "Regression Corp",
      message: "Testing local quote submission",
      budgetRange: "Under SAR 50,000",
      source: "Website",
      sourceDetail: "Request a Quote Page",
      campaign: "Website Quote Form"
    };
    
    console.log("Submitting to /public/leads:", quotePayload);
    const quoteRes = await axios.post(`${API_URL}/public/leads`, quotePayload);
    console.log("API Response:", quoteRes.data);
    
    await wait(1000); // give time for async activity creation
    
    const leadRow = await Lead.findOne({ where: { email: quotePayload.email }, raw: true });
    console.log("RAW Lead Row from DB:", JSON.stringify(leadRow, null, 2));
  } catch (err: any) {
    console.log("TEST 8 FAILED:", err.response?.data || err.message);
  }

  // TEST 10: Duplicate Contact Detection
  console.log("\n--- TEST 10: DUPLICATE CONTACT DETECTION ---");
  try {
    const domain = `dup-test-${Date.now()}.com`;
    // Lead 1
    const payload1 = {
      firstName: "John", lastName: "Doe",
      email: `john@${domain}`, company: "Acme Corporation",
      source: "Website"
    };
    console.log("Submitting Lead 1:", payload1);
    await axios.post(`${API_URL}/public/leads`, payload1);
    await wait(1000);
    
    // Lead 2
    const payload2 = {
      firstName: "Jane", lastName: "Smith",
      email: `jane@${domain}`, company: "Acme Corp.",
      source: "Website"
    };
    console.log("Submitting Lead 2:", payload2);
    await axios.post(`${API_URL}/public/leads`, payload2);
    await wait(1000);

    const leads = await Lead.findAll({ where: { email: { [sequelize.Sequelize.Op.like]: `%@${domain}` } }, raw: true });
    console.log("RAW Leads Rows:", JSON.stringify(leads, null, 2));
    const contacts = await Contact.findAll({ where: { email: { [sequelize.Sequelize.Op.like]: `%@${domain}` } }, raw: true });
    console.log("RAW Contact Rows:", JSON.stringify(contacts, null, 2));
  } catch (err: any) {
    console.log("TEST 10 FAILED:", err.response?.data || err.message);
  }

  // TEST 9: Asset Tracking
  console.log("\n--- TEST 9: ASSET TRACKING ---");
  try {
    const assetId = uuidv4();
    console.log(`Creating Asset ${assetId}...`);
    const newAsset = await Asset.create({
      id: assetId,
      name: "Regression Test Generator",
      category: "Equipment",
      status: "Available",
      condition: "Good",
      serialNumber: "REG-12345"
    });
    console.log("RAW DB Asset Before Update:", JSON.stringify(newAsset.get({ plain: true }), null, 2));
    
    await wait(500);
    console.log("Updating Asset Status to Maintenance...");
    await newAsset.update({ status: "Maintenance", condition: "Fair" });
    
    const updatedAsset = await Asset.findByPk(assetId, { raw: true });
    console.log("RAW DB Asset After Update:", JSON.stringify(updatedAsset, null, 2));
    
    const history = await AssetStatusHistory.findAll({ where: { assetId }, raw: true });
    console.log("RAW Asset History Rows:", JSON.stringify(history, null, 2));
  } catch (err: any) {
    console.log("TEST 9 FAILED:", err.message);
  }

  // TEST 6: WhatsApp Send/Receive
  console.log("\n--- TEST 6: WHATSAPP SIMULATION ---");
  try {
    const waLeadId = uuidv4();
    await Lead.create({
      id: waLeadId, email: `wa_${Date.now()}@test.com`, source: "WhatsApp",
      temperature: "Warm", leadScore: 50, responsivenessScore: 0
    });
    console.log("Created test lead for WA.");
    
    // Simulate Outbound
    const outWa = await Activity.create({
      id: uuidv4(), leadId: waLeadId, type: "whatsapp", direction: "outbound", outcome: "Message sent: Hello WA", createdById: "system"
    });
    console.log("RAW Outbound WA Activity:", JSON.stringify(outWa.get({plain:true}), null, 2));
    
    // Simulate Inbound
    await wait(500);
    const inWa = await Activity.create({
      id: uuidv4(), leadId: waLeadId, type: "whatsapp", direction: "inbound", outcome: "Message received: Hi back WA"
    });
    console.log("RAW Inbound WA Activity:", JSON.stringify(inWa.get({plain:true}), null, 2));
  } catch (err: any) {
    console.log("TEST 6 FAILED:", err.message);
  }

  // TEST 7: Email Send/Receive
  console.log("\n--- TEST 7: EMAIL SIMULATION ---");
  try {
    const emLeadId = uuidv4();
    await Lead.create({
      id: emLeadId, email: `em_${Date.now()}@test.com`, source: "Email",
      temperature: "Warm", leadScore: 50, responsivenessScore: 0
    });
    console.log("Created test lead for Email.");
    
    // Simulate Outbound
    const outEm = await Activity.create({
      id: uuidv4(), leadId: emLeadId, type: "email", direction: "outbound", outcome: "Message sent: Outbound email test", createdById: "system"
    });
    console.log("RAW Outbound Email Activity:", JSON.stringify(outEm.get({plain:true}), null, 2));
    
    // Simulate Inbound
    await wait(500);
    const inEm = await Activity.create({
      id: uuidv4(), leadId: emLeadId, type: "email", direction: "inbound", outcome: "Message received: Inbound email test"
    });
    console.log("RAW Inbound Email Activity:", JSON.stringify(inEm.get({plain:true}), null, 2));
  } catch (err: any) {
    console.log("TEST 7 FAILED:", err.message);
  }

  // TEST 11: Hot/Warm/Cold Temperature
  console.log("\n--- TEST 11: HOT/WARM/COLD TEMPERATURE SYSTEM ---");
  try {
    const tempLeadId = uuidv4();
    await Lead.create({
      id: tempLeadId, email: `temp_${Date.now()}@test.com`, source: "Website",
      temperature: "Warm", leadScore: 50, responsivenessScore: 0
    });
    console.log("Created test lead. RAW DB Before Recalculation:", JSON.stringify(await Lead.findByPk(tempLeadId, {raw:true}), null, 2));
    
    // Simulate Outbound
    await Activity.create({
      id: uuidv4(), leadId: tempLeadId, type: "whatsapp", direction: "outbound", outcome: "Outbound ping",
      createdAt: new Date(Date.now() - 3600000) // 1 hr ago
    });
    
    // Simulate Inbound (fast reply within 1 hr)
    await Activity.create({
      id: uuidv4(), leadId: tempLeadId, type: "whatsapp", direction: "inbound", outcome: "Fast reply",
      createdAt: new Date(Date.now() - 3000000) // 50 mins ago (10 min reply)
    });
    
    // Trigger Temperature recalculation directly (simulate what happens in ingestion)
    const { recalculateResponsiveness } = require('./src/services/leadTemperatureService');
    await recalculateResponsiveness(tempLeadId);
    
    const leadAfter = await Lead.findByPk(tempLeadId, {raw:true});
    console.log("RAW DB After Recalculation:", JSON.stringify(leadAfter, null, 2));
  } catch (err: any) {
    console.log("TEST 11 FAILED:", err.message);
  }

  console.log("\n=========================================");
  console.log("REGRESSION TEST SUITE COMPLETE");
  console.log("=========================================\n");
  process.exit(0);
}

runRegressionTests();
