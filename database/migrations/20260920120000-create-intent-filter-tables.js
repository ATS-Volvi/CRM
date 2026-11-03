"use strict";

const { DataTypes } = require("sequelize");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();

    // 1. Create IntentDecisions table
    if (!tables.includes("IntentDecisions")) {
      await queryInterface.createTable("IntentDecisions", {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true,
        },
        channel: {
          type: DataTypes.STRING,
          allowNull: false,
          defaultValue: "email",
        },
        senderEmail: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        subject: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        label: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        leadScore: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 50,
        },
        confidence: {
          type: DataTypes.STRING,
          allowNull: false,
          defaultValue: "medium",
        },
        action: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        reason: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        language: {
          type: DataTypes.STRING,
          allowNull: true,
          defaultValue: "en",
        },
        wouldHaveBlocked: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        enforced: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        leadId: {
          type: DataTypes.UUID,
          allowNull: true,
        },
        createdAt: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW,
        },
        updatedAt: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW,
        },
      });

      // Indexes for dashboard and filtering performance
      await queryInterface.addIndex("IntentDecisions", ["senderEmail"]);
      await queryInterface.addIndex("IntentDecisions", ["createdAt"]);
      await queryInterface.addIndex("IntentDecisions", ["action"]);
      await queryInterface.addIndex("IntentDecisions", ["label"]);
    }

    // 2. Create SenderRules table
    if (!tables.includes("SenderRules")) {
      await queryInterface.createTable("SenderRules", {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true,
        },
        type: {
          type: DataTypes.STRING,
          allowNull: false, // "allow" | "block"
        },
        matchType: {
          type: DataTypes.STRING,
          allowNull: false, // "email" | "domain"
        },
        value: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        createdById: {
          type: DataTypes.UUID,
          allowNull: true,
        },
        note: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        createdAt: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW,
        },
        updatedAt: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW,
        },
      });

      // Unique constraint on (matchType, value)
      await queryInterface.addIndex("SenderRules", ["matchType", "value"], {
        unique: true,
        name: "sender_rules_matchtype_value_unique",
      });
    }

    // 3. Extend FlaggedLeads table
    if (tables.includes("FlaggedLeads")) {
      const flaggedInfo = await queryInterface.describeTable("FlaggedLeads");

      if (!flaggedInfo.channel) {
        await queryInterface.addColumn("FlaggedLeads", "channel", {
          type: DataTypes.STRING,
          allowNull: true,
          defaultValue: "email",
        });
      }

      if (!flaggedInfo.disposition) {
        await queryInterface.addColumn("FlaggedLeads", "disposition", {
          type: DataTypes.STRING,
          allowNull: true,
          defaultValue: "review", // review | pending_clarification | archived | promoted | rejected
        });
      }

      if (!flaggedInfo.intentLabel) {
        await queryInterface.addColumn("FlaggedLeads", "intentLabel", {
          type: DataTypes.STRING,
          allowNull: true,
        });
      }

      if (!flaggedInfo.intentScore) {
        await queryInterface.addColumn("FlaggedLeads", "intentScore", {
          type: DataTypes.INTEGER,
          allowNull: true,
        });
      }

      if (!flaggedInfo.explanation) {
        await queryInterface.addColumn("FlaggedLeads", "explanation", {
          type: DataTypes.TEXT,
          allowNull: true,
        });
      }

      if (!flaggedInfo.senderEmail) {
        await queryInterface.addColumn("FlaggedLeads", "senderEmail", {
          type: DataTypes.STRING,
          allowNull: true,
        });
      }

      if (!flaggedInfo.subject) {
        await queryInterface.addColumn("FlaggedLeads", "subject", {
          type: DataTypes.STRING,
          allowNull: true,
        });
      }

      if (!flaggedInfo.promotedLeadId) {
        await queryInterface.addColumn("FlaggedLeads", "promotedLeadId", {
          type: DataTypes.UUID,
          allowNull: true,
        });
      }

      if (!flaggedInfo.reviewedById) {
        await queryInterface.addColumn("FlaggedLeads", "reviewedById", {
          type: DataTypes.UUID,
          allowNull: true,
        });
      }

      if (!flaggedInfo.reviewedAt) {
        await queryInterface.addColumn("FlaggedLeads", "reviewedAt", {
          type: DataTypes.DATE,
          allowNull: true,
        });
      }

      if (!flaggedInfo.autoReplySentAt) {
        await queryInterface.addColumn("FlaggedLeads", "autoReplySentAt", {
          type: DataTypes.DATE,
          allowNull: true,
        });
      }
    }
  },

  async down(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();

    if (tables.includes("FlaggedLeads")) {
      const flaggedInfo = await queryInterface.describeTable("FlaggedLeads");
      const columnsToRemove = [
        "channel",
        "disposition",
        "intentLabel",
        "intentScore",
        "explanation",
        "senderEmail",
        "subject",
        "promotedLeadId",
        "reviewedById",
        "reviewedAt",
        "autoReplySentAt",
      ];
      for (const col of columnsToRemove) {
        if (flaggedInfo[col]) {
          await queryInterface.removeColumn("FlaggedLeads", col);
        }
      }
    }

    if (tables.includes("SenderRules")) {
      await queryInterface.dropTable("SenderRules");
    }

    if (tables.includes("IntentDecisions")) {
      await queryInterface.dropTable("IntentDecisions");
    }
  },
};
