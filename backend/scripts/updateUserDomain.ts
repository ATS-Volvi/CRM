import { sequelize, User } from "@nexus-crm/database";

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  
  // Filter out the dry run flag to get domains
  const domains = args.filter(a => a !== "--dry-run");
  if (domains.length < 2) {
    console.error("Usage: npx ts-node scripts/updateUserDomain.ts <oldDomain> <newDomain> [--dry-run]");
    process.exit(1);
  }

  const [oldDomain, newDomain] = domains;
  
  console.log(`Migration parameters:`);
  console.log(`- Old Domain: @${oldDomain}`);
  console.log(`- New Domain: @${newDomain}`);
  console.log(`- Dry Run Mode: ${dryRun ? "ENABLED (no changes will be written)" : "DISABLED (changes WILL be written)"}`);
  console.log(`----------------------------------------`);

  // Initialize DB Connection
  await sequelize.authenticate();
  
  const users = await User.findAll() as any[];
  let updateCount = 0;

  for (const user of users) {
    if (user.email && user.email.endsWith(`@${oldDomain}`)) {
      const oldEmail = user.email;
      const username = oldEmail.split("@")[0];
      const newEmail = `${username}@${newDomain}`;
      
      console.log(`Match found: User "${user.name}"`);
      console.log(`  - Old Email: ${oldEmail}`);
      console.log(`  - New Email: ${newEmail}`);
      
      if (!dryRun) {
        user.email = newEmail;
        await user.save();
        console.log(`  [SUCCESS] Updated.`);
      } else {
        console.log(`  [DRY RUN] Would update.`);
      }
      updateCount++;
    }
  }

  console.log(`----------------------------------------`);
  console.log(`Migration summary: Found and processed ${updateCount} matching user records.`);
  process.exit(0);
}

main().catch(err => {
  console.error("Migration failed:", err);
  process.exit(1);
});
