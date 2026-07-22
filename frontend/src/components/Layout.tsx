import { useState, useEffect } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  LayoutDashboard, Inbox, Trello, Receipt, FileText, Settings, Key, 
  CheckSquare, BarChart, Search, Bell, Plus, Users, Home, Database, 
  ChevronDown, ChevronRight, LogOut, Mail, Menu, ChevronLeft, Sparkles,
  Command, Phone, Calendar, Upload, Building2, UserPlus, FilePlus, Clock, BookOpen
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { CommandPalette } from "./CommandPalette";
import { NotificationDrawer } from "./NotificationDrawer";
import { QuickActionFab } from "./QuickActionFab";
import { AiCopilotDrawer } from "./AiCopilotDrawer";
import { DemoStoryGuide } from "./DemoStoryGuide";

export function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, token } = useAuth();
  const queryClient = useQueryClient();

  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isAiCopilotOpen, setIsAiCopilotOpen] = useState(false);

  // Keyboard shortcuts listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore when typing inside an input, textarea, or contenteditable
      const target = e.target as HTMLElement;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }

      // CTRL+K / CMD+K
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsCommandPaletteOpen(prev => !prev);
        return;
      }

      // Single-key shortcuts
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        const key = e.key.toLowerCase();
        if (key === "n") {
          e.preventDefault();
          navigate("/leads/new");
        } else if (key === "c") {
          e.preventDefault();
          navigate("/customers");
        } else if (key === "p") {
          e.preventDefault();
          navigate("/pipeline");
        } else if (key === "r") {
          e.preventDefault();
          navigate("/ai-reports");
        } else if (key === "t") {
          e.preventDefault();
          navigate("/home");
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [navigate]);

  // Fetch unread notifications count
  const { data: notifications = [] } = useQuery<any[]>({
    queryKey: ["notifications"],
    queryFn: async () => {
      if (!token) return [];
      const res = await fetch("/api/v1/notifications", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!token
  });

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const initials = user?.name 
    ? user.name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase() 
    : "U";

  const userRole = user?.role || "sales_rep";
  const isManagerOrAdmin = userRole === "sales_manager" || userRole === "admin" || userRole === "director";

  // Sidebar collapse state
  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem("sidebar_collapsed") === "true";
  });

  // Group expand states
  const [isReportsOpen, setIsReportsOpen] = useState(() => {
    const activeInReports = ["/pipeline", "/", "/kpi", "/salespersons", "/ai-reports"].includes(location.pathname);
    return activeInReports || localStorage.getItem("group_reports_expanded") === "true";
  });

  const [isMasterOpen, setIsMasterOpen] = useState(() => {
    const activeInMaster = location.pathname.startsWith("/master-data") || location.pathname === "/price-book";
    return activeInMaster || localStorage.getItem("group_master_expanded") === "true";
  });

  useEffect(() => {
    if (["/pipeline", "/", "/kpi", "/salespersons", "/ai-reports"].includes(location.pathname)) {
      setIsReportsOpen(true);
      localStorage.setItem("group_reports_expanded", "true");
    }
    if (location.pathname.startsWith("/master-data") || location.pathname === "/price-book") {
      setIsMasterOpen(true);
      localStorage.setItem("group_master_expanded", "true");
    }
  }, [location.pathname]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) setIsCollapsed(true);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    localStorage.setItem("sidebar_collapsed", String(isCollapsed));
  }, [isCollapsed]);

  const toggleReports = () => {
    setIsReportsOpen(prev => {
      localStorage.setItem("group_reports_expanded", String(!prev));
      return !prev;
    });
  };

  const toggleMaster = () => {
    setIsMasterOpen(prev => {
      localStorage.setItem("group_master_expanded", String(!prev));
      return !prev;
    });
  };

  // Core Primary Items
  const primaryItems = [
    { name: "My Dashboard", path: "/home", icon: Home },
    { name: "Lead Inbox", path: "/leads", icon: Inbox },
    { name: "Pipeline Kanban", path: "/pipeline", icon: Trello },
    { name: "Quotation Center", path: "/quotes", icon: FileText },
    { name: "Purchase Orders", path: "/purchase-orders", icon: CheckSquare },
    { name: "Customer 360", path: "/customers", icon: Users },
    { name: "Activities Hub", path: "/activities", icon: Calendar },
    { name: "Communication Center", path: "/communications", icon: Mail },
    { name: "Invoices & Billing", path: "/invoices", icon: Receipt }
  ];

  // Reports submenu items
  const reportsItems = [
    { name: "Management Ops", path: "/", icon: LayoutDashboard, visible: isManagerOrAdmin },
    { name: "KPI Dashboard", path: "/kpi", icon: BarChart, visible: isManagerOrAdmin },
    { name: "Sales Representatives", path: "/salespersons", icon: Users, visible: isManagerOrAdmin },
    { name: "Executive BI", path: "/executive-bi", icon: BarChart, visible: isManagerOrAdmin },
    { name: "AI Reports", path: "/ai-reports", icon: Sparkles, visible: isManagerOrAdmin }
  ].filter(i => i.visible);

  // Master Data submenu items
  const masterItems = [
    { name: "Requirements", path: "/master-data/requirements", icon: FileText },
    { name: "Line Items", path: "/master-data/line-items", icon: Database },
    { name: "Construction Items", path: "/master-data/construction-items", icon: Building2 },
    { name: "Pricing Grid", path: "/master-data/pricing", icon: BarChart },
    { name: "Lead Sources", path: "/master-data/lead-sources", icon: UserPlus },
    { name: "KPI Master", path: "/master-data/kpis", icon: Clock },
    { name: "Price Book", path: "/price-book", icon: BookOpen }
  ];

  // Administration items
  const adminItems = [
    { name: "Workflow Engine", path: "/automation", icon: Sparkles },
    { name: "Assignment Rules", path: "/rules", icon: Settings },
    { name: "Approval Queues", path: "/approvals", icon: CheckSquare },
    { name: "System Settings", path: "/settings", icon: Key }
  ];

  return (
    <div className="flex flex-col h-screen w-full bg-background text-foreground font-sans overflow-hidden">
      {/* ENTERPRISE DEMO STORY GUIDE BAR */}
      <DemoStoryGuide />

      <div className="flex flex-1 w-full overflow-hidden">
        {/* SIDEBAR NAVIGATION CHROME */}
      <aside 
        className={`bg-sidebar border-r border-sidebar-border flex flex-col h-full shrink-0 transition-all duration-300 ${
          isCollapsed ? "w-16" : "w-[260px]"
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 border-b border-sidebar-border flex items-center px-4 gap-3 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-black shrink-0 shadow-sm">
            N
          </div>
          {!isCollapsed && (
            <div className="min-w-0 animate-fade-in">
              <h2 className="text-sm font-black text-foreground tracking-tight truncate">NEXUS CRM</h2>
              <p className="text-[10px] font-semibold text-muted-foreground truncate">Enterprise Suite</p>
            </div>
          )}
        </div>

        {/* Scrollable Navigation Area */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-4">
          
          {/* Main Navigation Group */}
          <div className="space-y-1">
            {!isCollapsed && <p className="px-3 text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Core Modules</p>}
            {primaryItems.map(item => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.name}
                  to={item.path}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  }`}
                  title={isCollapsed ? item.name : undefined}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {!isCollapsed && <span className="animate-fade-in truncate">{item.name}</span>}
                </Link>
              );
            })}
          </div>

          {/* Reports Submenu Group */}
          {reportsItems.length > 0 && (
            <div className="space-y-1">
              {!isCollapsed ? (
                <button
                  onClick={toggleReports}
                  className="w-full flex items-center justify-between px-3 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider hover:text-primary transition-all"
                >
                  <span>Analytics & Intelligence</span>
                  <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${isReportsOpen ? "rotate-0" : "-rotate-90"}`} />
                </button>
              ) : (
                <div className="border-t border-sidebar-border my-2" />
              )}

              {(isReportsOpen || isCollapsed) && (
                <div className={`${!isCollapsed ? "pl-2 border-l border-sidebar-border/60 ml-3 space-y-1" : "space-y-1"}`}>
                  {reportsItems.map(item => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.path;
                    return (
                      <Link
                        key={item.name}
                        to={item.path}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                          isActive
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        }`}
                        title={isCollapsed ? item.name : undefined}
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                        {!isCollapsed && <span className="animate-fade-in">{item.name}</span>}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Master Data Accordion Group */}
          {isManagerOrAdmin && (
            <div className="space-y-1">
              {!isCollapsed ? (
                <button
                  onClick={toggleMaster}
                  className="w-full flex items-center justify-between px-3 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider hover:text-primary transition-all"
                >
                  <span>Master Data</span>
                  <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${isMasterOpen ? "rotate-0" : "-rotate-90"}`} />
                </button>
              ) : (
                <div className="border-t border-sidebar-border my-2" />
              )}

              {(isMasterOpen || isCollapsed) && (
                <div className={`${!isCollapsed ? "pl-2 border-l border-sidebar-border/60 ml-3 space-y-1" : "space-y-1"}`}>
                  {masterItems.map(item => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.path;
                    return (
                      <Link
                        key={item.name}
                        to={item.path}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                          isActive
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        }`}
                        title={isCollapsed ? item.name : undefined}
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                        {!isCollapsed && <span className="animate-fade-in truncate">{item.name}</span>}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Administration Group */}
          {isManagerOrAdmin && (
            <div className="space-y-1">
              {!isCollapsed && <p className="px-3 text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Administration</p>}
              {adminItems.map(item => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.name}
                    to={item.path}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                      isActive
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    }`}
                    title={isCollapsed ? item.name : undefined}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    {!isCollapsed && <span className="animate-fade-in truncate">{item.name}</span>}
                  </Link>
                );
              })}
            </div>
          )}

        </nav>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-sidebar-border space-y-2 shrink-0">
          <button
            onClick={() => logout()}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-bold text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all"
            title={isCollapsed ? "Sign Out" : undefined}
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {!isCollapsed && <span>Sign Out</span>}
          </button>

          <button
            onClick={() => setIsCollapsed(v => !v)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-bold text-muted-foreground hover:bg-sidebar-accent transition-all"
          >
            <div className="flex items-center gap-3">
              <Menu className="w-4 h-4 shrink-0" />
              {!isCollapsed && <span>Collapse Sidebar</span>}
            </div>
            {!isCollapsed && <ChevronLeft className="w-3.5 h-3.5" />}
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* TOP NAVBAR & PERSISTENT COMMAND CENTER SEARCH */}
        <header className="h-16 border-b border-border bg-card flex items-center justify-between px-6 shrink-0 gap-4">
          
          {/* Persistent Global Search Bar with CTRL+K badge */}
          <div className="flex-1 max-w-xl">
            <button
              onClick={() => setIsCommandPaletteOpen(true)}
              className="w-full flex items-center gap-3 bg-muted/40 hover:bg-muted border border-border rounded-xl px-4 py-2 text-xs text-muted-foreground transition-all shadow-2xs group"
            >
              <Search className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
              <span className="flex-1 text-left font-medium">Search leads, customers, deals, quotes...</span>
              <kbd className="px-2 py-0.5 text-[10px] font-mono font-bold bg-background text-muted-foreground rounded border border-border shadow-2xs">
                CTRL + K
              </kbd>
            </button>
          </div>

          {/* Quick Action Buttons & Notifications */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Quick Actions launcher */}
            <div className="hidden lg:flex items-center gap-1.5">
              <button
                onClick={() => navigate("/leads/new")}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-lg transition-all"
              >
                <Plus className="w-3.5 h-3.5" /> Lead
              </button>
              <button
                onClick={() => navigate("/quotes/new")}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-violet-50 hover:bg-violet-100 text-violet-700 text-xs font-bold rounded-lg transition-all"
              >
                <FileText className="w-3.5 h-3.5" /> Quote
              </button>
              <button
                onClick={() => navigate("/customers")}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold rounded-lg transition-all"
              >
                <Users className="w-3.5 h-3.5" /> Customer
              </button>
            </div>

            {/* AI Copilot Trigger */}
            <button
              onClick={() => setIsAiCopilotOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all"
              title="AI Sales Copilot"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" /> AI Copilot
            </button>

            {/* Notification Drawer Launcher */}
            <button
              onClick={() => setIsNotificationsOpen(true)}
              className="relative p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-all"
              title="Notifications"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-destructive animate-pulse" />
              )}
            </button>

            {/* User Avatar */}
            <div className="flex items-center gap-2 pl-2 border-l border-border">
              <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground font-extrabold text-xs flex items-center justify-center">
                {initials}
              </div>
            </div>
          </div>
        </header>

        {/* PAGE CONTENT */}
        <main className="flex-1 overflow-y-auto bg-background">
          <Outlet />
        </main>
      </div>
    </div>

      {/* GLOBAL COMMAND PALETTE MODAL */}
      <CommandPalette isOpen={isCommandPaletteOpen} onClose={() => setIsCommandPaletteOpen(false)} />

      {/* RIGHT SLIDE NOTIFICATION DRAWER */}
      <NotificationDrawer isOpen={isNotificationsOpen} onClose={() => setIsNotificationsOpen(false)} />

      {/* AI COPILOT DRAWER */}
      <AiCopilotDrawer isOpen={isAiCopilotOpen} onClose={() => setIsAiCopilotOpen(false)} />

      {/* FLOATING QUICK ACTION FAB */}
      <QuickActionFab />
    </div>
  );
}
