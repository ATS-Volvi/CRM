import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import { SalesLayout } from "./components/SalesLayout";

// Page Imports
import ManagementDashboard from "./pages/ManagementDashboard";
import MyDashboard from "./pages/MyDashboard";
import KpiDashboard from "./pages/KpiDashboard";
import SalesQueue from "./pages/SalesQueue";
import LeadInbox from "./pages/LeadInbox";
import LeadDetail from "./pages/LeadDetail";
import PipelineKanban from "./pages/PipelineKanban";
import QuotationBuilder from "./pages/QuotationBuilder";
import QuoteHistory from "./pages/QuoteHistory";
import PriceBook from "./pages/PriceBook";
import PurchaseOrders from "./pages/PurchaseOrders";
import ApprovalQueue from "./pages/ApprovalQueue";
import AssignmentRules from "./pages/AssignmentRules";
import PublicQuoteRequest from "./pages/PublicQuoteRequest";
import Invoices from "./pages/Invoices";
import InvoiceDetail from "./pages/InvoiceDetail";
import Login from "./pages/Login";
import SalespersonTracker from "./pages/SalespersonTracker";
import SalespersonDetail from "./pages/SalespersonDetail";
import Requirements from "./pages/master-data/Requirements";
import LineItems from "./pages/master-data/LineItems";
import ConstructionItems from "./pages/master-data/ConstructionItems";
import Pricing from "./pages/master-data/Pricing";
import LeadSources from "./pages/master-data/LeadSources";
import Kpis from "./pages/master-data/Kpis";
import LineItemCatalog from "./pages/master-data/LineItemCatalog";
import Accounts from "./pages/Accounts";
import Contacts from "./pages/Contacts";

import AIReports from "./pages/AIReports";
import Settings from "./pages/Settings";
import LeadCreate from "./pages/LeadCreate";
import ActivitiesHub from "./pages/ActivitiesHub";
import CommunicationCenter from "./pages/CommunicationCenter";
import WorkflowAutomation from "./pages/WorkflowAutomation";
import ExecutiveDashboard from "./pages/ExecutiveDashboard";
import RepPortal from "./pages/RepPortal";
import ManagerPortal from "./pages/ManagerPortal";
import QuotationTemplateManager from "./pages/QuotationTemplateManager";
import AssetTracking from "./pages/AssetTracking";
import OrderDetail from "./pages/OrderDetail";
import SupplyQueue from "./pages/SupplyQueue";
import FulfillmentDetail from "./pages/FulfillmentDetail";
import Leads from "./pages/Leads";
import Opportunities from "./pages/Opportunities";
import OpportunityDetail from "./pages/OpportunityDetail";
import AccountDetail from "./pages/AccountDetail";
import Campaigns from "./pages/Campaigns";
import SupportTickets from "./pages/SupportTickets";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { Navigate, Outlet } from "react-router-dom";

const ProtectedRoute = () => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
};

/** Standardized Workspace Layout with Sidebar */
const RoleBasedLayout = () => {
  return <Layout />;
};

/** Redirect / to initial landing dashboard (My Work / Operational Dashboard) */
const RoleBasedHome = () => {
  return <MyDashboard />;
};

const queryClient = new QueryClient();

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/quote" element={<PublicQuoteRequest />} />
          <Route path="/login" element={<Login />} />
          
          <Route element={<ProtectedRoute />}>
            <Route element={<RoleBasedLayout />}>
              <Route path="/" element={<RoleBasedHome />} />
              <Route path="/home" element={<MyDashboard />} />
              <Route path="/inbox" element={<LeadInbox />} />
              <Route path="/kpi" element={<KpiDashboard />} />
              
              {/* Pre-Sales Leads Workspace */}
              <Route path="/leads" element={<Leads />} />
              <Route path="/leads/new" element={<LeadCreate />} />
              <Route path="/leads/:id" element={<LeadDetail />} />
              
              {/* Commercial Opportunities Workspace */}
              <Route path="/opportunities" element={<Navigate to="/pipeline" replace />} />
              <Route path="/opportunities/:id" element={<OpportunityDetail />} />
              <Route path="/deals" element={<Navigate to="/pipeline" replace />} />
              <Route path="/deals/:id" element={<OpportunityDetail />} />
              <Route path="/pipeline" element={<PipelineKanban />} />
              
              {/* Quotations Workspace */}
              <Route path="/quotes/new" element={<QuotationBuilder />} />
              <Route path="/quotes" element={<QuoteHistory />} />
              <Route path="/invoices" element={<Invoices />} />
              <Route path="/invoices/:id" element={<InvoiceDetail />} />
              <Route path="/price-book" element={<PriceBook />} />
              
              {/* Orders, Supply & Assets */}
              <Route path="/purchase-orders" element={<PurchaseOrders />} />
              <Route path="/orders/:id" element={<OrderDetail />} />
              <Route path="/supply" element={<SupplyQueue />} />
              <Route path="/supply/queue" element={<SupplyQueue />} />
              <Route path="/fulfillments/:id" element={<FulfillmentDetail />} />
              <Route path="/assets" element={<AssetTracking />} />
              <Route path="/tickets" element={<SupportTickets />} />
              <Route path="/support-tickets" element={<Navigate to="/tickets" replace />} />
              
              {/* Accounts & Contacts */}
              <Route path="/accounts" element={<Accounts />} />
              <Route path="/accounts/:id" element={<AccountDetail />} />
              <Route path="/customer/:id" element={<AccountDetail />} />
              <Route path="/contacts" element={<Contacts />} />
              
              {/* Marketing & Attribution */}
              <Route path="/campaigns" element={<Campaigns />} />
              <Route path="/campaigns/:id" element={<Campaigns />} />
              
              {/* Operations, Approvals & Governance */}
              <Route path="/approvals" element={<ApprovalQueue />} />
              <Route path="/rules" element={<AssignmentRules />} />
              <Route path="/salespersons" element={<SalespersonTracker />} />
              <Route path="/salespersons/:id" element={<SalespersonDetail />} />
              <Route path="/activities" element={<ActivitiesHub />} />
              <Route path="/communications" element={<CommunicationCenter />} />
              <Route path="/automation" element={<WorkflowAutomation />} />
              <Route path="/executive-bi" element={<ExecutiveDashboard />} />
              <Route path="/rep-portal" element={<RepPortal />} />
              <Route path="/manager-portal" element={<ManagerPortal />} />
              <Route path="/ai-reports" element={<AIReports />} />
              <Route path="/settings" element={<Settings />} />
              
              {/* Legacy Aliases */}
              <Route path="/sales-queue" element={<Navigate to="/inbox" replace />} />
              <Route path="/leads-table" element={<Navigate to="/leads" replace />} />
              
              {/* Master Data Routing */}
              <Route path="/master-data" element={<Navigate to="/master-data/catalog" replace />} />
              <Route path="/master-data/catalog" element={<LineItemCatalog />} />
              <Route path="/master-data/requirements" element={<Requirements />} />
              <Route path="/master-data/line-items" element={<LineItems />} />
              <Route path="/master-data/construction-items" element={<ConstructionItems />} />
              <Route path="/master-data/pricing" element={<Pricing />} />
              <Route path="/master-data/quote-templates" element={<QuotationTemplateManager />} />
              <Route path="/master-data/lead-sources" element={<LeadSources />} />
              <Route path="/master-data/kpis" element={<Kpis />} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
