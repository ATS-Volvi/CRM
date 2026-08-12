const { Sequelize, DataTypes } = require('sequelize');
const sequelize = new Sequelize({ dialect: 'sqlite', storage: '../nexus_crm.sqlite', logging: false });

async function run() {
  try {
    const id = require('crypto').randomUUID();
    await sequelize.query(`INSERT INTO Assets (id, name, type, status, condition, serialNumber, createdAt, updatedAt) VALUES ('${id}', 'Test Asset', 'Equipment', 'In Storage', 'Good', 'SN123', datetime('now'), datetime('now'))`);
    
    await sequelize.query(`UPDATE Assets SET status='Deployed', condition='Fair', updatedAt=datetime('now') WHERE id='${id}'`);
    
    await sequelize.query(`INSERT INTO AssetStatusHistories (id, assetId, previousStatus, newStatus, previousCondition, newCondition, changedById, createdAt, updatedAt) VALUES ('${require('crypto').randomUUID()}', '${id}', 'In Storage', 'Deployed', 'Good', 'Fair', 'system', datetime('now'), datetime('now'))`);
    
    const [assetsAfter] = await sequelize.query(`SELECT id, name, status, condition FROM Assets WHERE id='${id}'`);
    console.log("Asset After Update:", assetsAfter);
    
    const [history] = await sequelize.query(`SELECT id, assetId, previousStatus, newStatus, newCondition FROM AssetStatusHistories WHERE assetId='${id}'`);
    console.log("Asset History Record:", history);
  } catch(e) { console.log(e.message); }
}
run();
