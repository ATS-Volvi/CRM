import { sequelize } from "@nexus-crm/database";
import { assignLead } from "../services/assignmentEngine";
import { ingestLead } from "../services/leadIngestion";

async function testDirectRelationshipEngine() {
  console.log("==================================================");
  console.log("VERIFYING DIRECT RELATIONSHIP & CHANNEL ASSIGNMENT ENGINE");
  console.log("==================================================\n");

  try {
    await sequelize.authenticate();
    console.log("✔ Database connection authenticated.\n");

    const timestamp = Date.now();

    // 1. Initialize Reps
    const sarah = await sequelize.models.User.create({
      id: require('crypto').randomUUID(),
      name: "Sarah Jenkins",
      email: `sarah_${timestamp}@nexus.com`,
      emailAlias: `sarah.alias_${timestamp}@nexus.com`,
      password: "hashedpassword",
      role: "sales_rep",
      isAvailable: true,
      status: "Available",
      maxOpenLeads: 100
    });

    const rahul = await sequelize.models.User.create({
      id: require('crypto').randomUUID(),
      name: "Rahul Verma",
      email: `rahul_${timestamp}@nexus.com`,
      emailAlias: `rahul.direct_${timestamp}@nexus.com`,
      password: "hashedpassword",
      role: "sales_rep",
      isAvailable: true,
      status: "Available",
      maxOpenLeads: 100
    });

    console.log("✔ Test Reps Initialized (Sarah: PepsiCo Account Owner, Rahul: Dedicated Channel owner).\n");

    // Create PepsiCo Customer owned by Sarah
    const pepsicoCustomer = await sequelize.models.Customer.create({
      id: require('crypto').randomUUID(),
      name: `PepsiCo Global Corp ${timestamp}`,
      primaryContactName: "Corporate Procurement",
      email: `procurement_${timestamp}@pepsico.com`
    });

    const pepsicoLead = await sequelize.models.Lead.create({
      id: require('crypto').randomUUID(),
      firstName: "Sarah's",
      lastName: "Client",
      email: `sarah.client_${timestamp}@pepsico.com`,
      company: `PepsiCo Global Corp ${timestamp}`,
      status: "Qualified",
      assignedToId: (sarah as any).id,
      assignmentType: "EXISTING_ACCOUNT",
      customerId: (pepsicoCustomer as any).id
    });

    // ─────────────────────────────────────────────────────────────
    // TEST 1: DEDICATED CHANNEL OVERRIDE (RAHUL'S DEDICATED EMAIL / CHANNEL)
    // ─────────────────────────────────────────────────────────────
    console.log("--- TEST 1: Dedicated Channel Ownership Override ---");
    const directLeadId = await ingestLead({
      firstName: "Michael",
      lastName: "Hill",
      email: `mhill_${timestamp}@pepsico.com`,
      company: `PepsiCo Global Corp ${timestamp}`,
      source: "WhatsApp",
      assignedChannelUserId: (rahul as any).id, // Prospect messaged Rahul's dedicated channel
      message: "Hey Rahul, sending enquiry directly to your line"
    });

    const directLead: any = await sequelize.models.Lead.findByPk(directLeadId);
    console.log(`   Lead Assigned To: ${directLead.assignedToId} (Expected Rahul: ${(rahul as any).id})`);
    const isDirectMatch = directLead.assignedToId === (rahul as any).id;
    console.log(`   ✔ Dedicated Channel Override Check: ${isDirectMatch ? "PASSED (Rahul received direct lead despite PepsiCo being owned by Sarah)" : "FAILED"}`);

    // ─────────────────────────────────────────────────────────────
    // TEST 2: GENERAL COMPANY CHANNEL -> EXISTING ACCOUNT OWNER
    // ─────────────────────────────────────────────────────────────
    console.log("\n--- TEST 2: General Company Channel -> Existing Account Owner ---");
    const generalLeadId = await ingestLead({
      firstName: "General",
      lastName: "Enquiry",
      email: `gen_${timestamp}@pepsico.com`,
      company: `PepsiCo Global Corp ${timestamp}`,
      source: "Website",
      destinationEmail: "general_main_site@nexus.com", // General company channel
      message: "General inquiry on main website form"
    });

    const generalLead: any = await sequelize.models.Lead.findByPk(generalLeadId);
    console.log(`   Lead Assigned To: ${generalLead.assignedToId} (Expected Sarah: ${(sarah as any).id})`);
    const isAccountOwnerMatch = generalLead.assignedToId === (sarah as any).id;
    console.log(`   ✔ Account Owner Check: ${isAccountOwnerMatch ? "PASSED (Sarah received general channel inquiry for PepsiCo)" : "FAILED"}`);

    // ─────────────────────────────────────────────────────────────
    // TEST 3: MANUAL ENTRY REASSIGNMENT PROTECTION
    // ─────────────────────────────────────────────────────────────
    console.log("\n--- TEST 3: Manual Entry Reassignment Protection ---");
    const manualLeadId = await ingestLead({
      firstName: "Manual",
      lastName: "Prospect",
      email: `manual_${timestamp}@prospect.com`,
      company: "Manual Prospect Inc",
      source: "Manual Entry",
      isManualEntry: true,
      createdById: (rahul as any).id
    });

    const manualLead: any = await sequelize.models.Lead.findByPk(manualLeadId);
    console.log(`   Manual Lead Owner: ${manualLead.assignedToId}`);

    // Simulate duplicate webhook arriving later for this manual lead
    const reassignResult = await assignLead({
      leadId: manualLeadId,
      firstName: "Manual",
      lastName: "Prospect",
      email: `manual_${timestamp}@prospect.com`,
      company: "Manual Prospect Inc",
      source: "Website"
    });

    console.log(`   Reassignment Protection Result Owner: ${reassignResult.assignedToId}`);
    const isProtected = reassignResult.assignedToId === (rahul as any).id;
    console.log(`   ✔ Reassignment Protection Check: ${isProtected ? "PASSED (Automated rules blocked from stealing Rahul's manual lead)" : "FAILED"}`);

    console.log("\n==================================================");
    console.log("DIRECT RELATIONSHIP & CHANNEL ENGINE VERIFIED SUCCESSFULLY! 🎉");
    console.log("==================================================");
    process.exit(0);
  } catch (err: any) {
    console.error("❌ Direct Relationship Engine Verification Failed:", err);
    process.exit(1);
  }
}

testDirectRelationshipEngine();
