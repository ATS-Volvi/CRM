"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const { DataTypes } = Sequelize;
    
    // Check if table exists
    const tables = await queryInterface.showAllTables();
    const tableExists = tables.some(
      (t) => t === "GmailConfigs" || t.tableName === "GmailConfigs" || t.toLowerCase?.() === "gmailconfigs"
    );

    if (!tableExists) {
      console.log("Creating missing GmailConfigs table...");
      await queryInterface.createTable("GmailConfigs", {
        id: {
          type: DataTypes.STRING,
          primaryKey: true,
          allowNull: false
        },
        connectedEmail: {
          type: DataTypes.STRING,
          allowNull: false
        },
        encryptedRefreshToken: {
          type: DataTypes.TEXT,
          allowNull: false
        },
        lastSyncedAt: {
          type: DataTypes.DATE,
          allowNull: true
        },
        createdAt: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW
        },
        updatedAt: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW
        }
      });
      console.log("GmailConfigs table created successfully.");
    } else {
      console.log("GmailConfigs table already exists.");
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("GmailConfigs");
  }
};
