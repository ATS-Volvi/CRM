import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { apiClient } from "../lib/apiClient";
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
  ChevronDown,
  LayoutList,
  UserCheck
} from "lucide-react";
import { formatCurrency } from "../utils/currency";

export default function Accounts() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { id: paramId } = useParams<{ id: string }>();

  // Fetch all accounts
  const { data: accountsData, isLoading, error, refetch } = useQuery({
    queryKey: ["accounts"],
    queryFn: async () => {
      const res = await apiClient.get<any[]>("/api/v1/accounts");
      return Array.isArray(res) ? res : [];
    }
  });

  const accounts = useMemo(() => {
    return Array.isArray(accountsData) ? accountsData : [];
  }, [accountsData]);

  // Selected Account ID (defaults to paramId, or Acme Corp, or first account)
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");

  const activeAccount = useMemo(() => {
    if (paramId) {
      const found = accounts.find((a) => a.id === paramId);
      if (found) return found;
    }
    if (selectedAccountId) {
      const found = accounts.find((a) => a.id === selectedAccountId);
      if (found) return found;
    }
    // Default to Acme Corp if exists, or first account
    const acme = accounts.find((a) => (a.name || "").toLowerCase().includes("acme"));
    return acme || accounts[0] || {
      id: "acme-default",
      name: "Acme Corp",
      industry: "Technology",
      address: "San Francisco, CA",
      website: "acmecorp.com",
      status: "NEW LEAD",
      description: "Leading provider of enterprise cloud solutions and managed IT services for the modern workforce.",
      about: "Acme Corp is a multinational technology conglomerate specializing in enterprise software, cloud infrastructure, and data analytics. Founded in 2010, they have rapidly expanded their footprint in the North American and European markets. They are currently looking to upgrade their legacy systems and migrate core operations to a more robust cloud architecture."
    };
  }, [accounts, paramId, selectedAccountId]);

  // Deals tab filter: Active, Closed, Lost
  const [dealTab, setDealTab] = useState<"Active" | "Closed" | "Lost">("Active");

  // Search filter
  const [searchFilter, setSearchFilter] = useState("");
  const [viewMode, setViewMode] = useState<"profile" | "directory">("profile");

  // Modals state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);

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
    email: ""
  });

  // Mutations
  const updateAccountMutation = useMutation({
    mutationFn: async (updatedData: any) => {
      return apiClient.put(`/api/v1/accounts/${activeAccount.id}`, updatedData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      setIsEditModalOpen(false);
    }
  });

  const addNoteMutation = useMutation({
    mutationFn: async (notes: string) => {
      return apiClient.post(`/api/v1/activities`, {
        customerId: activeAccount.id,
        type: "note",
        outcome: notes,
        isCompleted: true
      });
    },
    onSuccess: () => {
      setNoteContent("");
      setIsNoteModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
    }
  });

  const addTaskMutation = useMutation({
    mutationFn: async (task: any) => {
      return apiClient.post(`/api/v1/activities`, {
        customerId: activeAccount.id,
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
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
    }
  });

  const addContactMutation = useMutation({
    mutationFn: async (contact: any) => {
      return apiClient.post(`/api/v1/contacts`, {
        accountId: activeAccount.id,
        ...contact
      });
    },
    onSuccess: () => {
      setContactForm({ firstName: "", lastName: "", role: "", email: "", phone: "" });
      setIsContactModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
    }
  });

  // Default Mockup Deals for Acme Corp or account deals
  const accountDeals = useMemo(() => {
    const raw = Array.isArray(activeAccount?.deals) && activeAccount.deals.length > 0 ? activeAccount.deals : [];
    if (raw.length > 0) return raw;
    return [
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
  }, [activeAccount]);

  // Filter deals based on tab: Active, Closed, Lost
  const filteredDeals = useMemo(() => {
    return accountDeals.filter((d: any) => {
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
  }, [accountDeals, dealTab]);

  // Contacts
  const accountContacts = useMemo(() => {
    if (Array.isArray(activeAccount?.contacts) && activeAccount.contacts.length > 0) {
      return activeAccount.contacts;
    }
    return [
      {
        id: "contact-1",
        firstName: "Sarah",
        lastName: "Jenkins",
        role: "VP of Engineering",
        email: "sarah.j@acmecorp.com",
        phone: "+1 (555) 234-5678"
      }
    ];
  }, [activeAccount]);

  const primaryContact = accountContacts[0];

  // Pipeline metrics
  const activeDealsList = accountDeals.filter((d: any) => {
    const s = (d.status || "").toUpperCase();
    return s !== "LOST" && !((d.stage?.name || "").toLowerCase().includes("lost"));
  });
  const totalPipeline = activeDealsList.reduce((sum: number, d: any) => sum + (Number(d.amount || d.value) || 0), 0) || 1200000;
  const activeDealsCount = activeDealsList.length || 4;
  const avgDealSize = activeDealsCount > 0 ? Math.round(totalPipeline / activeDealsCount) : 300000;

  const nameInitial = (activeAccount?.name || "Acme Corp").trim().charAt(0).toUpperCase();

  if (isLoading) {
    return (
      <div className="p-16 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
        <span className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        Loading Company Profile...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 max-w-xl mx-auto my-12 bg-rose-50 border border-rose-200 rounded-2xl p-6 text-center space-y-4 shadow-sm">
        <h3 className="text-base font-bold text-rose-900">Failed to Load Accounts</h3>
        <p className="text-xs text-rose-700">{(error as any).message || "An error occurred."}</p>
        <button
          onClick={() => refetch()}
          className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto font-sans bg-slate-50/50 min-h-screen">
      {/* ── TOP HEADER BAR ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Company Profile</h1>

          {/* Quick Account Switcher Dropdown */}
          {accounts.length > 0 && (
            <div className="relative">
              <select
                value={activeAccount.id}
                onChange={(e) => {
                  setSelectedAccountId(e.target.value);
                  navigate(`/accounts/${e.target.value}`);
                }}
                className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700 hover:border-slate-300 shadow-2xs focus:outline-none cursor-pointer"
              >
                {accounts.map((a: any) => (
                  <option key={a.id} value={a.id}>
                    {a.name || "Untitled Account"}
                  </option>
                ))}
              </select>
            </div>
          )}
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
          {/* Company Logo & Details */}
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
                  {activeAccount.name || "Acme Corp"}
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                  NEW LEAD
                </span>
              </div>

              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                <Globe className="w-3.5 h-3.5 text-slate-400" />
                <a
                  href={`https://${activeAccount.website || "acmecorp.com"}`}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-blue-600 hover:underline"
                >
                  {activeAccount.website || (activeAccount.name ? `${activeAccount.name.toLowerCase().replace(/[^a-z0-9]/g, "")}.com` : "acmecorp.com")}
                </a>
              </div>

              <p className="text-xs text-slate-500 font-normal leading-relaxed pt-1 max-w-2xl">
                {activeAccount.description || "Leading provider of enterprise cloud solutions and managed IT services for the modern workforce."}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0 self-start md:self-auto">
            <button
              onClick={() => {
                setEditForm({
                  name: activeAccount.name || "",
                  industry: activeAccount.industry || "",
                  address: activeAccount.address || "",
                  phone: activeAccount.phone || "",
                  email: activeAccount.email || ""
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
              ${(totalPipeline / 1000000).toFixed(1)}M
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
              {activeAccount.about ||
                `${activeAccount.name || "Acme Corp"} is a multinational technology conglomerate specializing in enterprise software, cloud infrastructure, and data analytics. Founded in 2010, they have rapidly expanded their footprint in the North American and European markets. They are currently looking to upgrade their legacy systems and migrate core operations to a more robust cloud architecture.`}
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
                    filteredDeals.map((deal: any) => {
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
                <span className="font-bold text-slate-800">{activeAccount.industry || "Technology"}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-medium">Size</span>
                <span className="font-bold text-slate-800">1,000 - 5,000</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-medium">Revenue</span>
                <span className="font-bold text-slate-800">$50M - $100M</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-medium">HQ Location</span>
                <span className="font-bold text-slate-800 flex items-center gap-1">
                  <span>{activeAccount.address || "San Francisco, CA"}</span>
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                </span>
              </div>
            </div>
          </div>

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
                    {(primaryContact?.firstName || "S").charAt(0)}{(primaryContact?.lastName || "J").charAt(0)}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-900">
                      {primaryContact?.firstName} {primaryContact?.lastName}
                    </div>
                    <div className="text-xs text-slate-500 font-medium">
                      {primaryContact?.role || "VP of Engineering"}
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200/50 space-y-1 text-xs text-slate-600">
                  <div className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    <a
                      href={`mailto:${primaryContact?.email || "sarah.j@acmecorp.com"}`}
                      className="hover:text-blue-600 hover:underline"
                    >
                      {primaryContact?.email || "sarah.j@acmecorp.com"}
                    </a>
                  </div>
                  {primaryContact?.phone && (
                    <div className="flex items-center gap-2 text-slate-500">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <span>{primaryContact.phone}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Other Contacts if available */}
              {accountContacts.length > 1 && (
                <div className="mt-3 space-y-2">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    OTHER CONTACTS ({accountContacts.length - 1})
                  </div>
                  {accountContacts.slice(1).map((c: any) => (
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
    </div>
  );
}
