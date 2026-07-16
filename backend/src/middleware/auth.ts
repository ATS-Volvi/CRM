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


