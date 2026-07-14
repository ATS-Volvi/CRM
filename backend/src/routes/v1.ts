import { Router } from "express";
import { register, login } from "../controllers/auth";
import { createPublicLead } from "../controllers/publicLeads";
import { authMiddleware } from "../middleware/auth";
import { getPipeline, moveDealStage, createDeal, getDeals } from "../controllers/pipelineController";
import { getLeadActivities, createActivity, togglePinActivity, completeTask, getOverdueTasks } from "../controllers/activityController";
import { getLeads, createLead, updateLead, deleteLead, getDuplicateLeads, mergeLeads } from '../controllers/leadController';
import { getPriceBookEntries, createPriceBookEntry, updatePriceBookEntry, deletePriceBookEntry, importPriceBookEntries, getPriceSuggestion, importPriceBookEntriesPreview } from '../controllers/priceBookController';
import { getQuotes, createQuote, getQuoteRecommendations, sendQuote, getPublicQuote, generateQuotePdf, signQuote, getQuoteHistoryByClient, getSimilarQuotesStats } from '../controllers/quoteController';
import { getInvoices, createInvoiceFromQuote, updateInvoiceStatus } from '../controllers/invoiceController';
import { getPurchaseOrders, createPurchaseOrder, updatePurchaseOrder } from '../controllers/purchaseOrderController';
import { getApprovals, updateApproval, getApprovalTiers, createApprovalTier, deleteApprovalTier } from '../controllers/approvalController';
import { getKpiDashboard, getManagementDashboard, getMyTodayDashboard, getMyHomeDashboard, getKpiTarget, updateKpiTarget, getActivitiesReports } from '../controllers/dashboardController';
import { getAssignmentRules, createAssignmentRule, updateAssignmentRule, deleteAssignmentRule } from '../controllers/assignmentRuleController';
import { getBundleTemplates, createBundleTemplate, deleteBundleTemplate } from '../controllers/bundleController';
import { exportLeads, exportQuotes, exportPurchaseOrders } from '../controllers/exportController';
import { getSalespersonsPerformance, createSalesperson, getSalespersonPerformanceDetails } from '../controllers/salespersonController';
import { getMessageTemplates, updateMessageTemplate } from '../controllers/communicationController';
import {
  getRequirements, createRequirement, updateRequirement, deleteRequirement,
  getLineItems, createLineItem, updateLineItem, deleteLineItem,
  getConstructionItems, createConstructionItem, updateConstructionItem, deleteConstructionItem,
  getRequirementRollup, getPricingGrid, updateConstructionItemPricing
} from '../controllers/masterDataController';

const router = Router();

// ==========================================
// PUBLIC ROUTES
// ==========================================
router.post("/public/leads", createPublicLead);
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

// ==========================================
// LEADS
// ==========================================
router.get("/leads/duplicates", authMiddleware, getDuplicateLeads);
router.post("/leads/merge", authMiddleware, mergeLeads);
router.get("/leads", authMiddleware, getLeads);
router.post("/leads", authMiddleware, createLead);
router.put("/leads/:id", authMiddleware, updateLead);
router.delete("/leads/:id", authMiddleware, deleteLead);

router.get("/deals", authMiddleware, getDeals);
router.get("/pipeline", authMiddleware, getPipeline);
router.post("/pipeline/deals", authMiddleware, createDeal);
router.put("/pipeline/deals/:id/stage", authMiddleware, moveDealStage);

// ==========================================
// QUOTES
// ==========================================
router.get("/quotes/recommendations", authMiddleware, getQuoteRecommendations);
router.get("/quotes/history/client/:leadId", authMiddleware, getQuoteHistoryByClient);
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
router.get("/salespersons/performance", authMiddleware, getSalespersonsPerformance);
router.get("/salespersons/:id/performance", authMiddleware, getSalespersonPerformanceDetails);
router.post("/salespersons", authMiddleware, createSalesperson);

// ==========================================
// ASSIGNMENT RULES
// ==========================================
router.get("/assignment-rules", authMiddleware, getAssignmentRules);
router.post("/assignment-rules", authMiddleware, createAssignmentRule);
router.put("/assignment-rules/:id", authMiddleware, updateAssignmentRule);
router.delete("/assignment-rules/:id", authMiddleware, deleteAssignmentRule);

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

// ==========================================
// MESSAGE TEMPLATES
// ==========================================
router.get("/message-templates", authMiddleware, getMessageTemplates);
router.put("/message-templates/:id", authMiddleware, updateMessageTemplate);

export default router;
