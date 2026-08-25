import { Database, sequelize } from "@nexus-crm/database";
import bcrypt from "bcrypt";
import crypto from "crypto";

async function seedEssentialUsers() {
  console.log("Connecting to database...");
  await Database.createConnection();

  const hashedPassword = await bcrypt.hash("password123", 10);

  const usersToEnsure = [
    {
      name: "Sophia Martinez",
      email: "admin@nexus.com",
      role: "admin",
      department: "Executive Management",
      territory: "Global Headquarters"
    },
    {
      name: "Amelia Rodriguez",
      email: "salesperson1@nexus.com",
      role: "salesperson",
      department: "Direct Sales",
      territory: "North America - East"
    },
    {
      name: "Liam Carter",
      email: "salesperson2@nexus.com",
      role: "salesperson",
      department: "Direct Sales",
      territory: "North America - West"
    },
    {
      name: "Sales Representative",
      email: "salesperson@nexus.com",
      role: "salesperson",
      department: "Direct Sales",
      territory: "General"
    },
    {
      name: "Marcus Vance",
      email: "manager@nexus.com",
      role: "sales_manager",
      department: "Sales Management",
      territory: "North America"
    }
  ];

  for (const u of usersToEnsure) {
    const existing: any = await sequelize.models.User.findOne({ where: { email: u.email } });
    if (existing) {
      await existing.update({
        name: u.name,
        password: hashedPassword,
        role: u.role,
        department: u.department,
        territory: u.territory,
        isAvailable: true
      });
      console.log(`Updated user: ${u.email} (${u.role})`);
    } else {
      await sequelize.models.User.create({
        id: crypto.randomUUID(),
        name: u.name,
        email: u.email,
        password: hashedPassword,
        role: u.role,
        department: u.department,
        territory: u.territory,
        isAvailable: true,
        maxOpenLeads: 50
      });
      console.log(`Created user: ${u.email} (${u.role})`);
    }
  }

  console.log("\n=================================================");
  console.log("🎉 SUCCESS: All essential login accounts are ready!");
  console.log("Password for all accounts: password123");
  console.log("=================================================");
  process.exit(0);
}

seedEssentialUsers().catch(err => {
  console.error("Error creating users:", err);
  process.exit(1);
});
