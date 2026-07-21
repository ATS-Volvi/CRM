'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Users', 'emailAlias', {
      type: Sequelize.STRING,
      allowNull: true
    });
    await queryInterface.addColumn('Leads', 'assignmentMethod', {
      type: Sequelize.STRING,
      allowNull: true
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('Users', 'emailAlias');
    await queryInterface.removeColumn('Leads', 'assignmentMethod');
  }
};
