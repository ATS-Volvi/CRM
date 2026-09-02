import { Router } from "express";
import { register, login } from "../controllers/auth";
import { createPublicLead } from "../controllers/publicLeads";
import { authMiddleware, requireAdminOrManager } from "../middleware/auth";
import {
  getPipeline, moveDealStage, createDeal, getDeals, validateTransition,
  getOpportunities, getOpportunityById, createOpportunity, updateOpportunity, moveOpportunityStage,
  getPipelineStages, postOpportunityEvent, markOpportunityWon, markOpportunityLost,
  getOpportunityTimeline, getOpportunityNextAction, getOpportunityHealth, getOpportunityAiSummary
} from "../controllers/pipelineController";
import { getLeadActivities, createActivity, togglePinActivity, completeTask, getOverdueTasks } from "../controllers/activityController";
import {
  getLeads,
  createLead,
  getLead,
  updateLead,
  convertLead,
  qualifyLeadEndpoint,
  markLeadNotConverted,
  deleteLead,
  reassignLead,
  getLeadReassignmentHistory,
  getLeadDealForQuote,
  getDuplicateLeads,
  mergeLeads,
  clearUnreadCount,
  getLeadAiSummary,
  getLeadAccountHistory,
  getLeadContacts,
  updateTemperature,
  unlockTemperature,
  getLeadMissingInfo,
  requestMissingDetails
} from "../controllers/leadController";
import { getPriceBookEntries, createPriceBookEntry, updatePriceBookEntry, deletePriceBookEntry, importPriceBookEntries, getPriceSuggestion, importPriceBookEntriesPreview, getCatalogCategories, getCatalogUoms } from '../controllers/priceBookController';
import {
  getQuotes, getQuoteById, createQuote, updateQuote, getQuoteRecommendations, sendQuote, acceptQuote, rejectQuote, createQuoteRevision,
  getOpportunityQuotes, createOpportunityQuote, getPublicQuote, generateQuotePdf, signQuote, getQuoteHistoryByClient,
  getSimilarQuotesStats, getSimilarClientQuotes, markQuoteFinalAgreed, getQuoteDeliveryPreview, getQuoteDeliveries, recordDeliveryStatus,
  getPublicQuoteByToken, acceptPublicQuoteByToken, requestPublicQuoteChanges
} from '../controllers/quoteController';
import { getInvoices, createInvoiceFromQuote, updateInvoiceStatus, generateInvoicePdf } from '../controllers/invoiceController';
import { getPurchaseOrders, getOrderById, createPurchaseOrder, updatePurchaseOrder, createOrderFromQuote, resolvePurchaseOrder } from '../controllers/purchaseOrderController';
import { getApprovals, updateApproval, getApprovalTiers, createApprovalTier, deleteApprovalTier, submitQuoteForApproval } from '../controllers/approvalController';
import { getKpiDashboard, getManagementDashboard, getMyTodayDashboard, getMyHomeDashboard, getKpiTarget, updateKpiTarget, getActivitiesReports, getHomeDashboard } from '../controllers/dashboardController';
import { getAssignmentRules, createAssignmentRule, updateAssignmentRule, deleteAssignmentRule, getSalespersonsCapacities, balanceSalespersonsCapacities } from '../controllers/assignmentRuleController';
import { getAssignmentPolicy, updateAssignmentPolicy, getRepPerformanceProfiles, getAssignmentAudits, reassignLeadManually } from '../controllers/assignmentController';
import { getBundleTemplates, createBundleTemplate, deleteBundleTemplate } from '../controllers/bundleController';
import { exportLeads, exportQuotes, exportPurchaseOrders } from '../controllers/exportController';
import {
  getSalespersonsPerformance, createSalesperson, getSalespersonPerformanceDetails, getAllSalespersons, updateSalespersonCapacity,
  getSalespersonKpis, editKpiTarget, getKpiHistory, restoreKpiHistory, bulkAssignTargets, lockKpiTargets, approveKpiTargetChange,
  getOrgChartEmployees, updateRepTeamType
} from '../controllers/salespersonController';
import {
  getRequirements, createRequirement, updateRequirement, deleteRequirement,
  getLineItems, createLineItem, updateLineItem, deleteLineItem,
  getConstructionItems, createConstructionItem, updateConstructionItem, deleteConstructionItem,
  getRequirementRollup, getPricingGrid, updateConstructionItemPricing
} from '../controllers/masterDataController';
import { getQuoteTemplates, createQuoteTemplate, parseReferenceDocument } from '../controllers/quoteTemplateController';
import { receiveInboundEmail } from "../controllers/emailController";
import { verifyInstagramWebhook, receiveInstagramMessage } from "../controllers/instagramController";
import { getAccounts, getAccountById, createAccount, updateAccount } from "../controllers/accountController";
import { getContacts, getContactById, createContact, updateContact } from "../controllers/contactController";
import { getAssets, getAssetById, createAsset, updateAsset, deleteAsset } from "../controllers/assetController";
import {
  getFulfillments,
  getFulfillmentById,
  getFulfillmentByOrderId,
  changeFulfillmentStatus,
  updateFulfillmentItemStatus
} from "../controllers/fulfillmentController";
import {
  getCampaigns,
  getCampaignById,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  createCampaignAd,
  getCampaignLeads,
  getCampaignOpportunities,
  getCampaignPerformanceReport
} from "../controllers/campaignController";
import {
  getLeadAttribution,
  getLeadAttributionHistory,
  recordManualTouch,
  getLeadSourceAnalytics,
  getCampaignsAnalytics,
  getAttributionTaxonomy
} from "../controllers/attributionController";

