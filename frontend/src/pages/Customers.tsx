import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import { formatCurrency } from "../utils/currency";
import { formatDistanceToNow } from "date-fns";
import {
  Users, Search, Phone, Mail, Building2, MapPin, Globe, Sparkles, Send,
  FileText, Receipt, Calendar, CheckSquare, Plus, Clock, Zap, ArrowRight,
  TrendingUp, AlertCircle, ShieldAlert, CheckCircle2, User, UserCheck, DollarSign,
  Paperclip, Maximize2, Minimize2, ChevronRight, X, Star, FileUp, Check, Award
} from "lucide-react";
import { apiClient } from "../lib/apiClient";

export default function Customers() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const selectedId = searchParams.get("id");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Workspace UI Modes
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [activeCenterDrawer, setActiveCenterDrawer] = useState<"conversation" | "quote" | "invoice" | "meeting" | "task" | "files">("conversation");
  const [replyText, setReplyText] = useState("");

  // Quote Builder State inside Workspace
  const [quoteDealName, setQuoteDealName] = useState("Enterprise Systems Order");
  const [quoteAmount, setQuoteAmount] = useState("42500");
  const [quoteNotes, setQuoteNotes] = useState("Includes 24/7 SLA Support");

  // Fetch Customers List
  const { data: customers = [], isLoading: loadingCustomers } = useQuery<any[]>({
    queryKey: ["customers"],
    queryFn: async () => {
      const res = await fetch("/api/v1/customers", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to fetch customers");
      return res.json();
    },
    enabled: !!token
  });

  // Selected Customer Details Query
  const activeCustomerId = selectedId || (customers[0]?.id || null);
  const { data: customer, isLoading: loadingCustomer } = useQuery<any>({
    queryKey: ["customer", activeCustomerId],
    queryFn: async () => {
      if (!activeCustomerId) return null;
      const res = await fetch(`/api/v1/customers/${activeCustomerId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to fetch customer detail");
      return res.json();
    },
    enabled: !!activeCustomerId && !!token
  });

  // Local stage override state for interactive switching
  const [activeStageOverride, setActiveStageOverride] = useState<string | null>(null);

  // Filtered customer list
  const filteredCustomers = useMemo(() => {
    return customers.filter((c: any) => {
      const q = searchQuery.toLowerCase();
      return !q || c.name?.toLowerCase().includes(q) || c.primaryContactName?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q);
    });
  }, [customers, searchQuery]);

  // Unified Chronological Stream Calculation
  const unifiedStream = useMemo(() => {
    if (!customer) return [];
    const items: any[] = [];

    (customer.activities || []).forEach((a: any) => {
      items.push({
        id: a.id,
        type: a.type || "note",
        channel: a.type === "whatsapp_sms" ? "WhatsApp" : a.type === "instagram_dm" ? "Instagram" : "Internal Note",
        sender: a.outcome === "message received" ? customer.name : "Sales Rep",
        text: a.notes || a.subject || "Activity logged",
        date: new Date(a.createdAt),
        isMe: a.outcome !== "message received"
      });
    });

    (customer.emailMessages || []).forEach((e: any) => {
      items.push({
        id: e.id,
        type: "email",
        channel: "Email",
        sender: e.sender || "Sales Team",
        text: `${e.subject ? e.subject + ": " : ""}${e.preview || e.body || ""}`,
        date: new Date(e.createdAt),
        isMe: true
      });
    });

    (customer.quotes || []).forEach((q: any) => {
      items.push({
        id: q.id,
        type: "quote",
        channel: "Quotation Engine",
        sender: "System",
        text: `Quotation #${q.quoteNumber || q.id.slice(0, 8)} generated ($${Number(q.totalAmount || 0).toLocaleString()}) - Status: ${q.status}`,
        date: new Date(q.createdAt),
        isMe: true
      });
    });

    return items.sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [customer]);

  // Quote Creation Mutation inside workspace
  const createQuoteMutation = useMutation({
    mutationFn: async () => {
      if (!customer) return;
      const res = await fetch("/api/v1/quotes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          customerId: customer.id,
          dealName: quoteDealName,
          totalAmount: parseFloat(quoteAmount),
          notes: quoteNotes
        })
      });
      if (!res.ok) throw new Error("Failed to create quote");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer", activeCustomerId] });
      setActiveCenterDrawer("conversation");
    }
  });

  return (
    <div className="h-[calc(100vh-64px)] bg-[#FAF8FF] text-[#191B23] flex font-sans overflow-hidden select-none">
      
      {/* ─── CUSTOMER LIST SELECTOR SIDEBAR (COMPACT 240px) ─────────────────────── */}
      {!isFocusMode && (
        <div className="w-64 border-r border-[#C3C6D7]/60 flex flex-col bg-white shrink-0">
          <div className="p-3 border-b border-slate-100 space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-black uppercase tracking-wider text-[#191B23]">Customer Registry</h2>
              <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-50 text-[#2563EB] rounded-full">
                {filteredCustomers.length}
              </span>
            </div>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Search customers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {filteredCustomers.map((c: any) => {
              const isSelected = activeCustomerId === c.id;
              return (
                <div
                  key={c.id}
                  onClick={() => setSearchParams({ id: c.id })}
                  className={`p-3 cursor-pointer transition-all ${
                    isSelected ? "bg-blue-50/80 border-l-4 border-l-[#2563EB]" : "hover:bg-slate-50"
                  }`}
                >
                  <h3 className="text-xs font-bold text-[#191B23] truncate">{c.name}</h3>
                  <p className="text-[10px] text-[#6B7280] truncate">{c.primaryContactName || c.email || "No contact"}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── WORKSPACE CORE (3-COLUMN RESPONSIVE LAYOUT) ───────────────────────── */}
      {customer ? (
        <div className="flex-1 flex overflow-hidden">
          
          {/* ─── LEFT PANEL (25% - CUSTOMER CONTEXT) ─────────────────────────── */}
          {!isFocusMode && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="w-[25%] border-r border-[#C3C6D7]/60 bg-white p-5 flex flex-col justify-between overflow-y-auto shrink-0 space-y-6"
            >
              {/* Identity & Health Card */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-[#2563EB] text-white font-black text-base flex items-center justify-center shadow-md shadow-blue-500/20">
                    {customer.name?.charAt(0)}
                  </div>
                  <div>
                    <h2 className="text-base font-black text-[#191B23] leading-tight">{customer.name}</h2>
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      Health: Excellent (98%)
                    </span>
                  </div>
                </div>

                {/* Profile Details */}
                <div className="space-y-2.5 text-xs pt-2 border-t border-slate-100">
                  <div className="flex items-center gap-2 text-slate-700">
                    <User className="w-3.5 h-3.5 text-[#2563EB]" />
                    <span className="font-semibold">{customer.primaryContactName || "John Miller"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-700">
                    <Mail className="w-3.5 h-3.5 text-[#2563EB]" />
                    <span>{customer.email || "contact@enterprise.com"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-700">
                    <Phone className="w-3.5 h-3.5 text-[#2563EB]" />
                    <span>{customer.phone || "+1 (555) 019-2834"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-700">
                    <Building2 className="w-3.5 h-3.5 text-[#2563EB]" />
                    <span>{customer.industry || "Commercial & Manufacturing"}</span>
                  </div>
                </div>

                {/* Financial Summary */}
                <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-100">
                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-center">
                    <span className="text-[9px] font-bold text-[#6B7280] uppercase">Lifetime Rev</span>
                    <p className="text-xs font-black text-emerald-600">${(customer.lifetimeRevenue || 1240000).toLocaleString()}</p>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-center">
                    <span className="text-[9px] font-bold text-[#6B7280] uppercase">Outstanding</span>
                    <p className="text-xs font-black text-rose-600">$42,500</p>
                  </div>
                </div>
              </div>

              {/* Pinned Files & Notes */}
              <div className="space-y-3 pt-4 border-t border-slate-100">
                <h4 className="text-[10px] font-black uppercase tracking-wider text-[#6B7280]">Pinned Specifications</h4>
                <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100 text-xs space-y-1">
                  <div className="flex items-center gap-1.5 text-[#2563EB] font-bold text-[11px]">
                    <Paperclip className="w-3.5 h-3.5" />
                    <span>Factory_Audit_Contract_2026.pdf</span>
                  </div>
                  <p className="text-[10px] text-slate-500">Uploaded by Rahul Verma · 2.4 MB</p>
                </div>
              </div>
            </motion.div>
          )}

          {/* ─── CENTER PANEL (50% - CONVERSATION & EMBEDDED WORK AREA) ───────── */}
          <div className="flex-1 flex flex-col bg-white border-r border-[#C3C6D7]/60 overflow-hidden">
            
            {/* WORKSPACE TOP HEADER & VISUAL JOURNEY TRACKER */}
            <div className="p-4 border-b border-slate-100 bg-white space-y-3 shrink-0 shadow-2xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <h2 className="text-sm font-black text-[#191B23]">Active Customer Operations Workspace</h2>
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsFocusMode(!isFocusMode)}
                    className="p-1.5 rounded-lg bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-[#2563EB] transition-all"
                    title="Toggle Focus Mode"
                  >
                    {isFocusMode ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* INTERACTIVE VISUAL JOURNEY TRACKER */}
              <div className="grid grid-cols-7 gap-1 text-center">
                {["Enquiry", "Assigned", "Meeting", "Quote", "Approval", "Invoice", "Won"].map((stg, idx) => {
                  // Compute current active stage index based on local override or backend customer status
                  const dbStageName = customer?.deals?.[0]?.stage?.name || customer?.leads?.[0]?.status || "Approval";
                  const currentStageName = activeStageOverride || dbStageName;

                  const stageIndexMap: Record<string, number> = {
                    "New": 0, "Enquiry": 0, "Contacted": 1, "Assigned": 1,
                    "Meeting/Demo": 2, "Meeting": 2, "Qualified": 2,
                    "Proposal": 3, "Quote": 3,
                    "Negotiation": 4, "Approval": 4,
                    "Invoice": 5, "Won": 6
                  };
                  const activeIdx = stageIndexMap[currentStageName] ?? stageIndexMap[stg] ?? 4;
                  const isDone = idx <= activeIdx;
                  const isCurrent = idx === activeIdx;

                  return (
                    <button
                      key={stg}
                      onClick={async () => {
                        // 1. Immediately update UI state
                        setActiveStageOverride(stg);

                        // 2. Persist to backend if deal exists
                        if (customer?.deals?.[0]?.id) {
                          try {
                            const stageNameMap: Record<string, string> = {
                              "Enquiry": "New",
                              "Assigned": "Contacted",
                              "Meeting": "Meeting/Demo",
                              "Quote": "Proposal",
                              "Approval": "Negotiation",
                              "Invoice": "Proposal",
                              "Won": "Won"
                            };
                            await apiClient(`/api/v1/deals/${customer.deals[0].id}/stage`, {
                              method: "PUT",
                              body: JSON.stringify({ stageName: stageNameMap[stg] || stg })
                            });
                            queryClient.invalidateQueries({ queryKey: ["customer", activeCustomerId] });
                          } catch (err) {
                            console.error("Stage update error:", err);
                          }
                        }
                      }}
                      className={`py-1.5 rounded-xl text-[10px] font-black tracking-tight transition-all active:scale-95 border cursor-pointer ${
                        isCurrent
                          ? "bg-[#2563EB] text-white border-blue-600 shadow-sm shadow-blue-500/30 ring-2 ring-blue-300"
                          : isDone
                          ? "bg-blue-600/90 text-white border-blue-600"
                          : "bg-slate-100 text-slate-400 border-slate-200/80 hover:bg-slate-200 hover:text-slate-700"
                      }`}
                      title={`Click to switch stage to ${stg}`}
                    >
                      {stg} {isCurrent ? "✓" : ""}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* EMBEDDED DRAWERS SWITCHER (CONVERSATION / QUOTE BUILDER / INVOICE) */}
            <div className="flex-1 overflow-y-auto p-5">
              <AnimatePresence mode="wait">
                
                {/* DEFAULT: UNIFIED CONVERSATION STREAM */}
                {activeCenterDrawer === "conversation" && (
                  <motion.div key="conversation" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-[#6B7280]">Unified Chronological Stream</h3>
                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        Live Cross-Platform Stream
                      </span>
                    </div>

                    <div className="space-y-3">
                      {unifiedStream.length > 0 ? (
                        unifiedStream.map((item: any) => (
                          <div
                            key={item.id}
                            className={`p-3.5 rounded-2xl border text-xs space-y-1 ${
                              item.isMe ? "bg-blue-50/70 border-blue-100 ml-12" : "bg-slate-50 border-slate-100 mr-12"
                            }`}
                          >
                            <div className="flex justify-between items-center text-[10px]">
                              <span className="font-bold text-[#2563EB]">{item.channel}</span>
                              <span className="text-slate-400">{formatDistanceToNow(item.date)} ago</span>
                            </div>
                            <p className="font-medium text-slate-800 leading-relaxed">"{item.text}"</p>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-8 text-xs text-slate-400">No activity history yet.</div>
                      )}
                    </div>
                  </motion.div>
                )}

                {/* EMBEDDED QUOTE BUILDER DRAWER */}
                {activeCenterDrawer === "quote" && (
                  <motion.div key="quote" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 bg-slate-50 p-5 rounded-2xl border border-slate-200">
                    <div className="flex justify-between items-center">
                      <h3 className="text-xs font-black uppercase text-[#2563EB] flex items-center gap-1.5">
                        <FileText className="w-4 h-4" /> Embedded Quotation Builder
                      </h3>
                      <button onClick={() => setActiveCenterDrawer("conversation")} className="text-slate-400 hover:text-slate-700">
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="space-y-3 text-xs">
                      <div>
                        <label className="font-bold text-slate-700 block mb-1">Deal / Project Name</label>
                        <input
                          type="text"
                          value={quoteDealName}
                          onChange={(e) => setQuoteDealName(e.target.value)}
                          className="w-full p-2 bg-white border border-slate-200 rounded-xl"
                        />
                      </div>
                      <div>
                        <label className="font-bold text-slate-700 block mb-1">Total Quotation Value ($)</label>
                        <input
                          type="number"
                          value={quoteAmount}
                          onChange={(e) => setQuoteAmount(e.target.value)}
                          className="w-full p-2 bg-white border border-slate-200 rounded-xl font-bold text-emerald-600"
                        />
                      </div>
                      <div>
                        <label className="font-bold text-slate-700 block mb-1">Terms & Specifications</label>
                        <textarea
                          value={quoteNotes}
                          onChange={(e) => setQuoteNotes(e.target.value)}
                          className="w-full p-2 bg-white border border-slate-200 rounded-xl h-20"
                        />
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={() => createQuoteMutation.mutate()}
                        disabled={createQuoteMutation.isPending}
                        className="px-4 py-2 bg-[#2563EB] text-white font-bold rounded-xl text-xs flex-1"
                      >
                        {createQuoteMutation.isPending ? "Generating..." : "Save & Send Quotation"}
                      </button>
                      <button onClick={() => setActiveCenterDrawer("conversation")} className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold">
                        Cancel
                      </button>
                    </div>
                  </motion.div>
                )}

              </AnimatePresence>
            </div>

            {/* REPLIER COMPOSER ALWAYS MOUNTED AT BOTTOM */}
            <div className="p-4 bg-white border-t border-slate-100 flex gap-2 shrink-0">
              <input
                type="text"
                placeholder={`Type message or reply to ${customer.name}...`}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20"
              />
              <button
                onClick={() => { setReplyText(""); alert("Reply dispatched!"); }}
                className="px-4 py-2 bg-[#2563EB] text-white font-bold rounded-xl text-xs flex items-center gap-1.5 active:scale-95"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send</span>
              </button>
            </div>

          </div>

          {/* ─── RIGHT PANEL (25% - AI COPILOT & QUICK ACTIONS) ────────────────── */}
          {!isFocusMode && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="w-[25%] bg-[#FAF8FF] p-5 border-l border-[#C3C6D7]/60 flex flex-col justify-between overflow-y-auto shrink-0 space-y-6"
            >
              {/* AI Copilot & Insights */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase tracking-wider text-[#2563EB] flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-500" /> AI Copilot Workspace
                  </h3>
                </div>

                <div className="space-y-2.5 text-xs">
                  <div className="p-3 bg-white rounded-xl border border-slate-200/80 shadow-2xs space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Buying Intent</span>
                    <p className="font-black text-emerald-600 text-sm">High (94%)</p>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-slate-200/80 shadow-2xs space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Relationship Score</span>
                    <p className="font-black text-[#2563EB] text-sm">98 / 100</p>
                  </div>
                </div>

                {/* AI Suggested Action */}
                <div className="p-3.5 bg-gradient-to-br from-blue-50 to-indigo-50/50 rounded-xl border border-blue-100 text-xs space-y-1.5">
                  <span className="font-black text-[#2563EB] text-[10px] uppercase block">Suggested Next Step</span>
                  <p className="text-slate-700 leading-relaxed font-medium">
                    Customer opened proposal 3 times today. Send quotation with 5% volume discount.
                  </p>
                </div>
              </div>

              {/* 1-CLICK QUICK ACTIONS TOOLBAR */}
              <div className="space-y-2.5 pt-4 border-t border-slate-200">
                <h4 className="text-[10px] font-black uppercase tracking-wider text-[#6B7280]">1-Click Quick Actions</h4>
                
                <button
                  onClick={() => setActiveCenterDrawer("quote")}
                  className="w-full py-2 bg-[#2563EB] hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition-all shadow-xs flex items-center justify-center gap-1.5 active:scale-95"
                >
                  <FileText className="w-3.5 h-3.5 text-amber-300" />
                  <span>Generate Quote</span>
                </button>

                <button
                  onClick={() => setActiveCenterDrawer("conversation")}
                  className="w-full py-2 bg-white border border-slate-200 hover:bg-slate-50 text-[#191B23] font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 active:scale-95"
                >
                  <Send className="w-3.5 h-3.5 text-[#2563EB]" />
                  <span>Quick Reply</span>
                </button>
              </div>

            </motion.div>
          )}

        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-xs text-slate-400">
          Loading Customer Operations Workspace...
        </div>
      )}

    </div>
  );
}
