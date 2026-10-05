'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const dialect = queryInterface.sequelize.getDialect();

    // Helper to safely add column if not exists
    const safeAddColumn = async (tableName, columnName, options) => {
      try {
        const tableDescription = await queryInterface.describeTable(tableName);
        if (!tableDescription[columnName]) {
          await queryInterface.addColumn(tableName, columnName, options);
          console.log(`[Migration] Added ${columnName} to ${tableName}`);
        } else {
          console.log(`[Migration] Column ${columnName} already exists on ${tableName}, skipping`);
        }
      } catch (err) {
        console.warn(`[Migration] Notice for ${tableName}.${columnName}:`, err.message);
      }
    };

    // 1. Add fields to CampaignMessages
    await safeAddColumn('CampaignMessages', 'channel', {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: 'EMAIL'
    });

    await safeAddColumn('CampaignMessages', 'templateSid', {
      type: Sequelize.STRING,
      allowNull: true,
      defaultValue: null
    });

    await safeAddColumn('CampaignMessages', 'templateVariables', {
      type: Sequelize.TEXT,
      allowNull: true,
      defaultValue: null
    });

    // 2. Add fields to CampaignRecipients
    await safeAddColumn('CampaignRecipients', 'phone', {
      type: Sequelize.STRING,
      allowNull: true,
      defaultValue: null
    });

    await safeAddColumn('CampaignRecipients', 'providerMessageId', {
      type: Sequelize.STRING,
      allowNull: true,
      defaultValue: null
    });

    await safeAddColumn('CampaignRecipients', 'deliveredAt', {
      type: Sequelize.DATE,
      allowNull: true,
      defaultValue: null
    });

    await safeAddColumn('CampaignRecipients', 'readAt', {
      type: Sequelize.DATE,
      allowNull: true,
      defaultValue: null
    });

    // Add indexes for performance
    await queryInterface.addIndex('CampaignMessages', ['channel']).catch(() => null);
    await queryInterface.addIndex('CampaignRecipients', ['phone']).catch(() => null);
    await queryInterface.addIndex('CampaignRecipients', ['providerMessageId']).catch(() => null);

    // 3. Relax NOT NULL constraints on Postgres if applicable
    if (dialect === 'postgres') {
      await queryInterface.sequelize.query('ALTER TABLE "CampaignMessages" ALTER COLUMN "subject" DROP NOT NULL;').catch(() => null);
      await queryInterface.sequelize.query('ALTER TABLE "CampaignMessages" ALTER COLUMN "bodyHtml" DROP NOT NULL;').catch(() => null);
      await queryInterface.sequelize.query('ALTER TABLE "CampaignRecipients" ALTER COLUMN "email" DROP NOT NULL;').catch(() => null);
    }
  },

  async down(queryInterface, Sequelize) {
    const safeRemoveColumn = async (tableName, columnName) => {
      try {
        const tableDescription = await queryInterface.describeTable(tableName);
        if (tableDescription[columnName]) {
          await queryInterface.removeColumn(tableName, columnName);
          console.log(`[Migration] Removed ${columnName} from ${tableName}`);
        }
      } catch (err) {
        console.warn(`[Migration] Notice on rollback for ${tableName}.${columnName}:`, err.message);
      }
    };

    await safeRemoveColumn('CampaignRecipients', 'readAt');
    await safeRemoveColumn('CampaignRecipients', 'deliveredAt');
    await safeRemoveColumn('CampaignRecipients', 'providerMessageId');
    await safeRemoveColumn('CampaignRecipients', 'phone');

    await safeRemoveColumn('CampaignMessages', 'templateVariables');
    await safeRemoveColumn('CampaignMessages', 'templateSid');
    await safeRemoveColumn('CampaignMessages', 'channel');
  }
};
