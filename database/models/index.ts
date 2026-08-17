import { DataTypes, Model, Op } from "sequelize";
import { sequelize } from "../config/dbConn";

export type UserRole = "admin" | "manager" | "senior_ae" | "sales_rep" | "director";

export class User extends Model {
  public id!: string;
  public name!: string;
  public email!: string;
  public password!: string;
  public role!: UserRole;
  public maxOpenLeads!: number;
  public maxActiveOpportunities!: number;
  public hireDate!: Date | null;
  public isAvailable!: boolean;
  public onLeave!: boolean | null;
  public delegatedUserId!: string | null;
  public managerId!: string | null;
  public department!: string | null;
  public territory!: string | null;
  public team!: string | null;
  public emailAlias!: string | null;
  public skills!: string | null;
  public status!: string | null;
  public weight!: number | null;
  public lastAssignedAt!: Date | null;
  public dedicatedEmail!: string | null;
  public dedicatedPhone!: string | null;
  public experienceYears!: number;
  public experienceTier!: string;
  public averageFirstResponseMinutes!: number;
  public slaComplianceRate!: number;
  public managerPerformanceRating!: number;
  public recentHighValueLeadCount!: number;
  public recentLeadValueAssigned!: number;
}

User.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false },
    email: { type: DataTypes.STRING, allowNull: false, unique: true },
    password: { type: DataTypes.STRING, allowNull: false },
    role: { type: DataTypes.STRING, defaultValue: "sales_rep" },
    maxOpenLeads: { type: DataTypes.INTEGER, defaultValue: 20 },
    maxActiveOpportunities: { type: DataTypes.INTEGER, defaultValue: 10 },
    hireDate: { type: DataTypes.DATEONLY, allowNull: true },
    isAvailable: { type: DataTypes.BOOLEAN, defaultValue: true },
    onLeave: { type: DataTypes.BOOLEAN, defaultValue: false },
    delegatedUserId: { type: DataTypes.UUID, allowNull: true },
    managerId: { type: DataTypes.UUID, allowNull: true },
    department: { type: DataTypes.STRING, allowNull: true },
    territory: { type: DataTypes.STRING, allowNull: true },
    team: { type: DataTypes.STRING, allowNull: true },
    emailAlias: { type: DataTypes.STRING, allowNull: true },
    skills: { type: DataTypes.TEXT, allowNull: true },
    status: { type: DataTypes.STRING, defaultValue: "Available" },
    weight: { type: DataTypes.INTEGER, defaultValue: 100 },
    lastAssignedAt: { type: DataTypes.DATE, allowNull: true },
    dedicatedEmail: { type: DataTypes.STRING, allowNull: true },
    dedicatedPhone: { type: DataTypes.STRING, allowNull: true },
    experienceYears: { type: DataTypes.DECIMAL(4, 1), defaultValue: 2.0 },
    experienceTier: { type: DataTypes.STRING, defaultValue: "Sales Representative" },
    averageFirstResponseMinutes: { type: DataTypes.DECIMAL(6, 1), defaultValue: 15.0 },
    slaComplianceRate: { type: DataTypes.DECIMAL(5, 4), defaultValue: 0.95 },
    managerPerformanceRating: { type: DataTypes.DECIMAL(3, 2), defaultValue: 4.0 },
    recentHighValueLeadCount: { type: DataTypes.INTEGER, defaultValue: 0 },
    recentLeadValueAssigned: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 }
  },
  { sequelize, modelName: "User" }
);

export class Lead extends Model {
  public id!: string;
  public firstName!: string;
  public lastName!: string;
  public company!: string;
  public email!: string | null;
  public phone!: string;
  public status!: string;
  public source!: string;
  public industry!: string;
  public assignedToId!: string | null;
  public leadScore!: number;
  public sourceDetail!: string | null;
  public campaign!: string | null;
  public rawPayload!: string | null;
  public isStrategic!: boolean | null;
  public optedOutEmail!: boolean;
  public subject!: string | null;
  public body!: string | null;
  public budgetRange!: string | null;
  public customerId!: string | null;
  public leadNumber!: string | null;
  public categoriesData!: any | null;
  public recipientEmail!: string | null;
  public assignmentMethod!: string | null;
  // WhatsApp tracking fields
  public lastWhatsappAt!: Date | null;
  public unreadWhatsappCount!: number;
  public whatsappPhone!: string | null;
  public communicationChannel!: string | null;

  // Temperature tracking
  public temperature!: string;
  public temperatureOverride!: boolean;
  public lastInboundAt!: Date | null;
  public responsivenessScore!: number;

  // Stage + Next Action Engine & Qualification fields
  public nextAction!: string | null;
  public nextActionDue!: Date | null;
  public qualificationData!: any | null;
}

Lead.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    firstName: { type: DataTypes.STRING, allowNull: false },
    lastName: { type: DataTypes.STRING, allowNull: false },
    company: { type: DataTypes.STRING, allowNull: true },
    email: { type: DataTypes.STRING, allowNull: true },
    phone: { type: DataTypes.STRING, allowNull: true },
    status: { type: DataTypes.STRING, defaultValue: "New" },
    source: { type: DataTypes.STRING, allowNull: true },
    industry: { type: DataTypes.STRING, allowNull: true },
    leadScore: { type: DataTypes.INTEGER, defaultValue: 50 },
    sourceDetail: { type: DataTypes.STRING, allowNull: true },
    campaign: { type: DataTypes.STRING, allowNull: true },
    rawPayload: { type: DataTypes.TEXT, allowNull: true },
    isStrategic: { type: DataTypes.BOOLEAN, defaultValue: false },
    optedOutEmail: { type: DataTypes.BOOLEAN, defaultValue: false },
    subject: { type: DataTypes.STRING, allowNull: true },
    body: { type: DataTypes.TEXT, allowNull: true },
    budgetRange: { type: DataTypes.STRING, allowNull: true },
    customerId: { type: DataTypes.UUID, allowNull: true },
    leadNumber: { type: DataTypes.STRING, allowNull: true, unique: true },
    categoriesData: { type: DataTypes.JSON, allowNull: true },
    recipientEmail: { type: DataTypes.STRING, allowNull: true },
    assignmentMethod: { type: DataTypes.STRING, allowNull: true },
    // WhatsApp tracking
    lastWhatsappAt: { type: DataTypes.DATE, allowNull: true },
    unreadWhatsappCount: { type: DataTypes.INTEGER, defaultValue: 0 },
    whatsappPhone: { type: DataTypes.STRING, allowNull: true },
    communicationChannel: { type: DataTypes.STRING, allowNull: true, defaultValue: "email" },
    temperature: { type: DataTypes.STRING, defaultValue: "Warm" },
    temperatureOverride: { type: DataTypes.BOOLEAN, defaultValue: false },
    lastInboundAt: { type: DataTypes.DATE, allowNull: true },
    responsivenessScore: { type: DataTypes.INTEGER, defaultValue: 0 },
    // Stage + Next Action Engine
    nextAction: { type: DataTypes.STRING, allowNull: true, defaultValue: "Reply to Lead" },
    nextActionDue: { type: DataTypes.DATE, allowNull: true },
    qualificationData: { type: DataTypes.JSON, allowNull: true },
  },
  { 
    sequelize, 
    modelName: "Lead",
    indexes: [
      { fields: ["assignedToId"] }
    ]
  }
);

export class PipelineStage extends Model {
  public id!: string;
  public name!: string;
  public order!: number;
  public probability!: number;
}

PipelineStage.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    name: { 
      type: DataTypes.ENUM, 
      values: ["Qualification", "Needs Analysis", "Proposal", "Negotiation", "Closed Won", "Closed Lost"],
      allowNull: false 
    },
    order: { type: DataTypes.INTEGER, allowNull: false },
    probability: { type: DataTypes.INTEGER, defaultValue: 0 },
  },
  { sequelize, modelName: "PipelineStage" }
);

