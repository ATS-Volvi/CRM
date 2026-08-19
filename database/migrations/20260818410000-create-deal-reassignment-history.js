"use strict";

const { DataTypes } = require("sequelize");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (t) => {
      const tables = await queryInterface.showAllTables();

      if (!tables.includes("DealReassignmentHistories")) {
        await queryInterface.createTable(
          "DealReassignmentHistories",
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
            oldOwnerId: {
              type: DataTypes.UUID,
              allowNull: true,
              references: { model: "Users", key: "id" },
              onUpdate: "CASCADE",
              onDelete: "SET NULL"
            },
            newOwnerId: {
              type: DataTypes.UUID,
              allowNull: false,
              references: { model: "Users", key: "id" },
              onUpdate: "CASCADE",
              onDelete: "CASCADE"
            },
            changedByUserId: {
              type: DataTypes.UUID,
              allowNull: false,
              references: { model: "Users", key: "id" },
              onUpdate: "CASCADE",
              onDelete: "CASCADE"
            },
            assignmentType: {
              type: DataTypes.STRING,
              allowNull: false,
              defaultValue: "AUTOMATIC"
            },
            dealAmountAtReassignment: {
              type: DataTypes.DECIMAL(12, 2),
              allowNull: true
            },
            exceededCutoff: {
              type: DataTypes.BOOLEAN,
              allowNull: false,
              defaultValue: false
            },
            exceededCapacity: {
              type: DataTypes.BOOLEAN,
              allowNull: false,
              defaultValue: false
            },
            reason: {
              type: DataTypes.TEXT,
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
          },
          { transaction: t }
        );
      } else {
        // Table exists, verify and add any missing columns idempotently
        const cols = await queryInterface.describeTable("DealReassignmentHistories");
        if (!cols.oldOwnerId && cols.fromUserId) {
          await queryInterface.renameColumn("DealReassignmentHistories", "fromUserId", "oldOwnerId", { transaction: t });
        }
        if (!cols.newOwnerId && cols.toUserId) {
          await queryInterface.renameColumn("DealReassignmentHistories", "toUserId", "newOwnerId", { transaction: t });
        }
        if (!cols.changedByUserId && cols.reassignedBy) {
          await queryInterface.renameColumn("DealReassignmentHistories", "reassignedBy", "changedByUserId", { transaction: t });
        }

        const updatedCols = await queryInterface.describeTable("DealReassignmentHistories");
        if (!updatedCols.assignmentType) {
          await queryInterface.addColumn("DealReassignmentHistories", "assignmentType", {
            type: DataTypes.STRING,
            allowNull: false,
            defaultValue: "AUTOMATIC"
          }, { transaction: t });
        }
        if (!updatedCols.dealAmountAtReassignment) {
          await queryInterface.addColumn("DealReassignmentHistories", "dealAmountAtReassignment", {
            type: DataTypes.DECIMAL(12, 2),
            allowNull: true
          }, { transaction: t });
        }
        if (!updatedCols.exceededCutoff) {
          await queryInterface.addColumn("DealReassignmentHistories", "exceededCutoff", {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
          }, { transaction: t });
        }
        if (!updatedCols.exceededCapacity) {
          await queryInterface.addColumn("DealReassignmentHistories", "exceededCapacity", {
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
      if (tables.includes("DealReassignmentHistories")) {
        await queryInterface.dropTable("DealReassignmentHistories", { transaction: t });
      }
    });
  }
};
