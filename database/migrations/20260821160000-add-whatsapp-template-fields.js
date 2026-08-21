'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable('MessageTemplates').catch(() => ({}));

    if (!tableInfo.twilioContentSid) {
      await queryInterface.addColumn('MessageTemplates', 'twilioContentSid', {
        type: Sequelize.STRING,
        allowNull: true,
        defaultValue: null
      });
    }

    if (!tableInfo.contentVariables) {
      await queryInterface.addColumn('MessageTemplates', 'contentVariables', {
        type: Sequelize.TEXT,
        allowNull: true,
        defaultValue: null
      });
    }

    if (!tableInfo.language) {
      await queryInterface.addColumn('MessageTemplates', 'language', {
        type: Sequelize.STRING,
        allowNull: true,
        defaultValue: 'ar'
      });
    }
  },

  down: async (queryInterface) => {
    const tableInfo = await queryInterface.describeTable('MessageTemplates').catch(() => ({}));

    if (tableInfo.twilioContentSid) {
      await queryInterface.removeColumn('MessageTemplates', 'twilioContentSid');
    }
    if (tableInfo.contentVariables) {
      await queryInterface.removeColumn('MessageTemplates', 'contentVariables');
    }
    if (tableInfo.language) {
      await queryInterface.removeColumn('MessageTemplates', 'language');
    }
  }
};
