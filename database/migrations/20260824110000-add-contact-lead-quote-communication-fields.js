"use strict";

const { DataTypes } = require("sequelize");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableInfoContacts = await queryInterface.describeTable("Contacts").catch(() => ({}));
    if (!tableInfoContacts.whatsappNumber) {
      await queryInterface.addColumn("Contacts", "whatsappNumber", {
        type: DataTypes.STRING,
        allowNull: true
      }).catch(err => console.warn("Could not add whatsappNumber to Contacts:", err.message));
    }
    if (!tableInfoContacts.preferredCommunicationChannel) {
      await queryInterface.addColumn("Contacts", "preferredCommunicationChannel", {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: "UNSPECIFIED"
      }).catch(err => console.warn("Could not add preferredCommunicationChannel to Contacts:", err.message));
    }
    if (!tableInfoContacts.emailVerified) {
      await queryInterface.addColumn("Contacts", "emailVerified", {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      }).catch(err => console.warn("Could not add emailVerified to Contacts:", err.message));
    }
    if (!tableInfoContacts.whatsappVerified) {
      await queryInterface.addColumn("Contacts", "whatsappVerified", {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      }).catch(err => console.warn("Could not add whatsappVerified to Contacts:", err.message));
    }

    const tableInfoLeads = await queryInterface.describeTable("Leads").catch(() => ({}));
    if (!tableInfoLeads.preferredCommunicationChannel) {
      await queryInterface.addColumn("Leads", "preferredCommunicationChannel", {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: "UNSPECIFIED"
      }).catch(err => console.warn("Could not add preferredCommunicationChannel to Leads:", err.message));
    }

    const tableInfoQuotes = await queryInterface.describeTable("Quotes").catch(() => ({}));
    if (!tableInfoQuotes.sentVia) {
      await queryInterface.addColumn("Quotes", "sentVia", {
        type: DataTypes.STRING,
        allowNull: true
      }).catch(err => console.warn("Could not add sentVia to Quotes:", err.message));
    }
    if (!tableInfoQuotes.isFinalAgreed) {
      await queryInterface.addColumn("Quotes", "isFinalAgreed", {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      }).catch(err => console.warn("Could not add isFinalAgreed to Quotes:", err.message));
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("Contacts", "whatsappNumber").catch(() => {});
    await queryInterface.removeColumn("Contacts", "preferredCommunicationChannel").catch(() => {});
    await queryInterface.removeColumn("Contacts", "emailVerified").catch(() => {});
    await queryInterface.removeColumn("Contacts", "whatsappVerified").catch(() => {});
    await queryInterface.removeColumn("Leads", "preferredCommunicationChannel").catch(() => {});
    await queryInterface.removeColumn("Quotes", "sentVia").catch(() => {});
    await queryInterface.removeColumn("Quotes", "isFinalAgreed").catch(() => {});
  }
};
