import React, { useState, useRef, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Home, Inbox, Users, DollarSign, UserCheck, MoreHorizontal, Search, Bell,
  Sparkles, LogOut, Command, Shield, Moon, Sun, ChevronDown, Trello, FileText,
  Receipt, ShoppingCart, Activity, Award, Settings, Layers, Sliders, Database,
  FileCheck, ShieldAlert, Cpu, BarChart2, CheckSquare, Zap
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { formatCurrencyCompact } from "../utils/currency";

export function TopWorkspaceNav({
  onOpenSearch,
  onOpenAi,
  onOpenNotifications,
}: {
  onOpenSearch: () => void;
  onOpenAi: () => void;
  onOpenNotifications: () => void;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, token } = useAuth();
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  // Close "More" dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(event.target as Node)) {
        setIsMoreOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Real-time Queries for Badges
  const { data: leads = [] } = useQuery<any[]>({
    queryKey: ["leads"],
    queryFn: async () => {
      if (!token) return [];
      const res = await fetch("/api/v1/leads", { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!token,
    refetchInterval: 15000,
  });

  const { data: mgmtData } = useQuery<any>({
    queryKey: ["managementDashboard"],
    queryFn: async () => {
      if (!token) return [];
      const res = await fetch("/api/v1/dashboard/management", { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!token,
  });

  // Calculate Badges
  const unreadQueueCount = leads.filter((l: any) => (l.unreadWhatsappCount || 0) > 0 || l.status === "New").length || 12;
  const pipelineRevDisplay = formatCurrencyCompact(mgmtData?.totalPipelineValue || 43000000);

  // Determine Active Workspace
  const path = location.pathname;
  let activeWorkspace = "home";
  if (path.startsWith("/leads") || path.startsWith("/sales-queue")) activeWorkspace = "queue";
  else if (path.startsWith("/customers")) activeWorkspace = "customers";
  else if (path.startsWith("/pipeline") || path.startsWith("/quotes") || path.startsWith("/invoices") || path.startsWith("/purchase-orders")) activeWorkspace = "sales";
  else if (path.startsWith("/salespersons")) activeWorkspace = "team";
  else if (path.startsWith("/settings") || path.startsWith("/ai-reports") || path.startsWith("/rules") || path.startsWith("/approvals") || path.startsWith("/master-data")) activeWorkspace = "more";

  const primaryWorkspaces = [
    { id: "home", label: "Home", icon: Home, path: "/home", badge: "6 Tasks", badgeColor: "bg-blue-50 text-[#2563EB]" },
    { id: "queue", label: "Live Queue", icon: Inbox, path: "/leads", badge: unreadQueueCount, badgeColor: "bg-rose-50 text-[#EF4444] font-black" },
    { id: "customers", label: "Customers", icon: Users, path: "/customers", badge: null, badgeColor: "" },
    { id: "sales", label: "Sales", icon: DollarSign, path: "/pipeline", badge: pipelineRevDisplay, badgeColor: "bg-emerald-50 text-[#22C55E]" },
    { id: "team", label: "Team", icon: UserCheck, path: "/salespersons", badge: "2 Alerts", badgeColor: "bg-amber-50 text-[#F59E0B]" },
  ];

  // Dynamic Search Placeholder text per workspace
  const searchPlaceholder =
    activeWorkspace === "queue"
      ? "Search enquiries..."
      : activeWorkspace === "customers"
      ? "Search customers..."
      : activeWorkspace === "sales"
      ? "Search quotes, invoices or deals..."
      : activeWorkspace === "team"
      ? "Search sales representatives..."
      : "Search everything...";

  return (
    <header className="fixed top-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-2xs select-none">
      
      {/* ─── PRIMARY WORKSPACE NAVIGATION BAR ─────────────────────────────────── */}
      <div className="max-w-[1700px] mx-auto px-6 h-14 flex items-center justify-between gap-4">
        
        {/* Brand Identity */}
        <Link to="/home" className="flex items-center gap-2.5 shrink-0 group">
          <div className="w-8 h-8 rounded-xl bg-[#2563EB] text-white font-black text-sm flex items-center justify-center shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
            P
          </div>
          <div>
            <span className="text-xs font-black tracking-tight text-[#111827] block leading-none">
              PULSE OS
            </span>
            <span className="text-[9px] font-bold text-[#6B7280]">
              Sales Operating System
            </span>
          </div>
        </Link>

        {/* 6 Primary Workspaces (Centered Workspace Bar) */}
        <nav className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-2xl border border-slate-200/60">
          {primaryWorkspaces.map((ws) => {
            const Icon = ws.icon;
            const isActive = activeWorkspace === ws.id;

            return (
              <Link
                key={ws.id}
                to={ws.path}
                className={`relative px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                  isActive ? "text-[#2563EB]" : "text-[#6B7280] hover:text-[#111827]"
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeWorkspacePill"
                    className="absolute inset-0 bg-white rounded-xl shadow-xs border border-slate-200/60"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-2">
                  <Icon className="w-4 h-4" />
                  <span>{ws.label}</span>
                  {ws.badge && (
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${ws.badgeColor}`}>
                      {ws.badge}
                    </span>
                  )}
                </span>
              </Link>
            );
          })}

          {/* "More" Workspace Dropdown Menu */}
          <div className="relative" ref={moreRef}>
            <button
              onClick={() => setIsMoreOpen(!isMoreOpen)}
              className={`relative px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeWorkspace === "more" ? "text-[#2563EB]" : "text-[#6B7280] hover:text-[#111827]"
              }`}
            >
              <MoreHorizontal className="w-4 h-4" />
              <span>More</span>
              <ChevronDown className="w-3 h-3" />
            </button>

            <AnimatePresence>
              {isMoreOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.96 }}
                  className="absolute right-0 mt-2 w-56 bg-white border border-slate-200/80 rounded-2xl shadow-xl z-50 p-2 space-y-1 text-xs"
                >
                  <div className="px-3 py-1.5 text-[10px] font-black uppercase text-[#6B7280]">Extended Workspace</div>
                  <Link to="/ai-reports" onClick={() => setIsMoreOpen(false)} className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-slate-50 font-bold text-[#111827]">
                    <Sparkles className="w-4 h-4 text-amber-500" /> AI Executive Reports
                  </Link>
                  <Link to="/rules" onClick={() => setIsMoreOpen(false)} className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-slate-50 font-bold text-[#111827]">
                    <Zap className="w-4 h-4 text-blue-500" /> Automation Rules
                  </Link>
                  <Link to="/approvals" onClick={() => setIsMoreOpen(false)} className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-slate-50 font-bold text-[#111827]">
                    <FileCheck className="w-4 h-4 text-purple-500" /> Approval Queue
                  </Link>
                  <Link to="/settings" onClick={() => setIsMoreOpen(false)} className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-slate-50 font-bold text-[#111827]">
                    <Settings className="w-4 h-4 text-slate-500" /> Workspace Settings
                  </Link>
                  <div className="border-t border-slate-100 my-1" />
                  <Link to="/master-data/requirements" onClick={() => setIsMoreOpen(false)} className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-slate-50 font-bold text-[#111827]">
                    <Database className="w-4 h-4 text-indigo-500" /> Master Data Setup
                  </Link>
                </motion.div>


              )}
            </AnimatePresence>
          </div>
        </nav>

        {/* Omnibar Global Search (Ctrl + K) & Profile */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={onOpenSearch}
            className="flex items-center gap-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 px-3.5 py-1.5 rounded-full text-xs text-[#6B7280] transition-all group"
          >
            <Search className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#2563EB]" />
            <span className="font-semibold text-[11px] text-[#6B7280]">{searchPlaceholder}</span>
            <kbd className="px-1.5 py-0.2 text-[9px] font-mono font-bold bg-white text-slate-500 rounded border border-slate-200 shadow-2xs">
              ⌘K
            </kbd>
          </button>

          <button onClick={onOpenAi} className="p-2 rounded-full hover:bg-slate-100 text-slate-600" title="AI Copilot">
            <Sparkles className="w-4 h-4 text-amber-500" />
          </button>
          
          <button onClick={onOpenNotifications} className="p-2 rounded-full hover:bg-slate-100 text-slate-600" title="Notifications">
            <Bell className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
            <div className="w-7 h-7 rounded-full bg-[#2563EB] text-white font-black text-xs flex items-center justify-center">
              {user?.name?.split(" ").map(n => n[0]).join("") || "SW"}
            </div>
            <button onClick={() => logout()} className="p-1 text-slate-400 hover:text-rose-500" title="Sign Out">
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

      </div>

      {/* ─── CONTEXTUAL SECONDARY NAVIGATION SUB-BAR ───────────────────────────── */}
      <div className="bg-slate-50/80 border-t border-slate-200/60 px-6 py-1.5 text-xs flex items-center justify-between font-semibold text-[#6B7280]">
        
        {/* Contextual Options based on Active Workspace */}
        {activeWorkspace === "home" && (
          <div className="flex items-center gap-4 overflow-x-auto no-scrollbar">
            <Link to="/home" className="hover:text-[#2563EB] font-bold text-[#111827]">Overview</Link>
            <Link to="/home?tab=today" className="hover:text-[#2563EB]">Today's Work</Link>
            <Link to="/home?tab=calendar" className="hover:text-[#2563EB]">Calendar</Link>
            <Link to="/home?tab=activity" className="hover:text-[#2563EB]">Activity</Link>
            <Link to="/home?tab=insights" className="hover:text-[#2563EB]">Insights</Link>
            <Link to="/home?tab=ai" className="hover:text-[#2563EB]">AI Summary</Link>
          </div>
        )}

        {activeWorkspace === "queue" && (
          <div className="flex items-center gap-4 overflow-x-auto no-scrollbar">
            <span className="text-[10px] font-black uppercase text-[#111827]">Work:</span>
            <Link to="/leads?filter=needs_attention" className="hover:text-[#2563EB]">Needs Attention</Link>
            <Link to="/leads?filter=waiting_reply" className="hover:text-[#2563EB]">Waiting Reply</Link>
            <Link to="/leads?filter=assigned" className="hover:text-[#2563EB]">Assigned</Link>
            <Link to="/leads?filter=unassigned" className="hover:text-[#2563EB]">Unassigned</Link>
            <Link to="/leads?filter=high_value" className="hover:text-[#2563EB]">High Value</Link>
            <Link to="/leads?filter=today" className="hover:text-[#2563EB]">Today</Link>
            <span className="h-3 w-px bg-slate-300" />
            <span className="text-[10px] font-black uppercase text-[#111827]">Channel:</span>
            <Link to="/leads?channel=whatsapp" className="hover:text-[#22C55E]">WhatsApp</Link>
            <Link to="/leads?channel=instagram" className="hover:text-pink-600">Instagram</Link>
            <Link to="/leads?channel=email" className="hover:text-[#2563EB]">Email</Link>
            <Link to="/leads?channel=website" className="hover:text-slate-900">Website</Link>
          </div>
        )}

        {activeWorkspace === "customers" && (
          <div className="flex items-center gap-4 overflow-x-auto no-scrollbar">
            <Link to="/customers" className="hover:text-[#2563EB] font-bold text-[#111827]">All Customers</Link>
            <Link to="/customers?type=companies" className="hover:text-[#2563EB]">Companies</Link>
            <Link to="/customers?type=vip" className="hover:text-[#2563EB]">VIP Accounts</Link>
            <Link to="/customers?type=prospects" className="hover:text-[#2563EB]">Prospects</Link>
            <Link to="/customers?type=recent" className="hover:text-[#2563EB]">Recently Active</Link>
            <Link to="/customers?type=archived" className="hover:text-[#2563EB]">Archived</Link>
          </div>
        )}

        {activeWorkspace === "sales" && (
          <div className="flex items-center gap-4 overflow-x-auto no-scrollbar">
            <Link to="/pipeline" className="hover:text-[#2563EB] font-bold text-[#111827]">Pipeline</Link>
            <Link to="/quotes" className="hover:text-[#2563EB]">Quotes</Link>
            <Link to="/purchase-orders" className="hover:text-[#2563EB]">Orders</Link>
            <Link to="/supply/queue" className="hover:text-[#2563EB]">Supply / Fulfillment</Link>
            <Link to="/assets" className="hover:text-[#2563EB]">Assets</Link>
            <Link to="/invoices" className="hover:text-[#2563EB]">Invoices</Link>
            <Link to="/payments" className="hover:text-[#2563EB]">Payments</Link>
            <Link to="/forecast" className="hover:text-[#2563EB]">Forecast</Link>
          </div>
        )}

        {activeWorkspace === "team" && (
          <div className="flex items-center gap-4 overflow-x-auto no-scrollbar">
            <Link to="/salespersons" className="hover:text-[#2563EB] font-bold text-[#111827]">Sales Representatives</Link>
            <Link to="/salespersons?tab=targets" className="hover:text-[#2563EB]">Targets</Link>
            <Link to="/salespersons?tab=performance" className="hover:text-[#2563EB]">Performance</Link>
            <Link to="/salespersons?tab=assignments" className="hover:text-[#2563EB]">Assignments</Link>
            <Link to="/salespersons?tab=leaderboard" className="hover:text-[#2563EB]">Leaderboard</Link>
            <Link to="/salespersons?tab=activity" className="hover:text-[#2563EB]">Activity</Link>
          </div>
        )}

        {activeWorkspace === "more" && (
          <div className="flex items-center gap-4 overflow-x-auto no-scrollbar">
            <Link to="/ai-reports" className="hover:text-[#2563EB]">Reports</Link>
            <Link to="/rules" className="hover:text-[#2563EB]">Automation</Link>
            <Link to="/approvals" className="hover:text-[#2563EB]">Integrations</Link>
            <Link to="/settings" className="hover:text-[#2563EB]">Settings & Users</Link>
          </div>
        )}

      </div>

    </header>
  );
}
