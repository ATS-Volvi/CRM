"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Add birthday & anniversaryDate columns to Customers
    const customerTable = await queryInterface.describeTable("Customers").catch(() => null);
    if (customerTable) {
      if (!customerTable.birthday) {
        await queryInterface.addColumn("Customers", "birthday", {
          type: Sequelize.DATEONLY,
          allowNull: true,
        });
      }
      if (!customerTable.anniversaryDate) {
        await queryInterface.addColumn("Customers", "anniversaryDate", {
          type: Sequelize.DATEONLY,
          allowNull: true,
        });
      }
    }

    // 2. Create CoachingNotes table if it doesn't exist
    const tables = await queryInterface.showAllTables();
    const tableNames = Array.isArray(tables) ? tables.map(t => (typeof t === "object" ? t.tableName || t.name : t)) : [];
    if (!tableNames.includes("CoachingNotes")) {
      await queryInterface.createTable("CoachingNotes", {
        id: {
          type: Sequelize.STRING,
          primaryKey: true,
          defaultValue: Sequelize.UUIDV4,
        },
        dealId: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        leadId: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        authorUserId: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        targetUserId: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        content: {
          type: Sequelize.TEXT,
          allowNull: false,
        },
        isRead: {
          type: Sequelize.BOOLEAN,
          defaultValue: false,
          allowNull: false,
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
    await queryInterface.removeColumn("Customers", "birthday").catch(() => {});
    await queryInterface.removeColumn("Customers", "anniversaryDate").catch(() => {});
    await queryInterface.dropTable("CoachingNotes").catch(() => {});
  },
};
