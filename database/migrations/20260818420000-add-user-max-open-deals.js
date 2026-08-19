'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable('Users');
    if (!tableInfo.maxOpenDeals) {
      await queryInterface.addColumn('Users', 'maxOpenDeals', {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: null
      });
    }
  },

  down: async (queryInterface) => {
    const tableInfo = await queryInterface.describeTable('Users');
    if (tableInfo.maxOpenDeals) {
      await queryInterface.removeColumn('Users', 'maxOpenDeals');
    }
  }
};
