/**
 * CRM API Adapters
 * Normalizes backend responses into canonical frontend types.
 * Keeps legacy field translations isolated from UI components.
 */

import {
  Lead,
  Account,
  Contact,
  Opportunity,
  Quote,
  QuoteLineItem,
  Order,
  Asset,
  Activity,
  ApprovalRequest,
  PaginatedResponse
} from "../../types";

export function normalizeLead(raw: any): Lead {
  if (!raw) return raw;
  return {
    id: raw.id,
    leadNumber: raw.leadNumber || undefined,
    firstName: raw.firstName || undefined,
    lastName: raw.lastName || undefined,
    companyName: raw.company || raw.companyName || undefined,
    company: raw.company || raw.companyName || undefined,
    email: raw.email || undefined,
    phone: raw.phone || undefined,
    sourceChannel: raw.source || raw.sourceChannel || "Website",
    source: raw.source || raw.sourceChannel || "Website",
    sourceDetail: raw.sourceDetail || null,
    sourceType: raw.sourceType || undefined,
    campaignId: raw.campaignId || null,
    campaign: raw.campaign || null,
    attribution: raw.attribution || null,
    industry: raw.industry || null,
    estimatedValue: raw.estimatedValue ? Number(raw.estimatedValue) : (raw.amount ? Number(raw.amount) : null),
    currency: raw.currency || "INR",
    budgetRange: raw.budgetRange || null,
    leadScore: raw.leadScore !== undefined ? Number(raw.leadScore) : null,
    priority: raw.priority || (raw.leadScore > 75 ? "HIGH" : raw.leadScore > 40 ? "MEDIUM" : "LOW"),
    temperature: raw.temperature || "Warm",
    ownerId: raw.assignedToId || raw.ownerId || null,
    assignedToId: raw.assignedToId || raw.ownerId || null,
    assignedTo: raw.assignedTo || null,
    status: raw.status || "NEW",
    body: raw.body || null,
    notes: raw.notes || null,
    nextAction: raw.nextAction || null,
    nextActionDue: raw.nextActionDue || null,
    convertedAt: raw.convertedAt || null,
    convertedAccountId: raw.convertedAccountId || raw.customerId || null,
    convertedContactId: raw.convertedContactId || null,
    convertedOpportunityId: raw.convertedOpportunityId || raw.dealId || null,
    contacts: raw.contacts ? raw.contacts.map((c: any) => ({
      id: c.id,
      firstName: c.firstName,
      lastName: c.lastName,
      email: c.email,
      phone: c.phone,
      role: c.role,
      sourceChannel: c.sourceChannel,
      createdAt: c.createdAt
    })) : [],
    createdAt: raw.createdAt || new Date().toISOString(),
    updatedAt: raw.updatedAt || new Date().toISOString(),
  };
}

export function normalizeAccount(raw: any): Account {
  if (!raw) return raw;
  return {
    id: raw.id,
    accountNumber: raw.accountNumber || undefined,
    legalName: raw.legalName || raw.name || "Unknown Company",
    displayName: raw.displayName || raw.name || "Unknown Company",
    name: raw.name || raw.displayName || raw.legalName,
    industry: raw.industry || null,
    territory: raw.territory || null,
    country: raw.country || null,
    city: raw.city || null,
    address: raw.address || null,
    website: raw.website || null,
    taxNumber: raw.taxNumber || null,
    customerType: raw.customerType || null,
    ownerId: raw.ownerId || raw.assignedToId || null,
    owner: raw.owner || raw.assignedTo || null,
    status: raw.status || "Active",
    contacts: raw.contacts ? raw.contacts.map(normalizeContact) : [],
    opportunities: (raw.deals || raw.opportunities) ? (raw.deals || raw.opportunities).map(normalizeOpportunity) : [],
    deals: (raw.deals || raw.opportunities) ? (raw.deals || raw.opportunities).map(normalizeOpportunity) : [],
    quotes: raw.quotes ? raw.quotes.map(normalizeQuote) : [],
    orders: (raw.purchaseOrders || raw.orders) ? (raw.purchaseOrders || raw.orders).map(normalizeOrder) : [],
    purchaseOrders: (raw.purchaseOrders || raw.orders) ? (raw.purchaseOrders || raw.orders).map(normalizeOrder) : [],
    activities: raw.activities ? raw.activities.map(normalizeActivity) : [],
    createdAt: raw.createdAt || new Date().toISOString(),
    updatedAt: raw.updatedAt || new Date().toISOString(),
  };
}