export class LeadStageHistory extends Model {
  public id!: string;
  public leadId!: string;
  public fromStage!: string;
  public toStage!: string;
  public changedById!: string;
  public reason!: string | null;
}

LeadStageHistory.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    fromStage: { type: DataTypes.STRING, allowNull: false },
    toStage: { type: DataTypes.STRING, allowNull: false },
    reason: { type: DataTypes.TEXT, allowNull: true },
  },
  { sequelize, modelName: "LeadStageHistory", updatedAt: false } // Only tracks creation date
);

export class Deal extends Model {
  public id!: string;
  public name!: string;
  public amount!: number;
  public expectedCloseDate!: Date;
  public stageId!: string;
  public leadId!: string | null;
  public ownerId!: string;
  public recontactDate!: Date | null;
  public lossReason!: string | null;
  public competitors!: string | null;
  public probability!: number | null;
  public customerId!: string | null;
  public accountId!: string | null;
}

Deal.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false },
    amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    expectedCloseDate: { type: DataTypes.DATE, allowNull: true },
    recontactDate: { type: DataTypes.DATE, allowNull: true },
    lossReason: { type: DataTypes.TEXT, allowNull: true },
    competitors: { type: DataTypes.TEXT, allowNull: true },
    probability: { type: DataTypes.INTEGER, allowNull: true },
    customerId: { type: DataTypes.UUID, allowNull: true },
    accountId: { type: DataTypes.UUID, allowNull: true },
  },
  { sequelize, modelName: "Deal" }
);

export class Quote extends Model {
  public id!: string;
  public dealId!: string;
  public status!: string;
  public totalAmount!: number;
  public expirationDate!: Date;
  public statusChangedAt!: Date;
  public followUpSentAt!: Date | null;
  public docusignEnvelopeId!: string | null;
  public quoteNumber!: string | null;
  public version!: number;
  public sentAt!: Date | null;
  public viewedAt!: Date | null;
  public acceptedAt!: Date | null;
}

Quote.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    status: { type: DataTypes.STRING, defaultValue: "Draft" },
    totalAmount: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
    expirationDate: { type: DataTypes.DATE, allowNull: true },
    statusChangedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    followUpSentAt: { type: DataTypes.DATE, allowNull: true },
    docusignEnvelopeId: { type: DataTypes.STRING, allowNull: true },
    quoteNumber: { type: DataTypes.STRING, allowNull: true },
    version: { type: DataTypes.INTEGER, defaultValue: 1 },
    sentAt: { type: DataTypes.DATE, allowNull: true },
    viewedAt: { type: DataTypes.DATE, allowNull: true },
    acceptedAt: { type: DataTypes.DATE, allowNull: true },
  },
  { sequelize, modelName: "Quote" }
);

export class PriceBookEntry extends Model {
  public id!: string;
  public sku!: string;
  public name!: string;
  public description!: string;
  public unitPrice!: number;
  public category!: string;
  public minPrice!: number | null;
  public maxPrice!: number | null;
  public segmentPricing!: string | null; // JSON String
  public startDate!: Date | null;
  public endDate!: Date | null;
}

PriceBookEntry.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    sku: { type: DataTypes.STRING, allowNull: false, unique: true },
    name: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    unitPrice: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    category: { type: DataTypes.STRING, allowNull: true },
    minPrice: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
    maxPrice: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
    segmentPricing: { type: DataTypes.TEXT, defaultValue: "{}" },
    startDate: { type: DataTypes.DATE, allowNull: true },
    endDate: { type: DataTypes.DATE, allowNull: true }
  },
  { sequelize, modelName: "PriceBookEntry" }
);

export class QuoteLineItem extends Model {
  public id!: string;
  public quoteId!: string;
  public productId!: string;
  public quantity!: number;
  public unitPrice!: number;
  public totalPrice!: number;
  public isOptional!: boolean;
}

QuoteLineItem.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    quantity: { type: DataTypes.INTEGER, allowNull: false },
    unitPrice: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    totalPrice: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    isOptional: { type: DataTypes.BOOLEAN, defaultValue: false }
  },
  { sequelize, modelName: "QuoteLineItem" }
);

export type PurchaseOrderType = "customer_po" | "supply_order";

export class PurchaseOrder extends Model {
  public id!: string;
  public quoteId!: string;
  public status!: string;
  public type!: PurchaseOrderType;
  public amount!: number;
  public poNumber!: string;
  public generatedDate!: Date;
}

PurchaseOrder.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    status: { type: DataTypes.STRING, defaultValue: "Pending" },
    type: { type: DataTypes.ENUM("customer_po", "supply_order"), defaultValue: "customer_po", allowNull: false },
    amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    poNumber: { type: DataTypes.STRING, allowNull: false, unique: true },
    generatedDate: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  },
  { sequelize, modelName: "PurchaseOrder" }
);

export class ApprovalRequest extends Model {
  public id!: string;
  public targetId!: string;
  public type!: string; // 'Quote', 'Deal', etc.
  public status!: string;
  public requestedById!: string;
  public approvedById!: string | null;
  public assignedApproverId!: string | null;
  public comments!: string;
}

ApprovalRequest.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    targetId: { type: DataTypes.STRING, allowNull: false },
    type: { type: DataTypes.STRING, allowNull: false },
    status: { type: DataTypes.STRING, defaultValue: "Pending" },
    assignedApproverId: { type: DataTypes.UUID, allowNull: true },
    comments: { type: DataTypes.TEXT, allowNull: true },
  },
  { sequelize, modelName: "ApprovalRequest" }
);

export class AssignmentRule extends Model {
  public id!: string;
  public criteria!: string;
  public assignToId!: string;
  public priority!: number;
  public isActive!: boolean;
  public ruleType!: string;
}

AssignmentRule.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    criteria: { type: DataTypes.TEXT, allowNull: false },
    priority: { type: DataTypes.INTEGER, defaultValue: 0 },
    isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
    ruleType: { type: DataTypes.STRING, defaultValue: "Round-robin" },
  },
  { sequelize, modelName: "AssignmentRule" }
);

export class Activity extends Model {
  public id!: string;
  public leadId!: string;
  public type!: string;
  public duration!: number | null;
  public outcome!: string | null;
  public notes!: string | null;
  public mentioned_user_ids!: string; // JSON string array
  public pinned!: boolean;
  public createdById!: string;
  public dueDate!: Date | null;
  public priority!: string | null;
  public isCompleted!: boolean;
  public mediaUrl!: string | null;  // WhatsApp media attachment
  public messageId!: string | null; // Meta message ID for idempotency
  public customerId!: string | null;
  public direction!: string | null; // inbound, outbound, internal
}

Activity.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    type: { 
      type: DataTypes.ENUM, 
      values: ["call", "email", "meeting", "task", "whatsapp_sms", "instagram_dm", "note", "stage_change"],
      allowNull: false 
    },
    duration: { type: DataTypes.INTEGER, allowNull: true },
    outcome: { type: DataTypes.STRING, allowNull: true },
    notes: { type: DataTypes.TEXT, allowNull: true },
    mentioned_user_ids: { type: DataTypes.TEXT, defaultValue: "[]" },
    pinned: { type: DataTypes.BOOLEAN, defaultValue: false },
    dueDate: { type: DataTypes.DATE, allowNull: true },
    priority: { type: DataTypes.STRING, allowNull: true },
    isCompleted: { type: DataTypes.BOOLEAN, defaultValue: false },
    mediaUrl: { type: DataTypes.STRING, allowNull: true },
    messageId: { type: DataTypes.STRING, allowNull: true },
    customerId: { type: DataTypes.UUID, allowNull: true },
    direction: { type: DataTypes.ENUM("inbound", "outbound", "internal"), allowNull: true },
  },
  { 
    sequelize, 
    modelName: "Activity",
    indexes: [
      { fields: ["messageId"], unique: true, where: { messageId: { [Op.ne]: null } } }
    ]
  }
);

