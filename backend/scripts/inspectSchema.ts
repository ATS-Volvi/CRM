import { sequelize } from "@nexus-crm/database";

async function inspect() {
  const [cols] = await sequelize.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'QuoteLineItems';
  `);
  console.log("QuoteLineItems columns:", (cols as any[]).map(c => `${c.column_name} (${c.data_type})`));
}

inspect().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
