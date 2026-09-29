# docs/CURRENCY_ROLLOUT.md
# Currency Feature — Production Rollout Runbook

> **Rule**: Never touch the production database directly during the rollout window.  
> All inspection and migration steps target a **Neon branch copy**, not the live branch.

---

## Release Order

```
PR a → PR b → PR c → PR d
```
Each PR merges into `dev`. The merge of `dev` → `master` triggers the Render deploy.

---

## Pre-Rollout Checklist

- [ ] CI passes on all four PRs (tsc, check:currency, SQLite tests, Postgres 16 tests)
- [ ] Reviewer has read each `docs/pr/<name>.md` and signed off on the checklist
- [ ] Neon branch copy created (see Step 1 below)
- [ ] Inspection script run and output reviewed (see Step 3)
- [ ] SAR limits decided (see Step 4)

---

## Step 1 — Create Neon Branch Copy

In the Neon Console:

1. Open the project → **Branches** → **Create Branch**
2. Name it `pre-currency-rollout-YYYYMMDD`
3. Source: `main` (production branch), point-in-time: **now**
4. Copy the branch connection string — do **not** use the production connection string for any of the following steps

```bash
# Set the branch URL (never set DATABASE_URL to production)
export NEON_BRANCH_URL="postgresql://neondb_owner:<branch-token>@<branch-host>/neondb?sslmode=require"
```

---

## Step 2 — Run Migrations on the Branch Copy

```bash
DATABASE_URL="$NEON_BRANCH_URL" USE_SQLITE=false \
  npx sequelize-cli db:migrate --config database/config/config.js
```

Expected output — each migration should print `== migrating` → `== migrated OK`:
- `20260924000000-create-org-settings`
- `20260924010000-add-currency-to-records`
- `20260924020000-add-policy-thresholds-and-exchange-rates`
- `20260924030000-add-deal-rate-snapshot-and-placeholder-flags`

If any migration fails, **stop**. Fix and re-run. Do not proceed to production.

---

## Step 3 — Inspection Script + Quote Totals Distribution

```bash
DATABASE_URL="$NEON_BRANCH_URL" USE_SQLITE=false \
  npx ts-node --project backend/tsconfig.json \
  backend/src/scripts/quoteTotalsDistribution.ts
```

Review the output for:
- Any quotes with `currency = NULL` (should be 0 after migration 010)
- Any quotes in currencies with no exchange rate (listed under "Unconvertible")
- P50/P75/P95/P99 distribution — use these to inform SAR approval limits in Step 4

```bash
# Also run the policy inspection query on the branch:
DATABASE_URL="$NEON_BRANCH_URL" USE_SQLITE=false \
  npx ts-node --project backend/tsconfig.json \
  backend/src/scripts/inspectPolicyTables.ts
```

> The inspection script must be run read-only — it only reads, never writes.

---

## Step 4 — Decide SAR Limits

Based on the P95 figure from Step 3, propose limits in SAR:

| Setting | Recommended Starting Value | Notes |
|---|---|---|
| `repSelfApprovalDefault` | `≤ P75 quote value` | Rep autonomy limit |
| `teamLeadApprovalDefault` | `≤ P95 quote value` | TL ceiling before admin |
| `maximumSalesRepApproval` | `P95 × 1.2` | Global cap for any rep |
| `highValueThreshold` (assignment policy) | `≥ P90 quote value` | High-value lead flag |

Record the chosen values in a note or PR comment before proceeding.

---

## Step 5 — Production Snapshot

> **Do this immediately before the production migration, not hours before.**

In the Neon Console, create a snapshot/restore point of the production branch:
1. **Branches** → production branch → **Create Restore Point**
2. Name it `pre-currency-migration-YYYYMMDD-HHmm`
3. Note the restore point ID

---

## Step 6 — Run Migrations on Production

