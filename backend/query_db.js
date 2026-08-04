const { Sequelize } = require('sequelize');
const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  dialectOptions: { ssl: { require: true, rejectUnauthorized: false } }
});

async function run() {
  try {
    const activities = await sequelize.query('SELECT * FROM "Activities" WHERE type = \'instagram_dm\' ORDER BY "createdAt" DESC LIMIT 5;', { type: Sequelize.QueryTypes.SELECT });
    console.log("Instagram Activities:");
    console.log(activities);
    
    const leads = await sequelize.query('SELECT * FROM "Leads" WHERE source = \'Instagram\' ORDER BY "createdAt" DESC LIMIT 5;', { type: Sequelize.QueryTypes.SELECT });
    console.log("\nInstagram Leads:");
    console.log(leads);
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}
run();
