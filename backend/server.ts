import express, { Express } from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import path from "path";
import v1Router from "./src/routes/v1";
import { setupSwagger } from "./src/swagger";

export function createServer(): Express {
  const app = express();

  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  const corsOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(",").map(o => o.trim())
    : ["http://localhost:5173", "https://crm-frontend-9xq4.vercel.app"];
  app.use(cors({ origin: corsOrigins, credentials: true }));
  app.use(express.json({ verify: (req: any, _res, buf) => { req.rawBody = buf; } }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.use("/static", express.static(path.join(__dirname, "public")));

  app.get(["/api/health", "/health"], (_req, res) => {
    res.json({ status: "ok", service: "nexus-crm-backend" });
  });

  app.get(["/api/db-health", "/db-health"], async (_req, res) => {
    const { sequelize } = require("@nexus-crm/database");
    try {
      await sequelize.authenticate();
      const userCount = await sequelize.models.User?.count().catch((e: any) => `table_error: ${e.message}`);
      res.json({
        status: "connected",
        database: "postgres",
        userCount,
        hasDatabaseUrl: !!process.env.DATABASE_URL
      });
    } catch (err: any) {
      res.status(500).json({
        status: "database_connection_failed",
        error: err.message,
        detail: err.parent?.message || err.original?.message || err.message,
        code: err.parent?.code || err.original?.code
      });
    }
  });

  setupSwagger(app);

  app.use(["/api/v1", "/v1"], v1Router);

  // Robust SPA build path resolution across Render/Docker/Local environments (Vercel serves frontend statically directly)
  if (!process.env.VERCEL) {
    const fs = require("fs");
    const possiblePaths = [
      path.join(process.cwd(), "../frontend/dist"),
      path.join(process.cwd(), "frontend/dist"),
      path.resolve(__dirname, "../../../frontend/dist"),
      path.resolve(__dirname, "../../frontend/dist"),
      path.resolve(__dirname, "../frontend/dist")
    ];
    const frontendBuildPath = possiblePaths.find(p => fs.existsSync(p)) || possiblePaths[0];
    app.use(express.static(frontendBuildPath));

    // SPA routing fallback for Client-side React Router paths
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api") || req.path.startsWith("/static") || req.path.startsWith("/api-docs")) {
        return next();
      }
      const indexPath = path.join(frontendBuildPath, "index.html");
      if (fs.existsSync(indexPath)) {
        return res.sendFile(indexPath);
      }
      next();
    });
  }

  // 404 JSON fallback for unmatched API routes
  app.all("*", (req, res) => {
    res.status(404).json({ error: "Endpoint not found", path: req.path });
  });

  // Global error handler to ensure JSON response for API calls
  app.use((err: any, _req: any, res: any, _next: any) => {
    console.error("[EXPRESS ERROR]", err);
    res.status(err.status || 500).json({
      error: err.message || "Internal Server Error"
    });
  });

  return app;
}
