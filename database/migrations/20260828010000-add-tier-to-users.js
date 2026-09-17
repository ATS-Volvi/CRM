'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable('Users');
    if (!tableInfo.tier) {
      await queryInterface.addColumn('Users', 'tier', {
        type: Sequelize.STRING,
        allowNull: true,
        defaultValue: null
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable('Users');
    if (tableInfo.tier) {
      await queryInterface.removeColumn('Users', 'tier');
    }
  }
};
