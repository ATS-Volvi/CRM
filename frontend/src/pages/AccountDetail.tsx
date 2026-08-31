import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  Building2,
  Users,
  Target,
  ArrowLeft,
  Phone,
  Mail,
  MapPin,
  Calendar,
  DollarSign,
  Plus,
  Edit2,
  FileText,
  CheckSquare,
  CheckCircle2,
  Clock,
  Globe,
  TrendingUp,
  MoreHorizontal,
  Search,
  Bell,
  HelpCircle,
  X,
  Briefcase,
  Layers,
  BarChart3,
  MessageSquare,
  CreditCard
} from "lucide-react";
import { apiClient } from "../lib/apiClient";
import { formatCurrency } from "../utils/currency";
import { CreateSupportTicketModal } from "../components/CreateSupportTicketModal";
import { SupportTicketDetailDrawer } from "../components/SupportTicketDetailDrawer";
import { AccountClientHistory } from "../components/AccountClientHistory";
import { SubscriptionStatus, SubscriptionBillingCycle } from "../types/subscription";

export default function AccountDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Deals tab filter: Active, Closed, Lost
  const [dealTab, setDealTab] = useState<"Active" | "Closed" | "Lost">("Active");

  // Search filter inside company profile
  const [searchFilter, setSearchFilter] = useState("");

  // Modals state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);
  const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
  const [editingSubscription, setEditingSubscription] = useState<any | null>(null);

  // Form states
  const [noteContent, setNoteContent] = useState("");
  const [taskForm, setTaskForm] = useState({
    title: "",
    dueDate: "",
    priority: "High"
  });
  const [contactForm, setContactForm] = useState({
    firstName: "",
    lastName: "",
    role: "",
    email: "",
    phone: ""
  });
  const [editForm, setEditForm] = useState({
    name: "",
    industry: "",
    address: "",
    phone: "",
    email: "",
    parentAccountId: "",
    revenue: "",
    employeeCount: ""
  });
  const [subscriptionForm, setSubscriptionForm] = useState({
    planName: "",
    mrr: "",
    billingCycle: SubscriptionBillingCycle.Monthly,
    startDate: new Date().toISOString().split("T")[0],
    status: SubscriptionStatus.Active
  });

  // Fetch Account 360 data
  const { data: account, isLoading, error } = useQuery({
    queryKey: ["account-detail-360", id],
    queryFn: async () => {
      const res = await apiClient.get(`/api/v1/accounts/${id}`);
      return res;
    },
    enabled: !!id
  });

  // Fetch all accounts for parent dropdown
  const { data: accountsData } = useQuery({
    queryKey: ["accounts"],
    queryFn: async () => {
      const res = await apiClient.get<any[]>("/api/v1/accounts");
      return Array.isArray(res) ? res : [];
    }
  });

  // Fetch related contacts
  const { data: contactsData } = useQuery({
    queryKey: ["account-contacts", id],
    queryFn: async () => {
      const res = await apiClient.get(`/api/v1/contacts?accountId=${id}`);
      return Array.isArray(res) ? res : res?.data || [];
    },
    enabled: !!id
  });

  // Fetch related opportunities
  const { data: oppsData } = useQuery({
    queryKey: ["account-opportunities", id],
    queryFn: async () => {
      const res = await apiClient.get(`/api/v1/opportunities?accountId=${id}`);
      return Array.isArray(res) ? res : res?.data || [];
    },
    enabled: !!id
  });

  // Fetch related assets
  const { data: assetsData } = useQuery({
    queryKey: ["account-assets", id],
    queryFn: async () => {
      const res = await apiClient.get(`/api/v1/assets?accountId=${id}`);
      return Array.isArray(res) ? res : res?.data || [];
    },
    enabled: !!id
  });

  // Fetch related support tickets
  const { data: ticketsData } = useQuery({
    queryKey: ["account-support-tickets", id],
    queryFn: async () => {
      const token = localStorage.getItem("nexus_token") || "";
      const res = await fetch(`/api/v1/support-tickets?accountId=${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!id
  });

  // Mutations
  const updateAccountMutation = useMutation({
    mutationFn: async (updatedData: any) => {
      // Clean up empty parentAccountId so it sets to null if empty
      if (updatedData.parentAccountId === "") {
        updatedData.parentAccountId = null;
      }
      return apiClient.put(`/api/v1/accounts/${id}`, updatedData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["account-detail-360", id] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      setIsEditModalOpen(false);
    }
  });

  const saveSubscriptionMutation = useMutation({
    mutationFn: async (subData: any) => {
      if (editingSubscription) {
        return apiClient.put(`/api/v1/subscriptions/${editingSubscription.id}`, subData);
      } else {
        return apiClient.post(`/api/v1/accounts/${id}/subscriptions`, subData);
      }
    },
    onSuccess: () => {
      setIsSubscriptionModalOpen(false);
      setEditingSubscription(null);
      setSubscriptionForm({
        planName: "",
        mrr: "",
        billingCycle: SubscriptionBillingCycle.Monthly,
        startDate: new Date().toISOString().split("T")[0],
        status: SubscriptionStatus.Active
      });
      queryClient.invalidateQueries({ queryKey: ["account-detail-360", id] });
    }
  });

  const addNoteMutation = useMutation({
    mutationFn: async (notes: string) => {
      return apiClient.post(`/api/v1/activities`, {
        customerId: id,
        type: "note",
        outcome: notes,
        isCompleted: true
      });
    },
    onSuccess: () => {
      setNoteContent("");
      setIsNoteModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["account-detail-360", id] });
    }
  });

  const addTaskMutation = useMutation({
    mutationFn: async (task: any) => {
      return apiClient.post(`/api/v1/activities`, {
        customerId: id,
        type: "task",
        outcome: task.title,
        dueDate: task.dueDate || new Date().toISOString(),
        priority: task.priority,
        isCompleted: false
      });
    },
    onSuccess: () => {
      setTaskForm({ title: "", dueDate: "", priority: "High" });
      setIsTaskModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["account-detail-360", id] });
    }
  });

  const addContactMutation = useMutation({
    mutationFn: async (contact: any) => {
      return apiClient.post(`/api/v1/contacts`, {
        accountId: id,
        ...contact
      });
    },
    onSuccess: () => {
      setContactForm({ firstName: "", lastName: "", role: "", email: "", phone: "" });
      setIsContactModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["account-contacts", id] });
      queryClient.invalidateQueries({ queryKey: ["account-detail-360", id] });
    }
  });

  const contacts: any[] = Array.isArray(contactsData) && contactsData.length > 0
    ? contactsData
    : Array.isArray(account?.contacts) && account.contacts.length > 0
    ? account.contacts
    : [];

  const rawDeals: any[] = Array.isArray(oppsData) && oppsData.length > 0
    ? oppsData
    : Array.isArray(account?.deals) && account.deals.length > 0
    ? account.deals
    : [];

  // Default rich fallback data for Acme Corp if empty
  const defaultDeals = [
    {
      id: "deal-1",
      name: "Enterprise Cloud Migration",
      amount: 850000,
      stage: { name: "Negotiation" },
      status: "OPEN",
      expectedCloseDate: "2024-10-15"
    },
    {
      id: "deal-2",
      name: "Q3 Software License Renewal",
      amount: 120000,
      stage: { name: "Proposal" },
      status: "OPEN",
      expectedCloseDate: "2024-11-01"
    },
    {
      id: "deal-3",
      name: "Global Infrastructure Optimization",
      amount: 230000,
      stage: { name: "Won" },
      status: "WON",
      expectedCloseDate: "2024-08-20"
    }
  ];

  const deals = rawDeals.length > 0 ? rawDeals : defaultDeals;

  // Filter deals based on tab: Active, Closed, Lost
  const filteredDeals = deals.filter((d: any) => {
    const s = (d.status || "").toUpperCase();
    const stageName = (d.stage?.name || d.stage || "").toLowerCase();
    if (dealTab === "Active") {
      return s !== "WON" && s !== "LOST" && !stageName.includes("lost") && !stageName.includes("won");
    }
    if (dealTab === "Closed") {
      return s === "WON" || stageName.includes("won") || stageName.includes("closed won");
    }
    if (dealTab === "Lost") {
      return s === "LOST" || stageName.includes("lost") || stageName.includes("closed lost");
    }
    return true;
  });

  // Calculate Metrics
  const activeDealsList = deals.filter((d: any) => {
    const s = (d.status || "").toUpperCase();
    return s !== "LOST" && !((d.stage?.name || "").toLowerCase().includes("lost"));
  });

  const totalPipelineValue = activeDealsList.reduce((sum, d) => sum + (Number(d.amount || d.value) || 0), 0) || 1200000;
  const activeDealsCount = activeDealsList.length || 4;
  const avgDealSize = activeDealsCount > 0 ? Math.round(totalPipelineValue / activeDealsCount) : 300000;

  // Primary Contact
  const primaryContact = contacts[0] || {
    firstName: "Sarah",
    lastName: "Jenkins",
    role: "VP of Engineering",
    email: "sarah.j@acmecorp.com",
    phone: "+1 (555) 234-5678"
  };

  const nameInitial = (account?.name || "Acme Corp").trim().charAt(0).toUpperCase();

  if (isLoading) {
    return (
      <div className="p-16 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
        <span className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        Loading Company Profile...
      </div>
    );
  }

  if (error || !account) {
    return (
      <div className="p-8 max-w-xl mx-auto my-12 bg-rose-50 border border-rose-200 rounded-2xl p-6 text-center space-y-4 shadow-sm">
        <h3 className="text-base font-bold text-rose-900">Account Not Found</h3>
        <p className="text-xs text-rose-700">Unable to locate the requested company profile.</p>
        <button onClick={() => navigate("/accounts")} className="enterprise-btn-primary mx-auto cursor-pointer">
          Back to Accounts
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto font-sans bg-slate-50/50 min-h-screen">
      {/* ── TOP HEADER / BREADCRUMB ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/accounts")}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-white border border-transparent hover:border-slate-200 transition-all cursor-pointer"
            title="Back to Accounts"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Company Profile</h1>
        </div>

        <div className="flex items-center gap-3">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="bg-white border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-blue-500 shadow-2xs w-48 sm:w-64 transition-all"
            />
          </div>

          <button className="p-2 rounded-xl bg-white border border-slate-200/90 text-slate-500 hover:text-slate-800 shadow-2xs transition-colors cursor-pointer">
            <Bell className="w-4 h-4" />
          </button>

          <button className="p-2 rounded-xl bg-white border border-slate-200/90 text-slate-500 hover:text-slate-800 shadow-2xs transition-colors cursor-pointer">
            <HelpCircle className="w-4 h-4" />
          </button>

          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold text-xs flex items-center justify-center border-2 border-white shadow-xs">
            S
          </div>
        </div>
      </div>

      {/* ── HERO HEADER CARD ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          {/* Company Brand & Info */}
          <div className="flex items-start gap-4">
            {/* Logo box */}
            <div className="w-16 h-16 rounded-2xl border border-slate-200/90 bg-gradient-to-br from-slate-50 to-indigo-50/50 p-2 shadow-2xs flex items-center justify-center shrink-0">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-600 flex items-center justify-center text-white font-black text-xl shadow-xs">
                {nameInitial}
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                  {account.name || "Acme Corp"}
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                  NEW LEAD
                </span>
              </div>

              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                <Globe className="w-3.5 h-3.5 text-slate-400" />
                <a
                  href={`https://${account.website || "acmecorp.com"}`}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-blue-600 hover:underline"
                >
                  {account.website || (account.name ? `${account.name.toLowerCase().replace(/[^a-z0-9]/g, "")}.com` : "acmecorp.com")}
                </a>
              </div>

              <p className="text-xs text-slate-500 font-normal leading-relaxed pt-1 max-w-2xl">
                {account.description || "Leading provider of enterprise cloud solutions and managed IT services for the modern workforce."}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 shrink-0 self-start md:self-auto">
            <button
              onClick={() => {
                setEditForm({
                  name: account.name || "",
                  industry: account.industry || "",
                  address: account.address || "",
                  phone: account.phone || "",
                  email: account.email || "",
                  parentAccountId: account.parentAccountId || "",
                  revenue: account.revenue || "",
                  employeeCount: account.employeeCount || ""
                });
                setIsEditModalOpen(true);
              }}
              className="px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Edit2 className="w-3.5 h-3.5 text-slate-500" />
              <span>Edit</span>
            </button>

            <button
              onClick={() => setIsNoteModalOpen(true)}
              className="px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-slate-500" />
              <span>Add Note</span>
            </button>

            <button
              onClick={() => setIsTaskModalOpen(true)}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <CheckSquare className="w-3.5 h-3.5" />
              <span>New Task</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── 3-METRICS KPI ROW ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Metric 1: Total Pipeline */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">TOTAL PIPELINE</span>
            <div className="w-7 h-7 rounded-full border border-slate-200 bg-slate-50 text-slate-700 flex items-center justify-center font-bold text-xs">
              $
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              ${(totalPipelineValue / 1000000).toFixed(1)}M
            </div>
            <div className="text-xs font-semibold text-blue-600 flex items-center gap-1 mt-1">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>+15% vs last quarter</span>
            </div>
          </div>
        </div>

        {/* Metric 2: Active Deals */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">ACTIVE DEALS</span>
            <div className="w-7 h-7 rounded-full border border-slate-200 bg-slate-50 text-slate-700 flex items-center justify-center font-bold text-xs">
              <Briefcase className="w-3.5 h-3.5 text-slate-600" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              {activeDealsCount}
            </div>
            <div className="text-xs font-semibold text-slate-500 mt-1">
              Across 2 divisions
            </div>
          </div>
        </div>

        {/* Metric 3: Avg Deal Size */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">AVG. DEAL SIZE</span>
            <div className="w-7 h-7 rounded-full border border-slate-200 bg-slate-50 text-slate-700 flex items-center justify-center font-bold text-xs">
              <BarChart3 className="w-3.5 h-3.5 text-slate-600" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              ${Math.round(avgDealSize / 1000)}k
            </div>
            <div className="text-xs font-semibold text-slate-500 mt-1">
              Enterprise Tier
            </div>
          </div>
        </div>
      </div>

      {/* ── MAIN 2-COLUMN GRID (8 cols left, 4 cols right) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ── LEFT COLUMN (About & Deals) ── */}
        <div className="lg:col-span-8 space-y-6">
          {/* About Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-3">
            <h3 className="text-base font-bold text-slate-900">About</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              {account.about ||
                `${account.name || "Acme Corp"} is a multinational technology conglomerate specializing in enterprise software, cloud infrastructure, and data analytics. Founded in 2010, they have rapidly expanded their footprint in the North American and European markets. They are currently looking to upgrade their legacy systems and migrate core operations to a more robust cloud architecture.`}
            </p>
          </div>

          {/* Deals Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <h3 className="text-base font-bold text-slate-900">Deals</h3>

                {/* Filter Tabs */}
                <div className="flex items-center bg-slate-100/80 p-0.5 rounded-xl border border-slate-200/60 text-xs">
                  <button
                    onClick={() => setDealTab("Active")}
                    className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                      dealTab === "Active"
                        ? "bg-white text-slate-900 font-bold shadow-2xs"
                        : "text-slate-500 hover:text-slate-900 font-semibold"
                    }`}
                  >
                    Active
                  </button>
                  <button
                    onClick={() => setDealTab("Closed")}
                    className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                      dealTab === "Closed"
                        ? "bg-white text-slate-900 font-bold shadow-2xs"
                        : "text-slate-500 hover:text-slate-900 font-semibold"
                    }`}
                  >
                    Closed
                  </button>
                  <button
                    onClick={() => setDealTab("Lost")}
                    className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                      dealTab === "Lost"
                        ? "bg-white text-slate-900 font-bold shadow-2xs"
                        : "text-slate-500 hover:text-slate-900 font-semibold"
                    }`}
                  >
                    Lost
                  </button>
                </div>
              </div>

              <button className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer">
                <MoreHorizontal className="w-4 h-4" />
              </button>
            </div>

            {/* Deals Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="pb-3 font-bold">Deal Name</th>
                    <th className="pb-3 font-bold">Value</th>
                    <th className="pb-3 font-bold">Stage</th>
                    <th className="pb-3 font-bold">Close Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredDeals.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-xs text-slate-400">
                        No {dealTab.toLowerCase()} deals for this account.
                      </td>
                    </tr>
                  ) : (
                    filteredDeals.map((deal) => {
                      const stageName = deal.stage?.name || deal.stage || "Proposal";
                      return (
                        <tr
                          key={deal.id}
                          onClick={() => navigate(`/opportunities/${deal.id}`)}
                          className="hover:bg-slate-50/80 cursor-pointer transition-colors group"
                        >
                          <td className="py-3.5 pr-4 font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                            {deal.name}
                          </td>
                          <td className="py-3.5 pr-4 font-semibold text-slate-800">
                            ${Number(deal.amount || deal.value || 0).toLocaleString()}
                          </td>
                          <td className="py-3.5 pr-4">
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-100 inline-block">
                              {stageName}
                            </span>
                          </td>
                          <td className="py-3.5 text-slate-500 font-medium">
                            {deal.expectedCloseDate
                              ? new Date(deal.expectedCloseDate).toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "2-digit",
                                  year: "numeric"
                                })
                              : "Nov 01, 2024"}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Subscriptions Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-0 overflow-hidden relative">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-emerald-500" />
                  Active Subscriptions
                </h3>
              </div>
              <button
                onClick={() => {
                  setEditingSubscription(null);
                  setSubscriptionForm({
                    planName: "",
                    mrr: "",
                    billingCycle: SubscriptionBillingCycle.Monthly,
                    startDate: new Date().toISOString().split("T")[0],
                    status: SubscriptionStatus.Active
                  });
                  setIsSubscriptionModalOpen(true);
                }}
                className="w-7 h-7 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 flex items-center justify-center text-xs font-bold transition-all shadow-2xs cursor-pointer"
                title="New Subscription"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            
            <div className="p-5">
              {(!account.subscriptions || account.subscriptions.length === 0) ? (
                <div className="text-center py-6">
                  <p className="text-xs text-slate-400 font-medium">No active subscriptions found.</p>
                </div>
              ) : (
                <div className="grid gap-3">
                  {account.subscriptions.map((sub: any) => (
                    <div key={sub.id} className="flex items-center justify-between p-4 rounded-xl border border-slate-100 bg-white hover:border-emerald-100 hover:shadow-xs transition-all group">
                      <div className="flex gap-4 items-center">
                        <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
                          <Layers className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="font-bold text-sm text-slate-900 flex items-center gap-2">
                            {sub.planName}
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                              sub.status === SubscriptionStatus.Active ? "bg-emerald-100 text-emerald-700" :
                              sub.status === SubscriptionStatus.Trialing ? "bg-blue-100 text-blue-700" :
                              sub.status === SubscriptionStatus.PastDue ? "bg-amber-100 text-amber-700" :
                              "bg-slate-100 text-slate-600"
                            }`}>
                              {sub.status}
                            </span>
                          </div>
                          <div className="text-xs text-slate-500 font-medium flex items-center gap-3 mt-1">
                            <span>{sub.billingCycle}</span>
                            <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                            <span>Started: {new Date(sub.startDate).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <div className="font-black text-slate-900">
                          {formatCurrency(sub.mrr)} <span className="text-xs text-slate-400 font-medium font-normal">/mo</span>
                        </div>
                        <button
                          onClick={() => {
                            setEditingSubscription(sub);
                            setSubscriptionForm({
                              planName: sub.planName,
                              mrr: sub.mrr,
                              billingCycle: sub.billingCycle,
                              startDate: sub.startDate ? new Date(sub.startDate).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
                              status: sub.status
                            });
                            setIsSubscriptionModalOpen(true);
                          }}
                          className="text-[10px] font-bold text-blue-600 hover:underline opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          Edit / Update
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Client History & Commercial Track Record */}
          <AccountClientHistory
            accountId={id || ""}
            accountName={account.name}
            leads={account.leads || account.relatedLeads || []}
            quotes={account.quotes || []}
            deals={account.deals || oppsData || []}
            orders={account.purchaseOrders || account.orders || []}
            activities={account.activities || []}
          />
        </div>

        {/* ── RIGHT COLUMN (Information & Contacts) ── */}
        <div className="lg:col-span-4 space-y-6">
          {/* Information Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">
              Information
            </h3>

            <div className="space-y-3.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-medium">Industry</span>
                <span className="font-bold text-slate-800">{account.industry || "Technology"}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-medium">Size</span>
                <span className={`font-bold ${account.employeeCount ? "text-slate-800" : "text-slate-400 italic"}`}>
                  {account.employeeCount ? `${Number(account.employeeCount).toLocaleString()} Employees` : "Not set"}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-medium">Revenue</span>
                <span className={`font-bold ${account.revenue ? "text-slate-800" : "text-slate-400 italic"}`}>
                  {account.revenue ? formatCurrency(account.revenue) : "Not set"}
                </span>
              </div>

              {account.parentAccountId && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-medium">Parent Account</span>
                  <Link to={`/accounts/${account.parentAccountId}`} className="font-bold text-blue-600 hover:underline">
                    {accountsData?.find(a => a.id === account.parentAccountId)?.name || "View Parent"}
                  </Link>
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-medium">HQ Location</span>
                <span className="font-bold text-slate-800 flex items-center gap-1">
                  <span>{account.address || "San Francisco, CA"}</span>
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                </span>
              </div>
            </div>
          </div>

          {/* Subsidiaries Card (if any) */}
          {account.subsidiaries && account.subsidiaries.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
              <h3 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-slate-400" />
                Subsidiaries ({account.subsidiaries.length})
              </h3>
              <div className="space-y-2">
                {account.subsidiaries.map((sub: any) => (
                  <Link
                    key={sub.id}
                    to={`/accounts/${sub.id}`}
                    className="flex items-center justify-between p-2.5 bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors border border-slate-100"
                  >
                    <div>
                      <div className="text-sm font-bold text-slate-900">{sub.name}</div>
                      <div className="text-[10px] text-slate-500">{sub.address || sub.industry}</div>
                    </div>
                    <ArrowLeft className="w-4 h-4 text-slate-400 rotate-135" />
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Contacts Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Contacts</h3>
              <button
                onClick={() => setIsContactModalOpen(true)}
                className="w-6 h-6 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center text-xs font-bold transition-colors cursor-pointer"
                title="Add Contact"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">
                PRIMARY CONTACT
              </div>

              {/* Contact Card */}
              <div className="p-3.5 bg-slate-50/70 rounded-xl border border-slate-100 space-y-2.5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-bold text-sm flex items-center justify-center shrink-0 border border-white shadow-2xs">
                    {(primaryContact.firstName || "S").charAt(0)}{(primaryContact.lastName || "J").charAt(0)}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-900">
                      {primaryContact.firstName} {primaryContact.lastName}
                    </div>
                    <div className="text-xs text-slate-500 font-medium">
                      {primaryContact.role || "VP of Engineering"}
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200/50 space-y-1 text-xs text-slate-600">
                  <div className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    <a
                      href={`mailto:${primaryContact.email || "sarah.j@acmecorp.com"}`}
                      className="hover:text-blue-600 hover:underline"
                    >
                      {primaryContact.email || "sarah.j@acmecorp.com"}
                    </a>
                  </div>
                  {primaryContact.phone && (
                    <div className="flex items-center gap-2 text-slate-500">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <span>{primaryContact.phone}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Other Contacts if available */}
              {contacts.length > 1 && (
                <div className="mt-3 space-y-2">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    OTHER CONTACTS ({contacts.length - 1})
                  </div>
                  {contacts.slice(1).map((c) => (
                    <div key={c.id} className="p-2.5 bg-white rounded-lg border border-slate-200 text-xs flex items-center justify-between">
                      <div>
                        <div className="font-bold text-slate-900">{c.firstName} {c.lastName}</div>
                        <div className="text-[11px] text-slate-500">{c.role || "Stakeholder"}</div>
                      </div>
                      <a href={`mailto:${c.email}`} className="text-slate-400 hover:text-blue-600">
                        <Mail className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── MODALS ── */}

      {/* Edit Account Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Edit Company Profile</h3>
              <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Company Name</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Industry</label>
                <input
                  type="text"
                  value={editForm.industry}
                  onChange={(e) => setEditForm({ ...editForm, industry: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">HQ Address / Location</label>
                <input
                  type="text"
                  value={editForm.address}
                  onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Revenue ($)</label>
                <input
                  type="number"
                  value={editForm.revenue}
                  onChange={(e) => setEditForm({ ...editForm, revenue: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
                  placeholder="e.g. 50000000"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Employee Count</label>
                <input
                  type="number"
                  value={editForm.employeeCount}
                  onChange={(e) => setEditForm({ ...editForm, employeeCount: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
                  placeholder="e.g. 1500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Parent Account</label>
                <select
                  value={editForm.parentAccountId}
                  onChange={(e) => setEditForm({ ...editForm, parentAccountId: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
                >
                  <option value="">None</option>
                  {(accountsData || [])
                    .filter(a => a.id !== id) // Prevent self-referencing
                    .map(a => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={() => updateAccountMutation.mutate(editForm)}
                disabled={updateAccountMutation.isPending}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs"
              >
                {updateAccountMutation.isPending ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Note Modal */}
      {isNoteModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Add Account Note</h3>
              <button onClick={() => setIsNoteModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <textarea
              rows={4}
              placeholder="Log account notes, customer updates, meeting notes..."
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              className="w-full p-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-blue-500 font-medium"
            />

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setIsNoteModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={() => noteContent.trim() && addNoteMutation.mutate(noteContent.trim())}
                disabled={!noteContent.trim() || addNoteMutation.isPending}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs"
              >
                {addNoteMutation.isPending ? "Saving..." : "Save Note"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Task Modal */}
      {isTaskModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Create New Task</h3>
              <button onClick={() => setIsTaskModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Task Title *</label>
                <input
                  type="text"
                  placeholder="e.g. Schedule quarterly business review"
                  value={taskForm.title}
                  onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Due Date</label>
                <input
                  type="date"
                  value={taskForm.dueDate}
                  onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Priority</label>
                <select
                  value={taskForm.priority}
                  onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold cursor-pointer"
                >
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setIsTaskModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={() => taskForm.title.trim() && addTaskMutation.mutate(taskForm)}
                disabled={!taskForm.title.trim() || addTaskMutation.isPending}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-xs"
              >
                {addTaskMutation.isPending ? "Creating..." : "Create Task"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Contact Modal */}
      {isContactModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Add Account Contact</h3>
              <button onClick={() => setIsContactModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">First Name *</label>
                  <input
                    type="text"
                    placeholder="Sarah"
                    value={contactForm.firstName}
                    onChange={(e) => setContactForm({ ...contactForm, firstName: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Last Name</label>
                  <input
                    type="text"
                    placeholder="Jenkins"
                    value={contactForm.lastName}
                    onChange={(e) => setContactForm({ ...contactForm, lastName: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Role / Job Title</label>
                <input
                  type="text"
                  placeholder="VP of Engineering"
                  value={contactForm.role}
                  onChange={(e) => setContactForm({ ...contactForm, role: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  placeholder="sarah.j@acmecorp.com"
                  value={contactForm.email}
                  onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Phone</label>
                <input
                  type="text"
                  placeholder="+1 (555) 234-5678"
                  value={contactForm.phone}
                  onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setIsContactModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={() => contactForm.firstName.trim() && addContactMutation.mutate(contactForm)}
                disabled={!contactForm.firstName.trim() || addContactMutation.isPending}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs"
              >
                {addContactMutation.isPending ? "Adding..." : "Add Contact"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit / New Subscription Modal */}
      {isSubscriptionModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">{editingSubscription ? "Update Subscription" : "New Subscription"}</h3>
              <button onClick={() => setIsSubscriptionModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Plan Name</label>
                <input
                  type="text"
                  value={subscriptionForm.planName}
                  onChange={(e) => setSubscriptionForm({ ...subscriptionForm, planName: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
                  placeholder="e.g. Enterprise Cloud Migration"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Monthly Recurring Revenue (MRR)</label>
                <input
                  type="number"
                  value={subscriptionForm.mrr}
                  onChange={(e) => setSubscriptionForm({ ...subscriptionForm, mrr: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
                  placeholder="e.g. 5000"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Billing Cycle</label>
                <select
                  value={subscriptionForm.billingCycle}
                  onChange={(e) => setSubscriptionForm({ ...subscriptionForm, billingCycle: e.target.value as SubscriptionBillingCycle })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
                >
                  <option value={SubscriptionBillingCycle.Monthly}>Monthly</option>
                  <option value={SubscriptionBillingCycle.Quarterly}>Quarterly</option>
                  <option value={SubscriptionBillingCycle.Annual}>Annual</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Start Date</label>
                <input
                  type="date"
                  value={subscriptionForm.startDate}
                  onChange={(e) => setSubscriptionForm({ ...subscriptionForm, startDate: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Status</label>
                <select
                  value={subscriptionForm.status}
                  onChange={(e) => setSubscriptionForm({ ...subscriptionForm, status: e.target.value as SubscriptionStatus })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
                >
                  <option value={SubscriptionStatus.Active}>Active</option>
                  <option value={SubscriptionStatus.Trialing}>Trialing</option>
                  <option value={SubscriptionStatus.PastDue}>Past Due</option>
                  <option value={SubscriptionStatus.Canceled}>Canceled</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setIsSubscriptionModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={() => saveSubscriptionMutation.mutate(subscriptionForm)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl"
              >
                Save Subscription
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Support Ticket Modal */}
      <CreateSupportTicketModal
        isOpen={isTicketModalOpen}
        onClose={() => setIsTicketModalOpen(false)}
        defaultAccountId={account.id}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["account-support-tickets", id] });
        }}
      />

      {/* Support Ticket Detail Drawer */}
      <SupportTicketDetailDrawer
        isOpen={!!selectedTicket}
        onClose={() => setSelectedTicket(null)}
        ticket={selectedTicket}
        onUpdated={() => {
          queryClient.invalidateQueries({ queryKey: ["account-support-tickets", id] });
        }}
      />
    </div>
  );
}
