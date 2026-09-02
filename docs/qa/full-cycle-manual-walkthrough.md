# Manual QA Walkthrough: Full Commercial Lead-to-Quote Cycle

This runbook guides QA engineers, administrators, and product testers through verifying the complete commercial sales lifecycle in the Nexus CRM Web UI — from inbound lead intake through lead qualification, opportunity auto-assignment, quotation with discounts and tax, customer portal interactions, and deal closing.

---

## Verified Frontend UI Elements & Locations

| Action / Step | UI Component | Verified Button / Action Label | Location in Web UI |
| :--- | :--- | :--- | :--- |
| **Qualify Lead** | `QualificationDrawer.tsx` | `Qualify Lead & Create Opportunity` | Lead Detail Page -> Top Action Bar |
| **Auto-Assign Rep** | `OpportunityDetail.tsx` | `Auto-Assign` (sparkle icon) | Opportunity Detail Page -> Header Action Bar |
| **Send Quote** | `QuoteDetail.tsx` / `OpportunityDetail.tsx` | `Send to Client` / `Send Quote` | Quotation Detail View & Opportunity Quotes Tab |
| **Submit Approval** | `QuotationBuilder.tsx` | `Submit for Approval` | Quotation Builder Action Footer |
| **Customer Portal** | `PublicQuotePortal.tsx` | `Accept & Sign` / `Request Changes` | Public Customer Link (`/public/quote/:token`) |

---

## 12-Step Manual QA Procedure

### Step 1 — Inbound Lead Intake
1. Navigate to **Leads** (`/leads`) or simulate an inbound form/WhatsApp submission.
2. Verify that a new lead entry is created with customer name, company, email, phone, and source.
3. Confirm the lead is assigned to a front-line qualifying SDR / Sales Representative (e.g., `Salesman 1`).

### Step 2 — Log Mandatory Discovery Activity (Prerequisite Check)
1. Open the Lead Detail drawer or page.
2. **Prerequisite Test**: Click **Qualify Lead** *before* logging any activity. Verify the system blocks qualification with error: `"At least one logged activity or call/meeting note is required to qualify a lead."`
3. Click **Log Activity**, choose `Call`, enter meeting notes (e.g. *"Discovery call completed, budget validated"*), and save.

### Step 3 — Qualify Lead & Create Opportunity
1. Click **Qualify Lead & Create Opportunity** in the `QualificationDrawer`.
2. Enter estimated deal value, deal name, account name, and estimated close timeline.
3. Submit the form.
4. Verify the lead status updates to **Qualified**, and an Opportunity is created owned initially by `Salesman 1` (`ownerId` and `originalOwnerId` equal Salesman 1).

### Step 4 — Auto-Assign Opportunity to a Closer
1. Navigate to **Opportunities** (`/opportunities`) and open the newly created Opportunity.
2. Click the **Auto-Assign** button (sparkle icon) in the header action bar.
3. **Verify Behavior**:
   - The assignment engine evaluates available closers (including reps with role `salesperson`).
   - The qualifying rep (`Salesman 1`) is excluded from the candidate pool.
   - The deal is reassigned to an available closing representative (e.g., `Salesman 2`).

### Step 5 — Closer Review on Dashboard
1. Log in as the newly assigned closing representative (`Salesman 2`).
2. Navigate to **Opportunities** (`/opportunities`).
3. Verify the Opportunity appears in their active pipeline and detail view.

### Step 6 — Quotation Creation with Line Item Discount & Tax
1. On the Opportunity detail page, navigate to the **Quotes** tab and click **Create Quote**.
2. Add line items with specific discounts and tax rates:
   - **Line Item 1**: Quantity `10`, Unit Price `$65,000`, Discount `0%`, Tax `15%`.
   - **Line Item 2**: Quantity `1`, Unit Price `$100,000`, Discount `5%`, Tax `15%`.
3. Save the quotation draft.
4. Verify the calculated total amount is exactly `$856,750` (Subtotal `$750,000` - Discount `$5,000` + Tax `$111,750`).

### Step 7 — Deliver Quote to Customer
1. Click **Send to Client** / **Send Quote**.
2. Select delivery channel `Email` and confirm send.
3. Copy the generated public customer portal URL (`/public/quote/:token`).

### Step 8 — 3-Way Total Consistency Assertion (Bug 2 Regression Check)
Verify that the total amount is **100% consistent across all 3 system views**:
1. **Raw Database**: Inspect `Quotes` table row total (`totalAmount = 856750`).
2. **Authenticated Rep View**: Open `GET /api/v1/quotes/:id` in browser/API inspector (`totalAmount = 856750`).
3. **Unauthenticated Customer Link**: Open the public portal URL (`/public/quote/:token`) (`totalAmount = 856750`).
> **CRITICAL**: If the public customer view displays `$750,000` (dropping tax/discount) while the DB shows `$856,750`, **Bug 2 has regressed**!

### Step 9 — Customer Requests Changes
1. Open the public quote portal as the customer.
2. Click **Request Changes**.
3. Enter change request notes (e.g. *"Please apply a 10% discount to Item 2"*) and submit.
4. Verify quote status transitions to **Revision Requested**.

### Step 10 — Rep Issues Revision & Re-sends
1. Log in as the closing rep (`Salesman 2`).
2. Click **Create Revision**.
3. Update Line Item 2 discount to `10%`.
4. Save and click **Send Quote**.
5. Re-verify 3-way total consistency on the revision (`$851,000`).

### Step 11 — Customer Accepts Quote
1. Open the revised public quote link as the customer.
2. Click **Accept & Sign**.
3. Enter signer name and submit.
4. Verify quote status updates to **Accepted**.

### Step 12 — Close Opportunity as Won
1. Open the Opportunity in the rep interface.
2. Click **Mark as Won** and select the accepted quotation.
3. Verify the Opportunity stage updates to **WON** and `actualClosedAt` timestamp is set.

---

## Critical QA Gotchas & Known Edge Cases

> [!WARNING]
> **1. Activity Logging is a Hard Prerequisite for Qualification**
> Qualification will return an HTTP `400` error if attempted on a lead with 0 logged activities. Always log a call/note activity first.

> [!NOTE]
> **2. Auto-Assign Winner Scoring is Multi-Factor (Non-Deterministic)**
> Auto-assignment winner selection is based on rep capacity (`maxOpenDeals`), availability, and Bayesian performance scores. It will not always pick the same rep, but it MUST exclude the qualifying rep and MUST accept reps with role `salesperson`.

> [!CAUTION]
> **3. Total Amount Mismatch (Bug 2 Regression Alert)**
> If line item discount or tax disappears on customer public links (`GET /public/quotes/by-token/:token`), check `QuoteLineItems` table columns. Ensure `discount` and `tax` columns exist in SQLite schema.
