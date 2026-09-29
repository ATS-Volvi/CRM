'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = ['Deals', 'Quotes', 'Accounts', 'PurchaseOrders', 'Invoices'];
    
    // 1. Get default currency from OrgSettings if available
    let defaultCurrency = 'SAR';
    try {
      const allTables = await queryInterface.showAllTables();
      const tableNames = Array.isArray(allTables)
        ? allTables.map((t) => (typeof t === 'object' ? t.tableName || t.name : t))
        : [];
      if (tableNames.includes('OrgSettings')) {
        const [orgRows] = await queryInterface.sequelize.query(
          'SELECT "defaultCurrency" FROM "OrgSettings" LIMIT 1;'
        );
        if (orgRows && orgRows.length > 0 && orgRows[0].defaultCurrency) {
          defaultCurrency = orgRows[0].defaultCurrency;
        }
      }
    } catch (e) {
      console.warn('Could not read OrgSettings, using SAR default:', e.message);
    }

    // 2. Add currency column if missing and backfill
    for (const tableName of tables) {
      const tableDescription = await queryInterface.describeTable(tableName);
      if (!tableDescription.currency) {
        await queryInterface.addColumn(tableName, 'currency', {
          type: Sequelize.STRING(3),
          allowNull: false,
          defaultValue: defaultCurrency,
        });
      }

      await queryInterface.sequelize.query(
        `UPDATE "${tableName}" SET "currency" = :currency WHERE "currency" IS NULL;`,
        {
          replacements: { currency: defaultCurrency },
        }
      );
    }
  },

  async down(queryInterface, Sequelize) {
    const tables = ['Deals', 'Quotes', 'Accounts', 'PurchaseOrders', 'Invoices'];
    for (const tableName of tables) {
      const tableDescription = await queryInterface.describeTable(tableName);
      if (tableDescription.currency) {
        await queryInterface.removeColumn(tableName, 'currency');
      }
    }
  }
};
