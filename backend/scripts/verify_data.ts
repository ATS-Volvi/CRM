import { Sequelize } from 'sequelize';
const db = require('../../database/models/index');

async function run() {
  console.log('--- 1. Volvitech Migration State ---');
  const volvitech = await db.Account.findOne({ where: { name: 'Volvitech' } });
  if (volvitech) {
    const deals = await db.Deal.findAll({ 
      where: { accountId: volvitech.id },
      include: [{ model: db.Contact, through: db.DealContact, as: 'dealContacts' }]
    });

    console.log(`Volvitech has ${deals.length} active Deals.`);
    deals.forEach((d: any, idx: number) => {
      console.log(`Deal ${idx+1}: ${d.name}`);
      d.dealContacts.forEach((c: any) => {
        console.log(`  - Contact: ${c.firstName} ${c.lastName || ''} (Role: ${c.DealContact.role}, isPrimary: ${c.DealContact.isPrimary})`);
      });
    });
  } else {
    console.log("No Volvitech Account found in DB.");
  }

  console.log('\n--- 2. Old Data Intact Check ---');
  try {
    const oldLeads = await db.Lead.count();
    const oldLeadContacts = await db.LeadContact.count();
    const accounts = await db.Account.count();
    console.log(`Old Leads intact: ${oldLeads}`);
    console.log(`Old LeadContacts intact: ${oldLeadContacts}`);
    console.log(`Accounts (formerly Customers) count: ${accounts}`);
  } catch(e: any) {
    console.log("Error querying old data:", e.message);
  }

  console.log('\n--- 3. Foreign Key Rewiring Check ---');
  try {
    const asset = await db.Asset.findOne({ include: ['customer', 'deal'] });
    if (asset) console.log(`Asset ${asset.id} is linked to Account: ${asset.customer?.name} and Deal: ${asset.deal?.name}`);
    else console.log("No Assets found to check.");

    const quote = await db.Quote.findOne({ include: ['deal'] });
    if (quote) console.log(`Quote ${quote.id} is linked to Deal: ${quote.deal?.name}`);
    else console.log("No Quotes found to check.");

    const activity = await db.Activity.findOne({ include: ['customer', 'lead'] });
    if (activity) console.log(`Activity ${activity.id} is linked to Account: ${activity.customer?.name} and Lead: ${activity.lead?.company || activity.leadId}`);
    else console.log("No Activities found to check.");
  } catch(e: any) {
    console.log("Error querying foreign keys:", e.message);
  }

  process.exit(0);
}
run().catch(console.error);
