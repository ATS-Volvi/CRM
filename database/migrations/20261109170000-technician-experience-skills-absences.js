'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Add fields to ServiceResources
    const resTable = await queryInterface.describeTable('ServiceResources').catch(() => null);
    if (resTable) {
      if (!resTable.experienceYearsWithCompany) {
        await queryInterface.addColumn('ServiceResources', 'experienceYearsWithCompany', {
          type: Sequelize.FLOAT,
          allowNull: true,
          defaultValue: 0,
        });
      }
      if (!resTable.previousExperience) {
        await queryInterface.addColumn('ServiceResources', 'previousExperience', {
          type: Sequelize.TEXT,
          allowNull: true,
        });
      }
      if (!resTable.certifications) {
        await queryInterface.addColumn('ServiceResources', 'certifications', {
          type: Sequelize.JSON,
          allowNull: true,
          defaultValue: [],
        });
      }
      if (!resTable.attendanceStatus) {
        await queryInterface.addColumn('ServiceResources', 'attendanceStatus', {
          type: Sequelize.STRING,
          allowNull: false,
          defaultValue: 'On Duty',
        });
      }
    }

    // 2. Create ResourceAbsences table
    const absTable = await queryInterface.describeTable('ResourceAbsences').catch(() => null);
    if (!absTable) {
      await queryInterface.createTable('ResourceAbsences', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true,
        },
        serviceResourceId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'ServiceResources',
            key: 'id',
          },
          onDelete: 'CASCADE',
        },
        type: {
          type: Sequelize.STRING,
          allowNull: false,
          defaultValue: 'Vacation',
        },
        startDate: {
          type: Sequelize.DATE,
          allowNull: false,
        },
        endDate: {
          type: Sequelize.DATE,
          allowNull: false,
        },
        reason: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        status: {
          type: Sequelize.STRING,
          allowNull: false,
          defaultValue: 'Approved',
        },
        createdAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn('NOW'),
        },
        updatedAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn('NOW'),
        },
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    const absTable = await queryInterface.describeTable('ResourceAbsences').catch(() => null);
    if (absTable) {
      await queryInterface.dropTable('ResourceAbsences');
    }

    const resTable = await queryInterface.describeTable('ServiceResources').catch(() => null);
    if (resTable) {
      if (resTable.experienceYearsWithCompany) await queryInterface.removeColumn('ServiceResources', 'experienceYearsWithCompany');
      if (resTable.previousExperience) await queryInterface.removeColumn('ServiceResources', 'previousExperience');
      if (resTable.certifications) await queryInterface.removeColumn('ServiceResources', 'certifications');
      if (resTable.attendanceStatus) await queryInterface.removeColumn('ServiceResources', 'attendanceStatus');
    }
  },
};

