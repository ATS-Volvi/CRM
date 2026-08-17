import { sequelize } from "@nexus-crm/database";

async function checkLeadNumbers() {
  const [rows] = await sequelize.query(`
    SELECT "leadNumber", "createdAt" 
    FROM "Leads" 
    WHERE "leadNumber" IS NOT NULL 
    ORDER BY "createdAt" DESC 
    LIMIT 20;
  `);
  console.log("Recent leadNumbers:", rows);

  const [maxRow] = await sequelize.query(`
    SELECT "leadNumber" 
    FROM "Leads" 
    ORDER BY "leadNumber" DESC 
    LIMIT 10;
  `);
  console.log("Max leadNumbers:", maxRow);
}

checkLeadNumbers().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