export class Invoice extends Model {
  public id!: string;
  public quoteId!: string;
  public status!: string; // Draft, Sent, Paid, Overdue
  public totalAmount!: number;
  public dueDate!: Date;
  public notes!: string;
}

Invoice.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    status: { type: DataTypes.STRING, defaultValue: "Draft" },
    totalAmount: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
    dueDate: { type: DataTypes.DATE, allowNull: true },
    notes: { type: DataTypes.TEXT, allowNull: true },
  },
  { sequelize, modelName: "Invoice" }
);

export class InvoiceLineItem extends Model {
  public id!: string;
  public invoiceId!: string;
  public productId!: string;
  public quantity!: number;
  public unitPrice!: number;
  public totalPrice!: number;
}

InvoiceLineItem.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    quantity: { type: DataTypes.INTEGER, allowNull: false },
    unitPrice: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    totalPrice: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  },
  { sequelize, modelName: "InvoiceLineItem" }
);

export class Notification extends Model {
  public id!: string;
  public userId!: string;
  public role!: string;
  public type!: string;
  public severity!: string; // INFO, ACTION_REQUIRED, WARNING, CRITICAL
  public title!: string;
  public message!: string;
  public link!: string | null;
  public actionUrl!: string | null;
  public entityType!: string | null;
  public entityId!: string | null;
  public source!: string | null;
  public groupKey!: string | null;
  public eventId!: string | null;
  public metadata!: any | null;
  public isRead!: boolean;
  public readAt!: Date | null;
}

Notification.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    userId: { type: DataTypes.UUID, allowNull: true },
    role: { type: DataTypes.STRING, defaultValue: "SALES_REP" },
    type: { type: DataTypes.STRING, allowNull: false },
    severity: { type: DataTypes.STRING, defaultValue: "INFO" },
    title: { type: DataTypes.STRING, allowNull: false },
    message: { type: DataTypes.TEXT, allowNull: false },
    link: { type: DataTypes.STRING, allowNull: true },
    actionUrl: { type: DataTypes.STRING, allowNull: true },
    entityType: { type: DataTypes.STRING, allowNull: true },
    entityId: { type: DataTypes.STRING, allowNull: true },
    source: { type: DataTypes.STRING, allowNull: true },
    groupKey: { type: DataTypes.STRING, allowNull: true },
    eventId: { type: DataTypes.STRING, allowNull: true },
    metadata: { type: DataTypes.JSON, allowNull: true },
    isRead: { type: DataTypes.BOOLEAN, defaultValue: false },
    readAt: { type: DataTypes.DATE, allowNull: true }
  },
  { sequelize, modelName: "Notification" }
);

export class MessageTemplate extends Model {
  public id!: string;
  public name!: string;
  public channel!: string; // email, sms, in_app
  public subject!: string;
  public body!: string;
  public triggerEvent!: string; // e.g. "deal_won", "lead_created"
  
  // A/B Testing Fields
  public isAbTest!: boolean;
  public variantBSubject!: string | null;
  public variantBBody!: string | null;
  public variantASends!: number;
  public variantAOpens!: number;
  public variantBSends!: number;
  public variantBOpens!: number;
  public winnerVariant!: string | null;
  public isActive!: boolean;
}

MessageTemplate.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false, unique: true },
    channel: { type: DataTypes.STRING, allowNull: false, defaultValue: "email" },
    subject: { type: DataTypes.STRING, allowNull: true },
    body: { type: DataTypes.TEXT, allowNull: false },
    triggerEvent: { type: DataTypes.STRING, allowNull: true },
    isAbTest: { type: DataTypes.BOOLEAN, defaultValue: false },
    variantBSubject: { type: DataTypes.STRING, allowNull: true },
    variantBBody: { type: DataTypes.TEXT, allowNull: true },
    variantASends: { type: DataTypes.INTEGER, defaultValue: 0 },
    variantAOpens: { type: DataTypes.INTEGER, defaultValue: 0 },
    variantBSends: { type: DataTypes.INTEGER, defaultValue: 0 },
    variantBOpens: { type: DataTypes.INTEGER, defaultValue: 0 },
    winnerVariant: { type: DataTypes.STRING, allowNull: true },
    isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
  },
  { sequelize, modelName: "MessageTemplate" }
);

export class ScheduledEmail extends Model {
  public id!: string;
  public leadId!: string;
  public templateName!: string;
  public sendAfter!: Date;
  public sentAt!: Date | null;
}

ScheduledEmail.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    leadId: { type: DataTypes.UUID, allowNull: false },
    templateName: { type: DataTypes.STRING, allowNull: false },
    sendAfter: { type: DataTypes.DATE, allowNull: false },
    sentAt: { type: DataTypes.DATE, allowNull: true },
  },
  { sequelize, modelName: "ScheduledEmail" }
);

export class WebhookEvent extends Model {
  public id!: string;
  public source!: string;
  public payload!: string;
  public status!: string;
  public retryCount!: number;
  public errorMessage!: string | null;
}

WebhookEvent.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    source: { type: DataTypes.STRING, allowNull: false },
    payload: { type: DataTypes.TEXT, allowNull: false },
    status: { type: DataTypes.STRING, defaultValue: 'pending' },
    retryCount: { type: DataTypes.INTEGER, defaultValue: 0 },
    errorMessage: { type: DataTypes.TEXT, allowNull: true },
  },
  { sequelize, modelName: "WebhookEvent" }
);

export class WhatsAppLog extends Model {
  public id!: string;
  public timestamp!: Date;
  public level!: 'ERROR' | 'WARN' | 'INFO' | 'DEBUG';
  public category!: 'CONFIGURATION' | 'WEBHOOK_VERIFICATION' | 'INBOUND_PAYLOAD' | 'OUTBOUND_SEND' | 'DELIVERY_STATUS' | 'LEAD_ASSOCIATION' | 'API_ERROR';
  public event!: string;
  public message!: string;
  public details!: string | null;
  public phone!: string | null;
  public messageId!: string | null;
  public resolved!: boolean;
}

WhatsAppLog.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    timestamp: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    level: { type: DataTypes.STRING, defaultValue: 'INFO' },
    category: { type: DataTypes.STRING, allowNull: false },
    event: { type: DataTypes.STRING, allowNull: false },
    message: { type: DataTypes.TEXT, allowNull: false },
    details: { type: DataTypes.TEXT, allowNull: true },
    phone: { type: DataTypes.STRING, allowNull: true },
    messageId: { type: DataTypes.STRING, allowNull: true },
    resolved: { type: DataTypes.BOOLEAN, defaultValue: false },
  },
  { sequelize, modelName: "WhatsAppLog" }
);


// Define Associations
User.hasMany(Lead, { foreignKey: "assignedToId" });
Lead.belongsTo(User, { foreignKey: "assignedToId", as: "assignedTo" });

Lead.hasMany(LeadStageHistory, { foreignKey: "leadId", as: "stageHistory" });
LeadStageHistory.belongsTo(Lead, { foreignKey: "leadId" });

User.hasMany(LeadStageHistory, { foreignKey: "changedById" });
LeadStageHistory.belongsTo(User, { foreignKey: "changedById", as: "changedBy" });

PipelineStage.hasMany(Deal, { foreignKey: "stageId" });
Deal.belongsTo(PipelineStage, { foreignKey: "stageId", as: "stage" });

User.hasMany(Deal, { foreignKey: "ownerId" });
Deal.belongsTo(User, { foreignKey: "ownerId", as: "owner" });

Lead.hasMany(Deal, { foreignKey: "leadId" });
Deal.belongsTo(Lead, { foreignKey: "leadId", as: "lead" });