export function normalizeContact(raw: any): Contact {
  if (!raw) return raw;
  return {
    id: raw.id,
    accountId: raw.accountId || raw.customerId || "",
    account: raw.account ? {
      id: raw.account.id,
      name: raw.account.name,
      displayName: raw.account.displayName || raw.account.name
    } : null,
    firstName: raw.firstName || "",
    lastName: raw.lastName || "",
    jobTitle: raw.jobTitle || raw.role || null,
    department: raw.department || null,
    email: raw.email || null,
    phone: raw.phone || null,
    mobile: raw.mobile || null,
    role: raw.role || null,
    isPrimary: !!raw.isPrimary,
    sourceChannel: raw.sourceChannel || null,
    status: raw.status || "Active",
    createdAt: raw.createdAt || new Date().toISOString(),
    updatedAt: raw.updatedAt || new Date().toISOString(),
  };
}

export function normalizeOpportunity(raw: any): Opportunity {
  if (!raw) return raw;
  const stageName = raw.stage?.name || raw.stage || raw.status || "Discovery";
  return {
    id: raw.id,
    opportunityNumber: raw.opportunityNumber || raw.dealNumber || undefined,
    name: raw.name || "Untitled Opportunity",
    description: raw.description || null,
    accountId: raw.accountId || raw.customerId || "",
    account: raw.account ? normalizeAccount(raw.account) : null,
    primaryContactId: raw.primaryContactId || raw.contactId || null,
    primaryContact: raw.primaryContact ? normalizeContact(raw.primaryContact) : null,
    ownerId: raw.ownerId || raw.assignedToId || null,
    owner: raw.owner || raw.assignedTo || null,
    originatingLeadId: raw.originatingLeadId || raw.leadId || null,
    leadId: raw.leadId || raw.originatingLeadId || null,
    estimatedValue: raw.amount !== undefined ? Number(raw.amount) : (raw.estimatedValue !== undefined ? Number(raw.estimatedValue) : null),
    amount: raw.amount !== undefined ? Number(raw.amount) : (raw.estimatedValue !== undefined ? Number(raw.estimatedValue) : null),
    currency: raw.currency || "INR",
    probability: raw.probability !== undefined ? Number(raw.probability) : (raw.stage?.probability !== undefined ? Number(raw.stage.probability) : null),
    priority: raw.priority || null,
    expectedCloseDate: raw.expectedCloseDate || raw.expectedClose || null,
    stage: stageName as any,
    stageId: raw.stageId || raw.stage?.id || undefined,
    competitors: raw.competitors || null,
    lossReason: raw.lossReason || null,
    wonAt: raw.wonAt || null,
    lostAt: raw.lostAt || null,
    quotes: raw.quotes ? raw.quotes.map(normalizeQuote) : [],
    createdAt: raw.createdAt || new Date().toISOString(),
    updatedAt: raw.updatedAt || new Date().toISOString(),
  };
}

export function normalizeQuoteLineItem(raw: any): QuoteLineItem {
  if (!raw) return raw;
  return {
    id: raw.id,
    quoteId: raw.quoteId,
    productServiceId: raw.productServiceId || raw.productId || raw.catalogItemId || null,
    productId: raw.productId || raw.catalogItemId || null,
    catalogItemId: raw.catalogItemId || raw.productId || null,
    product: raw.product || null,
    description: raw.description || raw.customDescription || "Line Item",
    customDescription: raw.customDescription || null,
    uom: raw.uom || "Unit",
    quantity: Number(raw.quantity || 1),
    unitPrice: Number(raw.unitPrice || 0),
    discount: Number(raw.discount || 0),
    tax: Number(raw.tax || 0),
    totalPrice: Number(raw.totalPrice || raw.totalAmount || (Number(raw.quantity || 1) * Number(raw.unitPrice || 0))),
    amount: Number(raw.totalPrice || raw.totalAmount || (Number(raw.quantity || 1) * Number(raw.unitPrice || 0))),
    sortOrder: Number(raw.sortOrder || 0),
    isOptional: !!raw.isOptional,
    isCustom: !!raw.isCustom,
    internalCostSnapshot: raw.internalCostSnapshot ? Number(raw.internalCostSnapshot) : null,
  };
}

