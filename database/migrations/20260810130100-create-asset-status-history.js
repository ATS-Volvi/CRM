"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();
    const tableNames = Array.isArray(tables) ? tables.map(t => (typeof t === "object" ? t.tableName || t.name : t)) : [];

    if (!tableNames.includes("AssetStatusHistories")) {
      await queryInterface.createTable("AssetStatusHistories", {
        id: {
          type: Sequelize.UUID,
          primaryKey: true,
          defaultValue: Sequelize.UUIDV4,
        },
        assetId: {
          type: Sequelize.UUID,
          allowNull: false,
        },
        previousStatus: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        newStatus: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        previousCondition: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        newCondition: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        changedById: {
          type: Sequelize.UUID,
          allowNull: true,
        },
        notes: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        createdAt: {
          type: Sequelize.DATE,
          allowNull: false,
        },
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable("AssetStatusHistories").catch(() => {});
  },
};
