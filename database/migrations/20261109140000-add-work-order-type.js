'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable('WorkOrders').catch(() => null);
    if (tableInfo && !tableInfo.workOrderType) {
      await queryInterface.addColumn('WorkOrders', 'workOrderType', {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'Installation',
      });
    }
  },

  down: async (queryInterface) => {
    const tableInfo = await queryInterface.describeTable('WorkOrders').catch(() => null);
    if (tableInfo && tableInfo.workOrderType) {
      await queryInterface.removeColumn('WorkOrders', 'workOrderType');
    }
  }
};
