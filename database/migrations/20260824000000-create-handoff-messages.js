"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("HandoffMessages", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      dealId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: "Deals",
          key: "id"
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      },
      leadId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: "Leads",
          key: "id"
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      },
      senderId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: "Users",
          key: "id"
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      recipientId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: "Users",
          key: "id"
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      },
      message: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      isRead: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false
      }
    });

    // Add indexes for fast thread retrieval
    await queryInterface.addIndex("HandoffMessages", ["dealId", "createdAt"]);
    await queryInterface.addIndex("HandoffMessages", ["leadId", "createdAt"]);
    await queryInterface.addIndex("HandoffMessages", ["senderId", "recipientId"]);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable("HandoffMessages");
  }
};
