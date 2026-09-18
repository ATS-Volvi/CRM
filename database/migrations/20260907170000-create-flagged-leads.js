"use strict";

const { DataTypes } = require("sequelize");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();
    if (!tables.includes("FlaggedLeads")) {
      await queryInterface.createTable("FlaggedLeads", {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true,
        },
        payload: {
          type: DataTypes.JSON,
          allowNull: false,
        },
        source: {
          type: DataTypes.STRING,
          allowNull: false,
          defaultValue: "Website",
        },
        ip: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        reason: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        reviewed: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        createdAt: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW,
        },
        updatedAt: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW,
        },
      });
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("FlaggedLeads");
  },
};
