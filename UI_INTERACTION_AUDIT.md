# UI Interaction Audit: Nexus CRM Monorepo

This document outlines the interactive components, buttons, tabs, navigation items, and actions for both the **Nexus CRM** (`frontend/`) and **QuoteFlow Pro** (`quote-flow-pro-18/`) applications.

---

## 1. Global Navigation Summary

### App: frontend (Nexus CRM)

#### Sidebar items (Layout.tsx)
1. **My Dashboard** (Link to `/home`): Visible to all.
2. **Lead Inbox** (Link to `/leads`): Visible to all.
3. **Quotes** (Link to `/quotes`): Visible to all.
4. **Purchase Orders** (Link to `/purchase-orders`): Visible to all.
5. **Customers** (Link to `/customers`): Visible to all.
6. **Reports Group** (Collapsible header / Toggle button):
   - **Pipeline** (Link to `/pipeline`): Visible to all.
   - **Management Dashboard** (Link to `/`): Manager/Admin/Director only.
   - **KPI Dashboard** (Link to `/kpi`): Manager/Admin/Director only.
   - **Sales Representatives** (Link to `/salespersons`): Manager/Admin/Director only.
   - **AI Reports** (Link to `/ai-reports`): Manager/Admin/Director only.
7. **Master Data Group** (Collapsible header / Toggle button, Manager/Admin only):
   - **Requirements** (Link to `/master-data/requirements`)
   - **Line Items** (Link to `/master-data/line-items`)
   - **Construction Items** (Link to `/master-data/construction-items`)
   - **Pricing Grid** (Link to `/master-data/pricing`)
   - **Lead Sources** (Link to `/master-data/lead-sources`)
   - **KPI Master** (Link to `/master-data/kpis`)
   - **Price Book** (Link to `/price-book`)
8. **Sign Out** (Button): Calls `logout()` and redirects to `/login`.
9. **Collapse Sidebar** (Button): Toggles sidebar collapse width between 64px and 260px.

#### Header Items (Layout.tsx)
- **Global Search Bar**: Input field, explicitly `disabled` ("coming soon").
- **Notification Bell** (Icon Button): Static icon with mock red indicator dot.
- **Quick Add** (Dropdown Button):
  - **Add New Lead** (Link to `/leads/new`).
  - **Build New Quote** (Link to `/quotes/new`).
  - **New Purchase Order** (Link to `/purchase-orders`).
  - **Add Assignment Rule** (Link to `/rules`): Visible to Managers/Admins only.
- **User Avatar** (Initial Circle): Display only.

---

### App: quote-flow-pro-18 (QuoteFlow Pro)

#### Sidebar Items (AppSidebar.tsx)
1. **Dashboard** (Link to `/`): Visible to all.
2. **Leads** (Link to `/leads`): Visible to all.
3. **Quotations** (Link to `/quotations`): Visible to all.
4. **Purchase Orders** (Link to `/purchase-orders`): Visible to all.
5. **Customers** (Link to `/customers`): Visible to all.
6. **Reports Group** (Collapsible Header / Button):
   - **Pipeline** (Link to `/pipeline`)
   - **Analytics** (Link to `/analytics`)
   - **Sales KPI** (Link to `/salesperson-kpi`)
   - **AI Reports** (Link to `/ai-reports`)
7. **Master Data Group** (Collapsible Header / Button):
   - **Service Items** (Link to `/master/service-items`)
   - **Service Types** (Link to `/master/service-types`)
   - **RFQ Sources** (Link to `/master/rfq-sources`)
   - **Salespersons** (Link to `/master/salespersons`)
8. **Settings** (Link to `/settings`): Visible to all.
9. **Sign Out** (Button): Calls Supabase/auth `signOut()` handler.
10. **Collapse Sidebar** (Button): Toggles sidebar expand state.

#### Header Items (AppLayout.tsx)
- **Search Input**: Local filter search bar for RFQs and customers.
- **Notification Bell** (Icon Button): Static indicator.
- **User Profile Info**: Displays mock User Name and role (e.g. Khalid Nasser, Coordinator).

---

## 2. Interaction Map: frontend

### Route: `/login` (Component: `Login.tsx`)
- **Role visibility**: All visitors
- **Purpose**: Authenticate users and store JWT token

