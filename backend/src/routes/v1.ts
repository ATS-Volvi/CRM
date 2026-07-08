import { Router } from "express";
import { register, login } from "../controllers/auth";
import { createPublicLead } from "../controllers/publicLeads";
import { authMiddleware } from "../middleware/auth";
import { getPipeline, moveDealStage, createDeal } from "../controllers/pipelineController";
import { getLeadActivities, createActivity, togglePinActivity, completeTask, getOverdueTasks } from "../controllers/activityController";
import { getLeads, createLead, updateLead, deleteLead, getDuplicateLeads, mergeLeads } from '../controllers/leadController';
import { getPriceBookEntries, createPriceBookEntry, updatePriceBookEntry, deletePriceBookEntry, importPriceBookEntries } from '../controllers/priceBookController';
import { getQuotes, createQuote, getQuoteRecommendations, sendQuote, getPublicQuote, generateQuotePdf } from '../controllers/quoteController';
import { getInvoices, createInvoiceFromQuote, updateInvoiceStatus } from '../controllers/invoiceController';
import { getPurchaseOrders, createPurchaseOrder, updatePurchaseOrder } from '../controllers/purchaseOrderController';
import { getApprovals, updateApproval, getApprovalTiers, createApprovalTier, deleteApprovalTier } from '../controllers/approvalController';
import { getKpiDashboard, getManagementDashboard, getMyTodayDashboard } from '../controllers/dashboardController';
import { getAssignmentRules, createAssignmentRule, updateAssignmentRule, deleteAssignmentRule } from '../controllers/assignmentRuleController';
import { getBundleTemplates, createBundleTemplate, deleteBundleTemplate } from '../controllers/bundleController';
import { exportLeads, exportQuotes, exportPurchaseOrders } from '../controllers/exportController';
import { getSalespersonsPerformance } from '../controllers/salespersonController';

const router = Router();

// Public routes
router.post("/auth/register", register);
router.post("/auth/login", login);
router.post("/public/leads", createPublicLead);
router.get("/public/quotes/:id", getPublicQuote);

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

router.get("/deals", (req, res) => { res.json([]); });
router.get("/pipeline", authMiddleware, getPipeline);
router.post("/pipeline/deals", authMiddleware, createDeal);
router.put("/pipeline/deals/:id/stage", authMiddleware, moveDealStage);

// ==========================================
// QUOTES
// ==========================================
router.get("/quotes/recommendations", authMiddleware, getQuoteRecommendations);
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
router.post("/price-book/import", authMiddleware, importPriceBookEntries);
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
router.get("/dashboard/management", authMiddleware, getManagementDashboard);
router.get("/dashboard/today", authMiddleware, getMyTodayDashboard);
router.get("/salespersons/performance", authMiddleware, getSalespersonsPerformance);

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



export default router;
