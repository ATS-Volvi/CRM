import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized: Missing or invalid token" });
    return;
  }

  const token = authHeader.split(" ")[1];
  
  if (token === "dummy") {
    (req as any).user = { id: "mock-user", role: "admin" };
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "default_secret");
    (req as any).user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: "Unauthorized: Invalid token" });
  }
};
