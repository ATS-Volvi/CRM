# Site Inspection Phase 2 Rollout Runbook (Owner-Only)

This runbook documents the exact sequence of owner-only operations required to safely roll out Site Inspection Phase 2 (Stage A: Smart Assignment & Governance; Stage B: Timelines, SLA Automation & Alerts) to production.

---

## 1. Safety Principles & Zero-Downtime Architecture

1. **Migrate Before Deploying Code**: The database schema additions are fully additive (new nullable columns on `SiteInspections`, new standalone operational tables). The pre-Phase-2 backend code running in production is proven 100% compatible with the migrated database schema.
2. **Features Disabled by Default**: All new Phase 2 features (automation scanner, assignment modes, WhatsApp alerts, auto-qualify) are strictly guarded behind environment variables. When these variables are unset, the system runs in backward-compatible legacy mode without executing new background actions or alerts.
3. **No Secrets in History**: All commands use interactive masked prompts (`read -s`) to prevent connection strings or credentials from being logged in shell history.

---

## 2. Step 1: Create Neon Backup Branch (Point-in-Time Recovery)

Before executing database migrations, create a backup snapshot branch in the Neon Console:

1. Log in to the [Neon Console](https://console.neon.tech).
2. Select the Nexus CRM production project.
3. Navigate to **Branches** > **Create Branch**.
4. Set branch name: `backup-pre-phase2-YYYYMMDD`.
5. Select **Current state of main branch** (or specific point-in-time timestamp).
6. Verify the backup branch status is **Ready**.

---

## 3. Step 2: Verify Target Database Host

Ensure you are targeting the production direct database and not an unexpected host:

```bash
read -s "PROD_DIRECT_DB?Paste production direct DATABASE_URL (no pooler): "
echo

# Strip pooler suffix if accidentally included
PROD_DIRECT_DB=${PROD_DIRECT_DB/-pooler/}
PROD_DIRECT_DB=${PROD_DIRECT_DB/&channel_binding=require/}

# Verify target host using pg_stat_database / inet_server_addr
export PGOPTIONS='-c default_transaction_read_only=on'
psql "$PROD_DIRECT_DB" -c "SELECT inet_server_addr(), current_database(), current_user, version();"
unset PGOPTIONS
```

Verify that the output displays the expected database name and cloud host.

---

## 4. Step 3: Run Database Migrations (Pre-Deployment)

Execute the two Phase 2 migrations against the direct (non-pooler) connection:

```bash
# Verify pending migrations
DATABASE_URL="$PROD_DIRECT_DB" ./node_modules/.bin/sequelize-cli db:migrate:status

# Execute migrations
DATABASE_URL="$PROD_DIRECT_DB" ./node_modules/.bin/sequelize-cli db:migrate

# Verify SequelizeMeta has both Phase 2 migration records
psql "$PROD_DIRECT_DB" -c "
SELECT name FROM \"SequelizeMeta\" 
WHERE name LIKE '%20261030%' 
ORDER BY name;
"
```

Expected output:
- `20261030100000-site-inspection-phase2-assignment.js`
- `20261030110000-site-inspection-stage-b-timelines-alerts.js`

---

## 5. Step 4: Render Manual Deploy

Once migrations are successfully applied, deploy the code to Render:

1. Merge pull request into `master` on GitHub.
2. In the [Render Dashboard](https://dashboard.render.com), navigate to the backend web service (`crm-backend`).
3. Click **Manual Deploy** > **Deploy latest commit**.
4. Monitor deploy logs for:
   - `DB connection established`
   - `Database connection established successfully.`
   - `[SiteInspectionScanner] Scheduler started (interval: 60s, AST timezone).`
   - Zero crash or startup error reports.

---

## 6. Step 5: Post-Deploy Health Checks

Verify service health immediately after deployment:

```bash
# 1. Core API health
curl -s https://<render-backend-url>/api/health
# Expected: {"status":"ok","service":"nexus-crm-backend"}

# 2. Automation health
curl -s https://<render-backend-url>/api/health/automation
# Expected: {"status":"healthy","automationEnabled":false,...}
```

---

## 7. Step 6: Production Smoke Test

Run the full-cycle test suite in production mode using a safe temporary directory:

```bash
mkdir -p /tmp/si-prod-test
cd /path/to/full-cycle-live-test/scripts

HOME=/tmp/si-prod-test node live-test-users.mjs https://<render-backend-url> --i-know-this-is-production
HOME=/tmp/si-prod-test node live-test-flow.mjs https://<render-backend-url> --i-know-this-is-production
HOME=/tmp/si-prod-test node live-test-cleanup.mjs https://<render-backend-url> --i-know-this-is-production

rm -rf /tmp/si-prod-test
```

---

## 8. Step 7: Environment Variable Configuration

### Safe Initial State (Deploy Day)
Keep the following variables unset in Render Dashboard:
- `SITE_INSPECTION_ASSIGNMENT_MODE`: *Unset* (runs legacy round-robin assignment).
- `SITE_INSPECTION_AUTOMATION`: *Unset* (scanner remains idle; zero automated messages).
- `SITE_INSPECTION_AUTO_QUALIFY`: *Unset* (manual qualification required).
- `SITE_INSPECTION_WHATSAPP`: *Unset* (WhatsApp alerts remain off).
- `SITE_INSPECTION_GATE`: *Unset* (defaults to ON; inspections required for lead qualification).

### Enabling Features Incrementally (One at a Time)

#### Phase 2.1: Enable Nearest Assignment
1. Add environment variable in Render Dashboard:
   - `SITE_INSPECTION_ASSIGNMENT_MODE=nearest`
2. Save changes (triggers zero-downtime rolling restart).
3. Verify new inspection requests assign to the closest inspector profile.

#### Phase 2.2: Switch to Balanced Assignment
1. Update environment variable in Render Dashboard:
   - `SITE_INSPECTION_ASSIGNMENT_MODE=balanced`
2. Save changes.
3. Verify assignments balance distance (50%) and inspector workload (50%).

#### Phase 2.3: Enable Automation Scanner & Alerts
1. Add environment variable in Render Dashboard:
   - `SITE_INSPECTION_AUTOMATION=true`
2. Save changes.
3. Check `GET /api/health/automation`: verify `"automationEnabled": true`.
4. Monitor logs for SLA 50% / 80% reminder alerts and escalation passes.

---

## 9. Rollback Procedures

If an issue occurs during rollout, execute rollback in this precise order:

### Level 1: Instant Feature Disable via Environment Variables (< 1 min)
In Render Dashboard:
- Set `SITE_INSPECTION_AUTOMATION=false` (stops all automated scans and alerts).
- Set `SITE_INSPECTION_ASSIGNMENT_MODE=legacy` (restores legacy assignment logic).
- (Optional) If urgent sales bypass required: set `SITE_INSPECTION_GATE=off`.
- Save changes to apply immediately.

### Level 2: Application Code Rollback (< 3 min)
In Render Dashboard:
1. Navigate to **Deploys**.
2. Locate the previous stable deploy commit.
3. Click **Rollback** to re-deploy previous build.

### Level 3: Database Migration Reversal (Only if Schema Reversion Needed)
Since Phase 2 columns and tables are nullable and backward-compatible, migration reversal is rarely needed. If strictly required:

```bash
read -s "PROD_DIRECT_DB?Paste production direct DATABASE_URL: "
echo

# Undo Stage B operational tables & columns
DATABASE_URL="$PROD_DIRECT_DB" ./node_modules/.bin/sequelize-cli db:migrate:undo

# Undo Stage A assignment tables & columns
DATABASE_URL="$PROD_DIRECT_DB" ./node_modules/.bin/sequelize-cli db:migrate:undo

unset PROD_DIRECT_DB
```
