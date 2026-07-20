# Email Routing Verification & Custom Salesperson Matching Findings

## Step 1 — Verification of Live Deployed State
1. **Deployed Backend URL**:
   - Confirmed deployed backend URL via `vercel.json` and API response: `https://crm-k8g4.onrender.com`
2. **Assignment Rules Mapping (Live Deployed)**:
   - Querying the active rules from GET `https://crm-k8g4.onrender.com/api/v1/assignment-rules` returned:
     ```json
     [
       {
         "id": "8130502e-37f1-4c6d-80a2-20811f405d04",
         "criteria": "[{\"field\":\"industry\",\"operator\":\"equals\",\"value\":\"Technology\"}]",
         "priority": 1,
         "isActive": true,
         "ruleType": "Criteria",
         "assignToId": "a27424bc-973c-4665-9804-a408542e7657"
       }
     ]
     ```
   - Only a single criteria rule existed (assigning to Liam Carter if the industry equals `"Technology"`).
3. **Inbound Webhook Live Test**:
   - Sent a POST request to `https://crm-k8g4.onrender.com/api/v1/emails/inbound` with text `"addressed to Saud"`:
     ```json
     {
       "message": "Inbound email ingested successfully",
       "leadId": "6f05798b-12dd-4fef-aaa5-ddd1020224f0",
       "assignedToId": "792c1cab-ebed-4501-b756-de3de370b201"
     }
     ```
   - The `assignedToId` belongs to `Sophia Martinez` (default admin/manager).
   - **Conclusion**: There was no prior route or logic that parsed the email recipient (`to` field) or attempted matching against salesperson email addresses on the deployed server. Any assignment matching was purely fallback-based.

---

## Step 2 — Direct "Addressed-To" Routing Implementation (Local Only)

### Backend Controller Updates
- Updated `receiveInboundEmail` in [emailController.ts](file:///Users/saud/Projects/CRM/backend/src/controllers/emailController.ts) to parse the `to`, `recipient`, or `To` fields in the inbound webhook request body.
- Added lookup to match parsed recipient address against the `User` model attributes:
  ```typescript
  const matchedUser = await User.findOne({ where: { email: recipientEmail } });
  ```
- If the matched user exists and possesses a sales role (`sales_rep`, `sales_manager`, or `admin`), the lead is assigned directly to them, skipping assignment rules engine fallbacks.

### Database Schema Updates
- Added `recipientEmail` field to the `Lead` model configuration under [models/index.ts](file:///Users/saud/Projects/CRM/database/models/index.ts).
- Created a database schema migration script [20260720080000-add-recipient-email-to-leads.js](file:///Users/saud/Projects/CRM/database/migrations/20260720080000-add-recipient-email-to-leads.js) to append the `recipientEmail` column.

### Verification & E2E Testing
- Added two E2E test cases inside [email.e2e.test.ts](file:///Users/saud/Projects/CRM/backend/tests/e2e/email.e2e.test.ts) covering:
  - Match case: Assigning lead directly to salesperson matching the recipient address.
  - Fallback case: Reverting to fallback default routing if the recipient email does not match a known salesperson.
- Executed Jest tests successfully:
  ```bash
  PASS tests/e2e/email.e2e.test.ts (3 passed, 3 total)
  ```
