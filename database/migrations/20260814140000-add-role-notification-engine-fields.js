"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const tableInfo = await queryInterface.describeTable("Notifications");

    const addCol = async (col, config) => {
      if (!tableInfo[col]) {
        await queryInterface.addColumn("Notifications", col, config);
      }
    };

    await addCol("userId", { type: Sequelize.UUID, allowNull: true });
    await addCol("role", { type: Sequelize.STRING, defaultValue: "SALES_REP" });
    await addCol("severity", { type: Sequelize.STRING, defaultValue: "INFO" });
    await addCol("actionUrl", { type: Sequelize.STRING, allowNull: true });
    await addCol("entityType", { type: Sequelize.STRING, allowNull: true });
    await addCol("entityId", { type: Sequelize.STRING, allowNull: true });
    await addCol("source", { type: Sequelize.STRING, allowNull: true });
    await addCol("groupKey", { type: Sequelize.STRING, allowNull: true });
    await addCol("eventId", { type: Sequelize.STRING, allowNull: true });
    await addCol("metadata", { type: Sequelize.JSON, allowNull: true });
    await addCol("readAt", { type: Sequelize.DATE, allowNull: true });
  },

  async down(queryInterface) {
    const cols = ["userId", "role", "severity", "actionUrl", "entityType", "entityId", "source", "groupKey", "eventId", "metadata", "readAt"];
    for (const c of cols) {
      try {
        await queryInterface.removeColumn("Notifications", c);
      } catch (e) {}
    }
  }
};
