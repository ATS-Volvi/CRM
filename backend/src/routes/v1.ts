import { Router, Request, Response } from "express";
import { register, login } from "../controllers/auth";
import { createPublicLead } from "../controllers/publicLeads";
import { authMiddleware } from "../middleware/auth";
import { 
  Lead, Deal, Quote, PriceBookEntry, 
  PurchaseOrder, ApprovalRequest, AssignmentRule 
} from "@nexus-crm/database";

const router = Router();

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
router.post("/public/leads", createPublicLead);

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

// Protect all following routes
router.use(authMiddleware);

// Mock CRUD routes removed, replaced by DB routes below

import { mockLeads, mockQuotes, mockPurchaseOrders, mockPriceBook, mockApprovals, mockAssignmentRules } from "../mockData";
import { getPipeline, moveDealStage, createDeal } from "../controllers/pipelineController";
import { getLeadActivities, createActivity, togglePinActivity } from "../controllers/activityController";
import { getLeads, createLead, updateLead, deleteLead, getDuplicateLeads, mergeLeads } from '../controllers/leadController';
import { getPriceBookEntries, createPriceBookEntry, updatePriceBookEntry, deletePriceBookEntry } from '../controllers/priceBookController';
import { getQuotes, createQuote, getQuoteRecommendations } from '../controllers/quoteController';
import { getInvoices, createInvoiceFromQuote, updateInvoiceStatus } from '../controllers/invoiceController';
import { getPurchaseOrders, createPurchaseOrder } from '../controllers/purchaseOrderController';
import { getApprovals, updateApproval, createApproval } from '../controllers/approvalController';
import { getKpiDashboard, getManagementDashboard } from '../controllers/dashboardController';
import { getAssignmentRules } from '../controllers/assignmentRuleController';
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
router.put("/leads/:id", authMiddleware, updateLead);
router.delete("/leads/:id", authMiddleware, deleteLead);

// Mock legacy endpoints (keeping just in case, but real ones take precedence above)
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
router.put("/price-book/:id", authMiddleware, updatePriceBookEntry);
// ==========================================
// PURCHASE ORDERS
// ==========================================
router.get("/purchase-orders", authMiddleware, getPurchaseOrders);
router.post("/purchase-orders", authMiddleware, createPurchaseOrder);

// ==========================================
// APPROVALS
// ==========================================
router.get("/approvals", authMiddleware, getApprovals);
router.post("/approvals", authMiddleware, createApproval);
router.put("/approvals/:id", authMiddleware, updateApproval);

// ==========================================
// DASHBOARDS
// ==========================================
router.get("/dashboard/kpi", authMiddleware, getKpiDashboard);
router.get("/dashboard/management", authMiddleware, getManagementDashboard);

// ==========================================
// ASSIGNMENT RULES
// ==========================================
router.get("/assignment-rules", authMiddleware, getAssignmentRules);

// ==========================================
// NOTIFICATIONS
// ==========================================
router.get("/notifications", authMiddleware, getNotifications);
router.put("/notifications/:id/read", authMiddleware, markAsRead);
router.post("/notifications/read-all", authMiddleware, markAllAsRead);

// ==========================================
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
// WHATSAPP
// ==========================================
router.use("/whatsapp", whatsappRoutes);

// ==========================================
// DOCUSIGN
// ==========================================


// Activity routes
router.get("/leads/:leadId/activities", getLeadActivities);
router.post("/leads/:leadId/activities", createActivity);
router.put("/activities/:id/pin", togglePinActivity);

// Generic CRUD factory for quick scaffolding (Database required)
const createCrudRoutes = (model: any) => {
  const r = Router();
  r.get("/", async (req: Request, res: Response) => {
    try {
      const items = await model.findAll();
      res.json(items);
    } catch (e: any) { 
      res.status(500).json({ error: e.message }); 
    }
  });
  return r;
};

// Database-backed routes (Disabled for now to use mock data)
// router.use("/leads", createCrudRoutes(Lead));
// router.use("/deals", createCrudRoutes(Deal));
// router.use("/quotes", createCrudRoutes(Quote));
// router.use("/price-book", createCrudRoutes(PriceBookEntry));
// router.use("/purchase-orders", createCrudRoutes(PurchaseOrder));
// router.use("/approvals", createCrudRoutes(ApprovalRequest));
// router.use("/assignment-rules", createCrudRoutes(AssignmentRule));

export default router;
