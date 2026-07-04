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

// Protect all following routes
router.use(authMiddleware);

// Generic CRUD factory for quick scaffolding
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
  
  r.get("/:id", async (req: Request, res: Response) => {
    try {
      const item = await model.findByPk(req.params.id);
      if (!item) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      res.json(item);
    } catch (e: any) { 
      res.status(500).json({ error: e.message }); 
    }
  });

  r.post("/", async (req: Request, res: Response) => {
    try {
      const item = await model.create(req.body);
      res.status(201).json(item);
    } catch (e: any) { 
      res.status(400).json({ error: e.message }); 
    }
  });

  r.patch("/:id", async (req: Request, res: Response) => {
    try {
      const item = await model.findByPk(req.params.id);
      if (!item) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      await item.update(req.body);
      res.json(item);
    } catch (e: any) { 
      res.status(400).json({ error: e.message }); 
    }
  });

  r.delete("/:id", async (req: Request, res: Response) => {
    try {
      const item = await model.findByPk(req.params.id);
      if (!item) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      await item.destroy();
      res.status(204).send();
    } catch (e: any) { 
      res.status(500).json({ error: e.message }); 
    }
  });
  
  return r;
};

// Mount CRUD routes for each entity
router.use("/leads", createCrudRoutes(Lead));
router.use("/deals", createCrudRoutes(Deal));
router.use("/quotes", createCrudRoutes(Quote));
router.use("/price-book", createCrudRoutes(PriceBookEntry));
router.use("/purchase-orders", createCrudRoutes(PurchaseOrder));
router.use("/approvals", createCrudRoutes(ApprovalRequest));
router.use("/assignment-rules", createCrudRoutes(AssignmentRule));

// Special KPI endpoints for dashboard mock
router.get("/kpis/salesperson", async (req, res) => {
  res.json({ sales: 12000, pipeline: 45000, meetings: 4, winRate: 65 });
});
router.get("/kpis/management", async (req, res) => {
  res.json({ totalRevenue: 1200000, activeDeals: 34, topPerformer: "Jane Doe" });
});

export default router;