Deal.hasMany(Quote, { foreignKey: "dealId" });
Quote.belongsTo(Deal, { foreignKey: "dealId", as: "deal" });

Quote.hasMany(QuoteLineItem, { foreignKey: "quoteId" });
QuoteLineItem.belongsTo(Quote, { foreignKey: "quoteId", as: "quote" });

PriceBookEntry.hasMany(QuoteLineItem, { foreignKey: "productId" });
QuoteLineItem.belongsTo(PriceBookEntry, { foreignKey: "productId", as: "product" });

Quote.hasOne(PurchaseOrder, { foreignKey: "quoteId" });
PurchaseOrder.belongsTo(Quote, { foreignKey: "quoteId", as: "quote" });

User.hasMany(ApprovalRequest, { foreignKey: "requestedById", as: "requestsMade" });
ApprovalRequest.belongsTo(User, { foreignKey: "requestedById", as: "requestedBy" });

User.hasMany(ApprovalRequest, { foreignKey: "approvedById", as: "requestsApproved" });
ApprovalRequest.belongsTo(User, { foreignKey: "approvedById", as: "approvedBy" });

User.hasMany(ApprovalRequest, { foreignKey: "assignedApproverId", as: "requestsAssigned" });
ApprovalRequest.belongsTo(User, { foreignKey: "assignedApproverId", as: "assignedApprover" });

User.hasMany(AssignmentRule, { foreignKey: "assignToId" });
AssignmentRule.belongsTo(User, { foreignKey: "assignToId", as: "assignTo" });

Lead.hasMany(Activity, { foreignKey: "leadId", as: "activities" });
Activity.belongsTo(Lead, { foreignKey: "leadId", as: "lead" });

User.hasMany(Activity, { foreignKey: "createdById", as: "activitiesCreated" });
Activity.belongsTo(User, { foreignKey: "createdById", as: "createdBy" });

Quote.hasOne(Invoice, { foreignKey: "quoteId" });
Invoice.belongsTo(Quote, { foreignKey: "quoteId", as: "quote" });

Invoice.hasMany(InvoiceLineItem, { foreignKey: "invoiceId", as: "lineItems" });
InvoiceLineItem.belongsTo(Invoice, { foreignKey: "invoiceId", as: "invoice" });

PriceBookEntry.hasMany(InvoiceLineItem, { foreignKey: "productId" });
InvoiceLineItem.belongsTo(PriceBookEntry, { foreignKey: "productId", as: "product" });

User.hasMany(Notification, { foreignKey: "userId", as: "notifications" });
Notification.belongsTo(User, { foreignKey: "userId", as: "user" });

MessageTemplate.hasMany(Notification, { foreignKey: "templateId" });
Notification.belongsTo(MessageTemplate, { foreignKey: "templateId" });

Lead.hasMany(ScheduledEmail, { foreignKey: "leadId", as: "scheduledEmails" });
ScheduledEmail.belongsTo(Lead, { foreignKey: "leadId", as: "lead" });

export class BundleTemplate extends Model {
  public id!: string;
  public name!: string;
  public description!: string | null;
}

BundleTemplate.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true }
  },
  { sequelize, modelName: "BundleTemplate" }
);

export class BundleItem extends Model {
  public id!: string;
  public bundleTemplateId!: string;
  public productId!: string;
  public quantity!: number;
  public isOptional!: boolean;
}

BundleItem.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    quantity: { type: DataTypes.INTEGER, defaultValue: 1 },
    isOptional: { type: DataTypes.BOOLEAN, defaultValue: false }
  },
  { sequelize, modelName: "BundleItem" }
);

// Define Bundle Associations
BundleTemplate.hasMany(BundleItem, { foreignKey: "bundleTemplateId", as: "items" });
BundleItem.belongsTo(BundleTemplate, { foreignKey: "bundleTemplateId" });

PriceBookEntry.hasMany(BundleItem, { foreignKey: "productId" });
BundleItem.belongsTo(PriceBookEntry, { foreignKey: "productId", as: "product" });

export class ApprovalTier extends Model {
  public id!: string;
  public name!: string;
  public thresholdValue!: number;
  public requiredRole!: string;
}

ApprovalTier.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false },
    thresholdValue: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    requiredRole: { type: DataTypes.STRING, defaultValue: "sales_manager" }
  },
  { sequelize, modelName: "ApprovalTier" }
);

// ── Master Data BOM Hierarchy ───────────────────────────────
export class Requirement extends Model {
  public id!: string;
  public name!: string;
  public description!: string | null;
  public category!: string | null;
  public isActive!: boolean;
}

Requirement.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    category: { type: DataTypes.STRING, allowNull: true },
    isActive: { type: DataTypes.BOOLEAN, defaultValue: true }
  },
  { sequelize, modelName: "Requirement" }
);

export class LineItem extends Model {
  public id!: string;
  public requirementId!: string;
  public name!: string;
  public unit!: string;
  public description!: string | null;
  public defaultQuantity!: number;
}

LineItem.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    requirementId: { type: DataTypes.UUID, allowNull: false },
    name: { type: DataTypes.STRING, allowNull: false },
    unit: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    defaultQuantity: { type: DataTypes.DECIMAL(10, 2), defaultValue: 1.00 }
  },
  { sequelize, modelName: "LineItem" }
);

export class ConstructionItem extends Model {
  public id!: string;
  public lineItemId!: string;
  public name!: string;
  public category!: string;
  public unit!: string;
  public quantityPerLineItem!: number;
  public unitCost!: number;
  public unitPrice!: number;
  public isActive!: boolean;
}

ConstructionItem.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    lineItemId: { type: DataTypes.UUID, allowNull: false },
    name: { type: DataTypes.STRING, allowNull: false },
    category: { 
      type: DataTypes.ENUM, 
      values: ["material", "labor", "equipment"],
      allowNull: false 
    },
    unit: { type: DataTypes.STRING, allowNull: false },
    quantityPerLineItem: { type: DataTypes.DECIMAL(10, 4), allowNull: false },
    unitCost: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    unitPrice: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    isActive: { type: DataTypes.BOOLEAN, defaultValue: true }
  },
  { sequelize, modelName: "ConstructionItem" }
);


User.hasMany(User, { foreignKey: "managerId", as: "teamMembers" });
User.belongsTo(User, { foreignKey: "managerId", as: "manager" });

Requirement.hasMany(LineItem, { foreignKey: "requirementId", as: "lineItems", onDelete: "CASCADE" });
LineItem.belongsTo(Requirement, { foreignKey: "requirementId", as: "requirement" });

LineItem.hasMany(ConstructionItem, { foreignKey: "lineItemId", as: "constructionItems", onDelete: "CASCADE" });
ConstructionItem.belongsTo(LineItem, { foreignKey: "lineItemId", as: "lineItem" });

export class Account extends Model {
  public id!: string;
  public name!: string;
  public primaryContactName!: string | null;
  public email!: string | null;
  public phone!: string | null;
  public address!: string | null;
  public industry!: string | null;
  public birthday!: string | null;
  public anniversaryDate!: string | null;
}

Account.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false },
    primaryContactName: { type: DataTypes.STRING, allowNull: true },
    email: { type: DataTypes.STRING, allowNull: true },
    phone: { type: DataTypes.STRING, allowNull: true },
    address: { type: DataTypes.TEXT, allowNull: true },
    industry: { type: DataTypes.STRING, allowNull: true },
    birthday: { type: DataTypes.DATEONLY, allowNull: true },
    anniversaryDate: { type: DataTypes.DATEONLY, allowNull: true }
  },
  { sequelize, modelName: "Account", tableName: "Accounts" }
);

// ── Coaching Notes ───────────────────────────────────────────────────────────
export class CoachingNote extends Model {
  public id!: string;
  public dealId!: string | null;
  public leadId!: string | null;
  public authorUserId!: string | null;
  public targetUserId!: string | null;
  public content!: string;
  public isRead!: boolean;
  public createdAt!: Date;
  public updatedAt!: Date;
}

