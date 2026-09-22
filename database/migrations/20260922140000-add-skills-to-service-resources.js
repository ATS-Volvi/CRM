'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable('ServiceResources');
    if (!tableInfo.skills) {
      await queryInterface.addColumn('ServiceResources', 'skills', {
        type: Sequelize.JSON,
        allowNull: true
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable('ServiceResources');
    if (tableInfo.skills) {
      await queryInterface.removeColumn('ServiceResources', 'skills');
    }
  }
};
