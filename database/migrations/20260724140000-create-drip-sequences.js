'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Sequences Table
    await queryInterface.createTable('Sequences', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      triggerEvent: {
        type: Sequelize.STRING,
        allowNull: true
      },
      isActive: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
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

    // 2. SequenceSteps Table
    await queryInterface.createTable('SequenceSteps', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      sequenceId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Sequences', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      order: {
        type: Sequelize.INTEGER,
        defaultValue: 1
      },
      delayDays: {
        type: Sequelize.INTEGER,
        defaultValue: 1
      },
      messageTemplateId: {
        type: Sequelize.UUID,
        allowNull: true
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

    // 3. SequenceEnrollments Table
    await queryInterface.createTable('SequenceEnrollments', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      leadId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'Leads', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      customerId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'Customers', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      sequenceId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Sequences', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      currentStep: {
        type: Sequelize.INTEGER,
        defaultValue: 1
      },
      enrolledAt: {
        type: Sequelize.DATE
      },
      status: {
        type: Sequelize.STRING,
        defaultValue: 'active'
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
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('SequenceEnrollments');
    await queryInterface.dropTable('SequenceSteps');
    await queryInterface.dropTable('Sequences');
  }
};