CoachingNote.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    dealId: { type: DataTypes.UUID, allowNull: true },
    leadId: { type: DataTypes.UUID, allowNull: true },
    authorUserId: { type: DataTypes.UUID, allowNull: true },
    targetUserId: { type: DataTypes.UUID, allowNull: true },
    content: { type: DataTypes.TEXT, allowNull: false },
    isRead: { type: DataTypes.BOOLEAN, defaultValue: false }
  },
  { sequelize, modelName: "CoachingNote" }
);

CoachingNote.belongsTo(User, { foreignKey: "authorUserId", as: "author" });
CoachingNote.belongsTo(User, { foreignKey: "targetUserId", as: "targetUser" });
CoachingNote.belongsTo(Deal, { foreignKey: "dealId", as: "deal" });
CoachingNote.belongsTo(Lead, { foreignKey: "leadId", as: "lead" });
User.hasMany(CoachingNote, { foreignKey: "targetUserId", as: "coachingNotes" });
User.hasMany(CoachingNote, { foreignKey: "authorUserId", as: "coachingNotesAuthored" });

export class LeadSource extends Model {
  public id!: string;
  public name!: string;
  public isActive!: boolean;
}

LeadSource.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false, unique: true },
    isActive: { type: DataTypes.BOOLEAN, defaultValue: true }
  },
  { sequelize, modelName: "LeadSource" }
);

Account.hasMany(Lead, { foreignKey: "customerId", as: "leads" });
Lead.belongsTo(Account, { foreignKey: "customerId", as: "customer" });

// NOTE: Deal.belongsTo(Account, { foreignKey: "customerId", as: "customer" }) kept for legacy Deal data compatibility
Deal.belongsTo(Account, { foreignKey: "customerId", as: "customer" });

Account.hasMany(Activity, { foreignKey: "customerId", as: "activities" });
Activity.belongsTo(Account, { foreignKey: "customerId", as: "customer" });

export class LeadReassignmentHistory extends Model {
  public id!: string;
  public leadId!: string;
  public oldAssignedToId!: string | null;
  public newAssignedToId!: string | null;
  public changedByUserId!: string;
  public reason!: string | null;
  public createdAt!: Date;
}

LeadReassignmentHistory.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    leadId: { type: DataTypes.UUID, allowNull: false },
    oldAssignedToId: { type: DataTypes.UUID, allowNull: true },
    newAssignedToId: { type: DataTypes.UUID, allowNull: true },
    changedByUserId: { type: DataTypes.UUID, allowNull: false },
    reason: { type: DataTypes.TEXT, allowNull: true }
  },
  { sequelize, modelName: "LeadReassignmentHistory" }
);

LeadReassignmentHistory.belongsTo(Lead, { foreignKey: "leadId", as: "lead" });
Lead.hasMany(LeadReassignmentHistory, { foreignKey: "leadId", as: "reassignmentHistory" });

LeadReassignmentHistory.belongsTo(User, { foreignKey: "oldAssignedToId", as: "oldAssignee" });
LeadReassignmentHistory.belongsTo(User, { foreignKey: "newAssignedToId", as: "newAssignee" });
LeadReassignmentHistory.belongsTo(User, { foreignKey: "changedByUserId", as: "changedByUser" });

export class KpiTarget extends Model {
  public id!: string;
  public salespersonId!: string;
  public kpiName!: string;
  public targetValue!: number;
  public currentValue!: number;
  public frequency!: string;
  public weightage!: number;
  public effectiveDate!: Date | null;
  public expiryDate!: Date | null;
  public notes!: string | null;
  public createdBy!: string | null;
  public status!: string;
  public createdAt!: Date;
  public updatedAt!: Date;
}

KpiTarget.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    salespersonId: { type: DataTypes.UUID, allowNull: false },
    kpiName: { type: DataTypes.STRING, allowNull: false },
    targetValue: { type: DataTypes.FLOAT, defaultValue: 0 },
    currentValue: { type: DataTypes.FLOAT, defaultValue: 0 },
    frequency: { type: DataTypes.STRING, defaultValue: "monthly" },
    weightage: { type: DataTypes.INTEGER, defaultValue: 10 },
    effectiveDate: { type: DataTypes.DATE, allowNull: true },
    expiryDate: { type: DataTypes.DATE, allowNull: true },
    notes: { type: DataTypes.TEXT, allowNull: true },
    createdBy: { type: DataTypes.UUID, allowNull: true },
    status: { type: DataTypes.STRING, defaultValue: "Active" }
  },
  { sequelize, modelName: "KpiTarget" }
);

export class KpiTargetHistory extends Model {
  public id!: string;
  public kpiTargetId!: string;
  public oldValue!: number;
  public newValue!: number;
  public changedBy!: string;
  public changeDate!: Date;
  public reason!: string | null;
  public createdAt!: Date;
  public updatedAt!: Date;
}

KpiTargetHistory.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    kpiTargetId: { type: DataTypes.UUID, allowNull: false },
    oldValue: { type: DataTypes.FLOAT, defaultValue: 0 },
    newValue: { type: DataTypes.FLOAT, defaultValue: 0 },
    changedBy: { type: DataTypes.UUID, allowNull: false },
    changeDate: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    reason: { type: DataTypes.TEXT, allowNull: true }
  },
  { sequelize, modelName: "KpiTargetHistory" }
);

User.hasMany(KpiTarget, { foreignKey: "salespersonId", as: "kpiTargets" });
KpiTarget.belongsTo(User, { foreignKey: "salespersonId", as: "salesperson" });

KpiTarget.hasMany(KpiTargetHistory, { foreignKey: "kpiTargetId", as: "history" });
KpiTargetHistory.belongsTo(KpiTarget, { foreignKey: "kpiTargetId", as: "kpiTarget" });

KpiTargetHistory.belongsTo(User, { foreignKey: "changedBy", as: "changedByUser" });

export class KpiMaster extends Model {
  public id!: string;
  public name!: string;
  public category!: string;
  public targetValue!: number;
  public frequency!: string;
  public weightage!: number;
  public isActive!: boolean;
}

KpiMaster.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false, unique: true },
    category: { type: DataTypes.STRING, allowNull: false },
    targetValue: { type: DataTypes.FLOAT, defaultValue: 0 },
    frequency: { type: DataTypes.STRING, defaultValue: "monthly" },
    weightage: { type: DataTypes.INTEGER, defaultValue: 10 },
    isActive: { type: DataTypes.BOOLEAN, defaultValue: true }
  },
  { sequelize, modelName: "KpiMaster" }
);

export class GmailConfig extends Model {
  public id!: string;
  public connectedEmail!: string;
  public encryptedRefreshToken!: string;
  public lastSyncedAt!: Date | null;
}

GmailConfig.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    connectedEmail: { type: DataTypes.STRING, allowNull: false },
    encryptedRefreshToken: { type: DataTypes.TEXT, allowNull: false },
    lastSyncedAt: { type: DataTypes.DATE, allowNull: true }
  },
  { sequelize, modelName: "GmailConfig" }
);

export class Task extends Model {
  public id!: string;
  public title!: string;
  public description!: string | null;
  public priority!: string;
  public dueDate!: Date | null;
  public reminderDate!: Date | null;
  public status!: string;
  public ownerId!: string | null;
  public leadId!: string | null;
  public customerId!: string | null;
}

Task.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    title: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    priority: { type: DataTypes.STRING, defaultValue: "Medium" },
    dueDate: { type: DataTypes.DATE, allowNull: true },
    reminderDate: { type: DataTypes.DATE, allowNull: true },
    status: { type: DataTypes.STRING, defaultValue: "Pending" },
    ownerId: { type: DataTypes.UUID, allowNull: true },
    leadId: { type: DataTypes.UUID, allowNull: true },
    customerId: { type: DataTypes.UUID, allowNull: true }
  },
  { sequelize, modelName: "Task" }
);

