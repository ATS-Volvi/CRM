const { Sequelize } = require('sequelize');
const db = require('../../database/models/index');

async function run() {
  console.log("--- SMOKE TEST: CRUD OPERATIONS ---");
  try {
    // CREATE
    console.log("1. Creating test Account...");
    const account = await db.Account.create({ name: 'Smoke Test Corp' });
    
    console.log("2. Creating test Contact...");
    const contact = await db.Contact.create({
      accountId: account.id,
      firstName: 'Smoke',
      lastName: 'Tester',
      email: 'smoke@test.com'
    });

    console.log("3. Creating test Deal...");
    const deal = await db.Deal.create({
      accountId: account.id,
      name: 'Smoke Test Deal',
      amount: 10000.00
    });

    console.log("4. Linking Contact to Deal (DealContact)...");
    const dealContact = await db.DealContact.create({
      dealId: deal.id,
      contactId: contact.id,
      role: 'Tester',
      isPrimary: true
    });

    // READ
    console.log("\n5. Reading full Deal tree...");
    const readDeal = await db.Deal.findOne({
      where: { id: deal.id },
      include: [{
        model: db.Contact,
        as: 'dealContacts',
        through: { attributes: ['role', 'isPrimary'] }
      }]
    });
    
    console.log(`   Read Deal: ${readDeal.name}`);
    console.log(`   Found Contacts on Deal: ${readDeal.dealContacts.length}`);
    console.log(`   Contact details: ${readDeal.dealContacts[0].firstName} (${readDeal.dealContacts[0].DealContact.role})`);

    // UPDATE
    console.log("\n6. Updating DealContact role...");
    await db.DealContact.update(
      { role: 'Lead Tester' },
      { where: { id: dealContact.id } }
    );
    
    console.log("\n--- SMOKE TEST SUCCESSFUL ---");

  } catch(e: any) {
    console.error("--- SMOKE TEST FAILED ---");
    console.error(e.message);
  } finally {
    process.exit(0);
  }
}
run();
