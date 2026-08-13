const { Sequelize } = require('sequelize');
const db = require('../../database/models/index');

async function run() {
  const Op = Sequelize.Op;
  const leads = await db.Lead.findAll({
    where: {
      [Op.or]: [
        { company: { [Op.like]: '%Volvi%' } },
        { firstName: 'Swasthik' },
        { firstName: 'Saud' }
      ]
    },
    include: [{ model: db.LeadContact, as: 'contacts' }]
  });
  
  console.log(`Found ${leads.length} matching leads.`);
  leads.forEach(l => {
    console.log(`Lead: ${l.firstName} ${l.lastName} - ${l.company}`);
    if (l.contacts) {
      l.contacts.forEach(c => console.log(`  - LC: ${c.firstName} ${c.lastName}`));
    }
  });

  const account = await db.Account.findOne({
    where: { name: { [Op.like]: '%Volvi%' } }
  });
  if (account) {
    console.log(`Account found: ${account.name}`);
    const deals = await db.Deal.findAll({ 
      where: { accountId: account.id },
      include: [{ model: db.Contact, through: db.DealContact, as: 'dealContacts' }]
    });
    console.log(`Active Deals: ${deals.length}`);
    deals.forEach((d, idx) => {
      console.log(`Deal ${idx+1}: ${d.name}`);
      d.dealContacts.forEach(c => {
        console.log(`  - Contact: ${c.firstName} ${c.lastName || ''} (Role: ${c.DealContact.role}, isPrimary: ${c.DealContact.isPrimary})`);
      });
    });
  } else {
    console.log("Still no Account matching Volvitech.");
  }
  process.exit(0);
}
run().catch(console.error);
