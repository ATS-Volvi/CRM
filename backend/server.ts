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
  app.use(express.json());
  app.use(cookieParser());
  app.use("/static", express.static(path.join(__dirname, "public")));

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", service: "nexus-crm-backend" });
  });

  setupSwagger(app);

  app.use("/api/v1", v1Router);

  // Serve static assets from frontend build if they exist
  // __dirname is backend/build/ (or backend/build/backend/), go up to repo root
  const repoRoot = path.resolve(__dirname, "../../..");
  const frontendBuildPath = path.join(repoRoot, "frontend/dist");
  app.use(express.static(frontendBuildPath));

  // SPA routing fallback for Client-side react Router paths
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/static") || req.path.startsWith("/api-docs")) {
      return next();
    }
    res.sendFile(path.join(frontendBuildPath, "index.html"), (err) => {
      if (err) {
        // If index.html is missing (e.g. during local backend-only testing), pass to default 404 handler
        next();
      }
    });
  });

  return app;
}
