# Shared Company Inbox Routing & Least-Workload Fallback Report

## 1. Detection Hierarchy Implemented

The inbound email webhook (`receiveInboundEmail` in `backend/src/controllers/emailController.ts`) evaluates incoming emails against the following detection rules in strict priority order, stopping at the first match:

1. **Check 0: Direct `to`-Address Match** (`assignmentMethod = "direct-address"`)
   - Checks if the parsed recipient email directly matches an active user's `email` address (roles: `sales_rep`, `sales_manager`, `admin`, `director`).
2. **Check 1: Plus-Addressing Tag Match** (`assignmentMethod = "plus-tag"`)
   - Extracts `+tag` from recipient email (e.g. `face+aliastag@123.com` -> `aliastag`).
   - Matches against `User.emailAlias` or `User.name` (lowercase first name / full name without spaces).
3. **Check 2: Explicit "Attn:" / "For:" Convention** (`assignmentMethod = "attn-tag"`)
   - Scans the subject and first line of the body for explicit `Attn: <Name>` or `For <Name>` prefixes.
   - Matches against active salespersons' first name, full name, or email alias.
4. **Check 3: Whole-Word Case-Insensitive Name Mention** (`assignmentMethod = "name-match"`)
   - Scans the subject and full body text for active salespersons' first names or full names as whole-word matches (`\bName\b`).
   - **Ambiguity Guard**: If **more than 1** active salesperson's name is mentioned, the match is treated as ambiguous and falls through to Check 4.
   - **Single Match Audit**: If **exactly 1** active salesperson matches, assigns to them and logs an `Activity` audit flag (`"Assignment Flag"`).
5. **Check 4: Genuine Least-Workload Fallback** (`assignmentMethod = "least-workload"`)
   - Evaluates all active salespersons with `isAvailable !== false` (unavailable users with `isAvailable: false` are excluded even if they have 0 open leads).
   - Counts open/active leads (`status NOT IN ('Won', 'Lost', 'Closed', 'Closed Won', 'Closed Lost')`).
   - Assigns to the representative with the lowest open lead count.
   - **Tie-Breaker**: Sorts by `openCount` ASC, then breaks ties deterministically by `user.id` ASC (`a.user.id.localeCompare(b.user.id)`).
6. **Check 5: Emergency Legacy Assignment Engine Fallback** (`assignmentMethod = "legacy-rules"`)
   - Placed as a final safety fallback if Check 4 yields no available candidates.

---

## 2. Model & Database Migration

- **Migration File**: `database/migrations/20260721000000-add-email-alias-and-assignment-method.js`
- **Schema Changes**:
  - `Users` table: added `emailAlias` (STRING, nullable).
  - `Leads` table: added `assignmentMethod` (STRING, nullable).

---

## 3. E2E Test Suite Execution Output

```text
PASS tests/e2e/email.e2e.test.ts
  E2E: Email Delivery Automation
    ✓ should trigger an automated email when a new public lead is captured
    ✓ should return 401 when calling inbound email without a valid secret
    ✓ should assign lead directly to salesperson if email is addressed to their email address
    ✓ should fallback to default routing if recipient email does not match a known salesperson
    ✓ should route by plus-addressing tag (e.g. face+alias@123.com)
    ✓ should route by explicit Attn: or For: convention
    ✓ should route by single confident name mention and record an activity log
    ✓ should fall through to least-workload when multiple names are mentioned (ambiguous match)
    ✓ should exclude unavailable users (isAvailable: false) from least-workload even if they have 0 leads

Test Suites: 3 passed, 3 total
Tests:       13 passed, 13 total
Snapshots:   0 total
Time:        13.717 s
Ran all test suites.
```
