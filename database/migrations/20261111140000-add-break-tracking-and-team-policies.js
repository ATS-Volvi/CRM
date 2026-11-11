'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add columns to UserAttendances if they don't already exist
    const userAttendancesTable = await queryInterface.describeTable('UserAttendances').catch(() => null);

    if (userAttendancesTable) {
      if (!userAttendancesTable.currentBreakStart) {
        await queryInterface.addColumn('UserAttendances', 'currentBreakStart', {
          type: Sequelize.DATE,
          allowNull: true,
        }).catch(() => {});
      }
      if (!userAttendancesTable.totalBreakMinutes) {
        await queryInterface.addColumn('UserAttendances', 'totalBreakMinutes', {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0,
        }).catch(() => {});
      }
      if (!userAttendancesTable.netDurationMinutes) {
        await queryInterface.addColumn('UserAttendances', 'netDurationMinutes', {
          type: Sequelize.INTEGER,
          allowNull: true,
        }).catch(() => {});
      }
    }

    // Create TeamBreakPolicies table
    const teamBreakPoliciesTable = await queryInterface.describeTable('TeamBreakPolicies').catch(() => null);
    if (!teamBreakPoliciesTable) {
      await queryInterface.createTable('TeamBreakPolicies', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true,
        },
        teamName: {
          type: Sequelize.STRING,
          allowNull: false,
          unique: true,
        },
        maxBreakMinutes: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 60,
        },
        updatedByUserId: {
          type: Sequelize.UUID,
          allowNull: true,
        },
        createdAt: {
          type: Sequelize.DATE,
          allowNull: false,
        },
        updatedAt: {
          type: Sequelize.DATE,
          allowNull: false,
        },
      }).catch(() => {});
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('UserAttendances', 'currentBreakStart').catch(() => {});
    await queryInterface.removeColumn('UserAttendances', 'totalBreakMinutes').catch(() => {});
    await queryInterface.removeColumn('UserAttendances', 'netDurationMinutes').catch(() => {});
    await queryInterface.dropTable('TeamBreakPolicies').catch(() => {});
  }
};