#### Buttons & Controls
- **Email & Password Input Fields** (Lines 76-96)
  - Click/Type: Updates form state (`email`, `password`).
- **Sign In Button** (Line 109)
  - Click: Fires POST to `/api/v1/auth/login`. On success, stores `nexus_token` and `nexus_user` in `localStorage`, updates `AuthContext` state, and navigates to `/`.

---

### Route: `/` (Component: `ManagementDashboard.tsx`)
- **Role visibility**: Manager, Admin, Director (`RoleBasedHome` redirects sales reps to `/home`)
- **Purpose**: Executive dashboard displaying business health and stats

#### Buttons & Controls
- **Export PDF Button** (Line 179)
  - Click: Triggers client-side PDF export logic (Stubbed placeholder).
- **View All Leads/Deals Link** (Line 182)
  - Click: Navigates to `/leads` (Lead Inbox).

---

### Route: `/home` (Component: `MyDashboard.tsx`)
- **Role visibility**: All roles (Default home for sales reps)
- **Purpose**: Personalized agent dashboard containing task lists, pipeline summaries, and recent activity logs

#### Buttons & Controls
- **Task Complete Checkboxes** (Line 230)
  - Click: Calls PATCH `/api/v1/tasks/:id` via controller to toggle status.
- **Add Task Button** (Line 245)
  - Click: Opens simple modal/input. Fires POST `/api/v1/tasks` to create a task for the current logged-in user.
- **Quick Links**: Clicking cards navigates to `/quotes/new` or `/leads`.

---

### Route: `/leads` (Component: `LeadInbox.tsx`)
- **Role visibility**: All roles
- **Purpose**: Displays active lead pipelines and allows creation/deletion of leads

#### Buttons & Controls
- **Add Lead Button** (Line 186)
  - Click: Opens "Add Lead" modal.
  - **Cancel Button** (Line 349): Closes modal.
  - **Save Lead Button** (Line 350): Fires POST to `/api/v1/leads` to create a lead, then refreshes query.
- **Download Excel Button** (Line 220)
  - Click: Exports filtered leads to local Excel file using `xlsx`.
- **Lead Row Name Link** (Line 252)
  - Click: Navigates to `/leads/:id` (Lead Detail page).
- **Update Status Button ("Mark Contacted")** (Line 282)
  - Click: Fires PATCH `/api/v1/leads/:id` to transition status to "Contacted".
- **Trash Icon (Delete Lead)** (Line 289)
  - Click: Shows native `confirm()`. If OK, fires DELETE `/api/v1/leads/:id`.

---

### Route: `/leads/:id` (Component: `LeadDetail.tsx`)
- **Role visibility**: All roles
- **Purpose**: 360-degree timeline view of a single lead with notes, activity logs, and edit functions

#### Buttons & Controls
- **Call/Email Note Toggles** (Lines 111-123)
  - Click: Toggles active note category type state.
- **Build Quote Button** (Line 135)
  - Click: Navigates to `/quotes/new?leadId=:id`.
- **Auto-enrichment Button** (Line 142)
  - Click: Triggers alert ("Auto-enrichment requires Phase 13 backend completion.").
- **Schedule Meeting Button** (Line 149)
  - Click: Triggers alert ("Schedule Meeting integration not configured.").
- **Timeline Filters (All / Notes / Comm)** (Lines 257-265)
  - Click: Filters list rendering locally.
- **Save Note Button** (Line 286)
  - Click: Fires POST `/api/v1/activities` (attaching `leadId`, note type, and description) to record a timeline event.
- **Pin Timeline Item Button** (Line 344)
  - Click: Fires PATCH `/api/v1/activities/:id/pin` to pin note to top of page.

---

### Route: `/pipeline` (Component: `PipelineKanban.tsx`)
- **Role visibility**: All roles
- **Purpose**: Drag-and-drop kanban board representing deal pipelines and stages

#### Buttons & Controls
- **Kanban / List Toggle Tabs** (Lines 106-112)
  - Click: Toggles local view mode state.
- **Add Deal Button** (Line 162)
  - Click: Opens "Create Deal" modal.
  - **Submit Button** (Line 311): Fires POST `/api/v1/pipeline` to create new deal.
