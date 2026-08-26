import { sequelize } from "@nexus-crm/database";

async function checkRecentLeads() {
  try {
    await sequelize.authenticate();
    console.log("=== CHECKING RECENT LEADS IN DB ===");

    const leads = await sequelize.models.Lead.findAll({
      order: [["createdAt", "DESC"]],
      limit: 10,
      attributes: ["id", "firstName", "lastName", "company", "email", "phone", "whatsappPhone", "source", "status", "assignedToId", "createdAt"]
    });

    console.log(`Found ${leads.length} recent leads:`);
    leads.forEach((l: any) => {
      console.log(`  - ID: ${l.id} | Name: ${l.firstName} ${l.lastName} | Source: ${l.source} | Email: ${l.email} | Phone: ${l.phone || l.whatsappPhone} | CreatedAt: ${l.createdAt}`);
    });

    process.exit(0);
  } catch (err) {
    console.error("Error checking recent leads:", err);
    process.exit(1);
  }
}

checkRecentLeads();