export class CallLog extends Model {
  public id!: string;
  public leadId!: string | null;
  public customerId!: string | null;
  public userId!: string | null;
  public direction!: string;
  public durationSeconds!: number;
  public outcome!: string | null;
  public notes!: string | null;
  public followUpDate!: Date | null;
  public recordingUrl!: string | null;
}

CallLog.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    leadId: { type: DataTypes.UUID, allowNull: true },
    customerId: { type: DataTypes.UUID, allowNull: true },
    userId: { type: DataTypes.UUID, allowNull: true },
    direction: { type: DataTypes.STRING, defaultValue: "Outbound" },
    durationSeconds: { type: DataTypes.INTEGER, defaultValue: 0 },
    outcome: { type: DataTypes.STRING, allowNull: true },
    notes: { type: DataTypes.TEXT, allowNull: true },
    followUpDate: { type: DataTypes.DATE, allowNull: true },
    recordingUrl: { type: DataTypes.STRING, allowNull: true }
  },
  { sequelize, modelName: "CallLog" }
);

export class CrmDocument extends Model {
  public id!: string;
  public leadId!: string | null;
  public customerId!: string | null;
  public uploadedById!: string | null;
  public name!: string;
  public fileType!: string | null;
  public fileSize!: number;
  public fileUrl!: string;
  public version!: string;
}

CrmDocument.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    leadId: { type: DataTypes.UUID, allowNull: true },
    customerId: { type: DataTypes.UUID, allowNull: true },
    uploadedById: { type: DataTypes.UUID, allowNull: true },
    name: { type: DataTypes.STRING, allowNull: false },
    fileType: { type: DataTypes.STRING, allowNull: true },
    fileSize: { type: DataTypes.INTEGER, defaultValue: 0 },
    fileUrl: { type: DataTypes.STRING, allowNull: false },
    version: { type: DataTypes.STRING, defaultValue: "1.0" }
  },
  { sequelize, modelName: "Document" }
);

export class Meeting extends Model {
  public id!: string;
  public title!: string;
  public date!: string;
  public time!: string;
  public attendees!: string | null;
  public location!: string | null;
  public videoLink!: string | null;
  public agenda!: string | null;
  public notes!: string | null;
  public outcome!: string | null;
  public leadId!: string | null;
  public customerId!: string | null;
  public organizerId!: string | null;
}

Meeting.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    title: { type: DataTypes.STRING, allowNull: false },
    date: { type: DataTypes.STRING, allowNull: false },
    time: { type: DataTypes.STRING, allowNull: false },
    attendees: { type: DataTypes.STRING, allowNull: true },
    location: { type: DataTypes.STRING, allowNull: true },
    videoLink: { type: DataTypes.STRING, allowNull: true },
    agenda: { type: DataTypes.TEXT, allowNull: true },
    notes: { type: DataTypes.TEXT, allowNull: true },
    outcome: { type: DataTypes.STRING, allowNull: true },
    leadId: { type: DataTypes.UUID, allowNull: true },
    customerId: { type: DataTypes.UUID, allowNull: true },
    organizerId: { type: DataTypes.UUID, allowNull: true }
  },
  { sequelize, modelName: "Meeting" }
);

export class EmailMessage extends Model {
  public id!: string;
  public leadId!: string | null;
  public customerId!: string | null;
  public senderId!: string | null;
  public toEmail!: string;
  public subject!: string;
  public body!: string;
  public status!: string;
  public scheduledAt!: Date | null;
  public openedAt!: Date | null;
  public clickedAt!: Date | null;
}

EmailMessage.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    leadId: { type: DataTypes.UUID, allowNull: true },
    customerId: { type: DataTypes.UUID, allowNull: true },
    senderId: { type: DataTypes.UUID, allowNull: true },
    toEmail: { type: DataTypes.STRING, allowNull: false },
    subject: { type: DataTypes.STRING, allowNull: false },
    body: { type: DataTypes.TEXT, allowNull: false },
    status: { type: DataTypes.STRING, defaultValue: "Sent" },
    scheduledAt: { type: DataTypes.DATE, allowNull: true },
    openedAt: { type: DataTypes.DATE, allowNull: true },
    clickedAt: { type: DataTypes.DATE, allowNull: true }
  },
  { sequelize, modelName: "EmailMessage" }
);

export class AutomationRule extends Model {
  public id!: string;
  public name!: string;
  public triggerType!: string;
  public triggerCondition!: any;
  public actionType!: string;
  public actionConfig!: any;
  public isActive!: boolean;
}

AutomationRule.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false },
    triggerType: { type: DataTypes.STRING, allowNull: false },
    triggerCondition: { type: DataTypes.JSON, allowNull: true },
    actionType: { type: DataTypes.STRING, allowNull: false },
    actionConfig: { type: DataTypes.JSON, allowNull: true },
    isActive: { type: DataTypes.BOOLEAN, defaultValue: true }
  },
  { sequelize, modelName: "AutomationRule" }
);

export class DealMilestone extends Model {
  public id!: string;
  public dealId!: string;
  public name!: string;
  public order!: number;
  public isCompleted!: boolean;
  public completedAt!: Date | null;
  public dueDate!: Date | null;
}

DealMilestone.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    dealId: { type: DataTypes.UUID, allowNull: false },
    name: { type: DataTypes.STRING, allowNull: false },
    order: { type: DataTypes.INTEGER, defaultValue: 1 },
    isCompleted: { type: DataTypes.BOOLEAN, defaultValue: false },
    completedAt: { type: DataTypes.DATE, allowNull: true },
    dueDate: { type: DataTypes.DATE, allowNull: true }
  },
  { sequelize, modelName: "DealMilestone" }
);

Account.hasMany(Activity, { foreignKey: "customerId", as: "customerActivities" });
export class Contact extends Model {
  public id!: string;
  public accountId!: string;
  public firstName!: string | null;
  public lastName!: string | null;
  public email!: string | null;
  public phone!: string | null;
  public role!: string | null;
  public sourceChannel!: string | null;
  public createdAt!: Date;
}
Contact.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  accountId: { type: DataTypes.UUID, allowNull: false },
  firstName: { type: DataTypes.STRING, allowNull: true },
  lastName: { type: DataTypes.STRING, allowNull: true },
  email: { type: DataTypes.STRING, allowNull: true },
  phone: { type: DataTypes.STRING, allowNull: true },
  role: { type: DataTypes.STRING, allowNull: true },
  sourceChannel: { type: DataTypes.STRING, allowNull: true },
  createdAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { sequelize, modelName: "Contact", tableName: "Contacts", updatedAt: false });

export class DealContact extends Model {
  public id!: string;
  public dealId!: string;
  public contactId!: string;
  public role!: string | null;
  public isPrimary!: boolean;
  public createdAt!: Date;
}
DealContact.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  dealId: { type: DataTypes.UUID, allowNull: false },
  contactId: { type: DataTypes.UUID, allowNull: false },
  role: { type: DataTypes.STRING, allowNull: true },
  isPrimary: { type: DataTypes.BOOLEAN, defaultValue: false },
  createdAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { sequelize, modelName: "DealContact", tableName: "DealContacts", updatedAt: false });

// New Salesforce Relationships
Account.hasMany(Contact, { foreignKey: "accountId", as: "contacts" });
Contact.belongsTo(Account, { foreignKey: "accountId", as: "account" });

Account.hasMany(Deal, { foreignKey: "accountId", as: "accountDeals" });
Deal.belongsTo(Account, { foreignKey: "accountId", as: "account" });