import { getLeadSources, createLeadSource, updateLeadSource, deleteLeadSource } from "../controllers/leadSourceController";
import { queryAiReport } from "../controllers/aiReportController";
import { parseVoiceLead } from "../controllers/voiceLeadController";
import { getMySettings, updateMySettings, getMyTeam, reassignTeamManager, updateDealValueCutoff, updateAvailability } from "../controllers/userSettingsController";
import { getKpiMasters, createKpiMaster, updateKpiMaster, deleteKpiMaster } from "../controllers/kpiMasterController";
import { getGmailAuthUrl, connectGmail, getGmailStatus, disconnectGmail, syncGmail } from "../controllers/gmailController";
import { getTasks, createTask, updateTaskStatus } from "../controllers/taskController";
import { getCallLogs, createCallLog } from "../controllers/callLogController";
import { getDocuments, createDocument } from "../controllers/documentController";
import { getMeetings, createMeeting } from "../controllers/meetingController";
import { getEmailMessages, sendEmailMessage } from "../controllers/emailMessageController";
import { globalSearch } from "../controllers/searchController";
import { getAutomationRules, createAutomationRule, updateAutomationRule, deleteAutomationRule } from "../controllers/automationController";
import { getTelephonyStatus, initiateCall } from "../controllers/telephonyController";
import { getDealMilestones, toggleDealMilestone, createDealMilestone } from "../controllers/milestoneController";
import whatsappRoutes from "./whatsappRoutes";
import {
  getCoachingNotes, createCoachingNote, markCoachingNoteRead, getAuthoredCoachingNotes,
  getStaleDeal, getQuoteExpiry, getTopAccounts, getCustomerBirthdays, getWinCelebrations
} from "../controllers/coachingNotesController";
import { getDealOwners, updateDealOwners, getWorkspaceSetting, updateWorkspaceSetting } from "../controllers/dealOwnerController";
import {
  autoAssignDealHandler,
  reassignDeal,
  getDealReassignmentHistory,
  getDealAssignmentCutoffs,
  updateDealAssignmentCutoffs,
  getFlaggedDeals
} from "../controllers/dealAssignmentController";
import {
  getHandoffMessages,
  sendHandoffMessage,
  updateHandoffMessage,
  deleteHandoffMessage
} from "../controllers/handoffMessageController";
import {
  getManagerTeamHandler,
  getDealSplitsHandler,
  setDealSplitsHandler,
  deleteDealSplitsHandler,
  getStuckDealsHandler
} from "../controllers/dealSplitController";
import { createPayment, getPaymentsForInvoice } from "../controllers/paymentController";
import { createSupportTicket, listSupportTickets, getSupportTicketById, updateSupportTicket } from "../controllers/supportTicketController";
import { getInvoiceById } from "../controllers/invoiceController";

const router = Router();

// ==========================================
// PUBLIC ROUTES
// ==========================================

// Public routes
/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       201:
 *         description: User registered successfully
 */
router.post("/auth/register", register);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login and get a JWT token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Successful login
 */

/**
 * @swagger
 * /public/leads:
 *   post:
 *     summary: Capture a lead from a public source (e.g. website, social media)
 *     tags: [Public]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               email:
 *                 type: string
 *               source:
 *                 type: string
 *     responses:
 *       201:
 *         description: Lead captured successfully
 */
import express from "express";
import multer from "multer";
const upload = multer();

router.post("/public/leads", createPublicLead);
router.post(
  "/emails/inbound",
  express.urlencoded({ extended: true }),
  upload.any(),
  receiveInboundEmail
);

// Instagram & WhatsApp Webhook Channels (Public for Meta Verification & Webhook Ingestion)
router.get("/instagram/webhook", verifyInstagramWebhook);
router.post("/instagram/webhook", receiveInstagramMessage);
router.use("/whatsapp", whatsappRoutes);

import { handleUnsubscribe } from "../controllers/leadController";
router.get("/leads/unsubscribe/:id", handleUnsubscribe);

import { trackEmailOpen, getAbTestStats, declareWinner } from "../controllers/messageTemplateController";
router.get("/message-templates/track/:id", trackEmailOpen);

