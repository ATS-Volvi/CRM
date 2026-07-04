import { Router, Request, Response } from "express";
import { register, login } from "../controllers/auth";
import { authMiddleware } from "../middleware/auth";
import { 
  Lead, Deal, Quote, PriceBookEntry, 
  PurchaseOrder, ApprovalRequest, AssignmentRule 
} from "@nexus-crm/database";

const router = Router();

// Public routes
router.post("/auth/register", register);
router.post("/auth/login", login);

// Special KPI endpoints for dashboard mock (Public for preview)
router.get("/kpis/salesperson", async (req, res) => {
  res.json({ sales: 12000, pipeline: 45000, meetings: 4, winRate: 65 });
});
router.get("/kpis/management", async (req, res) => {
  res.json({ totalRevenue: 1200000, activeDeals: 34, topPerformer: "Jane Doe" });
});

// Protect all following routes
router.use(authMiddleware);

import { mockLeads, mockPipeline, mockQuotes, mockPurchaseOrders, mockPriceBook, mockApprovals, mockAssignmentRules } from "../mockData";

// Mock CRUD routes
router.get("/leads", (req, res) => { res.json(mockLeads); });
router.get("/pipeline", (req, res) => { res.json(mockPipeline); });
router.get("/quotes", (req, res) => { res.json(mockQuotes); });
router.get("/purchase-orders", (req, res) => { res.json(mockPurchaseOrders); });
router.get("/price-book", (req, res) => { res.json(mockPriceBook); });
router.get("/approvals", (req, res) => { res.json(mockApprovals); });
router.get("/assignment-rules", (req, res) => { res.json(mockAssignmentRules); });

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

// Disable database-backed routes for now since PG isn't connected
// router.use("/leads", createCrudRoutes(Lead));
// router.use("/deals", createCrudRoutes(Deal));
// router.use("/quotes", createCrudRoutes(Quote));
// router.use("/price-book", createCrudRoutes(PriceBookEntry));
// router.use("/purchase-orders", createCrudRoutes(PurchaseOrder));
// router.use("/approvals", createCrudRoutes(ApprovalRequest));
// router.use("/assignment-rules", createCrudRoutes(AssignmentRule));

export default router;
