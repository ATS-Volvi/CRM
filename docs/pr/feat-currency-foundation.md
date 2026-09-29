# PR: feat/currency-foundation

## Summary

Establishes the core multi-currency infrastructure: org-level currency setting, `currency`
column on all money-bearing tables, the `ExchangeRates` table with admin UI, and the
`resolveLimit` / `formatMoney` utilities that all downstream currency logic depends on.

**This PR is additive-safe**: new columns have DB-level defaults, so existing rows and old
code that does not yet write `currency` continue to work without modification.

## What Changed and Why

### Backend

| File | Change |
|---|---|
| `database/migrations/20260924000000-create-org-settings.js` | Creates `OrgSettings` table; seeds `defaultCurrency = 'SAR'` |
| `database/migrations/20260924010000-add-currency-to-records.js` | Adds `currency VARCHAR(3) DEFAULT <orgCurrency>` to Deals, Quotes, Accounts, PurchaseOrders, Invoices; backfills NULLs |
| `database/models/index.ts` | Adds `OrgSetting`, `ExchangeRate` model classes |
| `backend/src/utils/orgSettings.ts` | `getOrgCurrency()` — reads from DB with in-process cache |
| `backend/src/utils/exchangeRate.ts` | `getExchangeRate`, `convertToOrgCurrency`, `resolveLimit`, `snapshotDealWonAmount`, `backfillWonDealsExchangeRates` |
| `backend/src/utils/formatMoney.ts` | `formatMoney(amount, currency)` — server-side formatter, always requires explicit currency |
| `backend/src/controllers/orgSettingsController.ts` | `GET/PUT /api/v1/org-settings` |
| `backend/src/controllers/exchangeRateController.ts` | `GET/POST/PUT/DELETE /api/v1/exchange-rates` |
| `backend/src/routes/v1.ts` | Wire new controllers |

### Frontend

| File | Change |
|---|---|
| `frontend/src/utils/currency.ts` | `formatCurrency(amount, currency?)` — falls back to `globalOrgCurrency` if currency is `null`/`undefined` |
| `frontend/src/context/OrgSettingsContext.tsx` | `useOrgCurrency()` hook — fetches and caches org currency, calls `setGlobalOrgCurrency` |
| `frontend/src/pages/Settings.tsx` | Org Currency selector + amber warning banner when currency changes |

## Migrations Included

| Migration | Additive? | Safe to deploy before code? | Notes |
|---|---|---|---|
| `20260924000000-create-org-settings` | Yes — new table | Yes | No existing code reads it |
| `20260924010000-add-currency-to-records` | Yes — new column with DEFAULT | Yes | Old code ignores the column |

### What happens if `currency` is NULL?

- **`formatCurrency` (frontend)**: `(currency || globalOrgCurrency)` — falls back to `globalOrgCurrency` which is always `'SAR'` at startup. Never crashes.
- **`resolveLimit` (backend)**: `(valueCurrency || orgCurr)` — treats NULL currency as org currency (same-currency path, no conversion needed). Never crashes.
- **`approvalEngine`**: reads `currency` from `adminPolicy` which is seeded in migration 020. If the row is missing, `policyCurrency` defaults to `'INR'`. Engine escalates to ADMIN on a missing exchange rate rather than crashing.

## How to Test

```bash
# 1. Apply migrations to a fresh SQLite DB
USE_SQLITE=true npx sequelize-cli db:migrate --config database/config/config.js

# 2. Verify currency column exists
USE_SQLITE=true npx ts-node backend/src/scripts/inspectPolicyTables.ts

# 3. Type check
npx tsc --noEmit -p frontend/tsconfig.json
npx tsc --noEmit -p backend/tsconfig.json

# 4. Hygiene
npm run check:currency
```

## Screenshots to Take

- Settings page → Org Currency dropdown
- Settings page → amber warning banner when currency changes (before saving)
- Exchange Rates admin table

## Risks

**Low.** All changes are additive. Old code that doesn't read `currency` is unaffected.
The only risk is the exchange rate cache returning stale data — handled by the 1-minute TTL
and the `invalidateExchangeRatesCache()` call after any PUT.

## Rollback Steps

```bash
# Undo the 2 currency foundation migrations
USE_SQLITE=false DATABASE_URL=$PROD npx sequelize-cli db:migrate:undo --config database/config/config.js
# Repeat once more
```

Both `down` paths drop the column/table cleanly. The `down` for migration 010 uses
`removeColumn` guarded by `describeTable`, so it is idempotent.

## Reviewer Checklist

- [ ] `20260924010000` `down` removes `currency` from all 5 tables cleanly (test on SQLite)
- [ ] `formatCurrency(null, null)` returns `'SAR 0.00'` (falls back to globalOrgCurrency)
- [ ] `resolveLimit(0, null, 'SAR')` returns `{ orgAmount: 0, missingRate: false }` (zero path)
- [ ] `resolveLimit(100, null, 'SAR')` returns `{ orgAmount: 100, missingRate: false }` (same-currency path)
- [ ] No hardcoded `₹` or `$` symbols outside the allowlist after this PR
- [ ] `npm run check:currency` → 0 violations
- [ ] Both tsc checks → 0 errors
