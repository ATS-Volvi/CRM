# UI Interaction Audit: Nexus CRM & QuoteFlow Pro

This document maps all interactive elements (navigation items, buttons, links, form submissions, and modals) across the two frontend applications in the CRM monorepo.

---

## 1. Global Navigation & Table Summary

### Global Navigation Items (In Order of Appearance)

#### App: frontend (Nexus CRM Sidebar + Header)
1. **Sidebar Toggle Icon-Button**: Minimizes/restores the left side navigation panel.
2. **My Dashboard Link**: Navigates to `/`.
3. **Lead Inbox Link**: Navigates to `/leads`.
4. **Quotes Link**: Navigates to `/quotes`.
5. **Purchase Orders Link**: Navigates to `/purchase-orders`.
6. **Customers Link**: Navigates to `/customers`.
7. **Pipeline Link** (under Reports): Navigates to `/pipeline`.
8. **Management Dashboard Link** (under Reports): Navigates to `/`. (Gated for admin/manager).
9. **KPI Dashboard Link** (under Reports): Navigates to `/kpi`.
10. **Sales Representatives Link** (under Reports): Navigates to `/salespersons`. (Gated for admin/manager).
11. **AI Reports Link** (under Reports): Navigates to `/ai-reports`.
12. **Requirements Link** (under Master Data): Navigates to `/master-data/requirements`. (Gated for admin).
13. **Line Items Link** (under Master Data): Navigates to `/master-data/line-items`. (Gated for admin).
14. **Construction Items Link** (under Master Data): Navigates to `/master-data/construction-items`. (Gated for admin).
15. **Pricing Grid Link** (under Master Data): Navigates to `/master-data/pricing`. (Gated for admin).
16. **Lead Sources Link** (under Master Data): Navigates to `/master-data/lead-sources`. (Gated for admin).
17. **KPI Master Link** (under Master Data): Navigates to `/master-data/kpis`. (Gated for admin).
18. **Price Book Link** (under Master Data): Navigates to `/price-book`. (Gated for admin).
19. **Quick Add Dropdown**: Triggers list showing `New Lead` (navigates `/leads/new`) and `New Quotation` (navigates `/quotes/new`).
20. **Notification Bell Icon**: Shows list of recent notifications.
21. **User Profile Dropdown**: Allows logging out (clears JWT token).

#### App: quote-flow-pro-18 (QuoteFlow Pro Sidebar)
1. **Dashboard**: Navigates to `/`.
2. **Leads**: Navigates to `/leads`.
3. **Quotations**: Navigates to `/quotations`.
4. **Customers**: Navigates to `/customers`.
5. **Purchase Orders**: Navigates to `/purchase-orders`.
6. **Analytics**: Navigates to `/analytics`.
7. **AI Coach**: Navigates to `/ai-reports`.
8. **Service Types**: Navigates to `/master/service-types`.
9. **Service Line Items**: Navigates to `/master/service-items`.
10. **Salespersons**: Navigates to `/master/salespersons`.
11. **RFQ Sources**: Navigates to `/master/rfq-sources`.
12. **Settings**: Navigates to `/settings`.
13. **Sign Out Button**: Logs out session.

---

### Global Interaction Flat Table

| Button/Control | Page | Action Type | Result |
| :--- | :--- | :--- | :--- |
| **Login Submit** | `Login.tsx` | API Call | Hits POST `/api/v1/auth/login`, redirects to `/` |
| **Quick Add Lead** | Layout | Navigate | Navigates to `/leads/new` |
| **Save as Draft** | `LeadCreate.tsx` | API Call | Hits POST `/api/v1/leads` with "Draft" status |
| **Simulate DocuSign** | `QuoteHistory.tsx` | API Call | Hits GET `/api/v1/public/quotes/:id/sign`, marks "Accepted" |
| **Convert Quote to Invoice** | `QuoteHistory.tsx` | API Call | Hits POST `/api/v1/invoices/from-quote`, redirects to `/invoices` |
| **View Full Audit Trail** | `QuoteHistory.tsx` | Modal / Local | Opens timeline popup modal showing log events |
| **Edit & Use** | `QuotationBuilder.tsx` | Local State | Copies selected historical template quote to builder |
| **Send As-Is** | `QuotationBuilder.tsx` | API Call | Sends selected template quote direct to client |
| **Supabase SignUp/SignIn** | `AuthPage.tsx` | API Call | Calls Supabase SignUp/SignIn methods |

---

## 2. Route-by-Route Audit: `frontend`

## App: frontend — Route: /login (Component: Login.tsx)
Role visibility: All public users.
Purpose of this page: Allows users to input email and password credentials to receive a JWT access token.

