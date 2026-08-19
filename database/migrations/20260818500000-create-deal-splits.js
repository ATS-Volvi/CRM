"use strict";

const { DataTypes } = require("sequelize");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (t) => {
      const tables = await queryInterface.showAllTables();

      if (!tables.includes("DealSplits")) {
        await queryInterface.createTable(
          "DealSplits",
          {
            id: {
              type: DataTypes.UUID,
              defaultValue: DataTypes.UUIDV4,
              primaryKey: true,
              allowNull: false
            },
            dealId: {
              type: DataTypes.UUID,
              allowNull: false,
              references: { model: "Deals", key: "id" },
              onUpdate: "CASCADE",
              onDelete: "CASCADE"
            },
            userId: {
              type: DataTypes.UUID,
              allowNull: false,
              references: { model: "Users", key: "id" },
              onUpdate: "CASCADE",
              onDelete: "CASCADE"
            },
            splitPercentage: {
              type: DataTypes.DECIMAL(5, 2),
              allowNull: false
            },
            configuredByUserId: {
              type: DataTypes.UUID,
              allowNull: true,
              references: { model: "Users", key: "id" },
              onUpdate: "CASCADE",
              onDelete: "SET NULL"
            },
            isCrossTeam: {
              type: DataTypes.BOOLEAN,
              allowNull: false,
              defaultValue: false
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
          },
          { transaction: t }
        );
      } else {
        const cols = await queryInterface.describeTable("DealSplits");
        if (!cols.dealId) {
          await queryInterface.addColumn("DealSplits", "dealId", {
            type: DataTypes.UUID,
            allowNull: false,
            references: { model: "Deals", key: "id" },
            onUpdate: "CASCADE",
            onDelete: "CASCADE"
          }, { transaction: t });
        }
        if (!cols.userId) {
          await queryInterface.addColumn("DealSplits", "userId", {
            type: DataTypes.UUID,
            allowNull: false,
            references: { model: "Users", key: "id" },
            onUpdate: "CASCADE",
            onDelete: "CASCADE"
          }, { transaction: t });
        }
        if (!cols.splitPercentage) {
          await queryInterface.addColumn("DealSplits", "splitPercentage", {
            type: DataTypes.DECIMAL(5, 2),
            allowNull: false
          }, { transaction: t });
        }
        if (!cols.configuredByUserId) {
          await queryInterface.addColumn("DealSplits", "configuredByUserId", {
            type: DataTypes.UUID,
            allowNull: true,
            references: { model: "Users", key: "id" },
            onUpdate: "CASCADE",
            onDelete: "SET NULL"
          }, { transaction: t });
        }
        if (!cols.isCrossTeam) {
          await queryInterface.addColumn("DealSplits", "isCrossTeam", {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
          }, { transaction: t });
        }
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (t) => {
      const tables = await queryInterface.showAllTables();
      if (tables.includes("DealSplits")) {
        await queryInterface.dropTable("DealSplits", { transaction: t });
      }
    });
  }
};
