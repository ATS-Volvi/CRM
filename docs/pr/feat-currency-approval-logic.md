# PR: feat/currency-approval-logic

## Summary

Wires the approval engine, assignment engine, notification engine, KPI snapshots, and the
budget-string parser to the multi-currency foundation from `feat/currency-foundation`. No
UI changes — this is entirely backend logic.

**Dependency**: must merge after `feat/currency-foundation`.

## What Changed and Why

### Approval Engine (`backend/src/services/approvalEngine.ts`)

- All policy limits are now resolved to org currency via `resolveLimit` before comparison
- `evaluateQuoteApproval`: detects quote currency, converts to org currency, then evaluates
  against the resolved `repLimit` / `teamLeadLimit`
- `evaluateDealApproval`: same pattern for deal values
- Missing exchange rate → escalates to `ADMIN` with an explicit error message (never silently passes)
- Dual-currency display in reason strings (e.g. "SAR 44,944 (limit set as ₹10,00,000)")
- `dealValueCutoff` on User treated as org-currency (already stored in org currency — no conversion needed)

### Assignment Engine (`backend/src/services/assignmentEngine.ts`)

- `expectedValInOrg` computed via `convertToOrgCurrency` before `dealValueCutoff` comparison
- `highValueThreshold` from `SalesAssignmentPolicy` is `resolveLimit`-resolved before
  `calculateLeadPriorityScore` is called

### Budget Parser (`backend/src/services/repPerformanceService.ts`)

- `calculateLeadPriorityScore` now accepts `orgCurrency` as 3rd param
- Full multiplier support: `Cr` (×10M), `Lakh`/`L` (×100K), `M` (×1M), `k` (×1K)
- Explicit currency token detection (`SAR`, `USD`, `₹`, `$`, etc.)
- Cross-currency safety: if budget token ≠ org currency, `expectedRevenue` is zeroed out
  so the scoring term is skipped (callers must pass a pre-converted `expectedValue`)
- Returns `budgetCurrencyToken` so callers can surface a warning

### Notification Engine (`backend/src/services/notificationEngine.ts`)

- Quote and deal notification amounts now formatted via `formatMoney(amount, currency)`
  with the record's own currency — never hardcodes ₹ or $

### KPI Snapshots

- `snapshotDealWonAmount` called in `approvalController` when a deal is marked Won
- `backfillWonDealsExchangeRates` available as a one-off migration script

### Migrations Included

| Migration | Additive? | Safe with old code? |
|---|---|---|
| `20260924020000-add-policy-thresholds-and-exchange-rates` | Yes — new columns + new table | Yes — old code ignores new columns |
| `20260924030000-add-deal-rate-snapshot-and-placeholder-flags` | Yes — new nullable columns | Yes — old code ignores them |

**Postgres fix in 030**: The `UPDATE ExchangeRates SET needsReview = 1` was SQLite-integer
syntax. Fixed to `SET needsReview = TRUE` on Postgres and `= 1` on SQLite via
`queryInterface.sequelize.getDialect()`.

### Boundary Test Suite Output (19/19 — SQLite, org currency SAR)

