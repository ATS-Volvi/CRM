# PR: ui/remove-fake-data

## Summary

Removes hardcoded mock data from the frontend that was masking real backend data. This is
purely a UI cleanup — no schema changes, no migrations, no backend changes.

## What Changed and Why

Several frontend pages contain hardcoded arrays / objects that were left over from
development scaffolding. These cause the UI to show fabricated numbers alongside (or
instead of) real data, which would be misleading after the currency feature ships (real
amounts would appear next to fake ones formatted in the wrong currency).

Files changed in this PR:

| File | What was removed |
|---|---|
| `frontend/src/pages/AccountDetail.tsx` | Hardcoded `mockCompanyIntelligence` object and corporate hierarchy card |
| `frontend/src/pages/ManagementDashboard.tsx` | Hardcoded win-probability fallback percentages (`0.72`, `0.58`, …) |
| `frontend/src/pages/QuotationTemplateManager.tsx` | Hardcoded template price/quantity fallback arrays |
| `frontend/src/pages/MyDashboard.tsx` | Hardcoded lead-score demo cards |
| `frontend/src/pages/Leads.tsx` | `companyIntelligence` mock object |

All removed items are replaced with `null`/empty-state placeholders or driven by real API
data. No functional logic changes.

## Migrations Included

None.

## How to Test

1. `npm run dev:frontend` → open the app
2. Navigate to any Account → Company Intelligence card should show "No data available"
   (or be hidden) instead of fake company data
3. Management Dashboard → win-probability bars should reflect real deal data (or 0%)
4. `npm run check:currency` → 0 violations

## Screenshots to Take

- AccountDetail before/after (Company Intelligence card)
- ManagementDashboard win-probability section

## Risks

Low. This is display-only. The only risk is that a page shows empty state where it
previously showed fake data — which is the intended outcome.

## Rollback Steps

Revert this PR on GitHub. No database state to undo.

## Reviewer Checklist

- [ ] Verify no `mock` / `fake` / `placeholder` variables remain in changed files
- [ ] Verify `npm run check:currency` still passes
- [ ] Verify `npx tsc --noEmit -p frontend/tsconfig.json` passes (0 errors)
- [ ] Spot-check AccountDetail and ManagementDashboard in dev
