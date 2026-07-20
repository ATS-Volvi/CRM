# UI Interaction Audit: Nexus CRM & QuoteFlow Pro

This document maps all interactive elements (navigation items, buttons, links, form submissions, and modals) across the two frontend applications in the CRM monorepo.

---

## 1. Global Navigation Structure

### App: frontend (Nexus CRM)

#### Navigation Sidebar / Layout (`frontend/src/components/Layout.tsx`)
- **Collapse/Expand Sidebar Toggle**: Minimizes/restores the left side navigation panel.
- **My Dashboard Link**: Navigates to `/`.
- **Lead Inbox Link**: Navigates to `/leads`.
- **Quotes Link**: Navigates to `/quotes`.
- **Purchase Orders Link**: Navigates to `/purchase-orders`.
- **Customers Link**: Navigates to `/customers`.
- **Reports Section**:
  - **Pipeline Link**: Navigates to `/pipeline`.
  - **Management Dashboard Link**: Navigates to `/management`. (Visible to `sales_manager` and `admin` only).
  - **KPI Dashboard Link**: Navigates to `/kpi`.
  - **Sales Representatives Link**: Navigates to `/salespersons`. (Visible to `sales_manager` and `admin` only).
  - **AI Reports Link**: Navigates to `/ai-reports`.
- **Master Data Section** (Visible to `admin` only):
  - **Requirements Link**: Navigates to `/master-data/requirements`.
  - **Line Items Link**: Navigates to `/master-data/line-items`.
  - **Construction Items Link**: Navigates to `/master-data/construction-items`.
  - **Pricing Grid Link**: Navigates to `/master-data/pricing`.
  - **Lead Sources Link**: Navigates to `/master-data/lead-sources`.
  - **KPI Master Link**: Navigates to `/master-data/kpis`.
  - **Price Book Link**: Navigates to `/price-book`.
- **Quick Add Dropdown**:
  - **New Lead**: Navigates to `/leads/new`.
  - **New Quotation**: Navigates to `/quotes/new`.
- **Notifications Icon (Bell)**: Displays unread system notifications dropdown.
- **User Avatar Profile Icon**: Opens setting/profile configuration popover.
- **Sign Out Button**: Clears JWT token from `localStorage` and redirects to `/login`.

---

### App: quote-flow-pro-18 (QuoteFlow Pro)

#### Navigation Sidebar (`quote-flow-pro-18/src/components/AppSidebar.tsx`)
- **Dashboard**: Navigates to `/`.
- **Leads**: Navigates to `/leads`.
- **Quotations**: Navigates to `/quotations`.
- **Customers**: Navigates to `/customers`.
- **Purchase Orders**: Navigates to `/purchase-orders`.
- **Analytics**: Navigates to `/analytics`.
- **AI Coach**: Navigates to `/ai-reports`.
- **Master Data Dropdown**:
  - **Service Types**: Navigates to `/master-data/service-types`.
  - **Line Items**: Navigates to `/master-data/service-items`.
  - **Salespersons**: Navigates to `/master-data/salespersons`.
  - **RFQ Sources**: Navigates to `/master-data/rfq-sources`.
- **Settings**: Navigates to `/settings`.
- **Sign Out Button**: Performs Supabase auth sign-out, clears local user session, and redirects to `/auth`.

---

## 2. Page-by-Page Audit: `frontend` (Nexus CRM)

### Route: `/login` (Component: `Login.tsx`)
- **Submit Form** (L77):
  - Click / Enter → Submits credentials (email and password) to POST `/api/v1/auth/login`. Sets authorization headers, stores JWT in localStorage, and redirects to root `/`.

### Route: `/` (Component: `MyDashboard.tsx`)
- **Range Toggle Buttons** (L226):
  - Click → Changes the local query range filter state (`range` = "weekly" | "monthly" | "yearly"). Re-triggers TanStack query for dashboard analytics.
- **Add Lead Link** (L311):
  - Click → Navigates to `/leads/new`.
- **Create Quote Link** (L312):
  - Click → Navigates to `/quotes/new`.
- **View My Pipeline Link** (L313):
  - Click → Navigates to `/pipeline?ownerId={userId}`.
- **Tab Selection Controls** (L367):
  - Click → Switches the active tab layout (`activeTab` = "overview" | "recent_quotes" | "incoming_emails").
- **Close Email Modal Button** (L526 / L554):
  - Click → Clears selected email detail overlay state (`setSelectedEmail(null)`).

### Route: `/leads` (Component: `LeadInbox.tsx`)
- **Create Lead Link** (L69 / L141):
  - Click → Navigates to `/leads/new`.
- **Lead ID Row Link** (L162):
  - Click → Navigates to the Lead details view `/leads/{leadId}`.

### Route: `/leads/new` (Component: `LeadCreate.tsx`)
- **Save as Draft Button** (L299):
  - Click → Submits lead details with status `"Draft"` to POST `/api/v1/leads`.
- **Save & Mark Contacted Button** (L306):
  - Click → Submits lead details with status `"Contacted"` to POST `/api/v1/leads`.
- **Voice Assistant Toggle** (L336):
  - Click → Activates browser Web Speech API for voice transcript capture.
