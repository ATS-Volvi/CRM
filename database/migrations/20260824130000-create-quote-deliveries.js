"use strict";

const { DataTypes } = require("sequelize");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();
    if (!tables.includes("QuoteDeliveries")) {
      await queryInterface.createTable("QuoteDeliveries", {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true,
          allowNull: false
        },
        quoteId: {
          type: DataTypes.UUID,
          allowNull: false,
          references: {
            model: "Quotes",
            key: "id"
          },
          onUpdate: "CASCADE",
          onDelete: "CASCADE"
        },
        channel: {
          type: DataTypes.STRING,
          allowNull: false
        },
        recipient: {
          type: DataTypes.STRING,
          allowNull: false
        },
        status: {
          type: DataTypes.STRING,
          allowNull: false,
          defaultValue: "SENT"
        },
        providerMessageId: {
          type: DataTypes.STRING,
          allowNull: true
        },
        occurredAt: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW
        },
        notes: {
          type: DataTypes.TEXT,
          allowNull: true
        },
        createdAt: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW
        }
      });

      await queryInterface.addIndex("QuoteDeliveries", ["quoteId"]).catch(() => {});
      await queryInterface.addIndex("QuoteDeliveries", ["status"]).catch(() => {});
      await queryInterface.addIndex("QuoteDeliveries", ["occurredAt"]).catch(() => {});
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("QuoteDeliveries").catch(() => {});
  }
};
