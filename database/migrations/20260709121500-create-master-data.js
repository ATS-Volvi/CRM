'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Requirements table
    await queryInterface.createTable('Requirements', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.STRING
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      category: {
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

    // 2. LineItems table
    await queryInterface.createTable('LineItems', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.STRING
      },
      requirementId: {
        type: Sequelize.STRING,
        allowNull: false,
        references: {
          model: 'Requirements',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      unit: {
        type: Sequelize.STRING,
        allowNull: false
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      defaultQuantity: {
        type: Sequelize.DECIMAL(10, 2),
        defaultValue: 1.00
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

    // 3. ConstructionItems table
    await queryInterface.createTable('ConstructionItems', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.STRING
      },
      lineItemId: {
        type: Sequelize.STRING,
        allowNull: false,
        references: {
          model: 'LineItems',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      category: {
        type: Sequelize.STRING,
        allowNull: false
      },
      unit: {
        type: Sequelize.STRING,
        allowNull: false
      },
      quantityPerLineItem: {
        type: Sequelize.DECIMAL(10, 4),
        allowNull: false
      },
      unitCost: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false
      },
      unitPrice: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false
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
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('ConstructionItems');
    await queryInterface.dropTable('LineItems');
    await queryInterface.dropTable('Requirements');
  }
};
