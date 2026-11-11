'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable('UserAttendances').catch(() => null);
    if (!tableInfo) {
      await queryInterface.createTable('UserAttendances', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true,
          allowNull: false
        },
        userId: {
          type: Sequelize.UUID,
          allowNull: false
        },
        date: {
          type: Sequelize.STRING,
          allowNull: false
        },
        checkInTime: {
          type: Sequelize.DATE,
          allowNull: false
        },
        checkOutTime: {
          type: Sequelize.DATE,
          allowNull: true
        },
        durationMinutes: {
          type: Sequelize.INTEGER,
          allowNull: true
        },
        status: {
          type: Sequelize.STRING,
          allowNull: false,
          defaultValue: 'Present'
        },
        notes: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        ipAddress: {
          type: Sequelize.STRING,
          allowNull: true
        },
        userAgent: {
          type: Sequelize.STRING,
          allowNull: true
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

      await queryInterface.addIndex('UserAttendances', ['userId', 'date'], {
        unique: true,
        name: 'user_attendances_user_date_unique'
      }).catch(() => {});
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('UserAttendances').catch(() => {});
  }
};

