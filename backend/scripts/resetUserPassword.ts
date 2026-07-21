import bcrypt from "bcrypt";
import { sequelize, User } from "@nexus-crm/database";

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error("Usage: npx ts-node scripts/resetUserPassword.ts <email> <newPassword>");
    process.exit(1);
  }

  const [email, newPassword] = args;

  await sequelize.authenticate();

  const user = (await User.findOne({ where: { email } })) as any;
  if (!user) {
    console.error(`Error: User with email "${email}" not found.`);
    process.exit(1);
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);
  user.password = hashedPassword;
  await user.save();

  console.log(`Password reset successfully for user:`);
  console.log(`- ID: ${user.id}`);
  console.log(`- Name: ${user.name}`);
  console.log(`- Email: ${user.email}`);
  console.log(`- Role: ${user.role}`);

  process.exit(0);
}

main().catch((err) => {
  console.error("Password reset failed:", err);
  process.exit(1);
});