```
RIGOROUS CURRENCY & APPROVAL ENGINE BOUNDARY TEST SUITE

[Context] Organization Base Currency: SAR

DYNAMIC RESOLVED LIMITS SUMMARY
  • Rep Self-Approval Limit:    SAR 44,944.00 (limit set as ₹10,00,000.00)
  • Team Lead Approval Limit:   SAR 224,720.00 (limit set as ₹50,00,000.00)
  • Executive Tier Cutoff:      SAR 11,236.00 (limit set as ₹2,50,000.00)
  • Agent Tier Cutoff:          SAR 2,247.20 (limit set as ₹50,000.00)

SUITE 1: Rep Self-Approval Boundary & Equality Tests (Same Currency)
  ✅ PASS: Quote at (limit - 0.01) is within rep authority
  ✅ PASS: Quote exactly at limit (equality <=) is within rep authority
  ✅ PASS: Quote at (limit + 0.01) exceeds rep limit and routes to TEAM_LEAD

SUITE 2: Team Lead Approval Ceiling Boundary Tests
  ✅ PASS: Quote at (TL limit - 0.01) routes to TEAM_LEAD
  ✅ PASS: Quote exactly at TL limit routes to TEAM_LEAD
  ✅ PASS: Quote at (TL limit + 0.01) exceeds TL ceiling and routes to ADMIN

SUITE 3: Representative Tier Cutoffs (Executive vs Agent)
  ✅ PASS: Executive rep quote under executive cutoff is auto-approved
  ✅ PASS: Executive rep quote exactly at executive cutoff is auto-approved
  ✅ PASS: Executive rep quote exceeding executive cutoff requires TEAM_LEAD approval
  ✅ PASS: Agent rep quote under agent cutoff is auto-approved
  ✅ PASS: Agent rep quote exactly at agent cutoff is auto-approved
  ✅ PASS: Agent rep quote exceeding agent cutoff requires TEAM_LEAD approval

SUITE 4: Cross-Currency Quote Conversion & Display Validation
  ✅ PASS: INR Quote below stored 1,000,000 INR limit auto-approves
  ✅ PASS: INR Quote exactly at stored 1,000,000 INR limit auto-approves
  ✅ PASS: INR Quote exceeding stored 1,000,000 INR limit routes to TEAM_LEAD with dual-currency display

SUITE 5: Missing Exchange Rate Escalation
  ✅ PASS: Missing exchange rate escalates quote to ADMIN
  ✅ PASS: Missing exchange rate escalates deal to ADMIN

SUITE 6: Deal Won Snapshot & Backfill
  ✅ PASS: Won deal snapshot converts USD to SAR at 3.75
  ✅ PASS: Backfill runs cleanly without throwing

TEST SUMMARY: 19/19 tests passed.
```

## How to Test

```bash
# Apply all 4 currency migrations
USE_SQLITE=true npx sequelize-cli db:migrate --config database/config/config.js

# Run boundary tests
USE_SQLITE=true npx ts-node --project backend/tsconfig.json \
  backend/src/scripts/testCurrencyEnginePhase6.ts

# Type check
npx tsc --noEmit -p backend/tsconfig.json

# Hygiene
npm run check:currency
```

## Screenshots to Take

- Approval queue showing a SAR-formatted quote amount and dual-currency reason
- WhatsApp/email notification showing SAR amount (not ₹)
- Deal timeline showing `amountInOrgCurrency` after Won

## Risks

**Medium.** The approval comparisons change: any quote that was previously auto-approved
because the engine compared INR amounts against INR limits (both were in INR) will now
be correctly converted to SAR before comparison. This means some quotes that previously
didn't require approval may now require it — this is the correct behaviour, not a regression.

**Mitigation**: run `quoteTotalsDistribution.ts` on the Neon branch copy first (Step 3 of
the rollout) to see how many quotes fall above the proposed limits in SAR.

## Rollback Steps

```bash
# Undo the 2 approval-logic migrations (030 then 020)
DATABASE_URL=$PROD npx sequelize-cli db:migrate:undo --config database/config/config.js
# Repeat
```

Reverting the PR on GitHub then re-deploying will restore the old approval logic.
No data is destroyed — the new columns are nullable and additive.

## Reviewer Checklist

- [ ] Run boundary test suite locally: 19/19 pass
- [ ] Verify migration 030 `down` removes `exchangeRateToOrg`, `amountInOrgCurrency` cleanly on Postgres
- [ ] Verify migration 020 `down` drops `ExchangeRates` table (check no FK constraint blocks it)
- [ ] Verify `evaluateQuoteApproval` with `currency: 'JPY_UNCONFIGURED'` → `approvalLevel: 'ADMIN'`
- [ ] Verify `calculateLeadPriorityScore('5L', threshold, 'SAR')` ignores budget (INR implied, not SAR)
- [ ] No hardcoded `₹` or `$` in approval engine or notification engine
- [ ] `npm run check:currency` → 0 violations
- [ ] `npx tsc --noEmit -p backend/tsconfig.json` → 0 errors
