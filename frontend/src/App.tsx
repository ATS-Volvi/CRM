import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";

// Page Imports
import ManagementDashboard from "./pages/ManagementDashboard";
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

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/quote" element={<PublicQuoteRequest />} />
          <Route element={<Layout />}>
            <Route path="/" element={<ManagementDashboard />} />
            <Route path="/kpi" element={<KpiDashboard />} />
            <Route path="/leads" element={<LeadInbox />} />
            <Route path="/leads/:id" element={<LeadDetail />} />
            <Route path="/pipeline" element={<PipelineKanban />} />
            <Route path="/quotes/new" element={<QuotationBuilder />} />
            <Route path="/quotes" element={<QuoteHistory />} />
            <Route path="/price-book" element={<PriceBook />} />
            <Route path="/purchase-orders" element={<PurchaseOrders />} />
            <Route path="/approvals" element={<ApprovalQueue />} />
            <Route path="/rules" element={<AssignmentRules />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
