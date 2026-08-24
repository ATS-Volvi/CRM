import "dotenv/config";
import { Database, sequelize } from "@nexus-crm/database";
import bcrypt from "bcrypt";

async function main() {
  await Database.createConnection();
  const { User } = sequelize.models;

  const hashedPassword = await bcrypt.hash("password123", 10);

  // Salesman 1
  let salesman1: any = await User.findOne({ where: { email: "liamcarter@nexus.com" } });
  if (!salesman1) {
    salesman1 = await User.create({
      id: require("crypto").randomUUID(),
      name: "Liam Carter (Salesman 1)",
      email: "liamcarter@nexus.com",
      password: hashedPassword,
      role: "sales_rep",
      department: "Direct Sales",
      territory: "North America - East",
      isAvailable: true
    });
    console.log("✓ Created Salesman 1: liamcarter@nexus.com / password123");
  } else {
    await salesman1.update({ password: hashedPassword, isAvailable: true });
    console.log("✓ Updated Salesman 1 password: liamcarter@nexus.com / password123");
  }

  // Salesman 2
  let salesman2: any = await User.findOne({ where: { email: "emmawatson@nexus.com" } });
  if (!salesman2) {
    salesman2 = await User.create({
      id: require("crypto").randomUUID(),
      name: "Emma Watson (Salesman 2)",
      email: "emmawatson@nexus.com",
      password: hashedPassword,
      role: "senior_ae",
      department: "Enterprise AE Sales",
      territory: "North America - West",
      isAvailable: true
    });
    console.log("✓ Created Salesman 2: emmawatson@nexus.com / password123");
  } else {
    await salesman2.update({ password: hashedPassword, isAvailable: true });
    console.log("✓ Updated Salesman 2 password: emmawatson@nexus.com / password123");
  }

  console.log("Demo credentials ready!");
  process.exit(0);
}

main().catch(err => {
  console.error("Error setting up demo credentials:", err);
  process.exit(1);
});
