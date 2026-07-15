'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Users Table
    await queryInterface.createTable('Users', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      name: { type: Sequelize.STRING, allowNull: false },
      email: { type: Sequelize.STRING, allowNull: false, unique: true },
      password: { type: Sequelize.STRING, allowNull: false },
      role: { type: Sequelize.STRING, defaultValue: "sales_rep" },
      maxOpenLeads: { type: Sequelize.INTEGER, defaultValue: 20 },
      isAvailable: { type: Sequelize.BOOLEAN, defaultValue: true },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false }
    });

    // 2. Leads Table
    await queryInterface.createTable('Leads', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      firstName: { type: Sequelize.STRING, allowNull: false },
      lastName: { type: Sequelize.STRING, allowNull: false },
      company: { type: Sequelize.STRING, allowNull: true },
      email: { type: Sequelize.STRING, allowNull: false },
      phone: { type: Sequelize.STRING, allowNull: true },
      status: { type: Sequelize.STRING, defaultValue: "New" },
      source: { type: Sequelize.STRING, allowNull: true },
      industry: { type: Sequelize.STRING, allowNull: true },
      leadScore: { type: Sequelize.INTEGER, defaultValue: 50 },
      sourceDetail: { type: Sequelize.STRING, allowNull: true },
      campaign: { type: Sequelize.STRING, allowNull: true },
      rawPayload: { type: Sequelize.TEXT, allowNull: true },
      optedOutEmail: { type: Sequelize.BOOLEAN, defaultValue: false },
      subject: { type: Sequelize.STRING, allowNull: true },
      body: { type: Sequelize.TEXT, allowNull: true },
      assignedToId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false }
    });

    // Index on assignedToId for Leads
    await queryInterface.addIndex('Leads', ['assignedToId']);

    // 3. PipelineStages Table
    await queryInterface.createTable('PipelineStages', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      name: {
        type: Sequelize.ENUM("New", "Contacted", "Qualified", "Meeting/Demo", "Proposal", "Negotiation", "Won", "Lost", "On Hold"),
        allowNull: false
      },
      order: { type: Sequelize.INTEGER, allowNull: false },
      probability: { type: Sequelize.INTEGER, defaultValue: 0 },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false }
    });

    // 4. LeadStageHistories Table
    await queryInterface.createTable('LeadStageHistories', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      fromStage: { type: Sequelize.STRING, allowNull: false },
      toStage: { type: Sequelize.STRING, allowNull: false },
      reason: { type: Sequelize.TEXT, allowNull: true },
      leadId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Leads', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      changedById: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      createdAt: { type: Sequelize.DATE, allowNull: false }
    });

    // 5. Deals Table
    await queryInterface.createTable('Deals', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      name: { type: Sequelize.STRING, allowNull: false },
      amount: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
      expectedCloseDate: { type: Sequelize.DATE, allowNull: true },
      recontactDate: { type: Sequelize.DATE, allowNull: true },
      lossReason: { type: Sequelize.TEXT, allowNull: true },
      competitors: { type: Sequelize.TEXT, allowNull: true },
      probability: { type: Sequelize.INTEGER, allowNull: true },
      stageId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'PipelineStages', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      leadId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'Leads', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      ownerId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false }
    });

    // 6. Quotes Table
    await queryInterface.createTable('Quotes', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      status: { type: Sequelize.STRING, defaultValue: "Draft" },
      totalAmount: { type: Sequelize.DECIMAL(10, 2), defaultValue: 0 },
      expirationDate: { type: Sequelize.DATE, allowNull: true },
      quoteNumber: { type: Sequelize.STRING, allowNull: true },
      version: { type: Sequelize.INTEGER, defaultValue: 1 },
      sentAt: { type: Sequelize.DATE, allowNull: true },
      viewedAt: { type: Sequelize.DATE, allowNull: true },
      acceptedAt: { type: Sequelize.DATE, allowNull: true },
      statusChangedAt: { type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      followUpSentAt: { type: Sequelize.DATE, allowNull: true },
      docusignEnvelopeId: { type: Sequelize.STRING, allowNull: true },
      dealId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Deals', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false }
    });

    // 7. PriceBookEntries Table
    await queryInterface.createTable('PriceBookEntries', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      sku: { type: Sequelize.STRING, allowNull: false, unique: true },
      name: { type: Sequelize.STRING, allowNull: false },
      description: { type: Sequelize.TEXT, allowNull: true },
      unitPrice: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
      category: { type: Sequelize.STRING, allowNull: true },
      minPrice: { type: Sequelize.DECIMAL(10, 2), allowNull: true },
      maxPrice: { type: Sequelize.DECIMAL(10, 2), allowNull: true },
      segmentPricing: { type: Sequelize.TEXT, defaultValue: "{}" },
      startDate: { type: Sequelize.DATE, allowNull: true },
      endDate: { type: Sequelize.DATE, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false }
    });

    // 8. QuoteLineItems Table
    await queryInterface.createTable('QuoteLineItems', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      quantity: { type: Sequelize.INTEGER, allowNull: false },
      unitPrice: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
      totalPrice: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
      quoteId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Quotes', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      productId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'PriceBookEntries', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false }
    });

    // 9. PurchaseOrders Table
    await queryInterface.createTable('PurchaseOrders', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      status: { type: Sequelize.STRING, defaultValue: "Pending" },
      amount: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
      poNumber: { type: Sequelize.STRING, allowNull: false, unique: true },
      generatedDate: { type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      quoteId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Quotes', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false }
    });

    // 10. ApprovalRequests Table
    await queryInterface.createTable('ApprovalRequests', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      targetId: { type: Sequelize.STRING, allowNull: false },
      type: { type: Sequelize.STRING, allowNull: false },
      status: { type: Sequelize.STRING, defaultValue: "Pending" },
      comments: { type: Sequelize.TEXT, allowNull: true },
      requestedById: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      approvedById: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false }
    });

    // 11. AssignmentRules Table
    await queryInterface.createTable('AssignmentRules', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      criteria: { type: Sequelize.TEXT, allowNull: false },
      priority: { type: Sequelize.INTEGER, defaultValue: 0 },
      isActive: { type: Sequelize.BOOLEAN, defaultValue: true },
      ruleType: { type: Sequelize.STRING, defaultValue: "Round-robin" },
      assignToId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false }
    });

    // 12. Activities Table
    await queryInterface.createTable('Activities', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      type: {
        type: Sequelize.ENUM("call", "email", "meeting", "task", "whatsapp_sms", "note", "stage_change"),
        allowNull: false
      },
      duration: { type: Sequelize.INTEGER, allowNull: true },
      outcome: { type: Sequelize.STRING, allowNull: true },
      notes: { type: Sequelize.TEXT, allowNull: true },
      mentioned_user_ids: { type: Sequelize.TEXT, defaultValue: "[]" },
      pinned: { type: Sequelize.BOOLEAN, defaultValue: false },
      dueDate: { type: Sequelize.DATE, allowNull: true },
      priority: { type: Sequelize.STRING, allowNull: true },
      isCompleted: { type: Sequelize.BOOLEAN, defaultValue: false },
      leadId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Leads', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      createdById: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false }
    });

    // 13. BundleTemplates Table
    await queryInterface.createTable('BundleTemplates', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      name: { type: Sequelize.STRING, allowNull: false },
      description: { type: Sequelize.TEXT, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false }
    });

    // 14. BundleItems Table
    await queryInterface.createTable('BundleItems', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      quantity: { type: Sequelize.INTEGER, defaultValue: 1 },
      bundleTemplateId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'BundleTemplates', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      productId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'PriceBookEntries', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false }
    });

    // 15. ApprovalTiers Table
    await queryInterface.createTable('ApprovalTiers', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      name: { type: Sequelize.STRING, allowNull: false },
      thresholdValue: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
      requiredRole: { type: Sequelize.STRING, defaultValue: "sales_manager" },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false }
    });

    // 16. KpiTargets Table
    await queryInterface.createTable('KpiTargets', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      userId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      kpiName: { type: Sequelize.STRING, allowNull: false },
      targetValue: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
      period: { type: Sequelize.STRING, defaultValue: "monthly" },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false }
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('KpiTargets');
    await queryInterface.dropTable('ApprovalTiers');
    await queryInterface.dropTable('BundleItems');
    await queryInterface.dropTable('BundleTemplates');
    await queryInterface.dropTable('Activities');
    await queryInterface.dropTable('AssignmentRules');
    await queryInterface.dropTable('ApprovalRequests');
    await queryInterface.dropTable('PurchaseOrders');
    await queryInterface.dropTable('QuoteLineItems');
    await queryInterface.dropTable('PriceBookEntries');
    await queryInterface.dropTable('Quotes');
    await queryInterface.dropTable('Deals');
    await queryInterface.dropTable('LeadStageHistories');
    await queryInterface.dropTable('PipelineStages');
    await queryInterface.dropTable('Leads');
    await queryInterface.dropTable('Users');
  }
};
