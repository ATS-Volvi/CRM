'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable('QuoteLineItems').catch(() => ({}));

    if (!tableInfo.catalogItemId) {
      await queryInterface.addColumn('QuoteLineItems', 'catalogItemId', {
        type: Sequelize.UUID,
        allowNull: true
      });
    }

    if (!tableInfo.discount) {
      await queryInterface.addColumn('QuoteLineItems', 'discount', {
        type: Sequelize.FLOAT,
        allowNull: true,
        defaultValue: 0
      });
    }

    if (!tableInfo.tax) {
      await queryInterface.addColumn('QuoteLineItems', 'tax', {
        type: Sequelize.FLOAT,
        allowNull: true,
        defaultValue: 0
      });
    }

    if (!tableInfo.totalAmount) {
      await queryInterface.addColumn('QuoteLineItems', 'totalAmount', {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true
      });
    }

    if (!tableInfo.isCustom) {
      await queryInterface.addColumn('QuoteLineItems', 'isCustom', {
        type: Sequelize.BOOLEAN,
        allowNull: true,
        defaultValue: false
      });
    }

    if (!tableInfo.customDescription) {
      await queryInterface.addColumn('QuoteLineItems', 'customDescription', {
        type: Sequelize.TEXT,
        allowNull: true
      });
    }

    if (!tableInfo.description) {
      await queryInterface.addColumn('QuoteLineItems', 'description', {
        type: Sequelize.TEXT,
        allowNull: true
      });
    }

    if (!tableInfo.sortOrder) {
      await queryInterface.addColumn('QuoteLineItems', 'sortOrder', {
        type: Sequelize.INTEGER,
        allowNull: true
      });
    }

    if (!tableInfo.internalCostSnapshot) {
      await queryInterface.addColumn('QuoteLineItems', 'internalCostSnapshot', {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable('QuoteLineItems').catch(() => ({}));

    if (tableInfo.catalogItemId) await queryInterface.removeColumn('QuoteLineItems', 'catalogItemId');
    if (tableInfo.discount) await queryInterface.removeColumn('QuoteLineItems', 'discount');
    if (tableInfo.tax) await queryInterface.removeColumn('QuoteLineItems', 'tax');
    if (tableInfo.totalAmount) await queryInterface.removeColumn('QuoteLineItems', 'totalAmount');
    if (tableInfo.isCustom) await queryInterface.removeColumn('QuoteLineItems', 'isCustom');
    if (tableInfo.customDescription) await queryInterface.removeColumn('QuoteLineItems', 'customDescription');
    if (tableInfo.description) await queryInterface.removeColumn('QuoteLineItems', 'description');
    if (tableInfo.sortOrder) await queryInterface.removeColumn('QuoteLineItems', 'sortOrder');
    if (tableInfo.internalCostSnapshot) await queryInterface.removeColumn('QuoteLineItems', 'internalCostSnapshot');
  }
};
