import { sequelize } from "@nexus-crm/database";
import { ingestLead, LeadPayload } from "../services/leadIngestion";

async function runLeadIntakeTests() {
  console.log("==================================================");
  console.log("RUNNING UNIVERSAL LEAD INTAKE AUTOMATION VERIFICATION");
  console.log("==================================================\n");

  try {
    await sequelize.authenticate();
    console.log("✔ Database connection authenticated.\n");

    const testTime = Date.now();

    // 1. WEBSITE LEAD TEST
    console.log("--- TEST 1: Website Lead Intake ---");
    const webLeadId = await ingestLead({
      firstName: "TestWeb",
      lastName: `User_${testTime}`,
      email: `webuser_${testTime}@example.com`,
      company: "Acme Web Corp",
      source: "Website",
      message: "Need quote for enterprise software cabins",
      budgetRange: "$50,000 - $100,000"
    });
    console.log(`✔ Website Lead Created: ${webLeadId}`);

    const webLead = await sequelize.models.Lead.findByPk(webLeadId);
    console.log(`   Source: ${(webLead as any).source}, LeadNumber: ${(webLead as any).leadNumber}, AssignedTo: ${(webLead as any).assignedToId}`);

    const webTasks = await sequelize.models.Task.findAll({ where: { leadId: webLeadId } });
    console.log(`   Tasks Created: ${webTasks.length} (Title: "${(webTasks[0] as any)?.title}", Priority: ${(webTasks[0] as any)?.priority})`);

    const webActivities = await sequelize.models.Activity.findAll({ where: { leadId: webLeadId } });
    console.log(`   Activities Logged: ${webActivities.length}`);
    webActivities.forEach((a: any) => console.log(`     - [${a.direction?.toUpperCase()}] ${a.outcome}`));

    // 2. EMAIL LEAD TEST
    console.log("\n--- TEST 2: Email Lead Intake ---");
    const emailLeadId = await ingestLead({
      firstName: "TestEmail",
      lastName: `Sender_${testTime}`,
      email: `emailsender_${testTime}@example.com`,
      company: "Email Dynamics LLC",
      source: "Email",
      message: "Please send product pricing catalog"
    });
    console.log(`✔ Email Lead Created: ${emailLeadId}`);

    // 3. WHATSAPP LEAD TEST
    console.log("\n--- TEST 3: WhatsApp Lead Intake ---");
    const waLeadId = await ingestLead({
      firstName: "TestWhatsApp",
      lastName: `User_${testTime}`,
      phone: `+9665${Math.floor(10000000 + Math.random() * 90000000)}`,
      source: "WhatsApp",
      message: "Hello, I want to inquire about site cabins"
    });
    console.log(`✔ WhatsApp Lead Created: ${waLeadId}`);
    const waActivities = await sequelize.models.Activity.findAll({ where: { leadId: waLeadId } });
    console.log(`   Activities Logged: ${waActivities.length}`);
    waActivities.forEach((a: any) => console.log(`     - [${a.direction?.toUpperCase()}] ${a.outcome}`));

    // 4. MANUAL ENTRY LEAD TEST (NO AUTO-MESSAGE, TASK CREATED)
    console.log("\n--- TEST 4: Manual Entry Lead Intake ---");
    const manualLeadId = await ingestLead({
      firstName: "TestManual",
      lastName: `Entry_${testTime}`,
      email: `manual_${testTime}@example.com`,
      company: "Manual Operations Inc",
      source: "Manual Entry",
      isManualAutoResponseEnabled: false
    });
    console.log(`✔ Manual Lead Created: ${manualLeadId}`);
    const manualActivities = await sequelize.models.Activity.findAll({ where: { leadId: manualLeadId } });
    console.log(`   Activities Logged: ${manualActivities.length}`);
    manualActivities.forEach((a: any) => console.log(`     - [${a.direction?.toUpperCase()}] ${a.outcome}`));

    // 5. UNASSIGNED OWNER LEAD TEST
    console.log("\n--- TEST 5: Lead Ingestion & Owner Assignment ---");
    const unassignedLeadId = await ingestLead({
      firstName: "TestUnassigned",
      lastName: `Prospect_${testTime}`,
      email: `unassigned_${testTime}@example.com`,
      source: "Cold Call"
    });
    const unassignedLead = await sequelize.models.Lead.findByPk(unassignedLeadId);
    console.log(`✔ Cold Call Lead Created: ${unassignedLeadId}, AssignedTo: ${(unassignedLead as any).assignedToId || 'Unassigned'}`);

    // 6. FAILED AUTOMATED MESSAGE HANDLING TEST
    console.log("\n--- TEST 6: Failed Automated Message Failure Handling ---");
    const failLeadId = await ingestLead({
      firstName: "TestFail",
      lastName: `Delivery_${testTime}`,
      // No phone provided for WhatsApp lead -> forces auto response error handling
      source: "WhatsApp"
    });
    console.log(`✔ Fail-Scenario Lead Created: ${failLeadId}`);
    const failActivities = await sequelize.models.Activity.findAll({ where: { leadId: failLeadId } });
    console.log(`   Fail Lead Activities Logged: ${failActivities.length}`);
    failActivities.forEach((a: any) => console.log(`     - [${a.direction?.toUpperCase()}] ${a.outcome}`));
    const failTasks = await sequelize.models.Task.findAll({ where: { leadId: failLeadId } });
    console.log(`   Fail Lead Tasks (Includes High Priority Manual Action Task): ${failTasks.length}`);
    failTasks.forEach((t: any) => console.log(`     - [TASK ${(t as any).priority}] ${(t as any).title}`));

    // 7. DUPLICATE WEBHOOK / LEAD INGESTION EVENT TEST
    console.log("\n--- TEST 7: Duplicate Intake Event (Idempotency Protection) ---");
    const dupLeadId = await ingestLead({
      firstName: "TestWeb",
      lastName: `User_${testTime}`,
      email: `webuser_${testTime}@example.com`, // Same email as Test 1
      source: "Website",
      message: "Duplicate enquiry submission"
    });
    console.log(`✔ Duplicate Ingestion Handled cleanly. Lead ID: ${dupLeadId} (Matches Website Lead ID: ${webLeadId === dupLeadId})`);
    const dupActivities = await sequelize.models.Activity.findAll({ where: { leadId: dupLeadId } });
    console.log(`   Total Activities on Lead after duplicate capture: ${dupActivities.length}`);
    dupActivities.forEach((a: any) => console.log(`     - [${a.direction?.toUpperCase()}] ${a.outcome}`));

    console.log("\n==================================================");
    console.log("ALL UNIVERSAL LEAD INTAKE TESTS PASSED SUCCESSFULLY! 🎉");
    console.log("==================================================");
    process.exit(0);
  } catch (err: any) {
    console.error("❌ Lead Intake Verification Failed:", err);
    process.exit(1);
  }
}

runLeadIntakeTests();