- **Parse Transcript Button** (L347):
  - Click → Sends recorded transcript to AI Parser endpoint POST `/api/v1/voice-leads/parse` to extract fields.
- **Fill Fields Button** (L358):
  - Click → Populates fields on the page with parsed AI response metadata.
- **New Customer Inline Form Button** (L399):
  - Click → Toggles visibility of the new customer inline registration form.
- **Save Customer Button** (L447):
  - Click → Submits new inline customer to POST `/api/v1/customers`.
- **Remove Group Button** (L574):
  - Click → Deletes selected line items group from active state list.

### Route: `/leads/:id` (Component: `LeadDetail.tsx`)
- **Convert to Quotation Button** (L230):
  - Click → Converts lead to active quotation, creating pipeline deal mapping via POST `/api/v1/quotes` and redirecting.
- **Edit/X details Toggle** (L306):
  - Click → Enables inline form inputs for updating lead metadata attributes.
- **Save Changes Button** (L353):
  - Click → Submits changes to PUT `/api/v1/leads/{id}`.
- **Reassign Representative Icon** (L399):
  - Click → Toggles dropdown selection to reassign lead representative.
- **Reassign Lead Button** (L443):
  - Click → Submits changes to PUT `/api/v1/leads/{id}/reassign`.
- **Activity Feed Card Box** (L568):
  - Click → Launches activity feed modal to record tasks or communication logs.

### Route: `/quotes` (Component: `QuoteHistory.tsx`)
- **Export CSV Button** (L213):
  - Click → Downloads CSV file containing all filtered quote lists from GET `/api/v1/exports/quotes`.
- **New Quote Button** (L219 / L251):
  - Click → Navigates to `/quotes/new`.
- **Simulate DocuSign Button** (L319):
  - Click → Calls Mock DocuSign endpoint GET `/api/v1/public/quotes/{id}/sign` to mark status as "Accepted".
- **Convert to Invoice Button** (L342):
  - Click → Submits POST `/api/v1/invoices/from-quote` and redirects to `/invoices` page on success.
- **View Full Audit Trail Button** (L399):
  - Click → Opens overlay popup containing complete system activity logs.

### Route: `/quotes/new` (Component: `QuotationBuilder.tsx`)
- **Save as Draft Button** (L387):
  - Click → Submits quote items with status `"Draft"` to POST `/api/v1/quotes`.
- **Send for Approval Button** (L388):
  - Click → Submits quote items with status `"Pending"` to POST `/api/v1/quotes`.
- **Add Product Button** (L398):
  - Click → Appends empty line item row to quote collection.
- **Trash Icon Button** (L458):
  - Click → Removes product row from active quotation builder form.
- **Apply All Recommendations** (L474):
  - Click → Adds all AI suggestion products to active items list.
- **Tab Navigation** (L615):
  - Click → Toggles historical quotes sidebar tabs (`client` history or `similar` products).
- **Edit & Use Button** (L674 / L759):
  - Click → Overwrites active quote builder fields with products and values from selected historical template quote.
- **Send As-Is Button** (L685 / L770):
  - Click → Sends selected historical quote layout directly to the client without changes.

---

## 3. Page-by-Page Audit: `quote-flow-pro-18` (QuoteFlow Pro)

### Route: `/auth` (Component: `AuthPage.tsx`)
- **Submit Form** (L66):
  - Click / Enter → Triggers Supabase authentication signUp / signIn flow.
- **Toggle Mode Link** (L123):
  - Click → Toggles between Login and Registration views.

### Route: `/` (Component: `Dashboard.tsx`)
- **Lead / Quotation Cards** (L273 / L306):
  - Click → Navigates to `/leads/{id}` or `/quotations/{id}`.

### Route: `/leads` (Component: `LeadList.tsx`)
- **New Lead Link** (L623):
  - Click → Navigates to `/leads/new`.

### Route: `/leads/new` (Component: `LeadCreate.tsx`)
- **Save Button** (L183):
  - Click → Saves lead details as draft.
- **Save & Mark Contacted Button** (L187):
  - Click → Saves lead details and marks status as contacted.
- **Add Service Button** (L276):
  - Click → Opens category configuration popup.

### Route: `/leads/:id` (Component: `LeadDetail.tsx`)
- **Convert to Quotation Button** (L212):
  - Click → Creates quotation configuration mapped to lead and updates DB state.

### Route: `/quotations` (Component: `QuotationList.tsx`)
- **New Quotation Link** (L811):
  - Click → Navigates to `/quotations/new`.
- **Status Filter buttons** (L815):
  - Click → Toggles local list filter status.

### Route: `/master-data/service-types` (Component: `MasterServiceTypes.tsx`)
- **Save / Create Button** (L83):
  - Click → Saves or updates service type taxonomy in Supabase.
- **Active / Off Toggle** (L125):
  - Click → Toggles active state boolean.

### Route: `/master-data/service-items` (Component: `MasterServiceItems.tsx`)
- **Add Line Item** (L185):
  - Click → Adds new line item definition.
- **Add Field** (L238):
  - Click → Appends custom metadata input field parameter definition.
