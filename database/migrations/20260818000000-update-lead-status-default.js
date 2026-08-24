'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const isSqlite = queryInterface.sequelize.getDialect() === 'sqlite';
    const quoteIdent = (name) => isSqlite ? `\`${name}\`` : `"${name}"`;

    const leadsTable = quoteIdent('Leads');

    // 1. Alter default value of Leads.status to 'NEW' at the database level
    if (!isSqlite) {
      await queryInterface.sequelize.query(`
        ALTER TABLE "Leads" ALTER COLUMN "status" SET DEFAULT 'NEW';
      `).catch((err) => {
        console.warn("Could not alter Leads.status default in Postgres:", err.message);
      });
    }

    // 1.5 Ensure required tables exist
    const allTables = await queryInterface.showAllTables();
    const tableNames = Array.isArray(allTables) ? allTables.map(t => (typeof t === 'object' ? (t.tableName || t.name) : t)) : [];

    if (!tableNames.includes('Contacts')) {
      await queryInterface.createTable('Contacts', {
        id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
        accountId: { type: Sequelize.UUID, allowNull: false, references: { model: 'Accounts', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
        firstName: { type: Sequelize.STRING, allowNull: true },
        lastName: { type: Sequelize.STRING, allowNull: true },
        email: { type: Sequelize.STRING, allowNull: true },
        phone: { type: Sequelize.STRING, allowNull: true },
        role: { type: Sequelize.STRING, allowNull: true },
        isPrimary: { type: Sequelize.BOOLEAN, defaultValue: false },
        sourceChannel: { type: Sequelize.STRING, allowNull: true },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
      }).catch((err) => {
        console.warn("Could not create Contacts table:", err.message);
      });
    }

    if (!tableNames.includes('LeadContacts')) {
      await queryInterface.createTable('LeadContacts', {
        id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
        leadId: { type: Sequelize.UUID, allowNull: false, references: { model: 'Leads', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
        firstName: { type: Sequelize.STRING, allowNull: false },
        lastName: { type: Sequelize.STRING, allowNull: false },
        email: { type: Sequelize.STRING, allowNull: true },
        phone: { type: Sequelize.STRING, allowNull: true },
        role: { type: Sequelize.STRING, allowNull: true },
        message: { type: Sequelize.TEXT, allowNull: true },
        sourceChannel: { type: Sequelize.STRING, allowNull: true },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
      }).catch((err) => {
        console.warn("Could not create LeadContacts table:", err.message);
      });
    }

    if (!tableNames.includes('DealContacts')) {
      await queryInterface.createTable('DealContacts', {
        id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
        dealId: { type: Sequelize.UUID, allowNull: false, references: { model: 'Deals', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
        contactId: { type: Sequelize.UUID, allowNull: false, references: { model: 'Contacts', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
        role: { type: Sequelize.STRING, allowNull: true },
        isPrimary: { type: Sequelize.BOOLEAN, defaultValue: false },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
      }).catch((err) => {
        console.warn("Could not create DealContacts table:", err.message);
      });
    }

    if (!tableNames.includes('WorkspaceSettings')) {
      await queryInterface.createTable('WorkspaceSettings', {
        id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
        key: { type: Sequelize.STRING, allowNull: false, unique: true },
        value: { type: Sequelize.TEXT, allowNull: false },
        description: { type: Sequelize.TEXT, allowNull: true },
        updatedBy: { type: Sequelize.UUID, allowNull: true, references: { model: 'Users', key: 'id' }, onDelete: 'SET NULL', onUpdate: 'CASCADE' },
        createdAt: { type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updatedAt: { type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
      }).catch((err) => {
        console.warn("Could not create WorkspaceSettings table:", err.message);
      });
    }

    if (!tableNames.includes('DealOwners')) {
      await queryInterface.createTable('DealOwners', {
        id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
        dealId: { type: Sequelize.UUID, allowNull: false, references: { model: 'Deals', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
        userId: { type: Sequelize.UUID, allowNull: false, references: { model: 'Users', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
        splitPct: { type: Sequelize.DECIMAL(5, 2), allowNull: false, defaultValue: 100.0 },
        role: { type: Sequelize.STRING, allowNull: true },
        createdAt: { type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updatedAt: { type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
      }).catch((err) => {
        console.warn("Could not create DealOwners table:", err.message);
      });
    }

    if (!tableNames.includes('Campaigns')) {
      await queryInterface.createTable('Campaigns', {
        id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
        name: { type: Sequelize.STRING, allowNull: false },
        code: { type: Sequelize.STRING, allowNull: false, unique: true },
        description: { type: Sequelize.TEXT, allowNull: true },
        channel: { type: Sequelize.STRING, allowNull: false, defaultValue: 'Other' },
        platform: { type: Sequelize.STRING, allowNull: true },
        status: { type: Sequelize.STRING, allowNull: false, defaultValue: 'DRAFT' },
        startDate: { type: Sequelize.DATE, allowNull: true },
        endDate: { type: Sequelize.DATE, allowNull: true },
        budget: { type: Sequelize.DECIMAL(12, 2), defaultValue: 0 },
        actualSpend: { type: Sequelize.DECIMAL(12, 2), allowNull: true },
        currency: { type: Sequelize.STRING, defaultValue: 'INR' },
        ownerId: { type: Sequelize.UUID, allowNull: true, references: { model: 'Users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
        targetAudience: { type: Sequelize.TEXT, allowNull: true },
        objective: { type: Sequelize.STRING, allowNull: true },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
      }).catch((err) => {
        console.warn("Could not create Campaigns table:", err.message);
      });
    }

    if (!tableNames.includes('CampaignAds')) {
      await queryInterface.createTable('CampaignAds', {
        id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
        campaignId: { type: Sequelize.UUID, allowNull: false, references: { model: 'Campaigns', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
        name: { type: Sequelize.STRING, allowNull: false },
        externalId: { type: Sequelize.STRING, allowNull: true },
        platform: { type: Sequelize.STRING, allowNull: true },
        creativeType: { type: Sequelize.STRING, allowNull: true },
        status: { type: Sequelize.STRING, allowNull: false, defaultValue: 'ACTIVE' },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
      }).catch((err) => {
        console.warn("Could not create CampaignAds table:", err.message);
      });
    }

    if (!tableNames.includes('LeadAttributions')) {
      await queryInterface.createTable('LeadAttributions', {
        id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
        leadId: { type: Sequelize.UUID, allowNull: false, references: { model: 'Leads', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
        channel: { type: Sequelize.STRING, allowNull: false },
        sourceType: { type: Sequelize.STRING, allowNull: false },
        sourceName: { type: Sequelize.STRING, allowNull: true },
        sourceEntityId: { type: Sequelize.UUID, allowNull: true },
        referringAccountId: { type: Sequelize.UUID, allowNull: true, references: { model: 'Accounts', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
        campaignId: { type: Sequelize.UUID, allowNull: true, references: { model: 'Campaigns', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
        adId: { type: Sequelize.UUID, allowNull: true, references: { model: 'CampaignAds', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
        landingPage: { type: Sequelize.STRING, allowNull: true },
        referrer: { type: Sequelize.STRING, allowNull: true },
        utmSource: { type: Sequelize.STRING, allowNull: true },
        utmMedium: { type: Sequelize.STRING, allowNull: true },
        utmCampaign: { type: Sequelize.STRING, allowNull: true },
        utmTerm: { type: Sequelize.STRING, allowNull: true },
        utmContent: { type: Sequelize.STRING, allowNull: true },
        clickId: { type: Sequelize.STRING, allowNull: true },
        touchType: { type: Sequelize.STRING, defaultValue: 'FIRST_TOUCH' },
        firstTouchAt: { type: Sequelize.DATE, allowNull: true },
        lastTouchAt: { type: Sequelize.DATE, allowNull: true },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
      }).catch((err) => {
        console.warn("Could not create LeadAttributions table:", err.message);
      });
    }

    if (!tableNames.includes('AttributionEvents')) {
      await queryInterface.createTable('AttributionEvents', {
        id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
        leadId: { type: Sequelize.UUID, allowNull: true, references: { model: 'Leads', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
        opportunityId: { type: Sequelize.UUID, allowNull: true, references: { model: 'Deals', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
        channel: { type: Sequelize.STRING, allowNull: false },
        sourceType: { type: Sequelize.STRING, allowNull: false },
        sourceName: { type: Sequelize.STRING, allowNull: true },
        campaignId: { type: Sequelize.UUID, allowNull: true, references: { model: 'Campaigns', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
        adId: { type: Sequelize.UUID, allowNull: true, references: { model: 'CampaignAds', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
        timestamp: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        metadata: { type: Sequelize.TEXT, defaultValue: '{}' },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
      }).catch((err) => {
        console.warn("Could not create AttributionEvents table:", err.message);
      });
    }

    if (!tableNames.includes('Fulfillments')) {
      await queryInterface.createTable('Fulfillments', {
        id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
        orderId: { type: Sequelize.UUID, allowNull: false, references: { model: 'PurchaseOrders', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
        status: { type: Sequelize.STRING, allowNull: false, defaultValue: 'PENDING' },
        priority: { type: Sequelize.STRING, defaultValue: 'MEDIUM' },
        assignedTeam: { type: Sequelize.STRING, defaultValue: 'Operations / Supply' },
        assignedUserId: { type: Sequelize.UUID, allowNull: true, references: { model: 'Users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
        plannedStartDate: { type: Sequelize.DATE, allowNull: true },
        plannedCompletionDate: { type: Sequelize.DATE, allowNull: true },
        actualStartDate: { type: Sequelize.DATE, allowNull: true },
        actualCompletionDate: { type: Sequelize.DATE, allowNull: true },
        requestedDeliveryDate: { type: Sequelize.DATE, allowNull: true },
        actualDeliveryDate: { type: Sequelize.DATE, allowNull: true },
        deliveryAddress: { type: Sequelize.TEXT, allowNull: true },
        dispatchReference: { type: Sequelize.STRING, allowNull: true },
        carrier: { type: Sequelize.STRING, allowNull: true },
        notes: { type: Sequelize.TEXT, allowNull: true },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
      }).catch((err) => {
        console.warn("Could not create Fulfillments table:", err.message);
      });
    }

    if (!tableNames.includes('FulfillmentItems')) {
      await queryInterface.createTable('FulfillmentItems', {
        id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
        fulfillmentId: { type: Sequelize.UUID, allowNull: false, references: { model: 'Fulfillments', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
        quoteLineItemId: { type: Sequelize.UUID, allowNull: true, references: { model: 'QuoteLineItems', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
        productServiceId: { type: Sequelize.UUID, allowNull: true, references: { model: 'PriceBookEntries', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
        description: { type: Sequelize.TEXT, allowNull: false },
        quantityPlanned: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
        quantityAllocated: { type: Sequelize.INTEGER, defaultValue: 0 },
        quantityInProduction: { type: Sequelize.INTEGER, defaultValue: 0 },
        quantityReady: { type: Sequelize.INTEGER, defaultValue: 0 },
        quantityDispatched: { type: Sequelize.INTEGER, defaultValue: 0 },
        quantityDelivered: { type: Sequelize.INTEGER, defaultValue: 0 },
        status: { type: Sequelize.STRING, allowNull: false, defaultValue: 'PENDING' },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
      }).catch((err) => {
        console.warn("Could not create FulfillmentItems table:", err.message);
      });
    }

    // 2. Ensure convertedContactId, convertedAccountId, convertedDealId exist on Leads table
    const tableInfo = await queryInterface.describeTable('Leads').catch(() => ({}));

    if (!tableInfo.convertedContactId) {
      await queryInterface.addColumn('Leads', 'convertedContactId', {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'Contacts',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      }).catch((err) => {
        console.warn("Could not add convertedContactId to Leads:", err.message);
      });
    }

    if (!tableInfo.convertedAccountId) {
      await queryInterface.addColumn('Leads', 'convertedAccountId', {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'Accounts',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      }).catch((err) => {
        console.warn("Could not add convertedAccountId to Leads:", err.message);
      });
    }

    if (!tableInfo.convertedDealId) {
      await queryInterface.addColumn('Leads', 'convertedDealId', {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'Deals',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      }).catch((err) => {
        console.warn("Could not add convertedDealId to Leads:", err.message);
      });
    }

    if (!tableInfo.sourceEntityId) {
      await queryInterface.addColumn('Leads', 'sourceEntityId', {
        type: Sequelize.UUID,
        allowNull: true
      }).catch((err) => {
        console.warn("Could not add sourceEntityId to Leads:", err.message);
      });
    }

    const dealsTableInfo = await queryInterface.describeTable('Deals').catch(() => ({}));
    if (!dealsTableInfo.sourceEntityId) {
      await queryInterface.addColumn('Deals', 'sourceEntityId', {
        type: Sequelize.UUID,
        allowNull: true
      }).catch((err) => {
        console.warn("Could not add sourceEntityId to Deals:", err.message);
      });
    }

    // 3. Ensure any lingering 'New' statuses are normalized to 'NEW'
    await queryInterface.sequelize.query(`
      UPDATE ${leadsTable}
      SET ${quoteIdent('status')} = 'NEW'
      WHERE ${quoteIdent('status')} = 'New' OR ${quoteIdent('status')} = 'New Lead' OR ${quoteIdent('status')} IS NULL;
    `).catch(() => {});
  },

  down: async (queryInterface, Sequelize) => {
    const isSqlite = queryInterface.sequelize.getDialect() === 'sqlite';
    if (!isSqlite) {
      await queryInterface.sequelize.query(`
        ALTER TABLE "Leads" ALTER COLUMN "status" SET DEFAULT 'New';
      `).catch(() => {});
    }
  }
};
