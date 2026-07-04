import express, { Express } from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";

export function createServer(): Express {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: process.env.CORS_ORIGIN || "*", credentials: true }));
  app.use(express.json());
  app.use(cookieParser());

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", service: "nexus-crm-backend" });
  });

  import v1Router from "./src/routes/v1";
  app.use("/api/v1", v1Router);

  return app;
}
