process.env.DATABASE_URL = "postgres://postgres@localhost:5433/test_postgres_notifications";
process.env.USE_SQLITE = "false";
process.env.DB_DIALECT = "postgres";

import fs from "fs";
import path from "path";
import { sequelize } from "@nexus-crm/database";

async function main() {
  console.log("=== Setting up Postgres schema as dev had it BEFORE this branch ===");
  await sequelize.authenticate();
  console.log("✓ Authenticated with Postgres at port 5433");

  // Sync dev models
  await sequelize.sync({ force: true });
  console.log("✓ Synchronized base model schema");

  // Drop this branch's 3 new tables & message templates to return DB strictly to pre-branch dev state
  await sequelize.query('DROP TABLE IF EXISTS "WorkOrderNotifications" CASCADE;');
  await sequelize.query('DROP TABLE IF EXISTS "WorkOrderFeedbacks" CASCADE;');
  await sequelize.query('DROP TABLE IF EXISTS "EmailSuppressions" CASCADE;');
  await sequelize.query("DELETE FROM \"MessageTemplates\" WHERE name LIKE 'work_order_%';");
  console.log("✓ Dropped WorkOrderNotifications, WorkOrderFeedbacks, EmailSuppressions tables and removed work_order_% templates");

  // Create SequelizeMeta table and mark all pre-branch migrations done
  await sequelize.query('CREATE TABLE IF NOT EXISTS "SequelizeMeta" (name VARCHAR(255) NOT NULL PRIMARY KEY);');

  const migrationsDir = path.resolve(__dirname, "../../database/migrations");
  const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith(".js") && f < "20261022120000");

  for (const file of files) {
    await sequelize.query('INSERT INTO "SequelizeMeta" (name) VALUES (:name) ON CONFLICT DO NOTHING;', {
      replacements: { name: file },
    });
  }
  console.log(`✓ Marked ${files.length} pre-branch migrations done in SequelizeMeta`);
  console.log("✓ Postgres schema successfully initialized to pre-branch dev state.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Error setting up dev Postgres schema:", err);
  process.exit(1);
});
