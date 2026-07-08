'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Create ScheduledEmails table
    await queryInterface.createTable('ScheduledEmails', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      leadId: {
        type: Sequelize.UUID,
        allowNull: false,
      },
      templateName: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      sendAfter: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      sentAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });

    // 2. Add columns to Quotes table
    await queryInterface.addColumn('Quotes', 'statusChangedAt', {
      type: Sequelize.DATE,
      defaultValue: Sequelize.NOW
    });

    await queryInterface.addColumn('Quotes', 'followUpSentAt', {
      type: Sequelize.DATE,
      allowNull: true
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('Quotes', 'followUpSentAt');
    await queryInterface.removeColumn('Quotes', 'statusChangedAt');
    await queryInterface.dropTable('ScheduledEmails');
  }
};
