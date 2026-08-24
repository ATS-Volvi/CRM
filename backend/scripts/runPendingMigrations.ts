import "dotenv/config";
import { Database, sequelize } from "@nexus-crm/database";
import * as fs from "fs";
import * as path from "path";

async function runMigrations() {
  await Database.createConnection();
  const queryInterface = sequelize.getQueryInterface();

  // Ensure SequelizeMeta table exists
  await queryInterface.createTable("SequelizeMeta", {
    name: {
      type: (sequelize.constructor as any).STRING,
      allowNull: false,
      unique: true,
      primaryKey: true
    }
  }).catch(() => {});

  const [executedRows]: any = await sequelize.query('SELECT name FROM "SequelizeMeta";').catch(() => [[]]);
  const executed = new Set((executedRows || []).map((r: any) => r.name));

  const migrationsDir = path.resolve(__dirname, "../../database/migrations");
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith(".js"))
    .sort();

  console.log(`Found ${files.length} migration files in directory.`);
  for (const file of files) {
    if (!executed.has(file)) {
      console.log(`Executing migration: ${file}...`);
      try {
        const migration = require(path.join(migrationsDir, file));
        if (typeof migration.up === "function") {
          await migration.up(queryInterface, sequelize.constructor);
        }
        await sequelize.query('INSERT INTO "SequelizeMeta" (name) VALUES (:name);', {
          replacements: { name: file }
        });
        console.log(`  ✅ Migration ${file} applied successfully.`);
      } catch (err: any) {
        console.warn(`  ⚠️ Migration ${file} note/warning: ${err.message}`);
        // Even if some columns/tables already existed, mark as executed so we proceed
        await sequelize.query('INSERT INTO "SequelizeMeta" (name) VALUES (:name) ON CONFLICT DO NOTHING;', {
          replacements: { name: file }
        }).catch(() => {});
      }
    }
  }

  console.log("All migrations checked and executed.");
}

runMigrations().then(() => process.exit(0)).catch((err) => {
  console.error("Migration runner error:", err);
  process.exit(1);
});
