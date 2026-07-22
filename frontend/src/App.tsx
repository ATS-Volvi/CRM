import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import { SalesLayout } from "./components/SalesLayout";

// Page Imports
import ManagementDashboard from "./pages/ManagementDashboard";
import MyDashboard from "./pages/MyDashboard";
import KpiDashboard from "./pages/KpiDashboard";
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
import Customers from "./pages/Customers";
import AIReports from "./pages/AIReports";
import Settings from "./pages/Settings";
import LeadCreate from "./pages/LeadCreate";
import ActivitiesHub from "./pages/ActivitiesHub";
import CommunicationCenter from "./pages/CommunicationCenter";
import WorkflowAutomation from "./pages/WorkflowAutomation";
import ExecutiveDashboard from "./pages/ExecutiveDashboard";
import RepPortal from "./pages/RepPortal";
import ManagerPortal from "./pages/ManagerPortal";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { Navigate, Outlet } from "react-router-dom";

const ProtectedRoute = () => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
};

/** Dynamic Layout Selector: SalesLayout for reps, standard Layout for managers/admins */
const RoleBasedLayout = () => {
  const { user } = useAuth();
  if (user?.role === "sales_rep") {
    return <SalesLayout />;
  }
  return <Layout />;
};

/** Redirect / to appropriate workspace based on user role */
const RoleBasedHome = () => {
  const { user } = useAuth();
  if (user && user.role === "sales_rep") {
    return <Navigate to="/rep-portal" replace />;
  }
  if (user && user.role === "sales_manager") {
    return <Navigate to="/manager-portal" replace />;
  }
  return <ManagementDashboard />;
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
                <Route path="/kpi" element={<KpiDashboard />} />
                <Route path="/leads" element={<LeadInbox />} />
                <Route path="/leads/new" element={<LeadCreate />} />
                <Route path="/leads/:id" element={<LeadDetail />} />
                <Route path="/pipeline" element={<PipelineKanban />} />
                <Route path="/quotes/new" element={<QuotationBuilder />} />
                <Route path="/quotes" element={<QuoteHistory />} />
                <Route path="/invoices" element={<Invoices />} />
                <Route path="/invoices/:id" element={<InvoiceDetail />} />
                <Route path="/price-book" element={<PriceBook />} />
                <Route path="/purchase-orders" element={<PurchaseOrders />} />
                <Route path="/approvals" element={<ApprovalQueue />} />
                <Route path="/rules" element={<AssignmentRules />} />
                <Route path="/salespersons" element={<SalespersonTracker />} />
                <Route path="/salespersons/:id" element={<SalespersonDetail />} />
                <Route path="/customers" element={<Customers />} />
                <Route path="/activities" element={<ActivitiesHub />} />
                <Route path="/communications" element={<CommunicationCenter />} />
                <Route path="/automation" element={<WorkflowAutomation />} />
                <Route path="/executive-bi" element={<ExecutiveDashboard />} />
                <Route path="/rep-portal" element={<RepPortal />} />
                <Route path="/manager-portal" element={<ManagerPortal />} />
                <Route path="/ai-reports" element={<AIReports />} />
                <Route path="/settings" element={<Settings />} />
                
                {/* Master Data Routing */}
                <Route path="/master-data/requirements" element={<Requirements />} />
                <Route path="/master-data/line-items" element={<LineItems />} />
                <Route path="/master-data/construction-items" element={<ConstructionItems />} />
                <Route path="/master-data/pricing" element={<Pricing />} />
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
