'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Add costPrice to PriceBookEntries if not present
    const pbeTable = await queryInterface.describeTable('PriceBookEntries');
    if (!pbeTable.costPrice) {
      await queryInterface.addColumn('PriceBookEntries', 'costPrice', {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      });
    }

    // 2. Create SalesApprovalProfiles
    await queryInterface.createTable('SalesApprovalProfiles', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      salesRepId: {
        type: Sequelize.UUID,
        allowNull: false,
        unique: true,
      },
      selfApprovalLimit: {
        type: Sequelize.DECIMAL(15, 2),
        defaultValue: 1000000,
      },
      discountApprovalLimit: {
        type: Sequelize.DECIMAL(5, 4),
        defaultValue: 0.10,
      },
      minimumMargin: {
        type: Sequelize.DECIMAL(5, 4),
        defaultValue: 0.20,
      },
      teamLeadId: {
        type: Sequelize.UUID,
        allowNull: true,
      },
      approvalEnabled: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
      },
      effectiveFrom: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      effectiveUntil: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    // 3. Create AdminApprovalPolicies
    await queryInterface.createTable('AdminApprovalPolicies', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      maximumSalesRepApproval: {
        type: Sequelize.DECIMAL(15, 2),
        defaultValue: 2500000,
      },
      maximumTeamLeadApproval: {
        type: Sequelize.DECIMAL(15, 2),
        defaultValue: 10000000,
      },
      maximumRepDiscount: {
        type: Sequelize.DECIMAL(5, 4),
        defaultValue: 0.10,
      },
      maximumTeamLeadDiscount: {
        type: Sequelize.DECIMAL(5, 4),
        defaultValue: 0.20,
      },
      minimumAllowedMargin: {
        type: Sequelize.DECIMAL(5, 4),
        defaultValue: 0.15,
      },
      updatedById: {
        type: Sequelize.UUID,
        allowNull: true,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    // 4. Create ApprovalAuditLogs
    await queryInterface.createTable('ApprovalAuditLogs', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      quoteId: {
        type: Sequelize.UUID,
        allowNull: false,
      },
      salesRepId: {
        type: Sequelize.UUID,
        allowNull: false,
      },
      approvalLevel: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      requiredLimit: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true,
      },
      actualQuoteValue: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false,
      },
      discount: {
        type: Sequelize.DECIMAL(5, 4),
        defaultValue: 0,
      },
      margin: {
        type: Sequelize.DECIMAL(5, 4),
        allowNull: true,
      },
      approverId: {
        type: Sequelize.UUID,
        allowNull: true,
      },
      decision: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      comment: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      previousStatus: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      newStatus: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      reason: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('ApprovalAuditLogs');
    await queryInterface.dropTable('AdminApprovalPolicies');
    await queryInterface.dropTable('SalesApprovalProfiles');
  },
};