// Special KPI endpoints for dashboard mock (Public for preview)
router.get("/kpis/salesperson", async (req, res) => {
  res.json({ sales: 12000, pipeline: 45000, meetings: 4, winRate: 65 });
});
router.get("/kpis/management", async (req, res) => {
  res.json({ totalRevenue: 1200000, activeDeals: 34, topPerformer: "Jane Doe" });
});

router.get("/public/quotes/:id", getPublicQuote);
router.get("/quotes/:id/public", getPublicQuote);
router.post("/public/quotes/:id/sign", signQuote);

// Customer-Facing Token-Based Quote Review & Acceptance Portal
router.get("/public/quotes/by-token/:token", getPublicQuoteByToken);
router.post("/public/quotes/by-token/:token/accept", acceptPublicQuoteByToken);
router.post("/public/quotes/by-token/:token/request-changes", requestPublicQuoteChanges);

// ==========================================
// QUOTE TEMPLATES & AI VISION PARSER
// ==========================================
router.get("/quote-templates", authMiddleware, getQuoteTemplates);
router.post("/quote-templates", authMiddleware, createQuoteTemplate);
router.post("/quote-templates/parse-reference", authMiddleware, upload.single("document"), parseReferenceDocument);

// ==========================================
// DEV ROUTES
// ==========================================
import { processGmailConnector, processMetaConnector, processLinkedInConnector } from "../services/leadIngestion";

if (process.env.NODE_ENV !== "production") {
  router.post("/dev/simulate-gmail-lead", async (_req, res) => {
    try {
      const leadId = await processGmailConnector();
      res.json({ leadId });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to simulate Gmail lead" });
    }
  });

  router.post("/dev/simulate-meta-lead", async (_req, res) => {
    try {
      const leadId = await processMetaConnector();
      res.json({ leadId });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to simulate Meta lead" });
    }
  });

  router.post("/dev/simulate-linkedin-lead", async (_req, res) => {
    try {
      const leadId = await processLinkedInConnector();
      res.json({ leadId });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to simulate LinkedIn lead" });
    }
  });
}

