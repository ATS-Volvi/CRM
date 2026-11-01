# Site Inspection Phase 2 Rollout Runbook (Owner-Only)

This runbook documents the exact sequence of owner-only operations required to safely roll out Site Inspection Phase 2 (Stage A: Smart Assignment & Governance; Stage B: Timelines, SLA Automation & Alerts) to production.

---

## 1. Safety Principles & Zero-Downtime Architecture

1. **Migrate Before Deploying Code**: Database schema additions are strictly additive (new nullable columns on `SiteInspections`, new operational tables). Pre-Phase-2 code is 100% compatible with the migrated schema.
2. **Startup Schema Check**: The backend service runs its Phase 2 schema detection once at application startup. The service must restart after migrating or deploy code after migrating so the schema detection evaluates the updated database tables.
3. **Deploy Day Leaves Gate OFF**: On deploy day, leave `SITE_INSPECTION_GATE=off` intact in the Render Dashboard. Removing or unsetting `SITE_INSPECTION_GATE` turns the commercial pipeline gate ON immediately.
4. **Features Disabled by Default**: All new Phase 2 features (automation scanner, assignment modes, WhatsApp alerts, auto-qualify) are strictly guarded behind environment variables and remain inactive until explicitly enabled.
5. **Zero Secrets in History**: All commands use interactive masked prompts (`read -s`) to prevent connection strings or credentials from being logged in shell history.

---

## 2. Pre-Deploy Checklist

Before running any migration or deployment commands, verify the following:

- [ ] `INTENT_FILTER_MODE` is set to `shadow` or `off` in Render Dashboard.
- [ ] `INTENT_AUTOREPLY_ENABLED` is set to `false`.
- [ ] Neon backup branch snapshot is created and in **Ready** status.
- [ ] Production database password has been rotated if previously exposed.
- [ ] All previous test users (`zz-*`, mock reps) are deactivated (`status = 'Inactive'`).
- [ ] `db:migrate:status` baseline has been captured and saved.

---

## 3. Step 1: Create Neon Backup Branch (Point-in-Time Recovery)

Before executing database migrations, create a backup snapshot branch in the Neon Console:

