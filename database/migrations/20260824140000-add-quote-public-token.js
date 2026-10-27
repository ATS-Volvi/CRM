"use strict";

const { DataTypes } = require("sequelize");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableInfo = await queryInterface.describeTable("Quotes").catch(() => ({}));

    if (!tableInfo.publicAccessToken) {
      await queryInterface.addColumn("Quotes", "publicAccessToken", {
        type: DataTypes.STRING,
        allowNull: true,
        unique: true
      });
    }

    if (!tableInfo.publicAccessExpiresAt) {
      await queryInterface.addColumn("Quotes", "publicAccessExpiresAt", {
        type: DataTypes.DATE,
        allowNull: true
      });
    }

    // Add unique index on publicAccessToken
    await queryInterface.addIndex("Quotes", ["publicAccessToken"], {
      unique: true,
      name: "quotes_public_access_token_unique"
    }).catch(() => {});
  },

  async down(queryInterface, Sequelize) {
    const tableInfo = await queryInterface.describeTable("Quotes").catch(() => ({}));
    if (tableInfo.publicAccessToken) {
      await queryInterface.removeColumn("Quotes", "publicAccessToken").catch(() => {});
    }
    if (tableInfo.publicAccessExpiresAt) {
      await queryInterface.removeColumn("Quotes", "publicAccessExpiresAt").catch(() => {});
    }
  }
};
