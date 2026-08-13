const { Sequelize, Op } = require('sequelize');

async function run() {
  const sequelize = new Sequelize('postgresql://neondb_owner:npg_HXV5RUTbpBy8@ep-sweet-feather-atnnebbn-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require', {
    dialect: 'postgres',
    logging: false,
    dialectOptions: { ssl: { require: true, rejectUnauthorized: false } }
  });
  
  try {
    await sequelize.authenticate();
    const [accounts] = await sequelize.query(`SELECT * FROM "Accounts" WHERE "name" ILIKE '%volvi%'`);
    if (accounts.length > 0) {
      console.log(`Account: ${accounts[0].name}`);
      const accountId = accounts[0].id;
      const [deals] = await sequelize.query(`SELECT * FROM "Deals" WHERE "accountId" = '${accountId}'`);
      console.log(`Found ${deals.length} deals.`);
      
      for (const d of deals) {
        console.log(`\nDeal: ${d.name}`);
        const [dcs] = await sequelize.query(`
          SELECT dc.*, c."firstName", c."lastName" 
          FROM "DealContacts" dc 
          JOIN "Contacts" c ON dc."contactId" = c."id" 
          WHERE dc."dealId" = '${d.id}'
        `);
        for (const dc of dcs) {
          console.log(`  - Contact: ${dc.firstName} ${dc.lastName} (Role: ${dc.role}, isPrimary: ${dc.isPrimary})`);
        }
      }
    } else {
      console.log("No Volvitech account found yet.");
    }
  } catch(e) {
    console.error(e.message);
  } finally {
    await sequelize.close();
  }
}
run();