### Buttons & controls
- **[Register / Account Submit Button]** (line 116)
  - Click → Calls POST `/api/v1/auth/login` to authenticate credentials.
  - Effect: Saves JWT token to client `localStorage` and redirects user to `/`.
  - Visible to: All users.

---

## App: frontend — Route: /home (Component: MyDashboard.tsx)
Role visibility: `sales_rep`, `sales_manager`, `admin`, `director`.
Purpose of this page: Main landing dashboard containing metrics charts and recent quote lists.

### Tabs / sub-navigation on this page
- Tab "Overview" → shows general performance metrics.
- Tab "Incoming Emails" → shows list of sync inbox emails.

### Buttons & controls
- **[Range Toggle Buttons]** (line 226)
  - Click → Toggles timeline selection (`weekly`, `monthly`, or `yearly`).
  - Effect: Triggers TanStack query state refresh for metrics calculation.
  - Visible to: All users.
- **[Add Lead Link]** (line 311)
  - Click → Navigates to `/leads/new`.
  - Effect: Opens new lead builder form.
  - Visible to: All users.

---

## App: frontend — Route: /leads/new (Component: LeadCreate.tsx)
Role visibility: `sales_rep`, `sales_manager`, `admin`.
Purpose of this page: Standardized lead builder and ingest form with integrated voice transcript parser.

### Buttons & controls
- **[Save as Draft Button]** (line 299)
  - Click → Submits form details with status `"Draft"` to POST `/api/v1/leads`.
  - Effect: Writes new draft lead database entry.
  - Visible to: All users.
- **[Voice Assistant Toggle]** (line 336)
  - Click → Toggles speech recorder on/off.
  - Effect: Captures microphone transcript locally.
  - Visible to: All users.
- **[Parse Transcript Button]** (line 347)
  - Click → Sends transcript to POST `/api/v1/voice-leads/parse`.
  - Effect: Populates fields dynamically with AI metadata attributes.
  - Visible to: All users.

---

## App: frontend — Route: /quotes (Component: QuoteHistory.tsx)
Role visibility: `sales_rep`, `sales_manager`, `admin`.
Purpose of this page: Lists historic quotations with print capabilities and invoice converters.

### Buttons & controls
- **[Simulate DocuSign Button]** (line 319)
  - Click → Calls GET `/api/v1/public/quotes/{id}/sign`.
  - Effect: Marks quote status as "Accepted" in the database.
  - Visible to: All users.
- **[Convert to Invoice Button]** (line 342)
  - Click → Sends POST `/api/v1/invoices/from-quote`.
  - Effect: Spawns new invoice and redirects.
  - Visible to: All users.
- **[View Full Audit Trail Button]** (line 399)
  - Click → Opens modal showing chronological events.
  - Effect: Renders overlay popup.
  - Visible to: All users.

---

## App: frontend — Route: /quotes/new (Component: QuotationBuilder.tsx)
Role visibility: `sales_rep`, `sales_manager`, `admin`.
Purpose of this page: Main interactive quote builder with sidebar suggestions and historical template copier.

### Tabs / sub-navigation on this page
- Tab "Client History" (line 604) → shows past quotations of active client.
- Tab "Similar Products" (line 615) → shows similar templates across other clients.

### Buttons & controls
- **[Edit & Use Button]** (line 674 / 759)
  - Click → Sets item values into builder local state arrays.
  - Effect: Fills current quotation editor fields with historical data.
  - Visible to: All users.
- **[Send As-Is Button]** (line 685 / 770)
  - Click → Triggers POST `/api/v1/quotes/{id}/send`.
  - Effect: Immediately emails template quote configuration.
  - Visible to: All users.

---

## 3. Route-by-Route Audit: `quote-flow-pro-18`

## App: quote-flow-pro-18 — Route: /auth (Component: AuthPage.tsx)
Role visibility: All public users.
Purpose of this page: Supabase registration and login gate.

### Buttons & controls
- **[Submit Auth Button]** (line 112)
  - Click → Calls Supabase Auth provider triggers.
  - Effect: Redirects session to dashboard on success.
  - Visible to: All users.

---

## App: quote-flow-pro-18 — Route: /leads/new (Component: LeadCreate.tsx)
Role visibility: All authenticated users.
Purpose of this page: Lead creator panel with service classification items.

### Buttons & controls
- **[Save Button]** (line 183)
  - Click → Submits fields to Supabase DB leads table.
  - Effect: Inserts new lead configuration.
  - Visible to: All users.
- **[Add Service Button]** (line 276)
  - Click → Opens category items popover picker.
  - Effect: Toggles local modal overlay state.
  - Visible to: All users.
