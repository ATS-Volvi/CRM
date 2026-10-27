"use strict";

const { DataTypes } = require("sequelize");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (t) => {
      const tables = await queryInterface.showAllTables();

      // Create ENUMs for SupportTickets
      await queryInterface.sequelize.query(
        `
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_SupportTickets_status') THEN
            CREATE TYPE "enum_SupportTickets_status" AS ENUM ('open', 'in_progress', 'resolved', 'closed');
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_SupportTickets_category') THEN
            CREATE TYPE "enum_SupportTickets_category" AS ENUM ('issue', 'maintenance', 'other');
          END IF;
        END
        $$;
        `,
        { transaction: t }
      );

      // Create SupportTickets table
      if (!tables.includes("SupportTickets")) {
        await queryInterface.createTable(
          "SupportTickets",
          {
            id: {
              type: DataTypes.UUID,
              defaultValue: DataTypes.UUIDV4,
              primaryKey: true
            },
            accountId: {
              type: DataTypes.UUID,
              allowNull: false,
              references: { model: "Accounts", key: "id" },
              onDelete: "CASCADE",
              onUpdate: "CASCADE"
            },
            assetId: {
              type: DataTypes.UUID,
              allowNull: true,
              references: { model: "Assets", key: "id" },
              onDelete: "SET NULL",
              onUpdate: "CASCADE"
            },
            raisedBy: {
              type: DataTypes.UUID,
              allowNull: true,
              references: { model: "Users", key: "id" },
              onDelete: "SET NULL",
              onUpdate: "CASCADE"
            },
            status: {
              type: DataTypes.STRING, // To be converted to ENUM
              allowNull: false,
              defaultValue: "open"
            },
            category: {
              type: DataTypes.STRING, // To be converted to ENUM
              allowNull: false,
              defaultValue: "issue"
            },
            description: {
              type: DataTypes.TEXT,
              allowNull: true
            },
            resolvedAt: {
              type: DataTypes.DATE,
              allowNull: true
            },
            createdAt: {
              type: DataTypes.DATE,
              defaultValue: DataTypes.NOW
            },
            updatedAt: {
              type: DataTypes.DATE,
              defaultValue: DataTypes.NOW
            }
          },
          { transaction: t }
        );

        // Convert status to ENUM
        await queryInterface.sequelize.query(
          `ALTER TABLE public."SupportTickets" ALTER COLUMN status DROP DEFAULT`,
          { transaction: t }
        );
        await queryInterface.sequelize.query(
          `ALTER TABLE public."SupportTickets" ALTER COLUMN status TYPE "enum_SupportTickets_status" USING status::"enum_SupportTickets_status"`,
          { transaction: t }
        );
        await queryInterface.sequelize.query(
          `ALTER TABLE public."SupportTickets" ALTER COLUMN status SET DEFAULT 'open'::"enum_SupportTickets_status"`,
          { transaction: t }
        );

        // Convert category to ENUM
        await queryInterface.sequelize.query(
          `ALTER TABLE public."SupportTickets" ALTER COLUMN category DROP DEFAULT`,
          { transaction: t }
        );
        await queryInterface.sequelize.query(
          `ALTER TABLE public."SupportTickets" ALTER COLUMN category TYPE "enum_SupportTickets_category" USING category::"enum_SupportTickets_category"`,
          { transaction: t }
        );
        await queryInterface.sequelize.query(
          `ALTER TABLE public."SupportTickets" ALTER COLUMN category SET DEFAULT 'issue'::"enum_SupportTickets_category"`,
          { transaction: t }
        );
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (t) => {
      await queryInterface.dropTable("SupportTickets", { transaction: t });
      await queryInterface.sequelize.query(`DROP TYPE IF EXISTS "enum_SupportTickets_status"`, { transaction: t });
      await queryInterface.sequelize.query(`DROP TYPE IF EXISTS "enum_SupportTickets_category"`, { transaction: t });
    });
  }
};
