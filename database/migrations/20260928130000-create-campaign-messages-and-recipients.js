'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Create CampaignMessages Table
    const tableInfoMessages = await queryInterface.describeTable('CampaignMessages').catch(() => null);
    if (!tableInfoMessages) {
      await queryInterface.createTable('CampaignMessages', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true,
          allowNull: false
        },
        campaignId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'Campaigns',
            key: 'id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE'
        },
        name: {
          type: Sequelize.STRING,
          allowNull: false
        },
        subject: {
          type: Sequelize.STRING,
          allowNull: false
        },
        bodyHtml: {
          type: Sequelize.TEXT,
          allowNull: false
        },
        audienceFilter: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        status: {
          type: Sequelize.STRING,
          allowNull: false,
          defaultValue: 'DRAFT'
        },
        scheduledAt: {
          type: Sequelize.DATE,
          allowNull: true
        },
        sentAt: {
          type: Sequelize.DATE,
          allowNull: true
        },
        createdBy: {
          type: Sequelize.UUID,
          allowNull: true,
          references: {
            model: 'Users',
            key: 'id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL'
        },
        createdAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn('NOW')
        },
        updatedAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn('NOW')
        }
      });

      await queryInterface.addIndex('CampaignMessages', ['campaignId']).catch(() => null);
      await queryInterface.addIndex('CampaignMessages', ['status']).catch(() => null);
    }

    // 2. Create CampaignRecipients Table
    const tableInfoRecipients = await queryInterface.describeTable('CampaignRecipients').catch(() => null);
    if (!tableInfoRecipients) {
      await queryInterface.createTable('CampaignRecipients', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true,
          allowNull: false
        },
        campaignMessageId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'CampaignMessages',
            key: 'id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE'
        },
        leadId: {
          type: Sequelize.UUID,
          allowNull: true,
          references: {
            model: 'Leads',
            key: 'id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL'
        },
        email: {
          type: Sequelize.STRING,
          allowNull: false
        },
        status: {
          type: Sequelize.STRING,
          allowNull: false,
          defaultValue: 'QUEUED'
        },
        skipReason: {
          type: Sequelize.STRING,
          allowNull: true
        },
        sentAt: {
          type: Sequelize.DATE,
          allowNull: true
        },
        openedAt: {
          type: Sequelize.DATE,
          allowNull: true
        },
        unsubscribedAt: {
          type: Sequelize.DATE,
          allowNull: true
        },
        error: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        createdAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn('NOW')
        }
      });

      await queryInterface.addIndex('CampaignRecipients', ['campaignMessageId']).catch(() => null);
      await queryInterface.addIndex('CampaignRecipients', ['leadId']).catch(() => null);
      await queryInterface.addIndex('CampaignRecipients', ['email']).catch(() => null);
      await queryInterface.addIndex('CampaignRecipients', ['status']).catch(() => null);
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('CampaignRecipients').catch(() => null);
    await queryInterface.dropTable('CampaignMessages').catch(() => null);
  }
};
