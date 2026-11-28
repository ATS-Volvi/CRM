// Root index.js entry point for Render, Docker, and cloud deployments
const fs = require("fs");
const path = require("path");

const candidates = [
  path.join(__dirname, "backend/build/backend/index.js"),
  path.join(__dirname, "backend/build/index.js"),
  path.join(__dirname, "build/backend/index.js"),
  path.join(__dirname, "build/index.js"),
];

const targetPath = candidates.find((p) => fs.existsSync(p));

if (!targetPath) {
  console.error("[CRITICAL] Could not locate compiled backend entrypoint. Checked candidates:", candidates);
  process.exit(1);
}

console.log(`[BOOT] Launching Nexus CRM backend from: ${targetPath}`);
require(targetPath);
