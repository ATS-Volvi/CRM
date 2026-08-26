'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable('Deals');
    if (!tableInfo.actualClosedAt) {
      await queryInterface.addColumn('Deals', 'actualClosedAt', {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: null
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable('Deals');
    if (tableInfo.actualClosedAt) {
      await queryInterface.removeColumn('Deals', 'actualClosedAt');
    }
  }
};