- **Drag-and-Drop Deal Card**:
  - Dragging card to another column opens the Stage Transition modal.
  - **Reason input & Recontact Date**: Required fields.
  - **Confirm Stage Transition Button** (Line 256): Fires PATCH `/api/v1/pipeline/deals/:id` to update deal stage and log transition reason.

---

### Route: `/quotes/new` (Component: `QuotationBuilder.tsx`)
- **Role visibility**: All roles
- **Purpose**: Advanced quote builder containing recommendation engines, price book catalog rules, and comparative sidebar tabs

#### Tabs & Sub-navigation
- **Client History Tab**: Displays previous quotes submitted under the current Lead ID.
- **Similar Clients Tab**: Queries similar deals by requirements type.

#### Buttons & Controls
- **Select Deal Dropdown** (Line 54)
  - Change: Sets selected deal and queries recommendations and historical comparative quotes.
- **Save as Draft Button** (Line 117)
  - Click: Fires POST `/api/v1/quotes` with status set to `Draft`.
- **Send for Approval Button** (Line 118)
  - Click: Fires POST `/api/v1/quotes` with status set to `Pending` (triggers approval routing workflow in the backend).
- **Add Product Link** (Line 128)
  - Click: Appends empty item row to items table state.
- **Trash Icon (Delete line item)** (Line 540)
  - Click: Removes the specific item index from local items state.
- **"Edit & Use" Button (Sidebar Cards)** (Line 673 & Line 758)
  - Click: Prompts confirmation, parses selected historical quote items, and overwrites local builder table items.
- **"Send As-Is" Button (Sidebar Cards)** (Line 158)
  - Click: Prompts confirmation, clones historical line items, and fires POST `/api/v1/quotes` directly with `Pending` status.

---

### Route: `/quotes` (Component: `QuoteHistory.tsx`)
- **Role visibility**: All roles
- **Purpose**: Repository containing all historical quotations, versions, and validation workflows

#### Buttons & Controls
- **Create Quote Button** (Line 107)
  - Click: Navigates to `/quotes/new`.
- **Row Action Menu Indicator** (Line 187)
  - Click: Displays options (View, Edit, Export).
- **Export button** (Line 101)
  - Click: Generates CSV list of quotes.

---

### Route: `/master-data/*`
- **Role visibility**: Manager, Admin
- **Purpose**: Manage system parameters, RFQ sources, construction items, and requirements definitions

---

## 3. Interaction Map: quote-flow-pro-18

This application operates on a separate frontend framework and communicates directly with **Supabase** tables.

### Route: `/auth` (Component: `AuthPage.tsx`)
- **Role visibility**: Public
- **Purpose**: User login via Supabase credentials

#### Buttons & Controls
- **Auth Submit Button**: Calls Supabase `auth.signInWithPassword()`.

### Route: `/` (Component: `Dashboard.tsx`)
- **Role visibility**: All roles
- **Purpose**: Supabase CRM analytics overview

#### Buttons & Controls
- **Date Range Toggles**: Filters local display metrics.

### Route: `/leads` (Component: `LeadList.tsx`)
- **Role visibility**: All roles
- **Purpose**: List leads fetched directly from the `leads` table in Supabase

#### Buttons & Controls
- **Lead Number Link**: Navigates to `/leads/:id`.
- **New Lead Button**: Navigates to `/leads/new`.

### Route: `/leads/new` (Component: `LeadCreate.tsx`)
- **Role visibility**: All roles
- **Purpose**: Create a new lead directly in Supabase

#### Buttons & Controls
- **Submit Form**: Inserts record into `leads` table in Supabase.

### Route: `/quotations/new` (Component: `QuotationCreate.tsx`)
- **Role visibility**: All roles
- **Purpose**: Advanced quotation generator utilizing Supabase database bindings

#### Buttons & Controls
- **Add Custom Item Button** (Line 318)
  - Click: Adds custom empty item input row.
- **Save Draft Button** (Line 243)
  - Click: Inserts record to `quotations` table with status `draft`.
- **Submit for Approval Button** (Line 246)
  - Click: Inserts record to `quotations` with status `pending_approval_l1`.
