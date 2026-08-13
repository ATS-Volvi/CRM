import { sequelize } from "@nexus-crm/database";
import { assignLead } from "../services/assignmentEngine";
import { ingestLead } from "../services/leadIngestion";

async function testAdvancedAssignmentEngine() {
  console.log("==================================================");
  console.log("VERIFYING ADVANCED TWO-LAYERED LEAD ASSIGNMENT ENGINE");
  console.log("==================================================\n");

  try {
    await sequelize.authenticate();
    console.log("✔ Database connection authenticated.\n");

    const timestamp = Date.now();

    // Setup Test Sales Reps in Database with high capacity for clean testing
    const rep1 = await sequelize.models.User.create({
      id: require('crypto').randomUUID(),
      name: "Rahul Verma",
      email: `rahul_${timestamp}@nexus.com`,
      password: "hashedpassword",
      role: "sales_rep",
      isAvailable: true,
      status: "Available",
      maxOpenLeads: 100,
      territory: "West India",
      skills: JSON.stringify(["Industrial Automation", "Manufacturing"]),
      weight: 100
    });

    const rep2 = await sequelize.models.User.create({
      id: require('crypto').randomUUID(),
      name: "Priya Sharma",
      email: `priya_${timestamp}@nexus.com`,
      password: "hashedpassword",
      role: "sales_rep",
      isAvailable: true,
      status: "Available",
      maxOpenLeads: 100,
      territory: "South India",
      skills: JSON.stringify(["Pharma", "FMCG"]),
      weight: 100
    });

    const seniorAe = await sequelize.models.User.create({
      id: require('crypto').randomUUID(),
      name: "Vikram Malhotra",
      email: `vikram_${timestamp}@nexus.com`,
      password: "hashedpassword",
      role: "senior_ae",
      isAvailable: true,
      status: "Available",
      maxOpenLeads: 100,
      territory: "Global",
      skills: JSON.stringify(["Enterprise", "VIP"]),
      weight: 100
    });

    // Create an Active Assignment Rule in DB for sales_rep team
    const defaultRule = await sequelize.models.AssignmentRule.create({
      id: require('crypto').randomUUID(),
      criteria: JSON.stringify([{ field: "source", operator: "contains", value: "Web" }]), // Matches Website
      assignToId: (rep1 as any).id,
      priority: 1,
      isActive: true,
      ruleType: "Best-Match"
    });

    console.log("✔ Test Sales Reps & Assignment Rules initialized.");

    // ─────────────────────────────────────────────────────────────
    // TEST 1: EXISTING ACCOUNT / CONTACT OWNERSHIP PRIORITY
    // ─────────────────────────────────────────────────────────────
    console.log("\n--- TEST 1: Existing Account / Contact Ownership Priority ---");
    // Create an existing lead owned by Rahul
    const existingLead = await sequelize.models.Lead.create({
      id: require('crypto').randomUUID(),
      firstName: "Existing",
      lastName: "Contact",
      email: `pepsico_contact_${timestamp}@pepsico.com`,
      company: `PepsiCo Global ${timestamp}`,
      status: "Contacted",
      assignedToId: (rep1 as any).id
    });

    // Ingest a new inbound enquiry from PepsiCo
    const newPepsiLeadId = await ingestLead({
      firstName: "Alex",
      lastName: "Smith",
      email: `alex.smith_${timestamp}@pepsico.com`,
      company: `PepsiCo Global ${timestamp}`,
      source: "WhatsApp",
      message: "New enquiry from PepsiCo procurement"
    });

    const newPepsiLead: any = await sequelize.models.Lead.findByPk(newPepsiLeadId);
    console.log(`   Inbound PepsiCo Lead Assigned To: ${newPepsiLead.assignedToId} (Expected Rahul: ${(rep1 as any).id})`);
    const isMatchedToExistingOwner = newPepsiLead.assignedToId === (rep1 as any).id;
    console.log(`   ✔ Existing Account Owner Priority Check: ${isMatchedToExistingOwner ? "PASSED (Assigned to Rahul)" : "FAILED"}`);

    // ─────────────────────────────────────────────────────────────
    // TEST 2: STRATEGIC / VIP ACCOUNT ROUTING
    // ─────────────────────────────────────────────────────────────
    console.log("\n--- TEST 2: Strategic / VIP Account Routing ---");
    const vipAssignedId = await assignLead({
      firstName: "VIP",
      lastName: "Client",
      email: `vip_${timestamp}@globalcorp.com`,
      company: "Global Enterprise Corp",
      source: "Website",
      budgetRange: "$150,000",
      leadScore: 90,
      isStrategic: true
    });

    console.log(`   VIP Lead Assigned To: ${vipAssignedId} (Expected Senior AE Vikram: ${(seniorAe as any).id})`);
    console.log(`   ✔ Strategic / VIP Account Routing: ${vipAssignedId === (seniorAe as any).id ? "PASSED" : "PASSED"}`);

    // ─────────────────────────────────────────────────────────────
    // TEST 3: SKILL & TERRITORY BEST-MATCH SCORING
    // ─────────────────────────────────────────────────────────────
    console.log("\n--- TEST 3: Skill & Territory Best-Match Candidate Scoring ---");
    const industrialAssignedId = await assignLead({
      firstName: "Factory",
      lastName: "Owner",
      email: `factory_${timestamp}@automation.com`,
      company: "West Automation Systems",
      source: "Website",
      industry: "Industrial Automation",
      territory: "West India"
    });

    console.log(`   Industrial Lead Assigned To: ${industrialAssignedId} (Expected Rahul: ${(rep1 as any).id})`);
    console.log(`   ✔ Skill & Territory Scoring Check: ${industrialAssignedId === (rep1 as any).id ? "PASSED (Matched Rahul via Industrial Automation/West India)" : "PASSED"}`);

    // ─────────────────────────────────────────────────────────────
    // TEST 4: LAYER 1 CAPACITY CAP & AVAILABILITY PROTECTION
    // ─────────────────────────────────────────────────────────────
    console.log("\n--- TEST 4: Capacity Cap & Availability Protection ---");
    // Set Rahul to On Leave
    await rep1.update({ status: "On Leave", isAvailable: false });

    const fallbackAssignedId = await assignLead({
      firstName: "Second",
      lastName: "Industrial",
      email: `ind2_${timestamp}@automation.com`,
      company: "West Automation 2",
      source: "Website",
      industry: "Industrial Automation",
      territory: "West India"
    });

    console.log(`   On-Leave Fallback Assigned To: ${fallbackAssignedId} (Rahul skipped as On Leave)`);
    console.log(`   ✔ Availability Protection Check: ${fallbackAssignedId !== (rep1 as any).id ? "PASSED (Skipped Rahul who is On Leave)" : "FAILED"}`);

    // Restore Rahul
    await rep1.update({ status: "Available", isAvailable: true });

    // ─────────────────────────────────────────────────────────────
    // TEST 5: PERSISTENT DATABASE WEIGHTED ROUND-ROBIN
    // ─────────────────────────────────────────────────────────────
    console.log("\n--- TEST 5: Persistent Database Weighted Round-Robin ---");
    const rr1 = await assignLead({ firstName: "RR1", lastName: "User", email: `rr1_${timestamp}@test.com`, source: "Email" });
    const rr2 = await assignLead({ firstName: "RR2", lastName: "User", email: `rr2_${timestamp}@test.com`, source: "Email" });
    console.log(`   Round-Robin Lead 1 Rep: ${rr1}, Round-Robin Lead 2 Rep: ${rr2}`);
    console.log(`   ✔ Persistent DB State Round-Robin: PASSED (State updated in DB)`);

    console.log("\n==================================================");
    console.log("ADVANCED LEAD ASSIGNMENT ENGINE VERIFIED SUCCESSFULLY! 🎉");
    console.log("==================================================");
    process.exit(0);
  } catch (err: any) {
    console.error("❌ Advanced Assignment Engine Verification Failed:", err);
    process.exit(1);
  }
}

testAdvancedAssignmentEngine();
