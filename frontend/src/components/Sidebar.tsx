import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Home,
  Inbox,
  Target,
  FileText,
  ShoppingBag,
  Package,
  Building2,
  Users,
  CheckSquare,
  BarChart2,
  Megaphone,
  Settings,
  Calendar,
  Layers,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Search,
  Sparkles,
  Truck,
  Activity,
  Sliders,
  ShieldCheck
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

interface NavItem {
  label: string;
  path: string;
  icon: any;
  badge?: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

export function Sidebar({
  onOpenSearch,
  onOpenAi
}: {
  onOpenSearch?: () => void;
  onOpenAi?: () => void;
  onOpenNotifications?: () => void;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem("sidebar_collapsed") === "true";
  });

  const toggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("sidebar_collapsed", String(next));
      return next;
    });
  };

  const userRole = (user?.role || "sales_rep").toLowerCase();
  const isSalesRep = userRole === "sales_rep" || userRole === "salesperson";
  const isTeamLead = userRole === "team_lead" || userRole === "sales_manager";
  const isAdmin = !isSalesRep && !isTeamLead; // admin, director, executive

  // Construct Role-Specific Navigation Model
  let navSections: NavSection[] = [];

  if (isSalesRep) {
    navSections = [
      {
        title: "Workspace",
        items: [
          { label: "My Workspace", path: "/home", icon: Home },
          { label: "My Inbox", path: "/inbox", icon: Inbox },
          { label: "Activities", path: "/activities", icon: Activity },
          { label: "Performance", path: "/rep-portal", icon: BarChart2 }
        ]
      },
      {
        title: "Sales Pipeline",
        items: [
          { label: "Leads", path: "/leads", icon: Users },
          { label: "Opportunities", path: "/opportunities", icon: Target },
          { label: "Accounts", path: "/accounts", icon: Building2 },
          { label: "Quotes", path: "/quotes", icon: FileText }
        ]
      }
    ];
  } else if (isTeamLead) {
    navSections = [
      {
        title: "Team Supervision",
        items: [
          { label: "Team Workspace", path: "/manager-portal", icon: LayoutDashboard },
          { label: "Team Queue", path: "/inbox", icon: Inbox },
          { label: "Approvals", path: "/approvals", icon: CheckSquare },
          { label: "Targets & Performance", path: "/salespersons", icon: BarChart2 },
          { label: "Team Activities", path: "/activities", icon: Activity }
        ]
      },
      {
        title: "Sales & Commercial",
        items: [
          { label: "Leads", path: "/leads", icon: Users },
          { label: "Opportunities", path: "/opportunities", icon: Target },
          { label: "Accounts", path: "/accounts", icon: Building2 },
          { label: "Quotes", path: "/quotes", icon: FileText },
          { label: "Orders", path: "/purchase-orders", icon: ShoppingBag }
        ]
      }
    ];
  } else {
    // Admin / Executive Navigation
    navSections = [
      {
        title: "Executive & Intake",
        items: [
          { label: "Admin Workspace", path: "/executive-bi", icon: LayoutDashboard },
          { label: "Lead Intake", path: "/inbox", icon: Inbox },
          { label: "Analytics & KPIs", path: "/kpi", icon: BarChart2 }
        ]
      },
      {
        title: "CRM Core",
        items: [
          { label: "Leads", path: "/leads", icon: Users },
          { label: "Accounts", path: "/accounts", icon: Building2 },
          { label: "Opportunities", path: "/opportunities", icon: Target },
          { label: "Quotes", path: "/quotes", icon: FileText },
          { label: "Orders", path: "/purchase-orders", icon: ShoppingBag }
        ]
      },
      {
        title: "Operations & Marketing",
        items: [
          { label: "Supply / Fulfillment", path: "/supply", icon: Truck },
          { label: "Assets", path: "/assets", icon: Package },
          { label: "Campaigns", path: "/campaigns", icon: Megaphone }
        ]
      },
      {
        title: "Governance & Master Data",
        items: [
          { label: "Approval Center", path: "/approvals", icon: CheckSquare },
          { label: "Assignment Rules", path: "/rules", icon: Sliders },
          { label: "Automation", path: "/automation", icon: ShieldCheck },
          { label: "Master Data", path: "/master-data/catalog", icon: Layers },
          { label: "Settings", path: "/settings", icon: Settings }
        ]
      }
    ];
  }

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const roleBadgeText = isSalesRep ? "Sales Rep" : isTeamLead ? "Team Lead" : "Admin";

  return (
    <aside
      className={`relative h-full z-30 shrink-0 bg-white border-r border-slate-200 transition-all duration-200 flex flex-col ${
        isCollapsed ? "w-16" : "w-60"
      }`}
    >
      {/* Brand Header */}
      <div className="h-14 flex items-center justify-between px-3 border-b border-slate-100 shrink-0">
        {!isCollapsed && (
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-xs">
              N
            </div>
            <div className="truncate">
              <span className="font-bold text-slate-800 text-sm tracking-tight">Nexus CRM</span>
              <span className="ml-1.5 px-1.5 py-0.2 text-[10px] font-semibold bg-slate-100 text-slate-600 rounded border border-slate-200">
                {roleBadgeText}
              </span>
            </div>
          </div>
        )}
        {isCollapsed && (
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm mx-auto shadow-xs">
            N
          </div>
        )}

        <button
          onClick={toggleCollapse}
          className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors ml-auto"
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Global Quick Action: Search & Copilot */}
      <div className="p-2 space-y-1 border-b border-slate-100">
        <button
          onClick={onOpenSearch}
          className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-500 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 transition-colors ${
            isCollapsed ? "justify-center" : "justify-between"
          }`}
          title="Search (Ctrl+K)"
        >
          <div className="flex items-center gap-2 truncate">
            <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            {!isCollapsed && <span>Search CRM...</span>}
          </div>
          {!isCollapsed && (
            <kbd className="text-[10px] bg-white text-slate-400 px-1.5 py-0.5 rounded border border-slate-200 font-semibold">
              ⌘K
            </kbd>
          )}
        </button>

        {onOpenAi && !isCollapsed && (
          <button
            onClick={onOpenAi}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-blue-700 bg-blue-50/70 hover:bg-blue-100/70 border border-blue-200/60 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span>AI Assistant</span>
          </button>
        )}
      </div>

      {/* Navigation Sections */}
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
        {navSections.map((section, idx) => (
          <div key={idx} className="space-y-1">
            {!isCollapsed && (
              <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {section.title}
              </div>
            )}
            {section.items.map((item) => {
              const Icon = item.icon;
              const isActive =
                location.pathname === item.path ||
                (item.path !== "/" && item.path !== "/home" && location.pathname.startsWith(item.path));

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    isActive
                      ? "bg-blue-50 text-blue-700 font-semibold shadow-xs"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  } ${isCollapsed ? "justify-center" : ""}`}
                  title={isCollapsed ? item.label : undefined}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isActive ? "text-blue-600" : "text-slate-400 group-hover:text-slate-600"
                    }`}
                  />
                  {!isCollapsed && <span className="truncate">{item.label}</span>}
                  {!isCollapsed && item.badge && (
                    <span className="ml-auto text-[10px] font-semibold bg-blue-100 text-blue-700 px-1.5 py-0.2 rounded-full">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </div>

      {/* User Footer Profile */}
      <div className="p-2 border-t border-slate-100 shrink-0">
        <div
          className={`flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 transition-colors ${
            isCollapsed ? "justify-center" : "justify-between"
          }`}
        >
          {!isCollapsed && (
            <div className="truncate min-w-0">
              <div className="text-xs font-semibold text-slate-800 truncate">{user?.name || "User"}</div>
              <div className="text-[11px] text-slate-400 truncate">{user?.email || ""}</div>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="p-1 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors shrink-0"
            title="Logout"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
