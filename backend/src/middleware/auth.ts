import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized: Missing or invalid token" });
    return;
  }

  const token = authHeader.split(" ")[1];
  


  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "default_secret");
    (req as any).user = decoded;
    next();
  } catch (err: any) {
    console.error("[DEBUG] JWT verification failed error name:", err.name, "message:", err.message, "token:", token);
    if (err.name === "TokenExpiredError") {
      res.status(401).json({ error: "TokenExpired" });
    } else {
      res.status(401).json({ error: "Unauthorized: Invalid token" });
    }
  }
};

/**
 * requireAdminOrManager — must be used AFTER authMiddleware.
 * Permits access only to users with role: admin | director | manager | sales_manager.
 * sales_rep, senior_ae, team_lead receive 403 Forbidden.
 *
 * Roles audited from backend/src and database/models:
 *   admin         → full system access
 *   director      → management-level, same as admin for CRM config
 *   manager       → management-level
 *   sales_manager → operational manager role (used in dealSplitController, priceBookController) — included
 *   sales_rep     → front-line rep — excluded
 *   senior_ae     → deal-assignment role only — excluded
 *   team_lead     → scoped lead management — excluded
 */
export const requireAdminOrManager = (req: Request, res: Response, next: NextFunction) => {
  const role: string = (req as any).user?.role ?? "";
  const ALLOWED_ROLES = ["admin", "director", "manager", "sales_manager"];
  if (!ALLOWED_ROLES.includes(role)) {
    res.status(403).json({ error: "Forbidden: admin or manager role required" });
    return;
  }
  next();
};