export function normalizeQuote(raw: any): Quote {
  if (!raw) return raw;
  return {
    id: raw.id,
    quoteNumber: raw.quoteNumber || "QT-DRAFT",
    opportunityId: raw.opportunityId || raw.dealId || "",
    dealId: raw.dealId || raw.opportunityId || "",
    accountId: raw.accountId || raw.deal?.accountId || raw.deal?.customerId,
    contactId: raw.contactId || null,
    version: Number(raw.version || 1),
    previousQuoteId: raw.previousQuoteId || raw.parentQuoteId || null,
    parentQuoteId: raw.parentQuoteId || raw.previousQuoteId || null,
    status: raw.status || "Draft",
    currency: raw.currency || "INR",
    validUntil: raw.validUntil || raw.expirationDate || null,
    expirationDate: raw.expirationDate || raw.validUntil || null,
    subtotal: raw.subtotal ? Number(raw.subtotal) : undefined,
    discount: raw.discount ? Number(raw.discount) : undefined,
    tax: raw.tax ? Number(raw.tax) : undefined,
    totalAmount: Number(raw.totalAmount || raw.grandTotal || 0),
    grandTotal: Number(raw.totalAmount || raw.grandTotal || 0),
    isFinalAgreed: raw.status === "Accepted" || !!raw.isFinalAgreed,
    notes: raw.notes || null,
    terms: raw.terms || null,
    createdBy: raw.createdBy || raw.createdById || "",
    createdById: raw.createdById || raw.createdBy || "",
    submittedAt: raw.submittedAt || null,
    approvedAt: raw.approvedAt || null,
    sentAt: raw.sentAt || null,
    acceptedAt: raw.acceptedAt || null,
    QuoteLineItems: (raw.QuoteLineItems || raw.items || []).map(normalizeQuoteLineItem),
    items: (raw.QuoteLineItems || raw.items || []).map(normalizeQuoteLineItem),
    deal: raw.deal ? {
      id: raw.deal.id,
      name: raw.deal.name,
      accountId: raw.deal.accountId,
      account: raw.deal.account
    } : undefined,
    createdAt: raw.createdAt || new Date().toISOString(),
    updatedAt: raw.updatedAt || new Date().toISOString(),
  };
}

export function normalizeOrder(raw: any): Order {
  if (!raw) return raw;
  return {
    id: raw.id,
    orderNumber: raw.orderNumber || raw.poNumber || "ORD-PENDING",
    poNumber: raw.poNumber || raw.orderNumber || "ORD-PENDING",
    accountId: raw.accountId || raw.customerId || raw.quote?.deal?.accountId || "",
    opportunityId: raw.opportunityId || raw.dealId || raw.quote?.dealId || undefined,
    dealId: raw.dealId || raw.opportunityId || raw.quote?.dealId || undefined,
    sourceQuoteId: raw.sourceQuoteId || raw.quoteId || undefined,
    quoteId: raw.quoteId || raw.sourceQuoteId || undefined,
    quote: raw.quote ? normalizeQuote(raw.quote) : null,
    status: raw.status || "Confirmed",
    currency: raw.currency || "INR",
    subtotal: raw.subtotal ? Number(raw.subtotal) : undefined,
    discount: raw.discount ? Number(raw.discount) : undefined,
    tax: raw.tax ? Number(raw.tax) : undefined,
    totalAmount: Number(raw.totalAmount || raw.grandTotal || raw.amount || 0),
    grandTotal: Number(raw.totalAmount || raw.grandTotal || raw.amount || 0),
    amount: Number(raw.amount || raw.totalAmount || 0),
    confirmedAt: raw.confirmedAt || raw.createdAt || null,
    deliveryDate: raw.deliveryDate || null,
    notes: raw.notes || null,
    items: raw.items || [],
    createdAt: raw.createdAt || new Date().toISOString(),
    updatedAt: raw.updatedAt || new Date().toISOString(),
  };
}

