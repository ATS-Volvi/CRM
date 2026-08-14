"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const tableInfo = await queryInterface.describeTable("Leads");

    if (!tableInfo.nextAction) {
      await queryInterface.addColumn("Leads", "nextAction", {
        type: Sequelize.STRING,
        allowNull: true,
        defaultValue: "Reply to Lead"
      });
    }

    if (!tableInfo.nextActionDue) {
      await queryInterface.addColumn("Leads", "nextActionDue", {
        type: Sequelize.DATE,
        allowNull: true
      });
    }

    if (!tableInfo.qualificationData) {
      await queryInterface.addColumn("Leads", "qualificationData", {
        type: Sequelize.JSON,
        allowNull: true
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("Leads", "nextAction");
    await queryInterface.removeColumn("Leads", "nextActionDue");
    await queryInterface.removeColumn("Leads", "qualificationData");
  }
};
