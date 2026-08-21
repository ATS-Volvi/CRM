'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable('LineItems').catch(() => ({}));
    if (!tableInfo.price) {
      await queryInterface.addColumn('LineItems', 'price', {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: true,
        defaultValue: null
      });
    }
  },

  down: async (queryInterface) => {
    const tableInfo = await queryInterface.describeTable('LineItems').catch(() => ({}));
    if (tableInfo.price) {
      await queryInterface.removeColumn('LineItems', 'price');
    }
  }
};
