#!/usr/bin/env ts-node
/**
 * check:currency — static source hygiene gate
 *
 * Fails with exit code 1 if any file in backend/src or frontend/src contains
 * patterns that indicate hardcoded, locale-specific, or currency-unaware money
 * handling outside the explicit allowlist below.
 *
 * Run via:  npm run check:currency   (from repo root)
 *           npx ts-node backend/src/scripts/checkCurrency.ts
 */

import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";

// ─── ALLOWLIST ──────────────────────────────────────────────────────────────
// Files/paths whose matches are intentionally permitted.
// Use partial path segments (matched with String.includes).
const ALLOWLIST_PATHS: string[] = [
  // Seed & test data — locale strings are acceptable there
  "backend/src/mockData/",
  "backend/src/scripts/seed_",
  "backend/src/scripts/load_",
  "backend/src/scripts/test",
  "backend/src/scripts/execute_live_walkthrough",
  "backend/src/scripts/audit_channels",
  "backend/src/scripts/check_",
  "backend/src/scripts/checkCurrency.ts", // this file itself
  "backend/src/scripts/assignTeams",
  "backend/src/scripts/reassign",
  "backend/src/scripts/quoteTotals",
  "backend/src/scripts/inspect_",
  "backend/src/scripts/verify_",
  // Journey workflow demo steps — illustrative only, not real calculations
  "backend/src/services/leadJourneyWorkflowEngine.ts",
  // Notification/Comms controller test trigger helpers (demo data, not calculations)
  "backend/src/controllers/notificationController.ts",
  // WhatsApp controller has hardcoded demo payload with $ values
  "backend/src/controllers/whatsappController.ts",
  // communicationService uses " $0.00" as a sentinel zero-display string
  "backend/src/services/communicationService.ts",
  // Approvals mock data files
  "backend/src/mockData/approvals.ts",
  // Frontend: CommunicationCenter has hardcoded demo deal cards (UI mock, not real data)
  "frontend/src/pages/CommunicationCenter.tsx",
  // AIReportVisualizer uses ₹/$ to detect if a table column header contains currency
  // for right-alignment purposes — not used for formatting amounts
  "frontend/src/components/AIReportVisualizer.tsx",
  // Settings.tsx: ₹ appears in the currency label "INR — Indian Rupee (₹)" — correct
  "frontend/src/pages/Settings.tsx",
];

// ─── RULES ──────────────────────────────────────────────────────────────────
interface Rule {
  id: string;
  description: string;
  pattern: RegExp;
  /**
   * Optional per-match validator. If provided, only lines for which this
   * returns true are counted as violations (allows context-sensitive exclusions).
   * Receives the full line text and the absolute file path.
   */
  reject?: (line: string, filePath: string) => boolean;
  /** If true, this rule is only checked for files under backend/src/ */
  backendOnly?: boolean;
}

