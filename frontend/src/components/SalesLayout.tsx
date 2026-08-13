import { useState } from "react";
import { Outlet, useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  LayoutDashboard, Inbox, Trello, Users, FileText, Activity,
  BarChart2, Calendar, Search, Bell, Sparkles, LogOut, Shield
} from "lucide-react";
import { NotificationDrawer } from "./NotificationDrawer";
import { AiCopilotDrawer } from "./AiCopilotDrawer";
import { CommandPalette } from "./CommandPalette";
import { WorkspaceTransition } from "./WorkspaceTransition";

export function SalesLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isAiCopilotOpen, setIsAiCopilotOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  const repName = user?.name || "Sales Executive";
  const initials = repName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();

  const userRole = (user?.role || "sales_rep").toLowerCase();
  const isManager = userRole === "sales_manager" || userRole === "team_lead";
  const isAdmin = userRole === "admin" || userRole === "director";

  let navItems = [
    { label: "My Inbox", path: "/leads", icon: Inbox },
    { label: "My Leads", path: "/leads-table", icon: Users },
    { label: "My Customers", path: "/customers", icon: Users },
    { label: "My Pipeline", path: "/pipeline", icon: Trello },
    { label: "Activities", path: "/activities", icon: Activity },
    { label: "Calendar", path: "/activities?tab=calendar", icon: Calendar },
    { label: "Quotes", path: "/quotes", icon: FileText },
    { label: "Performance", path: "/kpi", icon: BarChart2 },
  ];

  if (isManager) {
    navItems = [
      { label: "Team Queue", path: "/leads", icon: Inbox },
      { label: "Team Leads", path: "/manager-portal", icon: Users },
      { label: "Team Pipeline", path: "/pipeline", icon: Trello },
      { label: "Approvals", path: "/approvals", icon: BarChart2 },
      { label: "Activities", path: "/activities", icon: Activity },
      { label: "Calendar", path: "/activities?tab=calendar", icon: Calendar },
      { label: "Targets", path: "/kpi", icon: BarChart2 },
      { label: "Customers", path: "/customers", icon: Users },
      { label: "Reports", path: "/executive-bi", icon: LayoutDashboard },
    ];
  } else if (isAdmin) {
    navItems = [
      { label: "Lead Intake", path: "/leads", icon: Inbox },
      { label: "All Leads", path: "/leads-table", icon: Users },
      { label: "Assignment Rules", path: "/rules", icon: BarChart2 },
      { label: "Automation", path: "/automation", icon: LayoutDashboard },
      { label: "Team Management", path: "/salespersons", icon: Users },
      { label: "Analytics", path: "/executive-bi", icon: BarChart2 },
      { label: "Audit Logs", path: "/settings?tab=audit", icon: Shield },
      { label: "Integrations", path: "/settings?tab=integrations", icon: LayoutDashboard },
    ];
  }

  const isCurrentActive = (itemPath: string) => {
    const currentPath = location.pathname;
    const currentSearch = location.search;

    if (itemPath.includes("?")) {
      const [pathPart, queryPart] = itemPath.split("?");
      return currentPath === pathPart && currentSearch.includes(queryPart);
    }

    if (itemPath === "/rep-portal") {
      return currentPath === "/rep-portal" || currentPath === "/";
    }

    return currentPath === itemPath || (itemPath !== "/" && currentPath.startsWith(itemPath));
  };

  return (
    <div className="flex flex-col h-screen w-full bg-[#F8FAFC] dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans overflow-hidden">
      
      {/* BRAND & ACTION HEADER */}
      <header className="h-14 border-b border-slate-200 dark:border-slate-800 bg-slate-900 text-white flex items-center justify-between px-6 shrink-0 z-30 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-primary text-white flex items-center justify-center font-black text-xs shadow-xs">
            NX
          </div>
          <div>
            <span className="font-extrabold text-xs tracking-tight text-white block leading-none">
              NEXUS CRM
            </span>
            <span className="text-[10px] text-cyan-400 font-semibold block">
              Representative Workspace · {repName}
            </span>
          </div>
        </div>

        {/* Command Palette Search Trigger */}
        <div className="flex-1 max-w-md mx-6">
          <button
            onClick={() => setIsCommandPaletteOpen(true)}
            className="w-full flex items-center gap-2 bg-slate-800/80 border border-slate-700/80 rounded-full px-3 py-1.5 text-xs text-slate-400 hover:border-slate-600 hover:text-slate-200 transition-all shadow-2xs"
          >
            <Search className="w-3.5 h-3.5 text-cyan-400" />
            <span className="flex-1 text-left font-medium">Search leads, deals, contacts...</span>
            <kbd className="px-1.5 py-0.5 text-[9px] font-mono font-bold bg-slate-900 text-slate-400 rounded border border-slate-700">
              Ctrl+K
            </kbd>
          </button>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsAiCopilotOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-xs font-bold rounded-full shadow-2xs hover:bg-primary/90 transition-all"
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-300" />
            <span>AI Assistant</span>
          </button>

          <button
            onClick={() => setIsNotificationsOpen(true)}
            className="p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition-colors relative"
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
          </button>

          <div className="h-4 w-px bg-slate-800 mx-1" />

          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 font-bold text-xs flex items-center justify-center text-cyan-300">
              {initials}
            </div>
            <button
              onClick={() => logout()}
              className="p-1.5 text-slate-400 hover:text-rose-400 transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* PERSISTENT FLAT TOP NAVIGATION BAR */}
      <nav className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 flex items-center gap-1 overflow-x-auto no-scrollbar shrink-0 shadow-2xs">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isCurrentActive(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-2 px-4 py-3 text-xs font-bold whitespace-nowrap transition-all border-b-2 ${
                active
                  ? "border-primary text-primary dark:text-cyan-400 bg-primary/5 dark:bg-primary/10"
                  : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50"
              }`}
            >
              <Icon className={`w-4 h-4 ${active ? "text-primary dark:text-cyan-400" : "text-slate-400"}`} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 overflow-y-auto relative">
        <WorkspaceTransition>
          <Outlet />
        </WorkspaceTransition>
      </main>

      {/* DRAWERS & MODALS */}
      <NotificationDrawer
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
      />

      <AiCopilotDrawer
        isOpen={isAiCopilotOpen}
        onClose={() => setIsAiCopilotOpen(false)}
      />

      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
      />
    </div>
  );
}
