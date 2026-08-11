"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();
    const tableNames = Array.isArray(tables) ? tables.map(t => (typeof t === "object" ? t.tableName || t.name : t)) : [];
    
    if (!tableNames.includes("Assets")) {
      await queryInterface.createTable("Assets", {
        id: {
          type: Sequelize.UUID,
          primaryKey: true,
          defaultValue: Sequelize.UUIDV4,
        },
        name: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        type: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        serialNumber: {
          type: Sequelize.STRING,
          allowNull: true,
          unique: true,
        },
        status: {
          type: Sequelize.STRING,
          allowNull: false,
          defaultValue: "In Storage",
        },
        condition: {
          type: Sequelize.STRING,
          allowNull: false,
          defaultValue: "Good",
        },
        customerId: {
          type: Sequelize.UUID,
          allowNull: true,
        },
        dealId: {
          type: Sequelize.UUID,
          allowNull: true,
        },
        deployedAt: {
          type: Sequelize.DATE,
          allowNull: true,
        },
        expectedReturnDate: {
          type: Sequelize.DATE,
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
        updatedAt: {
          type: Sequelize.DATE,
          allowNull: false,
        },
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable("Assets").catch(() => {});
  },
};
