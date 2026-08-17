"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (t) => {
      // Idempotent: check column existence before adding
      const tableInfo = await queryInterface.describeTable("Users");
      if (!tableInfo.hireDate) {
        await queryInterface.addColumn(
          "Users",
          "hireDate",
          {
            type: Sequelize.DATEONLY,
            allowNull: true,
            defaultValue: null,
            comment: "Employee hire date — populated manually, not backfilled from createdAt"
          },
          { transaction: t }
        );
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (t) => {
      await queryInterface.removeColumn("Users", "hireDate", { transaction: t });
    });
  }
};
