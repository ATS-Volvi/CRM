import express, { Express } from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import v1Router from "./src/routes/v1";

export function createServer(): Express {
  const app = express();

  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(cors({ origin: process.env.CORS_ORIGIN || "http://localhost:5173", credentials: true }));
  app.use(express.json());
  app.use(cookieParser());

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", service: "nexus-crm-backend" });
  });

  app.use("/api/v1", v1Router);

  return app;
}
