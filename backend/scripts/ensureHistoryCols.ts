import "dotenv/config";
import { Database, sequelize } from "@nexus-crm/database";

async function main() {
  await Database.createConnection();
  try {
    await sequelize.query(`ALTER TABLE "DealReassignmentHistories" ADD COLUMN IF NOT EXISTS "assignmentType" VARCHAR(255) DEFAULT 'AUTOMATIC';`);
    console.log("Column assignmentType ensured");
  } catch (e: any) {
    console.error("Error adding column:", e.message);
  }
  const [cols]: any = await sequelize.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'DealReassignmentHistories';`);
  console.log("Current cols in DealReassignmentHistories:", cols.map((c: any) => c.column_name));
  process.exit(0);
}
main().catch(console.error);
