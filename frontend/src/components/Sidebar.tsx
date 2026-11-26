import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { 
  ClipboardCheck, LayoutDashboard, Home, Inbox, Trello, FileText, Receipt,
  Users, BarChart, Settings, Clock, ChevronLeft, 
  ChevronRight, MessageSquare, CheckSquare, Search, Bell, Sparkles, LogOut, ChevronDown, Layers, Package, Building2, LifeBuoy, Target,
  UserCheck, Shield, Briefcase, Megaphone, Wrench, ShieldAlert, Bot, Palette
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { useBrand } from "../context/BrandContext";
import { useVolviAssist } from "../context/VolviAssistContext";
import { leadFilterApi } from "../api";
import { AttendanceClockWidget } from "./AttendanceClockWidget";

interface NavSubItem {
  label: string;
  path: string;
  icon: any;
  badge?: string;
}

interface NavItem {
  label: string;
  path?: string;
  icon: any;
  badge?: string;
  subItems?: NavSubItem[];
}

export function Sidebar({
  onOpenSearch,
  onOpenAi,
  onOpenNotifications
}: {
  onOpenSearch?: () => void;
  onOpenAi?: () => void;
  onOpenNotifications?: () => void;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { brand, themeColor, setThemeColor } = useBrand();
  const { unreadCount } = useVolviAssist();

  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem("sidebar_collapsed") === "true";
  });

  const toggleCollapse = () => {
    setIsCollapsed(prev => {
      const next = !prev;
      localStorage.setItem("sidebar_collapsed", String(next));
      return next;
    });
  };

  const userRole = (user?.role || "admin").toLowerCase();

  const ALLOWED_FILTER_ROLES = ["admin", "director", "manager", "sales_manager"];
  const filterRole = (user?.role || "").toLowerCase();
  const isFilterRoleAllowed = Boolean(user && ALLOWED_FILTER_ROLES.includes(filterRole));

  const { data: filterStats } = useQuery({
    queryKey: ["sidebar-lead-filter-stats"],
    queryFn: () => leadFilterApi.getFilterStats(),
    enabled: isFilterRoleAllowed,
    refetchInterval: 30000,
    staleTime: 15000,
  });

  const needsReviewCount = filterStats?.needsReviewCount || 0;

  const siteManagerNavItems: NavItem[] = [
    { label: "My Site Inspections", path: "/site-inspections", icon: ClipboardCheck },
    { label: "Work Orders", path: "/purchase-orders", icon: Layers },
  ];

  const opsManagerNavItems: NavItem[] = [
    { label: "Site Inspections", path: "/site-inspections", icon: ClipboardCheck },
    { label: "Work Orders", path: "/purchase-orders", icon: Layers },
  ];

  const standardNavItems: NavItem[] = [
    { label: "Dashboard", path: "/", icon: LayoutDashboard },
    { 
      label: "Sales Division", 
      icon: Briefcase,
      subItems: [
        { label: "Leads", path: "/leads", icon: Users },
        { label: "Campaigns", path: "/campaigns", icon: Megaphone },
        { label: "Site Inspections", path: "/site-inspections", icon: ClipboardCheck },
        ...(isFilterRoleAllowed ? [{ 
          label: "Held Emails", 
          path: "/held-emails", 
          icon: ShieldAlert, 
          badge: needsReviewCount > 0 ? String(needsReviewCount) : undefined 
        }] : []),
        { label: "Opportunities", path: "/opportunities", icon: Target },
        { label: "Pipeline", path: "/pipeline", icon: Trello },
        { label: "Quotes", path: "/quotes", icon: FileText },
      ]
    },
    { label: "Approval Queue & Limits", path: "/approvals", icon: Shield },
    { 
      label: "CRM", 
      icon: Building2,
      subItems: [
        { label: "Accounts", path: "/accounts", icon: Building2 },
        { label: "Contacts", path: "/contacts", icon: Users },
        { label: "Business Users", path: "/salespersons", icon: UserCheck },
        { label: "Work Orders", path: "/work-orders", icon: Wrench },
      ]
    },
    { label: "Settings", path: "/master-data/requirements", icon: Settings },
  ];

  const primaryNavItems = userRole === "site_manager"
    ? siteManagerNavItems
    : userRole === "ops_manager"
    ? opsManagerNavItems
    : standardNavItems;

  // Track open dropdowns (default open for active route)
  const [openDropdowns, setOpenDropdowns] = useState<Record<string, boolean>>({
    "Sales Division": true,
    "Governance & Approvals": true,
    "CRM": false,
  });

  useEffect(() => {
    primaryNavItems.forEach(item => {
      if (item.subItems?.some(sub => location.pathname === sub.path || (sub.path !== "/" && location.pathname.startsWith(sub.path)))) {
        setOpenDropdowns(prev => ({ ...prev, [item.label]: true }));
      }
    });
  }, [location.pathname]);

  const toggleDropdown = (label: string) => {
    setOpenDropdowns(prev => ({ ...prev, [label]: !prev[label] }));
  };

  return (
    <aside
      style={{ backgroundColor: "#F5F7FD" }}
      className={`border-r border-[#E2E8F4] dark:border-slate-800 flex flex-col justify-between transition-all duration-300 z-20 shrink-0 select-none ${
        isCollapsed ? "w-16" : "w-64"
      }`}
    >
      {/* Sidebar Header */}
      <div 
        style={{ backgroundColor: "#F5F7FD" }}
        className="p-4 border-b border-[#E2E8F4] dark:border-slate-800 space-y-3"
      >
        <div className="flex items-center justify-between">
          {!isCollapsed && <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl text-white flex items-center justify-center font-black text-xs shadow-md bg-gradient-to-r from-[#1D4ED8] via-[#0D9488] to-[#10B981] shadow-emerald-500/20">
                  NX
                </div>
                <div>
                  <span className="font-extrabold text-sm tracking-tight text-slate-900 dark:text-white block leading-none">
                    NEXUS CRM
                  </span>
                  <span className="text-[10px] font-bold block text-[#059669] dark:text-emerald-400">
                    {userRole === "sales_rep" ? "Sales OS Rep" : "Workspace OS"}
                  </span>
                </div>
              </div>
            }
            {isCollapsed && (
              <div className="w-8 h-8 rounded-xl text-white flex items-center justify-center font-black text-xs mx-auto shadow-md bg-gradient-to-r from-[#1D4ED8] via-[#0D9488] to-[#10B981] shadow-emerald-500/20">
                NX
              </div>
            )}
          <button
            onClick={toggleCollapse}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors hidden sm:block"
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Global Search & AI Quick Triggers in Sidebar */}
        <div className="space-y-1.5 pt-1">
          {onOpenSearch && (
            <button
              onClick={onOpenSearch}
              className={`w-full flex items-center gap-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl px-2.5 py-2 text-xs font-bold transition-all ${
                isCollapsed ? "justify-center" : ""
              }`}
              title="Search (Ctrl+K)"
            >
              <Search className="w-4 h-4 text-blue-600 shrink-0" />
              {!isCollapsed && (
                <div className="flex-1 flex justify-between items-center">
                  <span>Search...</span>
                  <kbd className="px-1.5 py-0.5 text-[9px] font-mono bg-white dark:bg-slate-900 border rounded text-slate-400">Ctrl+K</kbd>
                </div>
              )}
            </button>
          )}

          <div className="flex gap-1">
            {onOpenAi && (
              <button
                onClick={onOpenAi}
                className={`flex-1 flex items-center justify-between bg-[var(--crm-sidebar-box-bg,#FFFFFF)] hover:bg-[var(--crm-sidebar-hover,#E8ECF2)] border border-[var(--crm-sidebar-box-border,#E3E8F0)] text-[var(--crm-sidebar-text,#334155)] shadow-2xs rounded-xl px-2.5 py-1.5 text-xs font-bold transition-all ${
                  isCollapsed ? "justify-center" : ""
                }`}
                title="Volvi Copilot (Industrial RAG & Alerts)"
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <Bot className="w-3.5 h-3.5 text-[var(--crm-primary,#2563EB)] shrink-0" />
                  {!isCollapsed && <span className="truncate font-extrabold text-[var(--crm-sidebar-heading,#0F172A)]">Volvi Copilot</span>}
                </div>
                {!isCollapsed && unreadCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-white text-[9px] font-black shadow-xs bg-[var(--crm-sidebar-active-bg,#2563EB)]">
                    {unreadCount}
                  </span>
                )}
              </button>
            )}

            {onOpenNotifications && (
              <button
                onClick={onOpenNotifications}
                className="p-1.5 bg-[var(--crm-sidebar-box-bg,#FFFFFF)] hover:bg-[var(--crm-sidebar-hover,#E8ECF2)] border border-[var(--crm-sidebar-box-border,#E3E8F0)] text-slate-600 rounded-xl transition-colors shrink-0"
                title="Notifications"
              >
                <Bell className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 5 Core Pillars Navigation List */}
      <div 
        style={{ backgroundColor: "#F5F7FD" }}
        className="flex-1 overflow-y-auto p-3 space-y-2 no-scrollbar"
      >
        {primaryNavItems.map((item) => {
          const Icon = item.icon;
          const hasSubItems = item.subItems && item.subItems.length > 0;
          const isDropdownOpen = !!openDropdowns[item.label];
          
          const isItemActive = item.path 
            ? (location.pathname === item.path || (item.path !== "/" && location.pathname.startsWith(item.path)))
            : (item.subItems?.some(sub => location.pathname === sub.path || (sub.path !== "/" && location.pathname.startsWith(sub.path))) || false);

          if (hasSubItems) {
            return (
              <div 
                key={item.label} 
                className="rounded-2xl transition-all duration-200 bg-[var(--crm-sidebar-panel-bg,#FFFFFF)] dark:bg-slate-900 border border-[var(--crm-sidebar-panel-border,#D8EEE1)] dark:border-slate-800 shadow-[0_2px_8px_-2px_rgba(5,150,105,0.04)] p-1.5 space-y-1"
              >
                <button
                  type="button"
                  onClick={() => {
                    if (isCollapsed) {
                      toggleCollapse();
                    }
                    toggleDropdown(item.label);
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl font-bold text-xs transition-all group cursor-pointer ${
                    isItemActive
                      ? "bg-gradient-to-r from-[#1D4ED8] via-[#0D9488] to-[#10B981] text-white shadow-xs font-black"
                      : "text-slate-700 dark:text-slate-200 hover:bg-[#EAF7F0] dark:hover:bg-emerald-950/40 hover:text-[#059669] dark:hover:text-emerald-300"
                  }`}
                  title={isCollapsed ? item.label : undefined}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`p-1.5 rounded-lg transition-colors ${
                      isItemActive 
                        ? "bg-white/20 text-white" 
                        : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 group-hover:text-[#059669] group-hover:bg-emerald-100/60"
                    }`}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    {!isCollapsed && <span className="truncate">{item.label}</span>}
                  </div>

                  {!isCollapsed && (
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${
                      isItemActive ? "text-white" : "text-slate-400 group-hover:text-[#059669]"
                    } ${isDropdownOpen ? "rotate-0" : "-rotate-90"}`} />
                  )}
                </button>

                {/* Sub-items list */}
                {isDropdownOpen && !isCollapsed && (
                  <div className="mt-1 space-y-0.5 p-1 rounded-xl bg-slate-50/70 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                    {item.subItems!.map((sub) => {
                      const SubIcon = sub.icon;
                      const isSubActive = location.pathname === sub.path || (sub.path !== "/" && location.pathname.startsWith(sub.path));

                      return (
                        <Link
                          key={sub.path}
                          to={sub.path}
                          className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            isSubActive
                              ? "bg-gradient-to-r from-[#1D4ED8] via-[#0D9488] to-[#10B981] text-white shadow-2xs font-black"
                              : "text-slate-600 dark:text-slate-300 hover:bg-[#EAF7F0] dark:hover:bg-emerald-950/40 hover:text-[#059669] dark:hover:text-emerald-300"
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <SubIcon className={`w-3.5 h-3.5 shrink-0 ${
                              isSubActive ? "text-white" : "text-slate-400 group-hover:text-[#059669]"
                            }`} />
                            <span className="truncate">{sub.label}</span>
                          </div>
                          {sub.badge && (
                            <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded-full ${
                              isSubActive ? "bg-white text-[#059669]" : "bg-emerald-500 text-white"
                            }`}>
                              {sub.badge}
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          return (
            <div
              key={item.path}
              className="rounded-2xl transition-all duration-200 bg-[var(--crm-sidebar-panel-bg,#FFFFFF)] dark:bg-slate-900 border border-[var(--crm-sidebar-panel-border,#D8EEE1)] dark:border-slate-800 shadow-[0_2px_8px_-2px_rgba(5,150,105,0.04)] overflow-hidden"
            >
              <Link
                to={item.path!}
                className={`flex items-center gap-2.5 px-3 py-2.5 font-bold text-xs transition-all group relative cursor-pointer ${
                  isItemActive
                    ? "bg-gradient-to-r from-[#1D4ED8] via-[#0D9488] to-[#10B981] text-white shadow-xs font-black"
                    : "text-slate-700 dark:text-slate-200 hover:bg-[#EAF7F0] dark:hover:bg-emerald-950/40 hover:text-[#059669] dark:hover:text-emerald-300"
                }`}
                title={isCollapsed ? item.label : undefined}
              >
                <div className={`p-1.5 rounded-lg transition-colors ${
                  isItemActive 
                    ? "bg-white/20 text-white" 
                    : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 group-hover:text-[#059669] group-hover:bg-emerald-100/60"
                }`}>
                  <Icon className="w-3.5 h-3.5" />
                </div>

                {!isCollapsed && (
                  <div className="flex-1 flex items-center justify-between">
                    <span className="truncate">{item.label}</span>
                    {item.badge && (
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                        isItemActive
                          ? "bg-white/20 text-white"
                          : "bg-emerald-100 dark:bg-emerald-950 text-[#059669] dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                      }`}>
                        {item.badge}
                      </span>
                    )}
                  </div>
                )}
              </Link>
            </div>
          );
        })}
      </div>

      {/* Sidebar Footer User Info & Shift Status */}
      <div 
        style={{ backgroundColor: "#F5F7FD" }}
        className="p-3 border-t border-[#E2E8F4] dark:border-slate-800 space-y-2"
      >
        {!isCollapsed && (
          <div className="flex items-center justify-between p-1 bg-[var(--crm-sidebar-toggle-bg,#E8ECF2)] rounded-xl text-[11px] font-bold">
            <button
              type="button"
              onClick={() => setThemeColor("sky")}
              className={`flex-1 py-1 rounded-lg text-center transition cursor-pointer ${
                themeColor === "sky"
                  ? "bg-white text-[var(--crm-primary,#2563EB)] shadow-2xs font-black"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Sky Light
            </button>
            <button
              type="button"
              onClick={() => setThemeColor("emerald")}
              className={`flex-1 py-1 rounded-lg text-center transition cursor-pointer ${
                themeColor === "emerald" || themeColor === "velvet"
                  ? "bg-white text-[var(--crm-primary,#059669)] shadow-2xs font-black"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              FACE Green
            </button>
          </div>
        )}
        {/* Punch in hidden from UI for now */}
        {!isCollapsed ? (
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300 font-black text-xs flex items-center justify-center border border-blue-200 dark:border-blue-800 shrink-0">
                {user?.name?.charAt(0) || "U"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{user?.name || "Logged User"}</p>
                <p className="text-[10px] text-slate-400 truncate uppercase font-extrabold">{user?.role?.replace("_", " ") || "Sales Rep"}</p>
              </div>
            </div>
            <button onClick={() => logout()} className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg transition-colors" title="Sign Out">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button onClick={() => logout()} className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300 font-black text-xs flex items-center justify-center mx-auto border border-blue-200 dark:border-blue-800" title="Sign Out">
            {user?.name?.charAt(0) || "U"}
          </button>
        )}
      </div>
    </aside>
  );
}
