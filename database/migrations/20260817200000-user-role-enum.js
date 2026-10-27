"use strict";

const { DataTypes } = require("sequelize");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (t) => {
      // Step 1: Rename existing 'sales_manager' rows to 'manager' BEFORE creating ENUM
      // Idempotent: WHERE clause is a no-op if already renamed
      await queryInterface.sequelize.query(
        `UPDATE public."Users" SET role = 'manager' WHERE role = 'sales_manager'`,
        { transaction: t }
      );

      // Step 2: Create ENUM type (idempotent via DO block)
      await queryInterface.sequelize.query(
        `
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_Users_role') THEN
            CREATE TYPE enum_Users_role AS ENUM ('admin', 'manager', 'senior_ae', 'sales_rep', 'director');
          END IF;
        END
        $$;
        `,
        { transaction: t }
      );

      // Step 3: Change column type from VARCHAR to ENUM
      // PostgreSQL cannot auto-cast the column DEFAULT from varchar to enum.
      // Must: drop default → alter type → set new default.
      // Idempotent: only run if column is still varchar
      const [rows] = await queryInterface.sequelize.query(
        `SELECT udt_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Users' AND column_name = 'role'`,
        { transaction: t }
      );
      if (rows[0]?.udt_name !== "enum_users_role") {
        // 3a. Drop existing varchar default first
        await queryInterface.sequelize.query(
          `ALTER TABLE public."Users" ALTER COLUMN role DROP DEFAULT`,
          { transaction: t }
        );
        // 3b. Change column type to ENUM
        await queryInterface.sequelize.query(
          `ALTER TABLE public."Users" ALTER COLUMN role TYPE enum_users_role USING role::enum_users_role`,
          { transaction: t }
        );
        // 3c. Set new enum default
        await queryInterface.sequelize.query(
          `ALTER TABLE public."Users" ALTER COLUMN role SET DEFAULT 'sales_rep'::enum_users_role`,
          { transaction: t }
        );
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (t) => {
      // Revert ENUM back to VARCHAR
      await queryInterface.sequelize.query(
        `ALTER TABLE public."Users" ALTER COLUMN role TYPE character varying USING role::character varying`,
        { transaction: t }
      );
      await queryInterface.sequelize.query(
        `ALTER TABLE public."Users" ALTER COLUMN role SET DEFAULT 'sales_rep'`,
        { transaction: t }
      );
      // Restore old role name (best-effort — cannot perfectly undo rename)
      await queryInterface.sequelize.query(
        `UPDATE public."Users" SET role = 'sales_manager' WHERE role = 'manager'`,
        { transaction: t }
      );
      await queryInterface.sequelize.query(
        `DROP TYPE IF EXISTS enum_Users_role`,
        { transaction: t }
      );
    });
  }
};
