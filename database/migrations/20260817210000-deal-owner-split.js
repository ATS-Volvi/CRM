"use strict";

const { DataTypes } = require("sequelize");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (t) => {
      // Step 1: Create WorkspaceSettings table (key-value, admin-only writes)
      const tables = await queryInterface.showAllTables();

      if (!tables.includes("WorkspaceSettings")) {
        await queryInterface.createTable(
          "WorkspaceSettings",
          {
            id: {
              type: DataTypes.UUID,
              defaultValue: DataTypes.UUIDV4,
              primaryKey: true
            },
            key: {
              type: DataTypes.STRING,
              allowNull: false,
              unique: true
            },
            value: {
              type: DataTypes.TEXT,
              allowNull: false
            },
            description: {
              type: DataTypes.TEXT,
              allowNull: true
            },
            updatedBy: {
              type: DataTypes.UUID,
              allowNull: true,
              references: { model: "Users", key: "id" },
              onDelete: "SET NULL",
              onUpdate: "CASCADE"
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
      }

      // Step 2: Seed the default qualifying split setting (idempotent via ON CONFLICT)
      await queryInterface.sequelize.query(
        `
        INSERT INTO public."WorkspaceSettings" (id, key, value, description, "createdAt", "updatedAt")
        VALUES (
          gen_random_uuid(),
          'default_qualifying_split_pct',
          '20',
          'Default commission split percentage for the qualifying rep when a lead is converted to an opportunity',
          NOW(),
          NOW()
        )
        ON CONFLICT (key) DO NOTHING
        `,
        { transaction: t }
      );

      // Step 3: Create DealOwners table
      if (!tables.includes("DealOwners")) {
        await queryInterface.createTable(
          "DealOwners",
          {
            id: {
              type: DataTypes.UUID,
              defaultValue: DataTypes.UUIDV4,
              primaryKey: true
            },
            dealId: {
              type: DataTypes.UUID,
              allowNull: false,
              references: { model: "Deals", key: "id" },
              onDelete: "CASCADE",
              onUpdate: "CASCADE"
            },
            userId: {
              type: DataTypes.UUID,
              allowNull: false,
              references: { model: "Users", key: "id" },
              onDelete: "CASCADE",
              onUpdate: "CASCADE"
            },
            splitPct: {
              type: DataTypes.DECIMAL(5, 2),
              allowNull: false,
              defaultValue: 100.0
            },
            role: {
              type: DataTypes.STRING,
              allowNull: true,
              comment: "e.g. qualifying_rep, closing_ae, support"
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

        // Add unique constraint: one row per (deal, user) pair
        await queryInterface.addIndex("DealOwners", ["dealId", "userId"], {
          unique: true,
          name: "deal_owners_deal_user_unique",
          transaction: t
        });
      }

      // Step 4: Backfill existing deals — one DealOwner row per deal with non-null ownerId at 100%
      // Idempotent: INSERT ... ON CONFLICT DO NOTHING (relies on unique constraint)
      await queryInterface.sequelize.query(
        `
        INSERT INTO public."DealOwners" (id, "dealId", "userId", "splitPct", role, "createdAt", "updatedAt")
        SELECT
          gen_random_uuid(),
          d.id AS "dealId",
          d."ownerId" AS "userId",
          100.00 AS "splitPct",
          'closing_ae' AS role,
          NOW(),
          NOW()
        FROM public."Deals" d
        WHERE d."ownerId" IS NOT NULL
        ON CONFLICT ("dealId", "userId") DO NOTHING
        `,
        { transaction: t }
      );
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (t) => {
      await queryInterface.dropTable("DealOwners", { transaction: t });
      await queryInterface.dropTable("WorkspaceSettings", { transaction: t });
    });
  }
};