Deal.belongsToMany(Contact, { through: DealContact, foreignKey: "dealId", as: "dealContacts" });
Contact.belongsToMany(Deal, { through: DealContact, foreignKey: "contactId", as: "contactDeals" });

// Associations
Task.belongsTo(User, { foreignKey: "ownerId", as: "owner" });
Task.belongsTo(Lead, { foreignKey: "leadId", as: "lead" });
Task.belongsTo(Account, { foreignKey: "customerId", as: "customer" });

CallLog.belongsTo(Lead, { foreignKey: "leadId", as: "lead" });
CallLog.belongsTo(Account, { foreignKey: "customerId", as: "customer" });
CallLog.belongsTo(User, { foreignKey: "userId", as: "user" });

CrmDocument.belongsTo(Lead, { foreignKey: "leadId", as: "lead" });
CrmDocument.belongsTo(Account, { foreignKey: "customerId", as: "customer" });
CrmDocument.belongsTo(User, { foreignKey: "uploadedById", as: "uploadedBy" });

Meeting.belongsTo(Lead, { foreignKey: "leadId", as: "lead" });
Meeting.belongsTo(Account, { foreignKey: "customerId", as: "customer" });
Meeting.belongsTo(User, { foreignKey: "organizerId", as: "organizer" });

EmailMessage.belongsTo(Lead, { foreignKey: "leadId", as: "lead" });
EmailMessage.belongsTo(Account, { foreignKey: "customerId", as: "customer" });
EmailMessage.belongsTo(User, { foreignKey: "senderId", as: "sender" });

export class Asset extends Model {
  public id!: string;
  public name!: string;
  public type!: string;
  public serialNumber!: string | null;
  public status!: string;
  public condition!: string;
  public customerId!: string | null;
  public dealId!: string | null;
  public deployedAt!: Date | null;
  public expectedReturnDate!: Date | null;
  public notes!: string | null;
}

Asset.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false },
    type: { type: DataTypes.STRING, allowNull: false },
    serialNumber: { type: DataTypes.STRING, allowNull: true, unique: true },
    status: { type: DataTypes.STRING, allowNull: false, defaultValue: "In Storage" },
    condition: { type: DataTypes.STRING, allowNull: false, defaultValue: "Good" },
    customerId: { type: DataTypes.UUID, allowNull: true },
    dealId: { type: DataTypes.UUID, allowNull: true },
    deployedAt: { type: DataTypes.DATE, allowNull: true },
    expectedReturnDate: { type: DataTypes.DATE, allowNull: true },
    notes: { type: DataTypes.TEXT, allowNull: true },
  },
  { sequelize, modelName: "Asset" }
);

export class AssetStatusHistory extends Model {
  public id!: string;
  public assetId!: string;
  public previousStatus!: string | null;
  public newStatus!: string | null;
  public previousCondition!: string | null;
  public newCondition!: string | null;
  public changedById!: string | null;
  public notes!: string | null;
  public createdAt!: Date;
}

AssetStatusHistory.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    assetId: { type: DataTypes.UUID, allowNull: false },
    previousStatus: { type: DataTypes.STRING, allowNull: true },
    newStatus: { type: DataTypes.STRING, allowNull: true },
    previousCondition: { type: DataTypes.STRING, allowNull: true },
    newCondition: { type: DataTypes.STRING, allowNull: true },
    changedById: { type: DataTypes.UUID, allowNull: true },
    notes: { type: DataTypes.TEXT, allowNull: true },
  },
  { sequelize, modelName: "AssetStatusHistory", updatedAt: false }
);

// Asset Associations
Asset.belongsTo(Account, { foreignKey: "customerId", as: "customer" });
Account.hasMany(Asset, { foreignKey: "customerId", as: "assets" });

Asset.belongsTo(Deal, { foreignKey: "dealId", as: "deal" });
Deal.hasMany(Asset, { foreignKey: "dealId", as: "assets" });

Asset.hasMany(AssetStatusHistory, { foreignKey: "assetId", as: "statusHistory" });
AssetStatusHistory.belongsTo(Asset, { foreignKey: "assetId", as: "asset" });

AssetStatusHistory.belongsTo(User, { foreignKey: "changedById", as: "changedBy" });
User.hasMany(AssetStatusHistory, { foreignKey: "changedById", as: "assetStatusChanges" });

export class LeadContact extends Model {
  public id!: string;
  public leadId!: string;
  public firstName!: string;
  public lastName!: string;
  public email!: string | null;
  public phone!: string | null;
  public role!: string | null;
  public message!: string | null;
  public sourceChannel!: string | null;
  public createdAt!: Date;
}

LeadContact.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    leadId: { type: DataTypes.UUID, allowNull: false },
    firstName: { type: DataTypes.STRING, allowNull: false },
    lastName: { type: DataTypes.STRING, allowNull: false },
    email: { type: DataTypes.STRING, allowNull: true },
    phone: { type: DataTypes.STRING, allowNull: true },
    role: { type: DataTypes.STRING, allowNull: true },
    message: { type: DataTypes.TEXT, allowNull: true },
    sourceChannel: { type: DataTypes.STRING, allowNull: true },
    createdAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  },
  { sequelize, modelName: "LeadContact", tableName: "LeadContacts", updatedAt: false }
);

// LeadContact Associations
Lead.hasMany(LeadContact, { foreignKey: "leadId", as: "contacts" });
LeadContact.belongsTo(Lead, { foreignKey: "leadId", as: "lead" });

// ── Approval Hierarchy Engine Models ────────────────────────
export class SalesApprovalProfile extends Model {
  public id!: string;
  public salesRepId!: string;
  public selfApprovalLimit!: number;
  public discountApprovalLimit!: number;
  public minimumMargin!: number;
  public teamLeadId!: string | null;
  public approvalEnabled!: boolean;
  public effectiveFrom!: Date | null;
  public effectiveUntil!: Date | null;
  public createdAt!: Date;
  public updatedAt!: Date;
}

SalesApprovalProfile.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    salesRepId: { type: DataTypes.UUID, allowNull: false, unique: true },
    selfApprovalLimit: { type: DataTypes.DECIMAL(15, 2), defaultValue: 1000000 },
    discountApprovalLimit: { type: DataTypes.DECIMAL(5, 4), defaultValue: 0.10 },
    minimumMargin: { type: DataTypes.DECIMAL(5, 4), defaultValue: 0.20 },
    teamLeadId: { type: DataTypes.UUID, allowNull: true },
    approvalEnabled: { type: DataTypes.BOOLEAN, defaultValue: true },
    effectiveFrom: { type: DataTypes.DATE, allowNull: true },
    effectiveUntil: { type: DataTypes.DATE, allowNull: true },
  },
  { sequelize, modelName: "SalesApprovalProfile", tableName: "SalesApprovalProfiles" }
);

export class AdminApprovalPolicy extends Model {
  public id!: string;
  public maximumSalesRepApproval!: number;
  public maximumTeamLeadApproval!: number;
  public maximumRepDiscount!: number;
  public maximumTeamLeadDiscount!: number;
  public minimumAllowedMargin!: number;
  public updatedById!: string | null;
  public createdAt!: Date;
  public updatedAt!: Date;
}

AdminApprovalPolicy.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    maximumSalesRepApproval: { type: DataTypes.DECIMAL(15, 2), defaultValue: 2500000 },
    maximumTeamLeadApproval: { type: DataTypes.DECIMAL(15, 2), defaultValue: 10000000 },
    maximumRepDiscount: { type: DataTypes.DECIMAL(5, 4), defaultValue: 0.10 },
    maximumTeamLeadDiscount: { type: DataTypes.DECIMAL(5, 4), defaultValue: 0.20 },
    minimumAllowedMargin: { type: DataTypes.DECIMAL(5, 4), defaultValue: 0.15 },
    updatedById: { type: DataTypes.UUID, allowNull: true },
  },
  { sequelize, modelName: "AdminApprovalPolicy", tableName: "AdminApprovalPolicies" }
);

