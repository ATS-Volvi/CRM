"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (t) => {
      const tableInfo = await queryInterface.describeTable("Users");
      if (!tableInfo.maxActiveOpportunities) {
        await queryInterface.addColumn(
          "Users",
          "maxActiveOpportunities",
          {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 10,
            comment: "Max active opportunity (deal) pipeline size per user — cap for senior_ae and manager roles"
          },
          { transaction: t }
        );
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (t) => {
      await queryInterface.removeColumn("Users", "maxActiveOpportunities", { transaction: t });
    });
  }
};
