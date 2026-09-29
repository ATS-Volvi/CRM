'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable('WorkOrders').catch(() => ({}));
    if (!tableInfo.alternatePhone) {
      await queryInterface.addColumn('WorkOrders', 'alternatePhone', {
        type: Sequelize.STRING,
        allowNull: true
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable('WorkOrders').catch(() => ({}));
    if (tableInfo.alternatePhone) {
      await queryInterface.removeColumn('WorkOrders', 'alternatePhone');
    }
  }
};
