"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    // ── Leads table: WhatsApp display + tracking fields ──────────────────
    const leadsDesc = await queryInterface.describeTable("Leads");

    if (!leadsDesc.lastWhatsappAt) {
      await queryInterface.addColumn("Leads", "lastWhatsappAt", {
        type: Sequelize.DATE,
        allowNull: true,
      });
    }

    if (!leadsDesc.unreadWhatsappCount) {
      await queryInterface.addColumn("Leads", "unreadWhatsappCount", {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        allowNull: false,
      });
    }

    if (!leadsDesc.whatsappPhone) {
      await queryInterface.addColumn("Leads", "whatsappPhone", {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }

    if (!leadsDesc.communicationChannel) {
      await queryInterface.addColumn("Leads", "communicationChannel", {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }

    // ── Activities table: media attachment + idempotency key ─────────────
    const activitiesDesc = await queryInterface.describeTable("Activities");

    if (!activitiesDesc.mediaUrl) {
      await queryInterface.addColumn("Activities", "mediaUrl", {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }

    if (!activitiesDesc.messageId) {
      await queryInterface.addColumn("Activities", "messageId", {
        type: Sequelize.STRING,
        allowNull: true,
      });
      // Add unique index for idempotency (partial — only on non-null values)
      await queryInterface.addIndex("Activities", ["messageId"], {
        unique: true,
        name: "activities_message_id_unique",
        where: { messageId: { [Sequelize.Op.ne]: null } },
      });
    }

    // ── WhatsAppLogs table ────────────────────────────────────────────────
    await queryInterface.createTable('WhatsAppLogs', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      timestamp: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      },
      level: {
        type: Sequelize.STRING,
        defaultValue: 'INFO'
      },
      category: {
        type: Sequelize.STRING,
        allowNull: false
      },
      event: {
        type: Sequelize.STRING,
        allowNull: false
      },
      message: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      details: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      phone: {
        type: Sequelize.STRING,
        allowNull: true
      },
      messageId: {
        type: Sequelize.STRING,
        allowNull: true
      },
      resolved: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    }).catch(() => {});
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('WhatsAppLogs').catch(() => {});
    await queryInterface.removeColumn("Leads", "lastWhatsappAt").catch(() => {});
    await queryInterface.removeColumn("Leads", "unreadWhatsappCount").catch(() => {});
    await queryInterface.removeColumn("Leads", "whatsappPhone").catch(() => {});
    await queryInterface.removeColumn("Leads", "communicationChannel").catch(() => {});
    await queryInterface.removeColumn("Activities", "mediaUrl").catch(() => {});
    await queryInterface.removeIndex("Activities", "activities_message_id_unique").catch(() => {});
    await queryInterface.removeColumn("Activities", "messageId").catch(() => {});
  },
};
