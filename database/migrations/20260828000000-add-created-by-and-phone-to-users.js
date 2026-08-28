'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable('Users');
    if (!tableInfo.createdByUserId) {
      await queryInterface.addColumn('Users', 'createdByUserId', {
        type: Sequelize.UUID,
        allowNull: true,
        defaultValue: null
      });
    }
    if (!tableInfo.phone) {
      await queryInterface.addColumn('Users', 'phone', {
        type: Sequelize.STRING,
        allowNull: true,
        defaultValue: null
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable('Users');
    if (tableInfo.createdByUserId) {
      await queryInterface.removeColumn('Users', 'createdByUserId');
    }
    if (tableInfo.phone) {
      await queryInterface.removeColumn('Users', 'phone');
    }
  }
};
