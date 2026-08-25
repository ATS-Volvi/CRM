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

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", service: "nexus-crm-backend" });
  });

  setupSwagger(app);

  app.use("/api/v1", v1Router);

  // Robust SPA build path resolution across Render/Docker environments
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

  return app;
}
