import { Router } from "express";
import { register, login } from "../controllers/auth";
import { createPublicLead } from "../controllers/publicLeads";
import { authMiddleware } from "../middleware/auth";
import { getPipeline, moveDealStage, createDeal, getDeals } from "../controllers/pipelineController";
import { getLeadActivities, createActivity, togglePinActivity, completeTask, getOverdueTasks } from "../controllers/activityController";
import { getLeads, getLead, createLead, updateLead, deleteLead, getDuplicateLeads, mergeLeads, reassignLead, getLeadReassignmentHistory, getLeadDealForQuote } from '../controllers/leadController';
import { getPriceBookEntries, createPriceBookEntry, updatePriceBookEntry, deletePriceBookEntry, importPriceBookEntries, getPriceSuggestion, importPriceBookEntriesPreview } from '../controllers/priceBookController';
import { getQuotes, createQuote, getQuoteRecommendations, sendQuote, getPublicQuote, generateQuotePdf, signQuote, getQuoteHistoryByClient, getSimilarQuotesStats, getSimilarClientQuotes } from '../controllers/quoteController';
import { getInvoices, createInvoiceFromQuote, updateInvoiceStatus, generateInvoicePdf } from '../controllers/invoiceController';
import { getPurchaseOrders, createPurchaseOrder, updatePurchaseOrder } from '../controllers/purchaseOrderController';
import { getApprovals, updateApproval, getApprovalTiers, createApprovalTier, deleteApprovalTier } from '../controllers/approvalController';
import { getKpiDashboard, getManagementDashboard, getMyTodayDashboard, getMyHomeDashboard, getKpiTarget, updateKpiTarget, getActivitiesReports, getHomeDashboard } from '../controllers/dashboardController';
import { getAssignmentRules, createAssignmentRule, updateAssignmentRule, deleteAssignmentRule, getSalespersonsCapacities, balanceSalespersonsCapacities } from '../controllers/assignmentRuleController';
import { getBundleTemplates, createBundleTemplate, deleteBundleTemplate } from '../controllers/bundleController';
import { exportLeads, exportQuotes, exportPurchaseOrders } from '../controllers/exportController';
import {
  getSalespersonsPerformance, createSalesperson, getSalespersonPerformanceDetails, getAllSalespersons, updateSalespersonCapacity,
  getSalespersonKpis, editKpiTarget, getKpiHistory, restoreKpiHistory, bulkAssignTargets, lockKpiTargets, approveKpiTargetChange
} from '../controllers/salespersonController';
import {
  getRequirements, createRequirement, updateRequirement, deleteRequirement,
  getLineItems, createLineItem, updateLineItem, deleteLineItem,
  getConstructionItems, createConstructionItem, updateConstructionItem, deleteConstructionItem,
  getRequirementRollup, getPricingGrid, updateConstructionItemPricing
} from '../controllers/masterDataController';
import { receiveInboundEmail } from "../controllers/emailController";
import { getCustomers, getCustomerById } from "../controllers/customerController";
import { getLeadSources, createLeadSource, updateLeadSource, deleteLeadSource } from "../controllers/leadSourceController";
import { queryAiReport } from "../controllers/aiReportController";
import { parseVoiceLead } from "../controllers/voiceLeadController";
import { getMySettings, updateMySettings, getMyTeam, reassignTeamManager } from "../controllers/userSettingsController";
import { getKpiMasters, createKpiMaster, updateKpiMaster, deleteKpiMaster } from "../controllers/kpiMasterController";
import { getGmailAuthUrl, connectGmail, getGmailStatus, disconnectGmail, syncGmail } from "../controllers/gmailController";
import { getTasks, createTask, updateTaskStatus } from "../controllers/taskController";
import { getCallLogs, createCallLog } from "../controllers/callLogController";
import { getDocuments, createDocument } from "../controllers/documentController";
import { getMeetings, createMeeting } from "../controllers/meetingController";
import { getEmailMessages, sendEmailMessage } from "../controllers/emailMessageController";
import { globalSearch } from "../controllers/searchController";

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
router.post("/auth/login", login);
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
router.post("/public/quotes/:id/sign", signQuote);

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

