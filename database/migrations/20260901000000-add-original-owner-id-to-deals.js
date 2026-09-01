'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable('Deals');
    if (!tableInfo.originalOwnerId) {
      await queryInterface.addColumn('Deals', 'originalOwnerId', {
        type: Sequelize.UUID,
        allowNull: true,
        defaultValue: null
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable('Deals');
    if (tableInfo.originalOwnerId) {
      await queryInterface.removeColumn('Deals', 'originalOwnerId');
    }
  }
};
