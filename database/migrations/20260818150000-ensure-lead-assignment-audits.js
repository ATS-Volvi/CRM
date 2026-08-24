"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const { DataTypes } = Sequelize;
    
    // Check if table exists
    const tables = await queryInterface.showAllTables();
    const tableExists = tables.some(
      (t) => t === "LeadAssignmentAudits" || t.tableName === "LeadAssignmentAudits" || t.toLowerCase?.() === "leadassignmentaudits"
    );

    if (!tableExists) {
      console.log("Creating missing LeadAssignmentAudits table...");
      await queryInterface.createTable("LeadAssignmentAudits", {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true
        },
        leadId: {
          type: DataTypes.UUID,
          allowNull: true
        },
        previousOwnerId: {
          type: DataTypes.UUID,
          allowNull: true
        },
        assignedToId: {
          type: DataTypes.UUID,
          allowNull: false
        },
        assignmentType: {
          type: DataTypes.STRING,
          allowNull: false
        },
        leadPriorityScore: {
          type: DataTypes.DECIMAL(5, 2),
          defaultValue: 50.0
        },
        expectedRevenue: {
          type: DataTypes.DECIMAL(15, 2),
          defaultValue: 0
        },
        candidateScores: {
          type: DataTypes.TEXT,
          allowNull: false
        },
        winningScore: {
          type: DataTypes.DECIMAL(5, 2),
          allowNull: false
        },
        reason: {
          type: DataTypes.TEXT,
          allowNull: false
        },
        triggerSource: {
          type: DataTypes.STRING,
          defaultValue: "API"
        },
        createdAt: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        }
      });
      console.log("LeadAssignmentAudits table created successfully.");
    } else {
      console.log("LeadAssignmentAudits table already exists.");
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("LeadAssignmentAudits");
  }
};
