'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const isSqlite = queryInterface.sequelize.getDialect() === 'sqlite';

    // 1. Create Campaigns Table
    const tableInfoCampaigns = await queryInterface.describeTable('Campaigns').catch(() => null);
    if (!tableInfoCampaigns) {
      await queryInterface.createTable('Campaigns', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true,
          allowNull: false
        },
        name: {
          type: Sequelize.STRING,
          allowNull: false
        },
        code: {
          type: Sequelize.STRING,
          allowNull: false,
          unique: true
        },
        description: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        channel: {
          type: Sequelize.STRING,
          allowNull: false,
          defaultValue: 'Other'
        },
        platform: {
          type: Sequelize.STRING,
          allowNull: true
        },
        status: {
          type: Sequelize.STRING,
          allowNull: false,
          defaultValue: 'DRAFT'
        },
        startDate: {
          type: Sequelize.DATE,
          allowNull: true
        },
        endDate: {
          type: Sequelize.DATE,
          allowNull: true
        },
        budget: {
          type: Sequelize.DECIMAL(12, 2),
          allowNull: true,
          defaultValue: 0
        },
        actualSpend: {
          type: Sequelize.DECIMAL(12, 2),
          allowNull: true
        },
        currency: {
          type: Sequelize.STRING,
          defaultValue: 'INR'
        },
        ownerId: {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: 'Users', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL'
        },
        targetAudience: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        objective: {
          type: Sequelize.STRING,
          allowNull: true
        },
        createdAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
        },
        updatedAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
        }
      });
    }

    // 2. Create CampaignAds Table
    const tableInfoAds = await queryInterface.describeTable('CampaignAds').catch(() => null);
    if (!tableInfoAds) {
      await queryInterface.createTable('CampaignAds', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true,
          allowNull: false
        },
        campaignId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'Campaigns', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE'
        },
        name: {
          type: Sequelize.STRING,
          allowNull: false
        },
        externalId: {
          type: Sequelize.STRING,
          allowNull: true
        },
        platform: {
          type: Sequelize.STRING,
          allowNull: true
        },
        creativeType: {
          type: Sequelize.STRING,
          allowNull: true
        },
        status: {
          type: Sequelize.STRING,
          allowNull: false,
          defaultValue: 'ACTIVE'
        },
        createdAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
        },
        updatedAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
        }
      });
    }

    // 3. Create LeadAttributions Table
    const tableInfoAttributions = await queryInterface.describeTable('LeadAttributions').catch(() => null);
    if (!tableInfoAttributions) {
      await queryInterface.createTable('LeadAttributions', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true,
          allowNull: false
        },
        leadId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'Leads', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE'
        },
        channel: {
          type: Sequelize.STRING,
          allowNull: false
        },
        sourceType: {
          type: Sequelize.STRING,
          allowNull: false
        },
        sourceName: {
          type: Sequelize.STRING,
          allowNull: true
        },
        sourceEntityId: {
          type: Sequelize.UUID,
          allowNull: true
        },
        referringAccountId: {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: 'Accounts', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL'
        },
        campaignId: {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: 'Campaigns', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL'
        },
        adId: {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: 'CampaignAds', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL'
        },
        landingPage: {
          type: Sequelize.STRING,
          allowNull: true
        },
        referrer: {
          type: Sequelize.STRING,
          allowNull: true
        },
        utmSource: {
          type: Sequelize.STRING,
          allowNull: true
        },
        utmMedium: {
          type: Sequelize.STRING,
          allowNull: true
        },
        utmCampaign: {
          type: Sequelize.STRING,
          allowNull: true
        },
        utmTerm: {
          type: Sequelize.STRING,
          allowNull: true
        },
        utmContent: {
          type: Sequelize.STRING,
          allowNull: true
        },
        clickId: {
          type: Sequelize.STRING,
          allowNull: true
        },
        touchType: {
          type: Sequelize.STRING,
          defaultValue: 'FIRST_TOUCH'
        },
        firstTouchAt: {
          type: Sequelize.DATE,
          allowNull: true
        },
        lastTouchAt: {
          type: Sequelize.DATE,
          allowNull: true
        },
        createdAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
        },
        updatedAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
        }
      });
    }

    // 4. Create AttributionEvents Table (Multi-touch history log)
    const tableInfoEvents = await queryInterface.describeTable('AttributionEvents').catch(() => null);
    if (!tableInfoEvents) {
      await queryInterface.createTable('AttributionEvents', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true,
          allowNull: false
        },
        leadId: {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: 'Leads', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE'
        },
        opportunityId: {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: 'Deals', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL'
        },
        channel: {
          type: Sequelize.STRING,
          allowNull: false
        },
        sourceType: {
          type: Sequelize.STRING,
          allowNull: false
        },
        sourceName: {
          type: Sequelize.STRING,
          allowNull: true
        },
        campaignId: {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: 'Campaigns', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL'
        },
        adId: {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: 'CampaignAds', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL'
        },
        timestamp: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
        },
        metadata: {
          type: Sequelize.TEXT,
          defaultValue: '{}'
        },
        createdAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
        }
      });
    }

    // 5. Extend Leads table with explicit attribution columns
    const leadsInfo = await queryInterface.describeTable('Leads').catch(() => ({}));
    if (!leadsInfo.campaignId) {
      await queryInterface.addColumn('Leads', 'campaignId', {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'Campaigns', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      }).catch(() => {});
    }
    if (!leadsInfo.adId) {
      await queryInterface.addColumn('Leads', 'adId', {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'CampaignAds', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      }).catch(() => {});
    }
    if (!leadsInfo.sourceType) {
      await queryInterface.addColumn('Leads', 'sourceType', {
        type: Sequelize.STRING,
        allowNull: true
      }).catch(() => {});
    }
    if (!leadsInfo.sourceChannel) {
      await queryInterface.addColumn('Leads', 'sourceChannel', {
        type: Sequelize.STRING,
        allowNull: true
      }).catch(() => {});
    }
    if (!leadsInfo.sourceName) {
      await queryInterface.addColumn('Leads', 'sourceName', {
        type: Sequelize.STRING,
        allowNull: true
      }).catch(() => {});
    }
    if (!leadsInfo.referringAccountId) {
      await queryInterface.addColumn('Leads', 'referringAccountId', {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'Accounts', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      }).catch(() => {});
    }
    if (!leadsInfo.firstTouchAttribution) {
      await queryInterface.addColumn('Leads', 'firstTouchAttribution', {
        type: Sequelize.TEXT,
        allowNull: true
      }).catch(() => {});
    }
    if (!leadsInfo.lastTouchAttribution) {
      await queryInterface.addColumn('Leads', 'lastTouchAttribution', {
        type: Sequelize.TEXT,
        allowNull: true
      }).catch(() => {});
    }

    // 6. Extend Deals (Opportunities) table with attribution columns
    const dealsInfo = await queryInterface.describeTable('Deals').catch(() => ({}));
    if (!dealsInfo.campaignId) {
      await queryInterface.addColumn('Deals', 'campaignId', {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'Campaigns', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      }).catch(() => {});
    }
    if (!dealsInfo.adId) {
      await queryInterface.addColumn('Deals', 'adId', {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'CampaignAds', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      }).catch(() => {});
    }
    if (!dealsInfo.sourceType) {
      await queryInterface.addColumn('Deals', 'sourceType', {
        type: Sequelize.STRING,
        allowNull: true
      }).catch(() => {});
    }
    if (!dealsInfo.sourceChannel) {
      await queryInterface.addColumn('Deals', 'sourceChannel', {
        type: Sequelize.STRING,
        allowNull: true
      }).catch(() => {});
    }
    if (!dealsInfo.sourceName) {
      await queryInterface.addColumn('Deals', 'sourceName', {
        type: Sequelize.STRING,
        allowNull: true
      }).catch(() => {});
    }
    if (!dealsInfo.referringAccountId) {
      await queryInterface.addColumn('Deals', 'referringAccountId', {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'Accounts', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      }).catch(() => {});
    }
    if (!dealsInfo.firstTouchAttribution) {
      await queryInterface.addColumn('Deals', 'firstTouchAttribution', {
        type: Sequelize.TEXT,
        allowNull: true
      }).catch(() => {});
    }
    if (!dealsInfo.lastTouchAttribution) {
      await queryInterface.addColumn('Deals', 'lastTouchAttribution', {
        type: Sequelize.TEXT,
        allowNull: true
      }).catch(() => {});
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('AttributionEvents').catch(() => {});
    await queryInterface.dropTable('LeadAttributions').catch(() => {});
    await queryInterface.dropTable('CampaignAds').catch(() => {});
    await queryInterface.dropTable('Campaigns').catch(() => {});
  }
};
