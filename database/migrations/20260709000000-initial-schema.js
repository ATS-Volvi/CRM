'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const defaultFields = {
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
    };

    await queryInterface.createTable('Users', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      name: { type: Sequelize.STRING, allowNull: false },
      email: { type: Sequelize.STRING, allowNull: false, unique: true },
      password: { type: Sequelize.STRING, allowNull: false },
      role: { type: Sequelize.STRING, defaultValue: "sales_rep" },
      ...defaultFields
    });

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
      optedOutEmail: { type: Sequelize.BOOLEAN, defaultValue: false },
      assignedToId: { type: Sequelize.UUID, references: { model: 'Users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
      ...defaultFields
    });

    await queryInterface.createTable('PipelineStages', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      name: { type: Sequelize.ENUM("New", "Contacted", "Qualified", "Meeting/Demo", "Proposal", "Negotiation", "Won", "Lost", "On Hold"), allowNull: false },
      order: { type: Sequelize.INTEGER, allowNull: false },
      probability: { type: Sequelize.INTEGER, defaultValue: 0 },
      ...defaultFields
    });

    await queryInterface.createTable('LeadStageHistories', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      leadId: { type: Sequelize.UUID, references: { model: 'Leads', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      fromStage: { type: Sequelize.STRING, allowNull: false },
      toStage: { type: Sequelize.STRING, allowNull: false },
      changedById: { type: Sequelize.UUID, references: { model: 'Users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
      reason: { type: Sequelize.TEXT, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
    });

    await queryInterface.createTable('Deals', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      name: { type: Sequelize.STRING, allowNull: false },
      amount: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
      expectedCloseDate: { type: Sequelize.DATE, allowNull: true },
      recontactDate: { type: Sequelize.DATE, allowNull: true },
      lossReason: { type: Sequelize.TEXT, allowNull: true },
      stageId: { type: Sequelize.UUID, references: { model: 'PipelineStages', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
      leadId: { type: Sequelize.UUID, references: { model: 'Leads', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
      ownerId: { type: Sequelize.UUID, references: { model: 'Users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
      ...defaultFields
    });

    await queryInterface.createTable('Quotes', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      dealId: { type: Sequelize.UUID, references: { model: 'Deals', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
      status: { type: Sequelize.STRING, defaultValue: "Draft" },
      totalAmount: { type: Sequelize.DECIMAL(10, 2), defaultValue: 0 },
      expirationDate: { type: Sequelize.DATE, allowNull: true },
      statusChangedAt: { type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      followUpSentAt: { type: Sequelize.DATE, allowNull: true },
      docusignEnvelopeId: { type: Sequelize.STRING, allowNull: true },
      ...defaultFields
    });

    await queryInterface.createTable('PriceBookEntries', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      sku: { type: Sequelize.STRING, allowNull: false, unique: true },
      name: { type: Sequelize.STRING, allowNull: false },
      description: { type: Sequelize.TEXT, allowNull: true },
      unitPrice: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
      category: { type: Sequelize.STRING, allowNull: true },
      ...defaultFields
    });

    await queryInterface.createTable('QuoteLineItems', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      quoteId: { type: Sequelize.UUID, references: { model: 'Quotes', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      productId: { type: Sequelize.UUID, references: { model: 'PriceBookEntries', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
      quantity: { type: Sequelize.INTEGER, allowNull: false },
      unitPrice: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
      totalPrice: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
      ...defaultFields
    });

    await queryInterface.createTable('PurchaseOrders', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      quoteId: { type: Sequelize.UUID, references: { model: 'Quotes', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      status: { type: Sequelize.STRING, defaultValue: "Pending" },
      amount: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
      poNumber: { type: Sequelize.STRING, allowNull: false, unique: true },
      generatedDate: { type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      ...defaultFields
    });

    await queryInterface.createTable('ApprovalRequests', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      targetId: { type: Sequelize.STRING, allowNull: false },
      type: { type: Sequelize.STRING, allowNull: false },
      status: { type: Sequelize.STRING, defaultValue: "Pending" },
      comments: { type: Sequelize.TEXT, allowNull: true },
      requestedById: { type: Sequelize.UUID, references: { model: 'Users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
      approvedById: { type: Sequelize.UUID, references: { model: 'Users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
      ...defaultFields
    });

    await queryInterface.createTable('AssignmentRules', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      criteria: { type: Sequelize.TEXT, allowNull: false },
      priority: { type: Sequelize.INTEGER, defaultValue: 0 },
      isActive: { type: Sequelize.BOOLEAN, defaultValue: true },
      assignToId: { type: Sequelize.UUID, references: { model: 'Users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
      ...defaultFields
    });

    await queryInterface.createTable('Activities', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      type: { type: Sequelize.ENUM("call", "email", "meeting", "task", "whatsapp_sms", "note", "stage_change"), allowNull: false },
      duration: { type: Sequelize.INTEGER, allowNull: true },
      outcome: { type: Sequelize.STRING, allowNull: true },
      notes: { type: Sequelize.TEXT, allowNull: true },
      mentioned_user_ids: { type: Sequelize.TEXT, defaultValue: "[]" },
      pinned: { type: Sequelize.BOOLEAN, defaultValue: false },
      leadId: { type: Sequelize.UUID, references: { model: 'Leads', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      createdById: { type: Sequelize.UUID, references: { model: 'Users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
      ...defaultFields
    });

    await queryInterface.createTable('Invoices', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      quoteId: { type: Sequelize.UUID, references: { model: 'Quotes', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      status: { type: Sequelize.STRING, defaultValue: "Draft" },
      totalAmount: { type: Sequelize.DECIMAL(10, 2), defaultValue: 0 },
      dueDate: { type: Sequelize.DATE, allowNull: true },
      notes: { type: Sequelize.TEXT, allowNull: true },
      ...defaultFields
    });

    await queryInterface.createTable('InvoiceLineItems', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      invoiceId: { type: Sequelize.UUID, references: { model: 'Invoices', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      productId: { type: Sequelize.UUID, references: { model: 'PriceBookEntries', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
      quantity: { type: Sequelize.INTEGER, allowNull: false },
      unitPrice: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
      totalPrice: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
      ...defaultFields
    });

    await queryInterface.createTable('MessageTemplates', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      name: { type: Sequelize.STRING, allowNull: false, unique: true },
      channel: { type: Sequelize.STRING, allowNull: false, defaultValue: "email" },
      subject: { type: Sequelize.STRING, allowNull: true },
      body: { type: Sequelize.TEXT, allowNull: false },
      triggerEvent: { type: Sequelize.STRING, allowNull: true },
      isAbTest: { type: Sequelize.BOOLEAN, defaultValue: false },
      variantBSubject: { type: Sequelize.STRING, allowNull: true },
      variantBBody: { type: Sequelize.TEXT, allowNull: true },
      variantASends: { type: Sequelize.INTEGER, defaultValue: 0 },
      variantAOpens: { type: Sequelize.INTEGER, defaultValue: 0 },
      variantBSends: { type: Sequelize.INTEGER, defaultValue: 0 },
      variantBOpens: { type: Sequelize.INTEGER, defaultValue: 0 },
      winnerVariant: { type: Sequelize.STRING, allowNull: true },
      ...defaultFields
    });

    await queryInterface.createTable('Notifications', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      type: { type: Sequelize.STRING, allowNull: false },
      title: { type: Sequelize.STRING, allowNull: false },
      message: { type: Sequelize.TEXT, allowNull: false },
      link: { type: Sequelize.STRING, allowNull: true },
      isRead: { type: Sequelize.BOOLEAN, defaultValue: false },
      userId: { type: Sequelize.UUID, references: { model: 'Users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      templateId: { type: Sequelize.UUID, references: { model: 'MessageTemplates', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
      ...defaultFields
    });

    await queryInterface.createTable('ScheduledEmails', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      leadId: { type: Sequelize.UUID, references: { model: 'Leads', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      templateName: { type: Sequelize.STRING, allowNull: false },
      sendAfter: { type: Sequelize.DATE, allowNull: false },
      sentAt: { type: Sequelize.DATE, allowNull: true },
      ...defaultFields
    });

    await queryInterface.createTable('WebhookEvents', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      source: { type: Sequelize.STRING, allowNull: false },
      payload: { type: Sequelize.TEXT, allowNull: false },
      status: { type: Sequelize.STRING, defaultValue: 'pending' },
      retryCount: { type: Sequelize.INTEGER, defaultValue: 0 },
      errorMessage: { type: Sequelize.TEXT, allowNull: true },
      ...defaultFields
    });
  },

  async down(queryInterface, Sequelize) {
    const tables = [
      'WebhookEvents', 'ScheduledEmails', 'Notifications', 'MessageTemplates',
      'InvoiceLineItems', 'Invoices', 'Activities', 'AssignmentRules',
      'ApprovalRequests', 'PurchaseOrders', 'QuoteLineItems', 'PriceBookEntries',
      'Quotes', 'Deals', 'LeadStageHistories', 'PipelineStages', 'Leads', 'Users'
    ];
    for (const table of tables) {
      await queryInterface.dropTable(table);
    }
  }
};
