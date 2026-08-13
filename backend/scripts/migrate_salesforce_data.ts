import { Sequelize } from 'sequelize';
const crypto = require('crypto');
const db = require('../../database/models/index');

async function run() {
  console.log('--- STARTING SALESFORCE DATA MIGRATION ---');

  // 1. Get all leads with their contacts
  const leads = await db.Lead.findAll({
    include: [{ model: db.LeadContact, as: 'contacts' }]
  });
  console.log(`Found ${leads.length} leads to process.`);

  for (const lead of leads) {
    console.log(`\nProcessing Lead: ${lead.firstName} ${lead.lastName} (${lead.company})`);
    
    // 2. Ensure Account exists
    let account = await db.Account.findOne({
      where: { name: lead.company || `${lead.firstName} ${lead.lastName}`.trim() }
    });

    if (!account) {
      account = await db.Account.create({
        id: crypto.randomUUID(),
        name: lead.company || `${lead.firstName} ${lead.lastName}`.trim(),
        primaryContactName: `${lead.firstName} ${lead.lastName}`.trim(),
        email: lead.email,
        phone: lead.phone,
        industry: lead.industry || 'General'
      });
      console.log(`  -> Created new Account: ${account.name}`);
    } else {
      console.log(`  -> Using existing Account: ${account.name}`);
    }

    // 3. Promote primary Lead to Contact
    const primaryContact = await db.Contact.create({
      id: crypto.randomUUID(),
      accountId: account.id,
      firstName: lead.firstName,
      lastName: lead.lastName,
      email: lead.email,
      phone: lead.phone,
      role: 'Primary Contact',
      sourceChannel: lead.source,
      createdAt: lead.createdAt
    });
    console.log(`  -> Created Primary Contact: ${primaryContact.firstName}`);

    // 4. Convert Lead to Deal (if doesn't exist)
    let primaryDeal = await db.Deal.findOne({ where: { leadId: lead.id } });
    
    if (!primaryDeal) {
      const stage = await db.PipelineStage.findOne({ order: [['order', 'ASC']] });
      primaryDeal = await db.Deal.create({
        id: crypto.randomUUID(),
        name: lead.company ? `${lead.company} Opportunity` : `${lead.firstName} Opportunity`,
        amount: lead.leadScore ? lead.leadScore * 1000 : 50000,
        stageId: stage ? stage.id : null,
        leadId: lead.id,
        ownerId: lead.assignedToId,
        accountId: account.id
      });
      console.log(`  -> Created Primary Deal: ${primaryDeal.name}`);
    } else {
      await primaryDeal.update({ accountId: account.id });
      console.log(`  -> Updated existing Primary Deal with accountId`);
    }

    // Link primary contact to primary deal
    await db.DealContact.create({
      id: crypto.randomUUID(),
      dealId: primaryDeal.id,
      contactId: primaryContact.id,
      role: 'Decision Maker',
      isPrimary: true
    });

    // 5. The Deal Splitter logic for LeadContacts
    if (lead.contacts && lead.contacts.length > 0) {
      const originalMessage = lead.rawPayload ? JSON.parse(lead.rawPayload).message?.toLowerCase() : null;

      for (const lc of lead.contacts) {
        const lcMessage = lc.message?.toLowerCase();

        // Convert LeadContact to Contact
        const secondaryContact = await db.Contact.create({
          id: crypto.randomUUID(),
          accountId: account.id,
          firstName: lc.firstName,
          lastName: lc.lastName,
          email: lc.email,
          phone: lc.phone,
          role: lc.role,
          sourceChannel: lc.sourceChannel,
          createdAt: lc.createdAt
        });

        // Determine if this should be a new Deal or attached to the existing one
        const isDifferentService = lcMessage && originalMessage && lcMessage !== originalMessage && lcMessage.length > 10;

        if (isDifferentService) {
          console.log(`  -> Splitter: Creating NEW Deal for Contact ${secondaryContact.firstName} (Different Service Requested)`);
          const newDeal = await db.Deal.create({
            id: crypto.randomUUID(),
            name: `${account.name} - ${secondaryContact.firstName} Opportunity`,
            amount: 50000,
            stageId: primaryDeal.stageId,
            leadId: lead.id, // Linking back to original lead for traceability
            ownerId: lead.assignedToId,
            accountId: account.id
          });

          await db.DealContact.create({
            id: crypto.randomUUID(),
            dealId: newDeal.id,
            contactId: secondaryContact.id,
            role: 'Initiator',
            isPrimary: true
          });
        } else {
          console.log(`  -> Splitter: Attaching Contact ${secondaryContact.firstName} to Primary Deal (Same Service/No Msg)`);
          await db.DealContact.create({
            id: crypto.randomUUID(),
            dealId: primaryDeal.id,
            contactId: secondaryContact.id,
            role: 'Secondary Contact',
            isPrimary: false
          });
        }
      }
    }
  }

  console.log('\n--- VERIFICATION: Volvitech Deals ---');
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
        console.log(`  - Contact: ${c.firstName} (Role: ${c.DealContact.role}, isPrimary: ${c.DealContact.isPrimary})`);
      });
    });
  }

  process.exit(0);
}

run().catch(console.error);
