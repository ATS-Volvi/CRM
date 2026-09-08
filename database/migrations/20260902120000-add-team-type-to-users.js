'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable('Users');
    if (!tableInfo.teamType) {
      await queryInterface.addColumn('Users', 'teamType', {
        type: Sequelize.STRING,
        allowNull: true,
        defaultValue: null
      }).catch(err => console.warn('Could not add teamType to Users:', err.message));
    }
  },

  down: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable('Users');
    if (tableInfo.teamType) {
      await queryInterface.removeColumn('Users', 'teamType').catch(() => {});
    }
  }
};
