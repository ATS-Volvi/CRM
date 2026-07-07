import { DataTypes, Model } from "sequelize";
import { sequelize } from "../config/dbConn";

export class User extends Model {
  public id!: string;
  public name!: string;
  public email!: string;
  public password!: string;
  public role!: string;
}

User.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false },
    email: { type: DataTypes.STRING, allowNull: false, unique: true },
    password: { type: DataTypes.STRING, allowNull: false },
    role: { type: DataTypes.STRING, defaultValue: "sales_rep" },
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
  },
  { sequelize, modelName: "Lead" }
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
}

Deal.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false },
    amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    expectedCloseDate: { type: DataTypes.DATE, allowNull: true },
    recontactDate: { type: DataTypes.DATE, allowNull: true },
    lossReason: { type: DataTypes.TEXT, allowNull: true },
  },
  { sequelize, modelName: "Deal" }
);

export class Quote extends Model {
  public id!: string;
  public dealId!: string;
  public status!: string;
  public totalAmount!: number;
  public expirationDate!: Date;
}

Quote.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    status: { type: DataTypes.STRING, defaultValue: "Draft" },
    totalAmount: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
    expirationDate: { type: DataTypes.DATE, allowNull: true },
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
}

PriceBookEntry.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    sku: { type: DataTypes.STRING, allowNull: false, unique: true },
    name: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    unitPrice: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    category: { type: DataTypes.STRING, allowNull: true },
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
}

QuoteLineItem.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    quantity: { type: DataTypes.INTEGER, allowNull: false },
    unitPrice: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    totalPrice: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
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
  public comments!: string;
}

ApprovalRequest.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    targetId: { type: DataTypes.STRING, allowNull: false },
    type: { type: DataTypes.STRING, allowNull: false },
    status: { type: DataTypes.STRING, defaultValue: "Pending" },
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
}

AssignmentRule.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    criteria: { type: DataTypes.TEXT, allowNull: false },
    priority: { type: DataTypes.INTEGER, defaultValue: 0 },
    isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
  },
  { sequelize, modelName: "AssignmentRule" }
);

export class Activity extends Model {
  public id!: string;
  public leadId!: string;
  public type!: string;
  public duration!: number | null;
  public outcome!: string | null;
  public mentioned_user_ids!: string; // JSON string array
  public pinned!: boolean;
  public createdById!: string;
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
    mentioned_user_ids: { type: DataTypes.TEXT, defaultValue: "[]" },
    pinned: { type: DataTypes.BOOLEAN, defaultValue: false },
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

export { sequelize };