```bash
# Use the PRODUCTION connection string (from Render environment or Neon production branch)
DATABASE_URL="$PRODUCTION_URL" USE_SQLITE=false \
  npx sequelize-cli db:migrate --config database/config/config.js
```

> Run from your local machine or a one-off Render job — **never from the dev environment**.

Verify each migration applied:
```sql
SELECT name FROM "SequelizeMeta" ORDER BY name;
```

---

## Step 7 — Backfill on Production

After migrations complete, run the backfill for won deals (records created before migration 030):

```bash
DATABASE_URL="$PRODUCTION_URL" USE_SQLITE=false \
  npx ts-node --project backend/tsconfig.json \
  -e "require('./backend/src/utils/exchangeRate').backfillWonDealsExchangeRates().then(n => { console.log('Backfilled:', n); process.exit(0); })"
```

Expected: prints `Backfilled: <N>` with N ≥ 0. Any error means a rate is missing — add it in the admin UI first.

---

## Step 8 — Merge dev → master (Render Deploys)

```bash
# On GitHub: open a PR from dev → master, require CI to pass, then merge
# Render auto-deploys from master
```

Do **not** push directly to master. Use a PR so CI runs one final time.

---

## Step 9 — Post-Deploy Admin UI Configuration

Log in as admin, navigate to **Settings**:

1. **Organization Settings** → set Default Currency to `SAR` → Save
2. **Approval Policy** → set the SAR limits decided in Step 4 → Save
3. **Lead Assignment Policy** → set `highValueThreshold` in SAR → Save
4. **Exchange Rates** → verify all INR rates show `⚠ Needs Review` flag → update with live rates → Save

---

## Step 10 — Post-Deploy Boundary Checks

Run the boundary test suite against production (read-only test, no writes):

```bash
DATABASE_URL="$PRODUCTION_URL" USE_SQLITE=false \
  npx ts-node --project backend/tsconfig.json \
  backend/src/scripts/testCurrencyEnginePhase6.ts
```

Expected: **19/19 tests passed**.

---

## Step 11 — Smoke Test (Novigo Account)

1. Log in as a sales rep
2. Open the **Novigo** account → create a new Quote
3. Set line items so the total is slightly above the rep's self-approval limit
4. Submit the quote → verify an approval request appears in the Approval Queue
5. Check the approval email/WhatsApp message — confirm currency displays as `SAR XX,XXX.XX` (not ₹ or $)
6. Open the deal Timeline — confirm the approval note shows the SAR amount

---

## Rollback Plan

### If migration fails during Step 6:

```bash
# Undo only the currency migrations (4 steps back)
DATABASE_URL="$PRODUCTION_URL" USE_SQLITE=false \
  npx sequelize-cli db:migrate:undo --config database/config/config.js
# Repeat 4 times total (030 → 020 → 010 → 000)
```

Verify by checking `SequelizeMeta` — the 4 currency migration names should be gone.

### If the app is broken after deploy:

1. In Render: **Manual Deploy** → select the previous deploy hash (the one before the currency PRs merged) → Deploy
2. In Neon Console: restore the production branch to the snapshot created in Step 5

### If only the exchange rate logic is wrong (no schema issue):

Revert PR d or PR c on GitHub → create a hotfix branch → Render auto-deploys the revert.

---

## Audit Checklist

After rollout, verify in production:

- [ ] `SELECT COUNT(*) FROM "Deals" WHERE currency IS NULL` → 0
- [ ] `SELECT COUNT(*) FROM "Quotes" WHERE currency IS NULL` → 0
- [ ] `SELECT COUNT(*) FROM "ExchangeRates"` → ≥ 24 rows
- [ ] `SELECT COUNT(*) FROM "OrgSettings"` → 1 row with `defaultCurrency = 'SAR'`
- [ ] Boundary test suite: 19/19 passed
- [ ] Smoke test: Novigo quote approval shows SAR amounts
- [ ] `npm run check:currency` on master HEAD → 0 violations
