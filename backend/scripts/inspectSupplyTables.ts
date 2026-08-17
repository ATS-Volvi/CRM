import { sequelize } from "@nexus-crm/database";

async function inspectSupplyTables() {
  const [poCols] = await sequelize.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'PurchaseOrders';
  `);
  console.log("PurchaseOrders columns:", (poCols as any[]).map(c => `${c.column_name} (${c.data_type})`));

  const [assetCols] = await sequelize.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'Assets';
  `);
  console.log("Assets columns:", (assetCols as any[]).map(c => `${c.column_name} (${c.data_type})`));
}

inspectSupplyTables().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