1. Log in to the [Neon Console](https://console.neon.tech).
2. Select the Nexus CRM production project.
3. Navigate to **Branches** > **Create Branch**.
4. Set branch name: `backup-pre-phase2-YYYYMMDD`.
5. Select **Current state of main branch** (or specific point-in-time timestamp).
6. Verify the backup branch status is **Ready**.

---

## 4. Step 2: Verify Target Database Host

Verify the database host from `PROD_DIRECT_DB` without logging passwords or connection strings:

```bash
read -s "PROD_DIRECT_DB?Paste production direct DATABASE_URL (no pooler): "
echo

# Strip pooler suffix if accidentally included
PROD_DIRECT_DB=${PROD_DIRECT_DB/-pooler/}
PROD_DIRECT_DB=${PROD_DIRECT_DB/&channel_binding=require/}

# Extract target host safely via sed without printing credentials
TARGET_HOST=$(echo "$PROD_DIRECT_DB" | sed -E 's|^.*@([^:/]+).*$|\1|')
echo "Target DB Host: $TARGET_HOST"

# Verify target host matches expected Render / Neon database host
read "EXPECTED_HOST?Enter expected database host from Render Dashboard: "
if [ "$TARGET_HOST" != "$EXPECTED_HOST" ]; then
  echo "ABORT: Target host ($TARGET_HOST) does not match expected host ($EXPECTED_HOST)."
  exit 1
fi
echo "Host verification passed."
```

---

## 5. Step 3: Run Database Migrations (Pre-Deployment)

Execute the two Phase 2 migrations against the direct (non-pooler) connection:

```bash
# Save pre-migration status baseline
DATABASE_URL="$PROD_DIRECT_DB" ./node_modules/.bin/sequelize-cli db:migrate:status > /tmp/migrate-status-pre.txt

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

## 6. Step 4: Render Deploy & Service Restart

Deploy code to Render service `CRM`:

1. Merge pull request into `master` on GitHub.
2. In the [Render Dashboard](https://dashboard.render.com), navigate to web service `CRM`.
3. Click **Manual Deploy** > **Deploy latest commit** (or restart service if auto-deploy triggered).
4. Note: The service must restart after migrating so the Phase 2 schema detection hook runs and enables Phase 2 models.
5. Monitor deploy logs for:
   - `DB connection established`
   - `Database connection established successfully.`
   - `[SiteInspectionScanner] Scheduler started (interval: 60s, AST timezone).`
   - Zero crash or startup error reports.

---

## 7. Step 5: Post-Deploy Health Checks

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

## 8. Step 6: Smoke Testing (Rehearsal on Neon Branch Copy)

Do NOT run automated end-to-end smoke test scripts directly against production; test runs create irreversible audit records, task logs, and alert residue. Instead, rehearse the full smoke test against a temporary Neon branch copy:

1. In the Neon Console, create a temporary testing branch: `test-smoke-YYYYMMDD` branched from `main`.
2. Connect a local test server or CI runner to the temporary branch URL.
3. Run test flows against the temporary branch copy:
   ```bash
   DATABASE_URL="<neon-branch-copy-url>" node live-test-flow.mjs
   ```
4. Verify all tests pass cleanly.
5. Delete the temporary branch in the Neon Console when rehearsal is complete.

---

## 9. Step 7: Environment Variable Configuration & Feature Activation

### Safe Initial State (Deploy Day)
Keep the following variables in the Render Dashboard for service `CRM`:
- `SITE_INSPECTION_GATE`: `off` (INTACT on deploy day; leaves commercial pipeline unrestricted).
- `SITE_INSPECTION_ASSIGNMENT_MODE`: *Unset* (runs legacy round-robin assignment).
- `SITE_INSPECTION_AUTOMATION`: *Unset* (scanner remains idle; zero automated messages).
- `SITE_INSPECTION_AUTO_QUALIFY`: *Unset* (manual qualification required).
- `SITE_INSPECTION_WHATSAPP`: *Unset* (WhatsApp alerts remain off).

### Enabling Features Incrementally

#### Phase 2.1: Enable Nearest Assignment
1. Add environment variable in Render Dashboard for `CRM`:
   - `SITE_INSPECTION_ASSIGNMENT_MODE=nearest`
2. Save changes (triggers zero-downtime rolling restart).
3. Verify new inspection requests assign to the closest inspector profile.

#### Phase 2.2: Switch to Balanced Assignment
1. Update environment variable in Render Dashboard for `CRM`:
   - `SITE_INSPECTION_ASSIGNMENT_MODE=balanced`
2. Save changes.
3. Verify assignments balance distance (50%) and inspector workload (50%).

#### Phase 2.3: Enable Automation Scanner & Alerts
1. Add environment variable in Render Dashboard for `CRM`:
   - `SITE_INSPECTION_AUTOMATION=true`
2. Save changes.
3. Check `GET /api/health/automation`: verify `"automationEnabled": true`.
4. Monitor logs for SLA 50% / 80% reminder alerts and escalation passes.

---

## 10. Step 8: Final Gate-Enabling Checklist

Only after Phase 2 features have been validated in production, enable the commercial pipeline gate by removing `SITE_INSPECTION_GATE=off`:

- [ ] **3 QUALIFIED leads verified**: At least 3 active leads have completed the full inspection flow (REQUESTED -> DRAFT -> SUBMITTED -> APPROVED).
- [ ] **Active Site Managers & Ops Managers confirmed**: Verified active Site Manager profiles and designated Ops Manager reviewers are logged in and available in the regional territory.
- [ ] **Team Communications Sent**: Sales Directors, Sales Representatives, and Field Operations teams have been formally notified of mandatory site inspection approval prior to deal qualification.
- [ ] **Remove `SITE_INSPECTION_GATE` variable**: In Render Dashboard for `CRM`, delete the `SITE_INSPECTION_GATE` environment variable and save changes.
- [ ] Verify that unapproved leads are now gated upon qualification/conversion attempts.

---

## 11. Rollback Procedures

If an issue occurs during rollout, execute rollback in this precise order:

### Level 1: Instant Feature Disable via Environment Variables (< 1 min)
In Render Dashboard for service `CRM`:
- Set `SITE_INSPECTION_GATE=off` (immediately disables pipeline gate).
- Set `SITE_INSPECTION_AUTOMATION=false` (stops all automated scans and alerts).
- Set `SITE_INSPECTION_ASSIGNMENT_MODE=legacy` (restores legacy assignment logic).
- Save changes to apply immediately.

### Level 2: Application Code Rollback (< 3 min)
In Render Dashboard for service `CRM`:
1. Navigate to **Deploys**.
2. Locate the previous stable deploy commit.
3. Click **Rollback** to re-deploy previous build.

### Level 3: Database Migration Reversal (CAUTION: Data Loss Warning)
> [!CAUTION]
> Running `db:migrate:undo` drops Phase 2 operational tables (`SiteInspectionAuditLogs`, `SiteInspectionAlerts`, `SiteInspectionAutomationRuns`, `SiteInspectorProfiles`, `SiteInspectionSettings`, `SiteHolidays`) and removes Phase 2 columns from `SiteInspections`. Any audit history, custom SLA configurations, and alert records accumulated since rollout will be permanently deleted. Only execute if schema rollback is strictly unavoidable.

```bash
read -s "PROD_DIRECT_DB?Paste production direct DATABASE_URL: "
echo

# Undo Stage B operational tables & columns
DATABASE_URL="$PROD_DIRECT_DB" ./node_modules/.bin/sequelize-cli db:migrate:undo

# Undo Stage A assignment tables & columns
DATABASE_URL="$PROD_DIRECT_DB" ./node_modules/.bin/sequelize-cli db:migrate:undo

unset PROD_DIRECT_DB
```
