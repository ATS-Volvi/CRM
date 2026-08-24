import "dotenv/config";
import { Database, sequelize, User, WorkspaceSetting } from "@nexus-crm/database";

async function main() {
  await Database.createConnection();
  console.log("DB Connected");
  const users: any[] = await User.findAll({ raw: true });
  console.log(`Total users: ${users.length}`);
  const tiers: Record<string, number> = {};
  const roles: Record<string, number> = {};
  for (const u of users) {
    const tier = u.experienceTier || "UNSPECIFIED";
    const role = u.role || "UNSPECIFIED";
    tiers[tier] = (tiers[tier] || 0) + 1;
    roles[role] = (roles[role] || 0) + 1;
    console.log(`User: ${u.name} (${u.email}) | Role: ${u.role} | Tier: ${u.experienceTier} | Available: ${u.isAvailable}`);
  }
  console.log("Distinct Tiers:", tiers);
  console.log("Distinct Roles:", roles);

  const settings = await WorkspaceSetting.findAll({ raw: true });
  console.log("WorkspaceSettings:", settings);
  process.exit(0);
}
main().catch(console.error);
