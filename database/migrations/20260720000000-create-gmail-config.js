'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('GmailConfigs', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.STRING
      },
      connectedEmail: {
        type: Sequelize.STRING,
        allowNull: false
      },
      encryptedRefreshToken: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      lastSyncedAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('GmailConfigs');
  }
};
