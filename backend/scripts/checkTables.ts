import { sequelize } from "@nexus-crm/database";

async function checkTables() {
  const [rows] = await sequelize.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
  `);
  console.log("Existing DB Tables:", (rows as any[]).map(r => r.table_name));
}

checkTables().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
