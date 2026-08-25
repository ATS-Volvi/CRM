"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable("Leads");

    if (!tableInfo.intakeStatus) {
      await queryInterface.addColumn("Leads", "intakeStatus", {
        type: Sequelize.STRING,
        allowNull: true,
        defaultValue: "INCOMPLETE"
      });
    }

    if (!tableInfo.lastAutomatedIntakeMessageAt) {
      await queryInterface.addColumn("Leads", "lastAutomatedIntakeMessageAt", {
        type: Sequelize.DATE,
        allowNull: true
      });
    }

    if (!tableInfo.intakeMessageCount) {
      await queryInterface.addColumn("Leads", "intakeMessageCount", {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      });
    }

    if (!tableInfo.missingFields) {
      await queryInterface.addColumn("Leads", "missingFields", {
        type: Sequelize.JSON,
        allowNull: true
      });
    }

    if (!tableInfo.lastProcessedEventId) {
      await queryInterface.addColumn("Leads", "lastProcessedEventId", {
        type: Sequelize.STRING,
        allowNull: true
      });
    }

    if (!tableInfo.extractedRequirement) {
      await queryInterface.addColumn("Leads", "extractedRequirement", {
        type: Sequelize.JSON,
        allowNull: true
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable("Leads");

    if (tableInfo.extractedRequirement) {
      await queryInterface.removeColumn("Leads", "extractedRequirement");
    }
    if (tableInfo.lastProcessedEventId) {
      await queryInterface.removeColumn("Leads", "lastProcessedEventId");
    }
    if (tableInfo.missingFields) {
      await queryInterface.removeColumn("Leads", "missingFields");
    }
    if (tableInfo.intakeMessageCount) {
      await queryInterface.removeColumn("Leads", "intakeMessageCount");
    }
    if (tableInfo.lastAutomatedIntakeMessageAt) {
      await queryInterface.removeColumn("Leads", "lastAutomatedIntakeMessageAt");
    }
    if (tableInfo.intakeStatus) {
      await queryInterface.removeColumn("Leads", "intakeStatus");
    }
  }
};
