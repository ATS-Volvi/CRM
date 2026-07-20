import { DataTypes, Model } from "sequelize";
import { sequelize } from "../config/dbConn";

export class User extends Model {
  public id!: string;
  public name!: string;
  public email!: string;
  public password!: string;
  public role!: string;
  public maxOpenLeads!: number;
  public isAvailable!: boolean;
  public onLeave!: boolean | null;
  public delegatedUserId!: string | null;
  public managerId!: string | null;
  public department!: string | null;
  public territory!: string | null;
  public team!: string | null;
}

User.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false },
    email: { type: DataTypes.STRING, allowNull: false, unique: true },
    password: { type: DataTypes.STRING, allowNull: false },
    role: { type: DataTypes.STRING, defaultValue: "sales_rep" },
    maxOpenLeads: { type: DataTypes.INTEGER, defaultValue: 20 },
    isAvailable: { type: DataTypes.BOOLEAN, defaultValue: true },
    onLeave: { type: DataTypes.BOOLEAN, defaultValue: false },
    delegatedUserId: { type: DataTypes.UUID, allowNull: true },
    managerId: { type: DataTypes.UUID, allowNull: true },
    department: { type: DataTypes.STRING, allowNull: true },
    territory: { type: DataTypes.STRING, allowNull: true },
    team: { type: DataTypes.STRING, allowNull: true }
  },
  { sequelize, modelName: "User" }
);

export class Lead extends Model {
  public id!: string;
  public firstName!: string;
  public lastName!: string;
  public company!: string;
  public email!: string;
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
}

Lead.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    firstName: { type: DataTypes.STRING, allowNull: false },
    lastName: { type: DataTypes.STRING, allowNull: false },
    company: { type: DataTypes.STRING, allowNull: true },
    email: { type: DataTypes.STRING, allowNull: false },
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
      values: ["New", "Contacted", "Qualified", "Meeting/Demo", "Proposal", "Negotiation", "Won", "Lost", "On Hold"],
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

export class PurchaseOrder extends Model {
  public id!: string;
  public quoteId!: string;
  public status!: string;
  public amount!: number;
  public poNumber!: string;
  public generatedDate!: Date;
}

PurchaseOrder.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    status: { type: DataTypes.STRING, defaultValue: "Pending" },
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
}

Activity.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    type: { 
      type: DataTypes.ENUM, 
      values: ["call", "email", "meeting", "task", "whatsapp_sms", "note", "stage_change"],
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
  },
  { sequelize, modelName: "Activity" }
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
  public type!: string;
  public title!: string;
  public message!: string;
  public link!: string | null;
  public isRead!: boolean;
}

Notification.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    type: { type: DataTypes.STRING, allowNull: false },
    title: { type: DataTypes.STRING, allowNull: false },
    message: { type: DataTypes.TEXT, allowNull: false },
    link: { type: DataTypes.STRING, allowNull: true },
    isRead: { type: DataTypes.BOOLEAN, defaultValue: false },
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
Activity.belongsTo(Lead, { foreignKey: "leadId" });

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

export class Customer extends Model {
  public id!: string;
  public name!: string;
  public primaryContactName!: string | null;
  public email!: string | null;
  public phone!: string | null;
  public address!: string | null;
  public industry!: string | null;
}

Customer.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false },
    primaryContactName: { type: DataTypes.STRING, allowNull: true },
    email: { type: DataTypes.STRING, allowNull: true },
    phone: { type: DataTypes.STRING, allowNull: true },
    address: { type: DataTypes.TEXT, allowNull: true },
    industry: { type: DataTypes.STRING, allowNull: true }
  },
  { sequelize, modelName: "Customer" }
);

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

Customer.hasMany(Lead, { foreignKey: "customerId", as: "leads" });
Lead.belongsTo(Customer, { foreignKey: "customerId", as: "customer" });

Customer.hasMany(Deal, { foreignKey: "customerId", as: "deals" });
Deal.belongsTo(Customer, { foreignKey: "customerId", as: "customer" });

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

export { sequelize };