// Protect all following routes
router.use(authMiddleware);

import { createApproval } from '../controllers/approvalController';
import { getNotifications, markAsRead, markAllAsRead } from '../controllers/notificationController';
import { getMessageTemplates, getMessageTemplateById, createMessageTemplate, updateMessageTemplate, deleteMessageTemplate } from '../controllers/messageTemplateController';
import whatsappRoutes from './whatsappRoutes';
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
router.delete("/leads/:id", authMiddleware, deleteLead);
router.put("/leads/:id/reassign", authMiddleware, reassignLead);
router.get("/leads/:id/reassignment-history", authMiddleware, getLeadReassignmentHistory);
router.get("/leads/:id/deal-for-quote", authMiddleware, getLeadDealForQuote);

router.get("/deals", authMiddleware, getDeals);
router.get("/pipeline", authMiddleware, getPipeline);
router.post("/pipeline/deals", authMiddleware, createDeal);
router.put("/pipeline/deals/:id/stage", authMiddleware, moveDealStage);

// ==========================================
// QUOTES
// ==========================================
router.get("/quotes/recommendations", authMiddleware, getQuoteRecommendations);
// Quotes endpoints
router.get("/quotes/history/similar-clients", getSimilarClientQuotes);
router.get("/quotes/history/client/:leadId", getQuoteHistoryByClient);
router.get("/quotes/history/similar/:productId", authMiddleware, getSimilarQuotesStats);
router.get("/quotes", authMiddleware, getQuotes);
router.post("/quotes", authMiddleware, createQuote);
router.post("/quotes/:id/send", authMiddleware, sendQuote);
router.get("/quotes/:id/pdf", authMiddleware, generateQuotePdf);

// ==========================================
// INVOICES
// ==========================================
router.get("/invoices", authMiddleware, getInvoices);
router.post("/invoices/from-quote", authMiddleware, createInvoiceFromQuote);
router.put("/invoices/:id/status", authMiddleware, updateInvoiceStatus);
router.get("/invoices/:id/pdf", authMiddleware, generateInvoicePdf);

// ==========================================
// PRICE BOOK
// ==========================================
router.get("/price-book", authMiddleware, getPriceBookEntries);
router.post("/price-book", authMiddleware, createPriceBookEntry);
router.post("/price-book/import-preview", authMiddleware, importPriceBookEntriesPreview);
router.post("/price-book/import", authMiddleware, importPriceBookEntries);
router.get("/price-book/suggest/:id", authMiddleware, getPriceSuggestion);
router.put("/price-book/:id", authMiddleware, updatePriceBookEntry);
// ==========================================
// PURCHASE ORDERS
// ==========================================
router.get("/purchase-orders", authMiddleware, getPurchaseOrders);
router.post("/purchase-orders", authMiddleware, createPurchaseOrder);
router.put("/purchase-orders/:id", authMiddleware, updatePurchaseOrder);

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
router.get("/salespersons/:id/performance", authMiddleware, getSalespersonPerformanceDetails);
router.post("/salespersons", authMiddleware, createSalesperson);
router.put("/salespersons/:id/capacity", authMiddleware, updateSalespersonCapacity);

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
router.post("/message-templates/:id/declare-winner", authMiddleware, declareWinner);
router.post("/message-templates", authMiddleware, createMessageTemplate);
router.put("/message-templates/:id", authMiddleware, updateMessageTemplate);
router.delete("/message-templates/:id", authMiddleware, deleteMessageTemplate);

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
// CUSTOMERS
// ==========================================
router.get("/customers", authMiddleware, getCustomers);
router.get("/customers/:id", authMiddleware, getCustomerById);

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

export default router;

// ==========================================
// WHATSAPP
// ==========================================
router.use("/whatsapp", whatsappRoutes);
