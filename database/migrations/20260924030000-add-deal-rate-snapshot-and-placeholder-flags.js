'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();

    // 1. Add exchangeRateToOrg and amountInOrgCurrency to Deals
    if (tables.includes('Deals')) {
      const dealCols = await queryInterface.describeTable('Deals');
      if (!dealCols.exchangeRateToOrg) {
        await queryInterface.addColumn('Deals', 'exchangeRateToOrg', {
          type: Sequelize.DECIMAL(18, 6),
          allowNull: true,
        });
      }
      if (!dealCols.amountInOrgCurrency) {
        await queryInterface.addColumn('Deals', 'amountInOrgCurrency', {
          type: Sequelize.DECIMAL(15, 2),
          allowNull: true,
        });
      }
    }

    // 2. Add needsReview and isPlaceholder to ExchangeRates
    if (tables.includes('ExchangeRates')) {
      const rateCols = await queryInterface.describeTable('ExchangeRates');
      if (!rateCols.needsReview) {
        await queryInterface.addColumn('ExchangeRates', 'needsReview', {
          type: Sequelize.BOOLEAN,
          defaultValue: false,
        });
      }
      if (!rateCols.isPlaceholder) {
        await queryInterface.addColumn('ExchangeRates', 'isPlaceholder', {
          type: Sequelize.BOOLEAN,
          defaultValue: false,
        });
      }

      // Update placeholder flags for INR rates
      await queryInterface.sequelize.query(`
        UPDATE "ExchangeRates"
        SET "needsReview" = 1, "isPlaceholder" = 1
        WHERE "fromCurrency" = 'INR' OR "toCurrency" = 'INR';
      `);
    }
  },

  async down(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();
    if (tables.includes('Deals')) {
      const dealCols = await queryInterface.describeTable('Deals');
      if (dealCols.exchangeRateToOrg) {
        await queryInterface.removeColumn('Deals', 'exchangeRateToOrg');
      }
      if (dealCols.amountInOrgCurrency) {
        await queryInterface.removeColumn('Deals', 'amountInOrgCurrency');
      }
    }
    if (tables.includes('ExchangeRates')) {
      const rateCols = await queryInterface.describeTable('ExchangeRates');
      if (rateCols.needsReview) {
        await queryInterface.removeColumn('ExchangeRates', 'needsReview');
      }
      if (rateCols.isPlaceholder) {
        await queryInterface.removeColumn('ExchangeRates', 'isPlaceholder');
      }
    }
  }
};