// ==========================================
// AUTH
// ==========================================
router.post("/auth/register", register);
router.post("/auth/login", login);
router.post("/auth/setup-test-users", async (req, res) => {
  try {
    const { User } = require("@nexus-crm/database");
    const bcrypt = require("bcrypt");
    const hashedPassword = await bcrypt.hash("TestPassword123!", 10);
    
    let s1: any = await User.findOne({ where: { email: "salesman1@nexus.com" } });
    if (s1) await s1.update({ isAvailable: true, password: hashedPassword });
    
    let s2: any = await User.findOne({ where: { email: "salesman2@nexus.com" } });
    if (s2) {
      await s2.update({ isAvailable: true, dealValueCutoff: null, maxOpenDeals: null, password: hashedPassword });
    }
    
    return res.json({ message: "Test users activated", salesman1: s1?.email, salesman2: s2?.email });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// WhatsApp Router (contains public /webhook and protected /send, /conversations, /messages)
router.use("/whatsapp", whatsappRoutes);

// Protect all following routes
router.use(authMiddleware);

import { createApproval } from '../controllers/approvalController';
import { getNotifications, markAsRead, markAllAsRead } from '../controllers/notificationController';
import { getMessageTemplates, getMessageTemplateById, createMessageTemplate, updateMessageTemplate, deleteMessageTemplate } from '../controllers/messageTemplateController';
// ==========================================
// LEADS
// ==========================================
router.get("/leads/duplicates", authMiddleware, getDuplicateLeads);
router.post("/leads/merge", authMiddleware, mergeLeads);
/**
 * @swagger
 * /leads:
 *   get:
 *     summary: Get a list of all leads
 *     tags: [Leads]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: A list of leads
 *   post:
 *     summary: Create a new lead manually
 *     tags: [Leads]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               email:
 *                 type: string
 *     responses:
 *       201:
 *         description: Lead created
 */
router.get("/leads", authMiddleware, getLeads);
router.post("/leads", authMiddleware, createLead);
router.get("/leads/:id", authMiddleware, getLead);
router.put("/leads/:id", authMiddleware, updateLead);
router.patch("/leads/:id", authMiddleware, updateLead);
router.post("/leads/:id/qualify", authMiddleware, qualifyLeadEndpoint);
router.post("/leads/:id/convert", authMiddleware, convertLead);
router.post("/leads/:id/not-converted", authMiddleware, markLeadNotConverted);
router.post("/leads/:id/temperature", authMiddleware, updateTemperature);
router.post("/leads/:id/temperature/unlock", authMiddleware, unlockTemperature);
router.delete("/leads/:id", authMiddleware, deleteLead);
router.put("/leads/:id/reassign", authMiddleware, reassignLead);
router.get("/leads/:id/ai-summary", authMiddleware, getLeadAiSummary);
router.get("/leads/:id/account-history", authMiddleware, getLeadAccountHistory);
router.get("/leads/:id/reassignment-history", authMiddleware, getLeadReassignmentHistory);
router.get("/leads/:id/deal-for-quote", authMiddleware, getLeadDealForQuote);
router.get("/leads/:id/contacts", authMiddleware, getLeadContacts);
router.put("/leads/:id/clear-unread", authMiddleware, clearUnreadCount);
router.get("/leads/:id/missing-info", authMiddleware, getLeadMissingInfo);
router.post("/leads/:id/request-details", authMiddleware, requestMissingDetails);

// ==========================================
// OPPORTUNITIES / DEALS
// ==========================================
router.get("/deals", authMiddleware, getDeals);
router.get("/deals/flagged", authMiddleware, getFlaggedDeals);
router.post("/deals/:dealId/auto-assign", authMiddleware, autoAssignDealHandler);
router.post("/deals/:dealId/reassign", authMiddleware, reassignDeal);
router.get("/deals/:dealId/reassignment-history", authMiddleware, getDealReassignmentHistory);

// Deal Commission Splits
router.get("/deals/:dealId/splits", authMiddleware, getDealSplitsHandler);
router.put("/deals/:dealId/splits", authMiddleware, setDealSplitsHandler);
router.delete("/deals/:dealId/splits", authMiddleware, deleteDealSplitsHandler);

// Manager Team Routes
router.get("/manager/team", authMiddleware, getManagerTeamHandler);
router.get("/manager/stuck-deals", authMiddleware, getStuckDealsHandler);

// Deal Assignment Settings
router.get("/settings/deal-assignment-cutoffs", authMiddleware, getDealAssignmentCutoffs);
router.put("/settings/deal-assignment-cutoffs/:userId", authMiddleware, updateDealAssignmentCutoffs);
router.get("/opportunities", authMiddleware, getOpportunities);
router.get("/opportunities/:id", authMiddleware, getOpportunityById);
router.post("/opportunities", authMiddleware, createOpportunity);
router.put("/opportunities/:id", authMiddleware, updateOpportunity);
router.patch("/opportunities/:id", authMiddleware, updateOpportunity);
router.post("/opportunities/:id/stage", authMiddleware, moveOpportunityStage);
router.post("/opportunities/:id/convert-from-lead", authMiddleware, convertLead);
router.get("/opportunities/:id/quotes", authMiddleware, getOpportunityQuotes);
router.post("/opportunities/:id/quotes", authMiddleware, createOpportunityQuote);

// Automated Opportunity Lifecycle Routes
router.post("/opportunities/:id/events", authMiddleware, postOpportunityEvent);
router.post("/opportunities/:id/mark-won", authMiddleware, markOpportunityWon);
router.post("/opportunities/:id/mark-lost", authMiddleware, markOpportunityLost);
router.get("/opportunities/:id/timeline", authMiddleware, getOpportunityTimeline);
router.get("/opportunities/:id/next-action", authMiddleware, getOpportunityNextAction);
router.get("/opportunities/:id/health", authMiddleware, getOpportunityHealth);
router.get("/opportunities/:id/ai-summary", authMiddleware, getOpportunityAiSummary);

router.get("/pipeline", authMiddleware, getPipeline);
router.get("/pipeline-stages", authMiddleware, getPipelineStages);
router.get("/pipeline/stages", authMiddleware, getPipelineStages);
router.post("/pipeline/deals", authMiddleware, createDeal);
router.put("/pipeline/deals/:id/stage", authMiddleware, moveDealStage);
router.post("/pipeline/validate-transition", authMiddleware, validateTransition);

// ==========================================
// QUOTES
// ==========================================
router.get("/quotes/recommendations", authMiddleware, getQuoteRecommendations);
// Quotes endpoints
router.get("/quotes/history/similar-clients", getSimilarClientQuotes);
router.get("/quotes/history/client/:leadId", getQuoteHistoryByClient);
router.get("/quotes/history/similar/:productId", authMiddleware, getSimilarQuotesStats);
router.get("/quotes/:id/public", getPublicQuote);
router.get("/quotes/:id/delivery-channel", authMiddleware, getQuoteDeliveryPreview);
router.get("/quotes/:id/deliveries", authMiddleware, getQuoteDeliveries);
router.post("/quotes/:id/delivery-status", authMiddleware, recordDeliveryStatus);
router.get("/quotes/:id/pdf", authMiddleware, generateQuotePdf);
router.get("/quotes", authMiddleware, getQuotes);
router.post("/quotes", authMiddleware, createQuote);
router.get("/quotes/:id", authMiddleware, getQuoteById);
router.put("/quotes/:id", authMiddleware, updateQuote);
router.patch("/quotes/:id", authMiddleware, updateQuote);
router.post("/quotes/:id/create-revision", authMiddleware, createQuoteRevision);
router.post("/quotes/:id/mark-final", authMiddleware, markQuoteFinalAgreed);
router.put("/quotes/:id/final", authMiddleware, markQuoteFinalAgreed);
router.post("/quotes/:id/send", authMiddleware, sendQuote);
router.post("/quotes/:id/accept", authMiddleware, acceptQuote);
router.post("/quotes/:id/reject", authMiddleware, rejectQuote);
router.post("/quotes/:id/submit-approval", authMiddleware, submitQuoteForApproval);
router.post("/approvals/quotes/:id/submit", authMiddleware, submitQuoteForApproval);

// ==========================================
// INVOICES & PAYMENTS
// ==========================================
router.get("/invoices", authMiddleware, getInvoices);
router.get("/invoices/:id", authMiddleware, getInvoiceById);
router.post("/invoices/from-quote", authMiddleware, createInvoiceFromQuote);
router.put("/invoices/:id/status", authMiddleware, updateInvoiceStatus);
router.get("/invoices/:id/pdf", authMiddleware, generateInvoicePdf);
router.get("/invoices/:invoiceId/payments", authMiddleware, getPaymentsForInvoice);
router.post("/invoices/:invoiceId/payments", authMiddleware, createPayment);

// ==========================================
// PRICE BOOK
// ==========================================
router.get("/price-book/categories", authMiddleware, getCatalogCategories);
router.get("/price-book/uoms", authMiddleware, getCatalogUoms);
router.get("/price-book", authMiddleware, getPriceBookEntries);
router.post("/price-book", authMiddleware, createPriceBookEntry);
router.post("/price-book/import-preview", authMiddleware, importPriceBookEntriesPreview);
router.post("/price-book/import", authMiddleware, importPriceBookEntries);
router.get("/price-book/suggest/:id", authMiddleware, getPriceSuggestion);
router.put("/price-book/:id", authMiddleware, updatePriceBookEntry);
router.delete("/price-book/:id", authMiddleware, deletePriceBookEntry);

// ==========================================
// ORDERS / PURCHASE ORDERS
// ==========================================
router.get("/orders", authMiddleware, getPurchaseOrders);
router.get("/orders/:id", authMiddleware, getOrderById);
router.post("/orders/from-quote/:quoteId", authMiddleware, createOrderFromQuote);
router.post("/orders", authMiddleware, createPurchaseOrder);
router.get("/purchase-orders", authMiddleware, getPurchaseOrders);
router.post("/purchase-orders", authMiddleware, createPurchaseOrder);
router.put("/purchase-orders/:id", authMiddleware, updatePurchaseOrder);
router.post("/purchase-orders/:id/resolve", authMiddleware, resolvePurchaseOrder);
router.put("/purchase-orders/:id/resolve", authMiddleware, resolvePurchaseOrder);
router.get("/orders/:id/fulfillment", authMiddleware, getFulfillmentByOrderId);

// ==========================================
// SUPPLY & FULFILLMENT
// ==========================================
router.get("/fulfillments", authMiddleware, getFulfillments);
router.get("/fulfillments/:id", authMiddleware, getFulfillmentById);
router.patch("/fulfillments/:id/status", authMiddleware, changeFulfillmentStatus);
router.put("/fulfillments/:id/status", authMiddleware, changeFulfillmentStatus);
router.patch("/fulfillments/items/:itemId", authMiddleware, updateFulfillmentItemStatus);

// ==========================================
// APPROVALS
// ==========================================
router.get("/approvals", authMiddleware, getApprovals);
router.post("/approvals", authMiddleware, createApproval);
router.put("/approvals/:id", authMiddleware, updateApproval);

// ==========================================
// APPROVAL TIERS
// ==========================================
router.get("/approval-tiers", authMiddleware, getApprovalTiers);
router.post("/approval-tiers", authMiddleware, createApprovalTier);
router.delete("/approval-tiers/:id", authMiddleware, deleteApprovalTier);

// ==========================================
// DASHBOARDS
// ==========================================
router.get("/dashboard/kpi", authMiddleware, getKpiDashboard);
router.get("/dashboard/kpi-target", authMiddleware, getKpiTarget);
router.put("/dashboard/kpi-target", authMiddleware, updateKpiTarget);
router.get("/dashboard/management", authMiddleware, getManagementDashboard);
router.get("/dashboard/today", authMiddleware, getMyTodayDashboard);
router.get("/dashboard/home", authMiddleware, getMyHomeDashboard);
router.get("/dashboard/activities-reports", authMiddleware, getActivitiesReports);
router.get("/salespersons", authMiddleware, getAllSalespersons);
router.get("/salespersons/performance", authMiddleware, getSalespersonsPerformance);
router.get("/salespersons/org-chart", authMiddleware, getOrgChartEmployees);
router.get("/salespersons/:id/performance", authMiddleware, getSalespersonPerformanceDetails);
router.post("/salespersons", authMiddleware, createSalesperson);
router.put("/salespersons/:id/capacity", authMiddleware, updateSalespersonCapacity);
router.patch("/users/:id/team-type", authMiddleware, updateRepTeamType);

// KPI Target Management
router.get("/salespersons/:id/kpis", authMiddleware, getSalespersonKpis);
router.put("/kpis/target/:kpiId", authMiddleware, editKpiTarget);
router.get("/kpis/target/:kpiId/history", authMiddleware, getKpiHistory);
router.post("/kpis/history/:historyId/restore", authMiddleware, restoreKpiHistory);
router.post("/kpis/bulk-assign", authMiddleware, bulkAssignTargets);
router.post("/kpis/lock", authMiddleware, lockKpiTargets);
router.post("/kpis/approve", authMiddleware, approveKpiTargetChange);

// ==========================================
// ASSIGNMENT RULES
// ==========================================
router.get("/assignment-rules/capacities", authMiddleware, getSalespersonsCapacities);
router.post("/assignment-rules/balance-capacity", authMiddleware, balanceSalespersonsCapacities);
router.get("/assignment-rules", authMiddleware, getAssignmentRules);
router.post("/assignment-rules", authMiddleware, createAssignmentRule);
router.put("/assignment-rules/:id", authMiddleware, updateAssignmentRule);
router.delete("/assignment-rules/:id", authMiddleware, deleteAssignmentRule);

// Performance-Aware Assignment Policy, Profiles, Audits & Overrides
router.get("/assignment/policy", authMiddleware, getAssignmentPolicy);
router.put("/assignment/policy", authMiddleware, updateAssignmentPolicy);
router.get("/assignment/rep-profiles", authMiddleware, getRepPerformanceProfiles);
router.get("/assignment/audits", authMiddleware, getAssignmentAudits);
router.post("/assignment/reassign", authMiddleware, reassignLeadManually);

// ==========================================
// ==========================================
// NOTIFICATIONS
// ==========================================
router.get("/notifications", authMiddleware, getNotifications);
router.put("/notifications/:id/read", authMiddleware, markAsRead);
router.post("/notifications/read-all", authMiddleware, markAllAsRead);

// MESSAGE TEMPLATES
// ==========================================
router.get("/message-templates", authMiddleware, getMessageTemplates);
router.get("/message-templates/:id", authMiddleware, getMessageTemplateById);
router.get("/message-templates/:id/ab-test-stats", authMiddleware, getAbTestStats);
// Write operations are restricted to admin / director / manager — reps must not edit Content SIDs
router.post("/message-templates/:id/declare-winner", authMiddleware, requireAdminOrManager, declareWinner);
router.post("/message-templates", authMiddleware, requireAdminOrManager, createMessageTemplate);
router.put("/message-templates/:id", authMiddleware, requireAdminOrManager, updateMessageTemplate);
router.delete("/message-templates/:id", authMiddleware, requireAdminOrManager, deleteMessageTemplate);

// ==========================================
// BUNDLE TEMPLATES
// ==========================================
router.get("/bundle-templates", authMiddleware, getBundleTemplates);
router.post("/bundle-templates", authMiddleware, createBundleTemplate);
router.delete("/bundle-templates/:id", authMiddleware, deleteBundleTemplate);

// ==========================================
// EXPORTS
// ==========================================
router.get("/exports/leads", authMiddleware, exportLeads);
router.get("/exports/quotes", authMiddleware, exportQuotes);
router.get("/exports/purchase-orders", authMiddleware, exportPurchaseOrders);

// Activity/Task routes
router.get("/leads/:leadId/activities", getLeadActivities);
router.post("/leads/:leadId/activities", createActivity);
router.put("/activities/:id/pin", togglePinActivity);
router.put("/activities/:id/complete", authMiddleware, completeTask);
router.get("/activities/overdue", authMiddleware, getOverdueTasks);

// ==========================================
// MASTER DATA
// ==========================================
router.get("/master-data/requirements", authMiddleware, getRequirements);
router.post("/master-data/requirements", authMiddleware, createRequirement);
router.put("/master-data/requirements/:id", authMiddleware, updateRequirement);
router.delete("/master-data/requirements/:id", authMiddleware, deleteRequirement);
router.get("/master-data/requirements/:id/rollup", authMiddleware, getRequirementRollup);

router.get("/master-data/line-items", authMiddleware, getLineItems);
router.post("/master-data/line-items", authMiddleware, createLineItem);
router.put("/master-data/line-items/:id", authMiddleware, updateLineItem);
router.delete("/master-data/line-items/:id", authMiddleware, deleteLineItem);

router.get("/master-data/construction-items", authMiddleware, getConstructionItems);
router.post("/master-data/construction-items", authMiddleware, createConstructionItem);
router.put("/master-data/construction-items/:id", authMiddleware, updateConstructionItem);
router.delete("/master-data/construction-items/:id", authMiddleware, deleteConstructionItem);

router.get("/master-data/pricing", authMiddleware, getPricingGrid);
router.patch("/master-data/pricing/:id", authMiddleware, updateConstructionItemPricing);

router.get("/master-data/kpis", authMiddleware, getKpiMasters);
router.post("/master-data/kpis", authMiddleware, createKpiMaster);
router.put("/master-data/kpis/:id", authMiddleware, updateKpiMaster);
router.delete("/master-data/kpis/:id", authMiddleware, deleteKpiMaster);

// ==========================================
// CUSTOMERS & ACCOUNTS
// ==========================================
router.get("/accounts", authMiddleware, getAccounts);
router.post("/accounts", authMiddleware, createAccount);
router.get("/accounts/:id", authMiddleware, getAccountById);
router.post("/accounts", authMiddleware, createAccount);
router.put("/accounts/:id", authMiddleware, updateAccount);

router.get("/customers", authMiddleware, getAccounts);
router.post("/customers", authMiddleware, createAccount);
router.get("/customers/:id", authMiddleware, getAccountById);

// Contacts
router.get("/contacts", authMiddleware, getContacts);
router.get("/contacts/:id", authMiddleware, getContactById);
router.post("/contacts", authMiddleware, createContact);
router.put("/contacts/:id", authMiddleware, updateContact);

// ==========================================
// USER SETTINGS & PROFILE
// ==========================================
router.get("/my-settings", authMiddleware, getMySettings);
router.put("/my-settings", authMiddleware, updateMySettings);
router.get("/users/settings", authMiddleware, getMySettings);
router.put("/users/settings", authMiddleware, updateMySettings);
router.put("/settings/availability", authMiddleware, updateAvailability);
router.put("/salespersons/:id/availability", authMiddleware, updateAvailability);
router.post("/salespersons/reassign-absent", authMiddleware, async (req, res) => {
  try {
    const { checkAndReassignAllAbsentReps } = require("../services/absenceReassignmentService");
    const count = await checkAndReassignAllAbsentReps();
    res.json({ message: "Absence re-assignment completed", totalTransferred: count });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// ASSETS / EQUIPMENT TRACKING
// ==========================================
router.get("/assets", authMiddleware, getAssets);
router.get("/assets/:id", authMiddleware, getAssetById);
router.post("/assets", authMiddleware, createAsset);
router.put("/assets/:id", authMiddleware, updateAsset);
router.delete("/assets/:id", authMiddleware, deleteAsset);

// ==========================================
// LEAD SOURCES
// ==========================================
router.get("/lead-sources", authMiddleware, getLeadSources);
router.post("/lead-sources", authMiddleware, createLeadSource);
router.put("/lead-sources/:id", authMiddleware, updateLeadSource);
router.delete("/lead-sources/:id", authMiddleware, deleteLeadSource);

// ==========================================
// AI REPORTS
// ==========================================
router.post("/ai-reports/query", authMiddleware, queryAiReport);

// ==========================================
// VOICE LEAD CAPTURE
// ==========================================
router.post("/leads/parse-voice", authMiddleware, parseVoiceLead);

// ==========================================
// SETTINGS & TEAM
// ==========================================
router.get("/users/me/settings", authMiddleware, getMySettings);
router.put("/users/me/settings", authMiddleware, updateMySettings);
router.get("/users/me/team", authMiddleware, getMyTeam);
router.put("/users/team/reassign", authMiddleware, reassignTeamManager);
router.put("/users/:id/cutoff", authMiddleware, updateDealValueCutoff);

// Gmail Connector
router.get("/gmail/auth-url", authMiddleware, getGmailAuthUrl);
router.post("/gmail/connect", authMiddleware, connectGmail);
router.get("/gmail/status", authMiddleware, getGmailStatus);
router.post("/gmail/disconnect", authMiddleware, disconnectGmail);
router.post("/gmail/sync", authMiddleware, syncGmail);

// ==========================================
// ENTERPRISE CRM WORKSPACE ENDPOINTS
// ==========================================
router.get("/tasks", authMiddleware, getTasks);
router.post("/tasks", authMiddleware, createTask);
router.put("/tasks/:id/status", authMiddleware, updateTaskStatus);

router.get("/call-logs", authMiddleware, getCallLogs);
router.post("/call-logs", authMiddleware, createCallLog);

router.get("/documents", authMiddleware, getDocuments);
router.post("/documents", authMiddleware, createDocument);

router.get("/meetings", authMiddleware, getMeetings);
router.post("/meetings", authMiddleware, createMeeting);

router.get("/email-messages", authMiddleware, getEmailMessages);
router.post("/email-messages", authMiddleware, sendEmailMessage);

router.get("/search", authMiddleware, globalSearch);

// ==========================================
// AUTOMATIONS (STATUS-CHANGE RULE BUILDER)
// ==========================================
router.get("/automations", authMiddleware, getAutomationRules);
router.post("/automations", authMiddleware, createAutomationRule);
router.put("/automations/:id", authMiddleware, updateAutomationRule);
router.delete("/automations/:id", authMiddleware, deleteAutomationRule);

// ==========================================
// ACTIVITIES & TIMELINE
// ==========================================
router.get("/activities", authMiddleware, getLeadActivities);
router.post("/activities", authMiddleware, createActivity);
router.get("/leads/:leadId/activities", authMiddleware, getLeadActivities);
router.post("/leads/:leadId/activities", authMiddleware, createActivity);
router.put("/activities/:id/pin", authMiddleware, togglePinActivity);
router.put("/activities/:id/complete", authMiddleware, completeTask);
router.get("/activities/overdue", authMiddleware, getOverdueTasks);

// ==========================================
// TELEPHONY (TWILIO CLICK-TO-CALL)
// ==========================================
router.get("/telephony/status", authMiddleware, getTelephonyStatus);
router.post("/telephony/call", authMiddleware, initiateCall);

// ==========================================
// DEAL MILESTONES
// ==========================================
router.get("/deals/:dealId/milestones", authMiddleware, getDealMilestones);
router.post("/deals/milestones", authMiddleware, createDealMilestone);
router.put("/deals/milestones/:id/toggle", authMiddleware, toggleDealMilestone);

// ==========================================
// DEAL OWNERS (commission splits)
// ==========================================
router.get("/deals/:dealId/owners", authMiddleware, getDealOwners);
router.put("/deals/:dealId/owners", authMiddleware, updateDealOwners);

// ==========================================
// WORKSPACE SETTINGS (admin-only writes)
// ==========================================
router.get("/workspace/settings/:key", authMiddleware, getWorkspaceSetting);
router.put("/workspace/settings/:key", authMiddleware, updateWorkspaceSetting);

// ==========================================
// COACHING NOTES (MANAGER → REP)
// ==========================================
router.get("/coaching-notes", authMiddleware, getCoachingNotes);
router.get("/coaching-notes/authored", authMiddleware, getAuthoredCoachingNotes);
router.post("/coaching-notes", authMiddleware, createCoachingNote);
router.patch("/coaching-notes/:id/read", authMiddleware, markCoachingNoteRead);

// ==========================================
// DEDICATED HANDOFF MESSAGES (INTERNAL CHAT)
// ==========================================
router.get("/handoff-messages", authMiddleware, getHandoffMessages);
router.post("/handoff-messages", authMiddleware, sendHandoffMessage);
router.put("/handoff-messages/:id", authMiddleware, updateHandoffMessage);
router.delete("/handoff-messages/:id", authMiddleware, deleteHandoffMessage);

// ==========================================
// DASHBOARD EXTRAS
// ==========================================
router.get("/dashboard/stale-deals", authMiddleware, getStaleDeal);
router.get("/dashboard/quote-expiry", authMiddleware, getQuoteExpiry);
router.get("/dashboard/top-accounts", authMiddleware, getTopAccounts);
router.get("/dashboard/customer-birthdays", authMiddleware, getCustomerBirthdays);
router.get("/dashboard/win-celebrations", authMiddleware, getWinCelebrations);

// ==========================================
// PHASE 5: CAMPAIGNS & ATTRIBUTION
// ==========================================
router.get("/campaigns", authMiddleware, getCampaigns);
router.get("/campaigns/:id", authMiddleware, getCampaignById);
router.post("/campaigns", authMiddleware, createCampaign);
router.patch("/campaigns/:id", authMiddleware, updateCampaign);
router.delete("/campaigns/:id", authMiddleware, deleteCampaign);
router.post("/campaigns/:id/ads", authMiddleware, createCampaignAd);
router.get("/campaigns/:id/leads", authMiddleware, getCampaignLeads);
router.get("/campaigns/:id/opportunities", authMiddleware, getCampaignOpportunities);
router.get("/campaigns/:id/performance", authMiddleware, getCampaignPerformanceReport);

router.get("/leads/:id/attribution", authMiddleware, getLeadAttribution);
router.get("/leads/:id/attribution-history", authMiddleware, getLeadAttributionHistory);
router.post("/leads/:id/attribution", authMiddleware, recordManualTouch);

router.get("/lead-sources/taxonomy", authMiddleware, getAttributionTaxonomy);
router.get("/analytics/lead-sources", authMiddleware, getLeadSourceAnalytics);
router.get("/analytics/campaigns", authMiddleware, getCampaignsAnalytics);

// ==========================================
// SUPPORT & MAINTENANCE
// ==========================================
router.post("/support-tickets", authMiddleware, createSupportTicket);
router.get("/support-tickets", authMiddleware, listSupportTickets);
router.get("/support-tickets/:id", authMiddleware, getSupportTicketById);
router.put("/support-tickets/:id", authMiddleware, updateSupportTicket);

// ==========================================
// VERCEL SERVERLESS CRON JOBS
// ==========================================
import { runHourlyCron, runDailyCron } from "../controllers/cronController";
router.get("/cron/hourly", runHourlyCron);
router.post("/cron/hourly", runHourlyCron);
router.get("/cron/daily", runDailyCron);
router.post("/cron/daily", runDailyCron);

export default router;

