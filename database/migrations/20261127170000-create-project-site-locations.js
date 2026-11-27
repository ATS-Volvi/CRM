'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable('ProjectSiteLocations').catch(() => null);
    if (!tableInfo) {
      await queryInterface.createTable('ProjectSiteLocations', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true,
          allowNull: false
        },
        name: {
          type: Sequelize.STRING,
          allowNull: false,
          unique: true
        },
        code: {
          type: Sequelize.STRING,
          allowNull: true
        },
        region: {
          type: Sequelize.STRING,
          allowNull: false,
          defaultValue: 'Eastern Province'
        },
        zoneType: {
          type: Sequelize.STRING,
          allowNull: false,
          defaultValue: 'modon_industrial'
        },
        zoneLabel: {
          type: Sequelize.STRING,
          allowNull: true
        },
        baseDistanceKm: {
          type: Sequelize.FLOAT,
          allowNull: false,
          defaultValue: 0
        },
        travelTimeHours: {
          type: Sequelize.FLOAT,
          allowNull: true
        },
        gateAccessProtocol: {
          type: Sequelize.STRING,
          allowNull: true
        },
        securityRequirements: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        mapLinkOrCoordinates: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        isQuickChip: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true
        },
        sortOrder: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0
        },
        isActive: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true
        },
        createdAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn('NOW')
        },
        updatedAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn('NOW')
        }
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('ProjectSiteLocations').catch(() => {});
  }
};
