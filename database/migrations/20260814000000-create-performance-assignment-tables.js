const { DataTypes } = require("sequelize");

module.exports = {
  up: async (queryInterface) => {
    // 1. Add Performance columns to Users table
    const tableInfo = await queryInterface.describeTable("Users");

    if (!tableInfo.experienceYears) {
      await queryInterface.addColumn("Users", "experienceYears", {
        type: DataTypes.DECIMAL(4, 1),
        defaultValue: 2.0
      });
    }

    if (!tableInfo.experienceTier) {
      await queryInterface.addColumn("Users", "experienceTier", {
        type: DataTypes.STRING,
        defaultValue: "Sales Representative"
      });
    }

    if (!tableInfo.averageFirstResponseMinutes) {
      await queryInterface.addColumn("Users", "averageFirstResponseMinutes", {
        type: DataTypes.DECIMAL(6, 1),
        defaultValue: 15.0
      });
    }

    if (!tableInfo.slaComplianceRate) {
      await queryInterface.addColumn("Users", "slaComplianceRate", {
        type: DataTypes.DECIMAL(5, 4),
        defaultValue: 0.95
      });
    }

    if (!tableInfo.managerPerformanceRating) {
      await queryInterface.addColumn("Users", "managerPerformanceRating", {
        type: DataTypes.DECIMAL(3, 2),
        defaultValue: 4.0
      });
    }

    if (!tableInfo.recentHighValueLeadCount) {
      await queryInterface.addColumn("Users", "recentHighValueLeadCount", {
        type: DataTypes.INTEGER,
        defaultValue: 0
      });
    }

    if (!tableInfo.recentLeadValueAssigned) {
      await queryInterface.addColumn("Users", "recentLeadValueAssigned", {
        type: DataTypes.DECIMAL(15, 2),
        defaultValue: 0
      });
    }

    // 2. Create SalesAssignmentPolicies Table
    await queryInterface.createTable("SalesAssignmentPolicies", {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
      },
      weights: {
        type: DataTypes.TEXT,
        defaultValue: JSON.stringify({
          conversionRate: 0.20,
          industrySkill: 0.20,
          territoryMatch: 0.10,
          revenuePerformance: 0.10,
          experienceTier: 0.10,
          responseTime: 0.05,
          slaCompliance: 0.05,
          workloadCapacity: 0.10,
          fairnessDistribution: 0.05,
          managerRating: 0.05
        })
      },
      highValueThreshold: {
        type: DataTypes.DECIMAL(15, 2),
        defaultValue: 10000000
      },
      strategicLeadScoreThreshold: {
        type: DataTypes.INTEGER,
        defaultValue: 85
      },
      minSampleSize: {
        type: DataTypes.INTEGER,
        defaultValue: 5
      },
      bayesianPrior: {
        type: DataTypes.DECIMAL(5, 4),
        defaultValue: 0.25
      },
      bayesianWeight: {
        type: DataTypes.INTEGER,
        defaultValue: 3
      },
      highValueExperienceTiers: {
        type: DataTypes.TEXT,
        defaultValue: JSON.stringify(["Senior Sales Representative", "Enterprise AE", "Strategic AE", "senior_ae", "sales_manager"])
      },
      isPerformanceRoutingEnabled: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
      },
      createdAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
      },
      updatedAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
      }
    });

    // 3. Create LeadAssignmentAudits Table
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
        defaultValue: "automated"
      },
      createdAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
      }
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable("LeadAssignmentAudits");
    await queryInterface.dropTable("SalesAssignmentPolicies");
  }
};
