import "dotenv/config";
import { Database, sequelize } from "@nexus-crm/database";

async function main() {
  await Database.createConnection();
  const [cols]: any = await sequelize.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'DealReassignmentHistories';
  `);
  console.log("Columns:", cols.map((c: any) => c.column_name));

  const existingCols = new Set(cols.map((c: any) => c.column_name));
  
  if (!existingCols.has("oldOwnerId")) {
    await sequelize.query(`ALTER TABLE "DealReassignmentHistories" ADD COLUMN IF NOT EXISTS "oldOwnerId" UUID;`);
    console.log("Added oldOwnerId column");
  }
  if (!existingCols.has("newOwnerId")) {
    await sequelize.query(`ALTER TABLE "DealReassignmentHistories" ADD COLUMN IF NOT EXISTS "newOwnerId" UUID;`);
    console.log("Added newOwnerId column");
  }
  if (!existingCols.has("changedByUserId")) {
    await sequelize.query(`ALTER TABLE "DealReassignmentHistories" ADD COLUMN IF NOT EXISTS "changedByUserId" UUID;`);
    console.log("Added changedByUserId column");
  }
  if (!existingCols.has("dealAmountAtReassignment")) {
    await sequelize.query(`ALTER TABLE "DealReassignmentHistories" ADD COLUMN IF NOT EXISTS "dealAmountAtReassignment" NUMERIC(12,2);`);
    console.log("Added dealAmountAtReassignment column");
  }
  if (!existingCols.has("exceededCutoff")) {
    await sequelize.query(`ALTER TABLE "DealReassignmentHistories" ADD COLUMN IF NOT EXISTS "exceededCutoff" BOOLEAN DEFAULT false;`);
    console.log("Added exceededCutoff column");
  }
  if (!existingCols.has("exceededCapacity")) {
    await sequelize.query(`ALTER TABLE "DealReassignmentHistories" ADD COLUMN IF NOT EXISTS "exceededCapacity" BOOLEAN DEFAULT false;`);
    console.log("Added exceededCapacity column");
  }

  process.exit(0);
}
main().catch(console.error);
