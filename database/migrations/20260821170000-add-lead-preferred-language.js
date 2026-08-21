'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable('Leads').catch(() => ({}));

    if (!tableInfo.preferredLanguage) {
      await queryInterface.addColumn('Leads', 'preferredLanguage', {
        type: Sequelize.STRING,
        allowNull: true,
        defaultValue: 'ar'
      });
    }
  },

  down: async (queryInterface) => {
    const tableInfo = await queryInterface.describeTable('Leads').catch(() => ({}));

    if (tableInfo.preferredLanguage) {
      await queryInterface.removeColumn('Leads', 'preferredLanguage');
    }
  }
};