export class ApprovalAuditLog extends Model {
  public id!: string;
  public quoteId!: string;
  public salesRepId!: string;
  public approvalLevel!: string;
  public requiredLimit!: number | null;
  public actualQuoteValue!: number;
  public discount!: number;
  public margin!: number | null;
  public approverId!: string | null;
  public decision!: string;
  public comment!: string | null;
  public previousStatus!: string | null;
  public newStatus!: string | null;
  public reason!: string;
  public createdAt!: Date;
}

ApprovalAuditLog.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    quoteId: { type: DataTypes.UUID, allowNull: false },
    salesRepId: { type: DataTypes.UUID, allowNull: false },
    approvalLevel: { type: DataTypes.STRING, allowNull: false },
    requiredLimit: { type: DataTypes.DECIMAL(15, 2), allowNull: true },
    actualQuoteValue: { type: DataTypes.DECIMAL(15, 2), allowNull: false },
    discount: { type: DataTypes.DECIMAL(5, 4), defaultValue: 0 },
    margin: { type: DataTypes.DECIMAL(5, 4), allowNull: true },
    approverId: { type: DataTypes.UUID, allowNull: true },
    decision: { type: DataTypes.STRING, allowNull: false },
    comment: { type: DataTypes.TEXT, allowNull: true },
    previousStatus: { type: DataTypes.STRING, allowNull: true },
    newStatus: { type: DataTypes.STRING, allowNull: true },
    reason: { type: DataTypes.TEXT, allowNull: false },
    createdAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
  },
  { sequelize, modelName: "ApprovalAuditLog", tableName: "ApprovalAuditLogs", updatedAt: false }
);

// ── Performance-Aware Lead Assignment Policy & Auditing ──────
export class SalesAssignmentPolicy extends Model {
  public id!: string;
  public weights!: string; // JSON
  public highValueThreshold!: number;
  public strategicLeadScoreThreshold!: number;
  public minSampleSize!: number;
  public bayesianPrior!: number;
  public bayesianWeight!: number;
  public highValueExperienceTiers!: string; // JSON
  public isPerformanceRoutingEnabled!: boolean;
  public createdAt!: Date;
  public updatedAt!: Date;
}

SalesAssignmentPolicy.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    weights: {
      type: DataTypes.TEXT,
      defaultValue: JSON.stringify({
        conversionRate: 0.20,
        industrySkill: 0.20,
        territoryMatch: 0.10,
        revenuePerformance: 0.10,
        experienceTier: 0.10,
        responseTime: 0.05,
        slaCompliance: 0.05,
        workloadCapacity: 0.10,
        fairnessDistribution: 0.05,
        managerRating: 0.05
      })
    },
    highValueThreshold: { type: DataTypes.DECIMAL(15, 2), defaultValue: 10000000 },
    strategicLeadScoreThreshold: { type: DataTypes.INTEGER, defaultValue: 85 },
    minSampleSize: { type: DataTypes.INTEGER, defaultValue: 5 },
    bayesianPrior: { type: DataTypes.DECIMAL(5, 4), defaultValue: 0.25 },
    bayesianWeight: { type: DataTypes.INTEGER, defaultValue: 3 },
    highValueExperienceTiers: {
      type: DataTypes.TEXT,
      defaultValue: JSON.stringify(["Senior Sales Representative", "Enterprise AE", "Strategic AE", "senior_ae", "sales_manager"])
    },
    isPerformanceRoutingEnabled: { type: DataTypes.BOOLEAN, defaultValue: true }
  },
  { sequelize, modelName: "SalesAssignmentPolicy", tableName: "SalesAssignmentPolicies" }
);

export class LeadAssignmentAudit extends Model {
  public id!: string;
  public leadId!: string | null;
  public previousOwnerId!: string | null;
  public assignedToId!: string;
  public assignmentType!: string;
  public leadPriorityScore!: number;
  public expectedRevenue!: number;
  public candidateScores!: string; // JSON string
  public winningScore!: number;
  public reason!: string;
  public triggerSource!: string;
  public createdAt!: Date;
}

LeadAssignmentAudit.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    leadId: { type: DataTypes.UUID, allowNull: true },
    previousOwnerId: { type: DataTypes.UUID, allowNull: true },
    assignedToId: { type: DataTypes.UUID, allowNull: false },
    assignmentType: { type: DataTypes.STRING, allowNull: false },
    leadPriorityScore: { type: DataTypes.DECIMAL(5, 2), defaultValue: 50.0 },
    expectedRevenue: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
    candidateScores: { type: DataTypes.TEXT, allowNull: false },
    winningScore: { type: DataTypes.DECIMAL(5, 2), allowNull: false },
    reason: { type: DataTypes.TEXT, allowNull: false },
    triggerSource: { type: DataTypes.STRING, defaultValue: "automated" },
    createdAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
  },
  { sequelize, modelName: "LeadAssignmentAudit", tableName: "LeadAssignmentAudits", updatedAt: false }
);

// Approval Hierarchy Associations
User.hasOne(SalesApprovalProfile, { foreignKey: "salesRepId", as: "approvalProfile" });
SalesApprovalProfile.belongsTo(User, { foreignKey: "salesRepId", as: "salesRep" });
SalesApprovalProfile.belongsTo(User, { foreignKey: "teamLeadId", as: "teamLead" });

Quote.hasMany(ApprovalAuditLog, { foreignKey: "quoteId", as: "auditLogs" });
ApprovalAuditLog.belongsTo(Quote, { foreignKey: "quoteId", as: "quote" });
ApprovalAuditLog.belongsTo(User, { foreignKey: "salesRepId", as: "salesRep" });
ApprovalAuditLog.belongsTo(User, { foreignKey: "approverId", as: "approver" });

// LeadAssignment Audit Associations
Lead.hasMany(LeadAssignmentAudit, { foreignKey: "leadId", as: "assignmentAudits" });
LeadAssignmentAudit.belongsTo(Lead, { foreignKey: "leadId", as: "lead" });
LeadAssignmentAudit.belongsTo(User, { foreignKey: "assignedToId", as: "assignedTo" });
LeadAssignmentAudit.belongsTo(User, { foreignKey: "previousOwnerId", as: "previousOwner" });

// ─── DealOwner (commission split) ────────────────────────────────────────────
export class DealOwner extends Model {
  public id!: string;
  public dealId!: string;
  public userId!: string;
  public splitPct!: number;
  public role!: string | null; // 'qualifying_rep' | 'closing_ae' | 'support'
}

DealOwner.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    dealId: { type: DataTypes.UUID, allowNull: false },
    userId: { type: DataTypes.UUID, allowNull: false },
    splitPct: { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 100.0 },
    role: { type: DataTypes.STRING, allowNull: true }
  },
  { sequelize, modelName: "DealOwner", tableName: "DealOwners" }
);

Deal.hasMany(DealOwner, { foreignKey: "dealId", as: "owners" });
DealOwner.belongsTo(Deal, { foreignKey: "dealId", as: "deal" });
DealOwner.belongsTo(User, { foreignKey: "userId", as: "user" });
User.hasMany(DealOwner, { foreignKey: "userId", as: "dealOwnerships" });

// ─── WorkspaceSetting (admin-only key-value config) ───────────────────────────
export class WorkspaceSetting extends Model {
  public id!: string;
  public key!: string;
  public value!: string;
  public description!: string | null;
  public updatedBy!: string | null;
}

WorkspaceSetting.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    key: { type: DataTypes.STRING, allowNull: false, unique: true },
    value: { type: DataTypes.TEXT, allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    updatedBy: { type: DataTypes.UUID, allowNull: true }
  },
  { sequelize, modelName: "WorkspaceSetting", tableName: "WorkspaceSettings" }
);

export { sequelize };
