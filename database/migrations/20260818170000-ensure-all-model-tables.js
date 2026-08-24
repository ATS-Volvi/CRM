"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const rawTables = await queryInterface.showAllTables();
    const existingTables = new Set(
      rawTables.map((t) => (typeof t === "string" ? t.toLowerCase() : (t.tableName || String(t)).toLowerCase()))
    );

    const { sequelize } = require("@nexus-crm/database");

    console.log("Checking all models for missing database tables...");
    for (const [modelName, model] of Object.entries(sequelize.models)) {
      const tableName = model.tableName || modelName + "s";
      if (!existingTables.has(tableName.toLowerCase())) {
        console.log(`Creating missing table for model ${modelName} -> ${tableName}...`);
        try {
          await model.sync({ alter: false });
          console.log(`✓ Table ${tableName} created successfully.`);
          existingTables.add(tableName.toLowerCase());
        } catch (err) {
          console.error(`Error syncing table ${tableName}:`, err);
        }
      }
    }
    console.log("Model table verification & synchronization complete.");
  },

  async down(queryInterface, Sequelize) {
    // No-op for safety
  }
};
