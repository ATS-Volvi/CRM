# PR: feat/currency-ui

## Summary

Completes the user-facing currency work: removes remaining hardcoded currency symbols from
the frontend, adds admin banners and the `check:currency` CI gate. No migrations.

**Dependency**: must merge after `feat/currency-approval-logic`.

## What Changed and Why

### Hardcoded Symbol Removal (Frontend)

All remaining `₹`, `$`, `SAR`, `Kr` hard-coded strings in amount-display contexts replaced
with `formatCurrency(amount, record.currency)` or `formatCurrency(amount)` (which falls
back to `globalOrgCurrency`).

Key files:

| File | Change |
|---|---|
| `frontend/src/pages/OpportunityDetail.tsx` | Deal amount now uses `formatCurrency(deal.amount, deal.currency)` |
| `frontend/src/pages/QuotationBuilder.tsx` | Quote totals use `formatCurrency` |
| `frontend/src/pages/ManagerPortal.tsx` | Pipeline totals use `formatCurrency` |
| `frontend/src/components/KpiAttainmentTable.tsx` | KPI amounts use `formatCurrency` |
| `frontend/src/pages/SalespersonTracker.tsx` | Rep revenue uses `formatCurrency` |
| `frontend/src/pages/ApprovalQueue.tsx` | Quote value in queue uses `formatCurrency` |

### Admin UI

- **`frontend/src/pages/Settings.tsx`**: Amber warning banner when org currency changes (links
  to Approval Policy and Lead Policy pages for admin to review thresholds)
- **`frontend/src/pages/Settings.tsx`**: Exchange Rates card — `⚠ Needs Review` badge on rows
  where `isPlaceholder = true`

### Currency Hygiene Script

- **`backend/src/scripts/checkCurrency.ts`**: Static source hygiene linter
- **`package.json`**: `"check:currency"` script
- Allowlist entries with justification for each exempted path

### `.env.example` Additions

No new environment variables were introduced by the currency feature. The existing
`DATABASE_URL` and `USE_SQLITE` variables cover all currency-related behaviour.

## Migrations Included

None.

## How to Test

```bash
# Hygiene
npm run check:currency   # must print "✅ No currency hygiene violations found."

# Type check
npx tsc --noEmit -p frontend/tsconfig.json
npx tsc --noEmit -p backend/tsconfig.json
```

Manual:
1. In Settings → change org currency → verify amber warning appears immediately
2. In Exchange Rates table → rows with `isPlaceholder = true` show `⚠ Needs Review`
3. Open any deal — amount shows in the deal's own currency (e.g. SAR 12,500.00)
4. Open Approval Queue — quote values show in the quote's currency

## Screenshots to Take

- Settings → org currency amber warning banner
- Exchange Rates table with ⚠ badge on INR rows
- Approval Queue showing SAR-formatted amount
- OpportunityDetail showing SAR deal amount

## Risks

**Low.** Pure display changes. The worst case is a currency code is shown instead of a
symbol if `Intl.NumberFormat` doesn't recognise the code — the catch block returns
`${curr} ${amount.toFixed(2)}` which is always readable.

## Rollback Steps

Revert the PR on GitHub. No schema or data changes to undo.

## Reviewer Checklist

- [ ] `npm run check:currency` → 0 violations (this is now a CI gate too)
- [ ] `npx tsc --noEmit -p frontend/tsconfig.json` → 0 errors
- [ ] Every money-display context uses `formatCurrency` or `formatCurrencyCompact`, not raw `.toFixed(2)`
- [ ] Settings amber warning appears when a different currency is selected (before Save)
- [ ] Settings amber warning disappears if currency is reset back to the current value
- [ ] Exchange Rates table: INR rows show `⚠ Needs Review` badge
- [ ] No `₹` or `$` symbols outside the check:currency allowlist
