import { Database, sequelize } from "@nexus-crm/database";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

async function testLoginAccounts() {
  await Database.createConnection();
  const emails = [
    "admin@nexus.com",
    "salesperson1@nexus.com",
    "salesperson2@nexus.com",
    "salesperson@nexus.com",
    "manager@nexus.com"
  ];

  console.log("Testing user logins with password 'password123':\n");

  for (const email of emails) {
    const user: any = await sequelize.models.User.findOne({ where: { email } });
    if (!user) {
      throw new Error(`User ${email} not found!`);
    }
    const isValid = await bcrypt.compare("password123", user.password);
    if (!isValid) {
      throw new Error(`Password mismatch for ${email}!`);
    }
    console.log(`✅ [OK] ${email} -> Name: "${user.name}", Role: "${user.role}", Validated!`);
  }

  console.log("\nAll login accounts verified successfully!");
  process.exit(0);
}

testLoginAccounts().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