export function normalizeActivity(raw: any): Activity {
  if (!raw) return raw;
  return {
    id: raw.id,
    type: raw.type || "note",
    leadId: raw.leadId || null,
    accountId: raw.accountId || raw.customerId || null,
    customerId: raw.customerId || raw.accountId || null,
    contactId: raw.contactId || null,
    opportunityId: raw.opportunityId || raw.dealId || null,
    dealId: raw.dealId || raw.opportunityId || null,
    quoteId: raw.quoteId || null,
    orderId: raw.orderId || null,
    subject: raw.subject || raw.title || undefined,
    outcome: raw.outcome || null,
    description: raw.description || raw.body || raw.notes || null,
    direction: raw.direction || null,
    duration: raw.duration ? Number(raw.duration) : null,
    pinned: !!raw.pinned,
    isCompleted: !!raw.isCompleted,
    createdBy: raw.createdBy || raw.createdById || "",
    createdById: raw.createdById || raw.createdBy || "",
    creator: raw.creator || null,
    createdAt: raw.createdAt || new Date().toISOString(),
    updatedAt: raw.updatedAt || new Date().toISOString(),
  };
}

export function normalizeApproval(raw: any): ApprovalRequest {
  if (!raw) return raw;
  return {
    id: raw.id,
    quoteId: raw.quoteId,
    approvalLevel: raw.approvalLevel || "SALES_REP",
    status: raw.decision === "APPROVED" ? "APPROVED" : raw.decision === "REJECTED" ? "REJECTED" : (raw.status || "PENDING"),
    requiredLimit: raw.requiredLimit ? Number(raw.requiredLimit) : null,
    actualQuoteValue: raw.actualQuoteValue ? Number(raw.actualQuoteValue) : null,
    discount: raw.discount ? Number(raw.discount) : null,
    margin: raw.margin ? Number(raw.margin) : null,
    reason: raw.reason || null,
    comment: raw.comment || null,
    salesRepId: raw.salesRepId,
    salesRep: raw.salesRep || undefined,
    requestedBy: raw.salesRepId || raw.requestedBy || "",
    approverId: raw.approverId || null,
    approvedBy: raw.approvedBy || raw.approverId || null,
    approver: raw.approver || null,
    decision: raw.decision || null,
    createdAt: raw.createdAt || new Date().toISOString(),
    updatedAt: raw.updatedAt || new Date().toISOString(),
  };
}

export function normalizeAsset(raw: any): Asset {
  if (!raw) return raw;
  return {
    id: raw.id,
    assetNumber: raw.assetNumber || undefined,
    name: raw.name || undefined,
    accountId: raw.accountId || raw.customerId,
    customerId: raw.customerId || raw.accountId,
    orderId: raw.orderId || null,
    dealId: raw.dealId || null,
    orderItemId: raw.orderItemId || null,
    productServiceId: raw.productServiceId || null,
    serialNumber: raw.serialNumber || null,
    type: raw.type || null,
    condition: raw.condition || "GOOD",
    installationDate: raw.installationDate || null,
    deployedAt: raw.deployedAt || null,
    commissionDate: raw.commissionDate || null,
    warrantyStart: raw.warrantyStart || null,
    warrantyEnd: raw.warrantyEnd || null,
    expectedReturnDate: raw.expectedReturnDate || null,
    location: raw.location || null,
    status: raw.status || "In Storage",
    notes: raw.notes || null,
    createdAt: raw.createdAt || new Date().toISOString(),
    updatedAt: raw.updatedAt || new Date().toISOString(),
  };
}

export function normalizePaginatedResponse<T>(raw: any, itemNormalizer: (item: any) => T): PaginatedResponse<T> {
  if (!raw) {
    return { data: [], page: 1, limit: 50, total: 0, totalPages: 1 };
  }
  const items = Array.isArray(raw.data) ? raw.data : (Array.isArray(raw) ? raw : []);
  return {
    data: items.map(itemNormalizer),
    page: Number(raw.page || 1),
    limit: Number(raw.limit || items.length || 50),
    total: Number(raw.total || items.length),
    totalPages: Number(raw.totalPages || (raw.total && raw.limit ? Math.ceil(raw.total / raw.limit) : 1)),
  };
}
