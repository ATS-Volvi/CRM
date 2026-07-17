import { useState, useEffect } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { 
  LayoutDashboard, Inbox, Trello, Receipt, FileText, Settings, Key, 
  CheckSquare, BarChart, Search, Bell, Plus, Users, Home, Database, 
  ChevronDown, ChevronRight, LogOut, Mail, Menu, ChevronLeft
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

export function Layout() {
  const location = useLocation();
  const { user, logout } = useAuth();
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

  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);

  // Core flat top-level items
  const flatItems = [
    { name: "My Dashboard", path: "/home", icon: Home },
    { name: "Lead Inbox", path: "/leads", icon: Inbox },
    { name: "Quotes", path: "/quotes", icon: FileText },
    { name: "Purchase Orders", path: "/purchase-orders", icon: CheckSquare },
    { name: "Customers", path: "/customers", icon: Users }
  ];

  // Reports submenu items
  const reportsItems = [
    { name: "Pipeline", path: "/pipeline", icon: Trello, visible: true },
    { name: "Management Dashboard", path: "/", icon: LayoutDashboard, visible: isManagerOrAdmin },
    { name: "KPI Dashboard", path: "/kpi", icon: BarChart, visible: isManagerOrAdmin },
    { name: "Sales Representatives", path: "/salespersons", icon: Users, visible: isManagerOrAdmin },
    { name: "AI Reports", path: "/ai-reports", icon: Mail, visible: isManagerOrAdmin }
  ].filter(i => i.visible);

  // Master Data submenu items (Only visible to managers/admins)
  const masterItems = [
    { name: "Requirements", path: "/master-data/requirements" },
    { name: "Line Items", path: "/master-data/line-items" },
    { name: "Construction Items", path: "/master-data/construction-items" },
    { name: "Pricing Grid", path: "/master-data/pricing" },
    { name: "Lead Sources", path: "/master-data/lead-sources" },
    { name: "KPI Master", path: "/master-data/kpis" },
    { name: "Price Book", path: "/price-book" }
  ];

  return (
    <div className="flex h-screen w-full bg-background text-foreground font-sans overflow-hidden">
      {/* Sidebar chrome */}
      <aside 
        className={`bg-sidebar border-r border-sidebar-border flex flex-col h-full shrink-0 transition-all duration-300 ${
          isCollapsed ? "w-16" : "w-[260px]"
        }`}
      >
        {/* Fixed-height logo header (h-16) */}
        <div className="h-16 border-b border-sidebar-border flex items-center px-4 gap-3 shrink-0">
          <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center text-white font-bold shrink-0 shadow-sm">
            N
          </div>
          {!isCollapsed && (
            <div className="min-w-0 animate-fade-in">
              <h2 className="text-sm font-bold text-foreground truncate">Nexus CRM</h2>
              <p className="text-[10px] text-muted-foreground truncate">Face Contracting Suite</p>
            </div>
          )}
        </div>

        {/* Scrollable Navigation Area */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-4">
          
          {/* Top-Level Flat Group */}
          <div className="space-y-1">
            {flatItems.map(item => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.name}
                  to={item.path}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                    isActive
                      ? "bg-primary/10 text-primary glow-primary"
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

          {/* Reports Submenu Group */}
          {reportsItems.length > 0 && (
            <div className="space-y-1">
              {!isCollapsed ? (
                <button
                  onClick={toggleReports}
                  className="w-full flex items-center justify-between px-3 py-1.5 text-[10px] font-bold text-sidebar-foreground/70 uppercase tracking-wider hover:text-primary transition-all"
                >
                  <span>Reports</span>
                  <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${isReportsOpen ? "rotate-0" : "-rotate-90"}`} />
                </button>
              ) : (
                <div className="border-t border-sidebar-border my-2" />
              )}

              {(isReportsOpen || isCollapsed) && (
                <div className={`${!isCollapsed ? "pl-2 border-l border-sidebar-border/60 ml-4 space-y-1" : "space-y-1"}`}>
                  {reportsItems.map(item => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.path;
                    return (
                      <Link
                        key={item.name}
                        to={item.path}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                          isActive
                            ? "bg-primary/10 text-primary glow-primary"
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

          {/* Master Data Configuration Submenu Group */}
          {isManagerOrAdmin && (
            <div className="space-y-1">
              {!isCollapsed ? (
                <button
                  onClick={toggleMaster}
                  className="w-full flex items-center justify-between px-3 py-1.5 text-[10px] font-bold text-sidebar-foreground/70 uppercase tracking-wider hover:text-primary transition-all"
                >
                  <span>Master Data</span>
                  <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${isMasterOpen ? "rotate-0" : "-rotate-90"}`} />
                </button>
              ) : (
                <div className="border-t border-sidebar-border my-2" />
              )}

              {(isMasterOpen || isCollapsed) && (
                <div className={`${!isCollapsed ? "pl-2 border-l border-sidebar-border/60 ml-4 space-y-1" : "space-y-1"}`}>
                  {masterItems.map(item => {
                    const isActive = location.pathname === item.path;
                    return (
                      <Link
                        key={item.name}
                        to={item.path}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                          isActive
                            ? "bg-primary/10 text-primary glow-primary"
                            : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        }`}
                        title={isCollapsed ? item.name : undefined}
                      >
                        <Database className="w-4 h-4 shrink-0" />
                        {!isCollapsed && <span className="animate-fade-in truncate">{item.name}</span>}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}

        </nav>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-sidebar-border shrink-0 space-y-1">
          {/* Sign Out row */}
          <button 
            onClick={() => {
              logout();
              window.location.href = "/login";
            }}
            className="w-full flex items-center gap-3 px-3 py-2 text-xs font-bold rounded-lg text-sidebar-foreground hover:bg-destructive/10 hover:text-destructive transition-all"
            title={isCollapsed ? "Logout" : undefined}
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {!isCollapsed && <span className="animate-fade-in">Sign Out</span>}
          </button>

          {/* Width collapse toggle button */}
          <button 
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="w-full flex items-center gap-3 px-3 py-2 text-xs font-bold rounded-lg text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all"
            title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4 shrink-0" /> : <ChevronLeft className="w-4 h-4 shrink-0" />}
            {!isCollapsed && <span className="animate-fade-in">Collapse Sidebar</span>}
          </button>
        </div>
      </aside>

      {/* Main Workspace chrome */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-sidebar-border bg-card px-8 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center flex-1 max-w-xl">
            <div className="relative w-full">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <input 
                type="text" 
                disabled
                className="w-full bg-muted border border-border rounded-full pl-10 pr-4 py-2 text-xs font-semibold cursor-not-allowed opacity-75 focus:outline-none" 
                placeholder="Global search coming soon..."
                title="Global Search is currently disabled"
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button className="p-2 text-muted-foreground hover:text-primary transition-colors relative">
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-destructive rounded-full"></span>
            </button>
            
            <div className="relative">
              <button 
                onClick={() => setIsQuickAddOpen(!isQuickAddOpen)}
                className="flex items-center gap-2 py-1.5 px-4 bg-primary text-primary-foreground font-bold rounded-lg shadow-sm hover:opacity-90 transition-all active:scale-95 text-xs"
              >
                <Plus className="w-4 h-4" />
                <span>Quick Add</span>
              </button>

              {isQuickAddOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setIsQuickAddOpen(false)} />
                  <div className="absolute right-0 mt-2 w-56 bg-card border border-border rounded-xl shadow-lg z-20 py-2 animate-scale-up">
                    <Link 
                      to="/leads/new" 
                      onClick={() => setIsQuickAddOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-xs font-bold text-foreground hover:bg-muted transition-colors"
                    >
                      <Inbox className="w-4 h-4 text-primary" />
                      Add New Lead
                    </Link>
                    <Link 
                      to="/quotes/new" 
                      onClick={() => setIsQuickAddOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-xs font-bold text-foreground hover:bg-muted transition-colors"
                    >
                      <FileText className="w-4 h-4 text-primary" />
                      Build New Quote
                    </Link>
                    <Link 
                      to="/purchase-orders" 
                      onClick={() => setIsQuickAddOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-xs font-bold text-foreground hover:bg-muted transition-colors"
                    >
                      <CheckSquare className="w-4 h-4 text-success" />
                      New Purchase Order
                    </Link>
                    {isManagerOrAdmin && (
                      <Link 
                        to="/rules" 
                        onClick={() => setIsQuickAddOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-xs font-bold text-foreground hover:bg-muted transition-colors"
                      >
                        <Settings className="w-4 h-4 text-accent" />
                        Add Assignment Rule
                      </Link>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="flex items-center ml-2">
              <div className="w-8 h-8 rounded-full border border-border bg-muted flex items-center justify-center text-primary font-extrabold text-xs" title={user?.name || "User"}>
                {initials}
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-background">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
