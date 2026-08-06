import { sequelize } from "@nexus-crm/database";

async function assignRahulToRep() {
  try {
    await sequelize.authenticate();
    console.log("Database connection established.");

    const [reps]: any = await sequelize.query(`SELECT id, name, email FROM "Users" WHERE role='sales_rep' LIMIT 1;`);
    const targetRep = reps[0];

    const [leads]: any = await sequelize.query(`SELECT id, "firstName", "lastName", email, "assignedToId" FROM "Leads" WHERE "firstName" ILIKE '%Rahul%' OR "lastName" ILIKE '%Sharma%';`);
    const rahulLead = leads[0];

    if (!targetRep) {
      console.log("No sales rep found.");
      process.exit(1);
    }

    if (!rahulLead) {
      console.log("Rahul Sharma lead not found in DB.");
      process.exit(1);
    }

    await sequelize.query(`UPDATE "Leads" SET "assignedToId" = '${targetRep.id}' WHERE id = '${rahulLead.id}';`);

    console.log("=========================================");
    console.log(`✅ SUCCESS! Assigned Rahul Sharma lead (${rahulLead.id})`);
    console.log(`   To Sales Representative: ${targetRep.name}`);
    console.log(`   Email: ${targetRep.email}`);
    console.log("=========================================");
  } catch (error) {
    console.error("Error reassigning lead:", error);
  } finally {
    process.exit(0);
  }
}

assignRahulToRep();
