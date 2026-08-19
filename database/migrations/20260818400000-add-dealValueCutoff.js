"use strict";

const { DataTypes } = require("sequelize");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (t) => {
      const tableInfo = await queryInterface.describeTable("Users");

      if (!tableInfo.dealValueCutoff) {
        await queryInterface.addColumn(
          "Users",
          "dealValueCutoff",
          {
            type: DataTypes.DECIMAL(12, 2),
            allowNull: true
          },
          { transaction: t }
        );
      }

      if (!tableInfo.maxOpenDeals) {
        await queryInterface.addColumn(
          "Users",
          "maxOpenDeals",
          {
            type: DataTypes.INTEGER,
            allowNull: true
          },
          { transaction: t }
        );
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (t) => {
      const tableInfo = await queryInterface.describeTable("Users");
      if (tableInfo.dealValueCutoff) {
        await queryInterface.removeColumn("Users", "dealValueCutoff", { transaction: t });
      }
      if (tableInfo.maxOpenDeals) {
        await queryInterface.removeColumn("Users", "maxOpenDeals", { transaction: t });
      }
    });
  }
};
