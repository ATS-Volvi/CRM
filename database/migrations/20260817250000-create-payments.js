"use strict";

const { DataTypes } = require("sequelize");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const dialect = queryInterface.sequelize.getDialect();
    await queryInterface.sequelize.transaction(async (t) => {
      const tables = await queryInterface.showAllTables();
      const tableNames = Array.isArray(tables)
        ? tables.map((tbl) => (typeof tbl === "object" ? tbl.tableName || tbl.name : tbl))
        : [];

      // 1. Add fields to Invoices if they don't exist
      const invoiceInfo = await queryInterface.describeTable("Invoices");

      if (!invoiceInfo.amountPaid) {
        await queryInterface.addColumn(
          "Invoices",
          "amountPaid",
          {
            type: DataTypes.DECIMAL(15, 2),
            allowNull: false,
            defaultValue: 0.0
          },
          { transaction: t }
        );
      }

      if (dialect === "sqlite") {
        if (!invoiceInfo.paymentStatus) {
          await queryInterface.addColumn(
            "Invoices",
            "paymentStatus",
            {
              type: DataTypes.STRING,
              allowNull: false,
              defaultValue: "unpaid"
            },
            { transaction: t }
          );
        }

        if (!tableNames.includes("Payments")) {
          await queryInterface.createTable(
            "Payments",
            {
              id: {
                type: DataTypes.UUID,
                defaultValue: DataTypes.UUIDV4,
                primaryKey: true
              },
              invoiceId: {
                type: DataTypes.UUID,
                allowNull: false,
                references: { model: "Invoices", key: "id" },
                onDelete: "CASCADE",
                onUpdate: "CASCADE"
              },
              amount: {
                type: DataTypes.DECIMAL(15, 2),
                allowNull: false
              },
              paymentDate: {
                type: DataTypes.DATE,
                defaultValue: DataTypes.NOW,
                allowNull: false
              },
              method: {
                type: DataTypes.STRING,
                allowNull: false,
                defaultValue: "bank_transfer"
              },
              reference: {
                type: DataTypes.STRING,
                allowNull: true
              },
              recordedBy: {
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
        return;
      }

      // Postgres path:
      // Create ENUM for Invoice paymentStatus
      await queryInterface.sequelize.query(
        `
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_Invoices_paymentStatus') THEN
            CREATE TYPE "enum_Invoices_paymentStatus" AS ENUM ('unpaid', 'partial', 'paid', 'overdue');
          END IF;
        END
        $$;
        `,
        { transaction: t }
      );

      if (!invoiceInfo.paymentStatus) {
        await queryInterface.sequelize.query(
          `ALTER TABLE "Invoices" ADD COLUMN "paymentStatus" "enum_Invoices_paymentStatus" NOT NULL DEFAULT 'unpaid'`,
          { transaction: t }
        );
      }

      // 2. Create Payments ENUM
      await queryInterface.sequelize.query(
        `
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_Payments_method') THEN
            CREATE TYPE "enum_Payments_method" AS ENUM ('bank_transfer', 'cheque', 'cash', 'card', 'other');
          END IF;
        END
        $$;
        `,
        { transaction: t }
      );

      // 3. Create Payments table
      if (!tableNames.includes("Payments")) {
        await queryInterface.createTable(
          "Payments",
          {
            id: {
              type: DataTypes.UUID,
              defaultValue: DataTypes.UUIDV4,
              primaryKey: true
            },
            invoiceId: {
              type: DataTypes.UUID,
              allowNull: false,
              references: { model: "Invoices", key: "id" },
              onDelete: "CASCADE",
              onUpdate: "CASCADE"
            },
            amount: {
              type: DataTypes.DECIMAL(15, 2),
              allowNull: false
            },
            paymentDate: {
              type: DataTypes.DATE,
              defaultValue: DataTypes.NOW,
              allowNull: false
            },
            method: {
              type: DataTypes.STRING,
              allowNull: false,
              defaultValue: "bank_transfer"
            },
            reference: {
              type: DataTypes.STRING,
              allowNull: true
            },
            recordedBy: {
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

        // Convert method column to the ENUM
        await queryInterface.sequelize.query(
          `ALTER TABLE "Payments" ALTER COLUMN method DROP DEFAULT`,
          { transaction: t }
        );
        await queryInterface.sequelize.query(
          `ALTER TABLE "Payments" ALTER COLUMN method TYPE "enum_Payments_method" USING method::"enum_Payments_method"`,
          { transaction: t }
        );
        await queryInterface.sequelize.query(
          `ALTER TABLE "Payments" ALTER COLUMN method SET DEFAULT 'bank_transfer'::"enum_Payments_method"`,
          { transaction: t }
        );
      }
    });
  },

  async down(queryInterface, Sequelize) {
    const dialect = queryInterface.sequelize.getDialect();
    await queryInterface.sequelize.transaction(async (t) => {
      await queryInterface.dropTable("Payments", { transaction: t });
      await queryInterface.removeColumn("Invoices", "amountPaid", { transaction: t });
      if (dialect === "sqlite") {
        await queryInterface.removeColumn("Invoices", "paymentStatus", { transaction: t });
      } else {
        await queryInterface.sequelize.query(`ALTER TABLE "Invoices" DROP COLUMN IF EXISTS "paymentStatus"`, { transaction: t });
        await queryInterface.sequelize.query(`DROP TYPE IF EXISTS "enum_Payments_method"`, { transaction: t });
        await queryInterface.sequelize.query(`DROP TYPE IF EXISTS "enum_Invoices_paymentStatus"`, { transaction: t });
      }
    });
  }
};
