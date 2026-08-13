const { Sequelize, Op } = require('sequelize');

async function run() {
  const sequelize = new Sequelize('postgresql://neondb_owner:npg_HXV5RUTbpBy8@ep-sparkling-wave-atc5ndul-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require', {
    dialect: 'postgres',
    logging: false,
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    }
  });

  try {
    await sequelize.authenticate();
    console.log('Connected to Production Neon DB successfully.');

    // Define raw queries instead of loading models to be perfectly safe and unencumbered by schema changes
    const [leads] = await sequelize.query(`
      SELECT * FROM "Leads"
      WHERE "firstName" ILIKE '%swasthik%' 
         OR "firstName" ILIKE '%saud%' 
         OR "firstName" ILIKE '%zeeshan%'
         OR "firstName" ILIKE '%rayray%'
         OR "company" ILIKE '%volvi%';
    `);

    console.log(`\n--- PRODUCTION LEADS SEARCH ---`);
    console.log(`Found ${leads.length} Leads.`);
    leads.forEach(l => {
      console.log(`Lead ID: ${l.id} | Name: ${l.firstName} ${l.lastName} | Company: ${l.company}`);
    });

    const [leadContacts] = await sequelize.query(`
      SELECT * FROM "LeadContacts"
      WHERE "firstName" ILIKE '%swasthik%' 
         OR "firstName" ILIKE '%saud%' 
         OR "firstName" ILIKE '%zeeshan%'
         OR "firstName" ILIKE '%rayray%';
    `);

    console.log(`\n--- PRODUCTION LEADCONTACTS SEARCH ---`);
    console.log(`Found ${leadContacts.length} LeadContacts.`);
    leadContacts.forEach(lc => {
      console.log(`LeadContact ID: ${lc.id} | Name: ${lc.firstName} ${lc.lastName} | LeadID: ${lc.leadId}`);
    });

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await sequelize.close();
  }
}

run();
