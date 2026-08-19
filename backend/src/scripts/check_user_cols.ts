import { sequelize } from "@nexus-crm/database";

async function checkUserColumns() {
  const [cols] = await sequelize.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'Users'
    ORDER BY column_name;
  `);
  console.log("Users columns:", cols.map((c: any) => c.column_name));
  
  // Check if maxOpenDeals exists
  const hasMaxOpenDeals = cols.some((c: any) => c.column_name === 'maxOpenDeals');
  if (!hasMaxOpenDeals) {
    console.log("Adding maxOpenDeals column to Users table...");
    await sequelize.query(`ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "maxOpenDeals" INTEGER DEFAULT NULL;`);
    console.log("maxOpenDeals column added.");
  }
}

checkUserColumns().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
