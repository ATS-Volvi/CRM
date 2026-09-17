'use strict';

const { v4: uuidv4 } = require('uuid');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Create Subscriptions
    await queryInterface.createTable('Subscriptions', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      accountId: { type: Sequelize.UUID, allowNull: false },
      planName: { type: Sequelize.STRING, allowNull: false },
      status: { type: Sequelize.STRING, defaultValue: 'Active' },
      startDate: { type: Sequelize.DATEONLY, allowNull: false },
      endDate: { type: Sequelize.DATEONLY, allowNull: true },
      mrr: { type: Sequelize.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
      billingCycle: { type: Sequelize.STRING, defaultValue: 'Monthly' },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
    });

    // 2. Create CampaignMembers
    await queryInterface.createTable('CampaignMembers', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      campaignId: { type: Sequelize.UUID, allowNull: false },
      leadId: { type: Sequelize.UUID, allowNull: false },
      status: { type: Sequelize.STRING, defaultValue: 'Sent' },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
    });

    // 3. Alter Accounts
    await queryInterface.addColumn('Accounts', 'parentAccountId', { type: Sequelize.UUID, allowNull: true });
    await queryInterface.addColumn('Accounts', 'revenue', { type: Sequelize.DECIMAL(15, 2), allowNull: true });
    await queryInterface.addColumn('Accounts', 'employeeCount', { type: Sequelize.INTEGER, allowNull: true });

    // 4. Data Migration for Lead.campaign
    // Get unique campaign names from Leads that don't already exist in Campaigns
    const [existingLeads] = await queryInterface.sequelize.query('SELECT id, campaign FROM "Leads" WHERE campaign IS NOT NULL AND campaign != \'\'');
    
    if (existingLeads && existingLeads.length > 0) {
      console.log(`[Data Migration] Found ${existingLeads.length} leads with a legacy campaign value.`);

      const uniqueCampaignNames = [...new Set(existingLeads.map(l => l.campaign))];
      console.log(`[Data Migration] Found ${uniqueCampaignNames.length} distinct campaign names.`);

      // Get existing campaigns
      const [existingCampaigns] = await queryInterface.sequelize.query('SELECT id, name FROM "Campaigns"');
      const existingCampaignMap = new Map();
      if (existingCampaigns) {
        existingCampaigns.forEach(c => existingCampaignMap.set(c.name, c.id));
      }

      const newCampaignsToInsert = [];
      const campaignNameToId = new Map(existingCampaignMap);

      for (const name of uniqueCampaignNames) {
        if (!campaignNameToId.has(name)) {
          const newId = uuidv4();
          campaignNameToId.set(name, newId);
          newCampaignsToInsert.push({
            id: newId,
            name: name,
            code: name.replace(/[^a-zA-Z0-9]/g, '-').toUpperCase().substring(0, 50), // Safe code string
            channel: 'Other',
            status: 'COMPLETED',
            createdAt: new Date(),
            updatedAt: new Date()
          });
        }
      }

      if (newCampaignsToInsert.length > 0) {
        await queryInterface.bulkInsert('Campaigns', newCampaignsToInsert);
        console.log(`[Data Migration] Inserted ${newCampaignsToInsert.length} new Campaigns.`);
      }

      const campaignMembersToInsert = [];
      for (const lead of existingLeads) {
        const cId = campaignNameToId.get(lead.campaign);
        if (cId) {
          campaignMembersToInsert.push({
            id: uuidv4(),
            campaignId: cId,
            leadId: lead.id,
            status: 'Sent',
            createdAt: new Date(),
            updatedAt: new Date()
          });
        }
      }

      if (campaignMembersToInsert.length > 0) {
        await queryInterface.bulkInsert('CampaignMembers', campaignMembersToInsert);
        console.log(`[Data Migration] Inserted ${campaignMembersToInsert.length} CampaignMembers.`);
      }
    } else {
      console.log(`[Data Migration] No legacy campaign data found in Leads.`);
    }

    // 5. Drop Lead.campaign column
    if (queryInterface.sequelize.options.dialect !== 'sqlite') {
      await queryInterface.removeColumn('Leads', 'campaign');
    } else {
      console.log('[Data Migration] Skipping DROP COLUMN for Leads.campaign on SQLite for compatibility.');
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Leads', 'campaign', { type: Sequelize.STRING, allowNull: true });
    
    await queryInterface.removeColumn('Accounts', 'parentAccountId');
    await queryInterface.removeColumn('Accounts', 'revenue');
    await queryInterface.removeColumn('Accounts', 'employeeCount');

    await queryInterface.dropTable('CampaignMembers');
    await queryInterface.dropTable('Subscriptions');
  }
};
