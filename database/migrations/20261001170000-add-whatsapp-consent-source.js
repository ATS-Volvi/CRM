'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
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

    await safeAddColumn('Leads', 'whatsappConsentSource', {
      type: Sequelize.STRING,
      allowNull: true,
      defaultValue: null
    });

    await safeAddColumn('Contacts', 'whatsappConsentSource', {
      type: Sequelize.STRING,
      allowNull: true,
      defaultValue: null
    });
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

    await safeRemoveColumn('Leads', 'whatsappConsentSource');
    await safeRemoveColumn('Contacts', 'whatsappConsentSource');
  }
};
