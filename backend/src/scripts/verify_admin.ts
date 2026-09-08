import { User } from "@nexus-crm/database";
import bcrypt from "bcryptjs";

async function verifyAdmin() {
  const users = await User.findAll({ attributes: ['id', 'email', 'name', 'role'] });
  console.log("Existing users in DB:", users.map(u => ({ email: u.email, role: u.role })));
  
  let admin = await User.findOne({ where: { email: "admin@nexus.com" } });
  if (!admin) {
    console.log("Creating admin@nexus.com user...");
    const hashedPassword = await bcrypt.hash("password123", 10);
    admin = await User.create({
      email: "admin@nexus.com",
      name: "Admin User",
      password: hashedPassword,
      role: "admin",
      isAvailable: true
    });
    console.log("Admin user created.");
  } else {
    console.log("Resetting admin@nexus.com password to password123...");
    const hashedPassword = await bcrypt.hash("password123", 10);
    admin.password = hashedPassword;
    await admin.save();
    console.log("Admin password reset successfully.");
  }
}

verifyAdmin().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