const RULES: Rule[] = [
  {
    id: "HARDCODED_RUPEE",
    description: "Hardcoded ₹ symbol used as value formatter (use formatMoney(val, currency))",
    pattern: /₹/,
    reject: (line) => {
      // Allow ₹ inside regex character classes: [...₹...]
      if (/\[[^\]]*₹[^\]]*\]/.test(line)) return false;
      // Allow ₹ inside regex alternation groups (regex literal or .match() call)
      if (/\/[^\/]*₹[^\/]*\/|\.match\([^)]*₹/.test(line)) return false;
      // Allow ₹ that appears only after // (inline comment suffix)
      const commentStart = line.indexOf("//");
      if (commentStart !== -1 && !/₹/.test(line.substring(0, commentStart))) return false;
      // Allow ₹ inside currency label strings like "INR — Indian Rupee (₹)"
      if (/Rupee\s*\(₹\)|\(₹\)"/.test(line)) return false;
      return true;
    },
  },
  {
    id: "HARDCODED_DOLLAR_JSX",
    description: "Hardcoded $ amount in JSX/TSX string literal (use formatMoney)",
    // $ followed by digit(s) inside a quoted string (amount pattern)
    pattern: /["'`][^"'`]*\$[0-9][^"'`]*["'`]/,
    reject: (line) => {
      // Skip regex replace patterns: replace(/.../, ' $1') or ' $2'
      if (/['"` ]\$[1-9]['"` ]|replace\([^)]*\$[1-9]/.test(line)) return false;
      // Skip zero-sentinel strings: "$0.00" or '$0'
      if (/["'`]\$0(\.00)?["'`]/.test(line)) return false;
      // Skip console.log test step descriptions
      if (/console\.log\(/.test(line)) return false;
      return true;
    },
  },
  {
    id: "CR_SUFFIX",
    description: "Cr suffix abbreviation for Crore (INR-locale: use formatMoney or formatMoneyCompact)",
    pattern: /\bCr\b|\s+Cr['"`,)]/,
    reject: (line) => {
      return /(?:toFixed\(\d+\)\s*\+?\s*[`'"] Cr|[`'"] Cr[`'"]|\b\d+\s*Cr\b)/.test(line);
    },
  },
  {
    id: "LAKH_SUFFIX",
    description: "Lakh/L suffix abbreviation (INR-locale: use formatMoney or formatMoneyCompact)",
    pattern: /\bLakh\b|\bLakhs\b/,
  },
  {
    id: "TIMES_10000_ESTIMATE",
    description: "* 10000 value estimate (leadScore * 10000 pattern — use resolveLimit instead)",
    pattern: /\*\s*10000\b/,
  },
  {
    id: "FORMAT_MONEY_NO_CURRENCY",
    description: "Backend formatMoney() called without a currency argument (always pass currency on the server)",
    pattern: /\bformatMoney\s*\(/,
    backendOnly: true, // Frontend formatCurrency(val) uses globalOrgCurrency — intentional
    reject: (line) => {
      // Find the formatMoney( call and count commas at depth 1 to determine arg count
      const idx = line.search(/\bformatMoney\s*\(/);
      if (idx === -1) return false;
      const start = line.indexOf("(", idx);
      if (start === -1) return false;
      let depth = 0;
      let topLevelCommas = 0;
      for (let i = start; i < line.length; i++) {
        const ch = line[i];
        if (ch === "(") depth++;
        else if (ch === ")") {
          depth--;
          if (depth === 0) break; // end of the formatMoney(...) call
        } else if (ch === "," && depth === 1) {
          topLevelCommas++;
        }
      }
      // A single-arg call has 0 top-level commas; that is a violation
      return topLevelCommas === 0;
    },
  },
  {
    id: "PROBABILITY_DEFAULT_50",
    description: "?? 50 bare probability default (use a named constant)",
    pattern: /\?\?\s*50\b/,
    reject: (line) => {
      return /(?:probability|score|prob|chance|likelihood|winRate)\s*\?\?\s*50\b/i.test(line);
    },
  },
];

// ─── SCANNER ────────────────────────────────────────────────────────────────

interface Violation {
  file: string;
  line: number;
  ruleId: string;
  description: string;
  content: string;
}

function isAllowlisted(filePath: string): boolean {
  const normalised = filePath.replace(/\\/g, "/");
  return ALLOWLIST_PATHS.some((p) => normalised.includes(p.replace(/\\/g, "/")));
}

async function scanFile(filePath: string, violations: Violation[]): Promise<void> {
  if (isAllowlisted(filePath)) return;

  const ext = path.extname(filePath);
  if (![".ts", ".tsx"].includes(ext)) return;

  const stream = fs.createReadStream(filePath, { encoding: "utf8" });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  let lineNo = 0;
  const isBackendFile = filePath.replace(/\\/g, "/").includes("/backend/src/");

  for await (const line of rl) {
    lineNo++;
    // Skip pure comment lines (they often contain explanatory currency text)
    const trimmed = line.trimStart();
    if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) continue;

    for (const rule of RULES) {
      // Skip backend-only rules when scanning frontend files
      if (rule.backendOnly && !isBackendFile) continue;

      if (!rule.pattern.test(line)) continue;
      // If the rule has a reject filter, apply it
      if (rule.reject && !rule.reject(line, filePath)) continue;

      violations.push({
        file: filePath,
        line: lineNo,
        ruleId: rule.id,
        description: rule.description,
        content: line.trim().substring(0, 120),
      });
    }
  }
}

function walkDir(dir: string, results: string[] = []): string[] {
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (["node_modules", "dist", "build", ".next", "coverage"].includes(entry.name)) continue;
      walkDir(full, results);
    } else {
      results.push(full);
    }
  }
  return results;
}

async function main(): Promise<void> {
  // Walk up from cwd until we find the monorepo root (package.json with "workspaces")
  let repoRoot = process.cwd();
  for (let i = 0; i < 6; i++) {
    const pkg = path.join(repoRoot, "package.json");
    if (fs.existsSync(pkg)) {
      try {
        const content = JSON.parse(fs.readFileSync(pkg, "utf8"));
        if (content.workspaces) break;
      } catch {}
    }
    repoRoot = path.dirname(repoRoot);
  }
  const scanDirs = [
    path.join(repoRoot, "backend", "src"),
    path.join(repoRoot, "frontend", "src"),
  ];

  const violations: Violation[] = [];
  let filesScanned = 0;

  for (const dir of scanDirs) {
    const files = walkDir(dir);
    for (const file of files) {
      await scanFile(file, violations);
      filesScanned++;
    }
  }

  console.log(`\n📋 check:currency — scanned ${filesScanned} files\n`);

  if (violations.length === 0) {
    console.log("✅ No currency hygiene violations found.\n");
    process.exit(0);
  }

  // Group by rule
  const byRule: Record<string, Violation[]> = {};
  for (const v of violations) {
    (byRule[v.ruleId] = byRule[v.ruleId] || []).push(v);
  }

  for (const [ruleId, group] of Object.entries(byRule)) {
    const rule = RULES.find((r) => r.id === ruleId)!;
    console.log(`\n❌ [${ruleId}] ${rule.description}`);
    console.log(`   ${group.length} violation(s):`);
    for (const v of group) {
      const rel = path.relative(repoRoot, v.file).replace(/\\/g, "/");
      console.log(`   ${rel}:${v.line}  →  ${v.content}`);
    }
  }

  console.log(`\n⚠️  Total violations: ${violations.length} across ${Object.keys(byRule).length} rule(s).`);
  console.log(`   Fix all violations above or add the file to the ALLOWLIST in checkCurrency.ts.\n`);
  process.exit(1);
}

main().catch((err) => {
  console.error("check:currency failed:", err);
  process.exit(2);
});
