const { Sequelize } = require('sequelize');
const db = require('../../database/models/index');

async function run() {
  const Op = Sequelize.Op;
  const contacts = await db.LeadContact.findAll({
    where: {
      [Op.or]: [
        { firstName: 'Swasthik' },
        { firstName: 'Saud' },
        { firstName: 'Zeeshan' },
        { firstName: 'Rayray' }
      ]
    }
  });
  console.log(`Found ${contacts.length} matching LeadContacts.`);
  contacts.forEach(c => console.log(`  - LC: ${c.firstName} ${c.lastName}`));
  process.exit(0);
}
run().catch(console.error);
