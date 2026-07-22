import { useState, useEffect } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  LayoutDashboard, Inbox, Trello, Receipt, FileText, Settings, Key, 
  CheckSquare, BarChart, Search, Bell, Plus, Users, Home, Database, 
  ChevronDown, ChevronRight, LogOut, Mail, Menu, ChevronLeft, Sparkles,
  Command, Phone, Calendar, Upload, Building2, UserPlus, FilePlus
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

export function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, token } = useAuth();
  const queryClient = useQueryClient();

  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  // Keyboard shortcut for CTRL+K / CMD+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setIsSearchFocused(prev => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Fetch real search results
  const { data: searchResults, isLoading: isSearching } = useQuery<any>({
    queryKey: ["globalSearch", searchQuery],
    queryFn: async () => {
      if (!token || !searchQuery || searchQuery.trim().length < 2) {
        return { leads: [], customers: [], deals: [], quotes: [], tasks: [] };
      }
      const res = await fetch(`/api/v1/search?q=${encodeURIComponent(searchQuery)}`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) return { leads: [], customers: [], deals: [], quotes: [], tasks: [] };
      return res.json();
    },
    enabled: !!token && searchQuery.trim().length >= 2
  });

  // Fetch real notifications
  const { data: notifications, isLoading: isLoadingNotifications } = useQuery<any[]>({
    queryKey: ["notifications"],
    queryFn: async () => {
      if (!token) return [];
      const res = await fetch("/api/v1/notifications", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to fetch notifications");
      return res.json();
    },
    enabled: !!token
  });

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/v1/notifications/${id}/read`, {
        method: "PUT",
        headers: { "Authorization": `Bearer ${token}` }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    }
  });

  const readAllMutation = useMutation({
    mutationFn: async () => {
      await fetch("/api/v1/notifications/read-all", {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    }
  });

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
          <div className="flex items-center flex-1 max-w-xl relative">
            <div className="relative w-full">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <input 
                type="text" 
                value={searchQuery}
                onFocus={() => setIsSearchFocused(true)}
                onChange={e => {
                  setSearchQuery(e.target.value);
                  setIsSearchFocused(true);
                }}
                className="w-full bg-muted border border-border rounded-xl pl-10 pr-16 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary transition-all" 
                placeholder="Global search across leads, customers, deals, quotes (Press CTRL+K)..."
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-[10px] font-bold text-muted-foreground bg-card border border-border px-1.5 py-0.5 rounded">
                <Command className="w-3 h-3" /> K
              </div>
            </div>

            {/* Instant Fuzzy Search Overlay */}
            {isSearchFocused && searchQuery.trim().length >= 2 && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setIsSearchFocused(false)} />
                <div className="absolute top-12 left-0 right-0 bg-card border border-border rounded-xl shadow-xl z-40 p-4 max-h-96 overflow-y-auto text-xs space-y-4">
                  {isSearching ? (
                    <div className="text-center py-4 text-muted-foreground font-medium animate-pulse">Searching CRM records...</div>
                  ) : (
                    <>
                      {/* Leads results */}
                      {searchResults?.leads?.length > 0 && (
                        <div>
                          <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1.5">Leads</p>
                          <div className="space-y-1">
                            {searchResults.leads.map((l: any) => (
                              <div 
                                key={l.id} 
                                onClick={() => { navigate(`/leads/${l.id}`); setIsSearchFocused(false); }}
                                className="p-2 hover:bg-muted rounded-lg cursor-pointer flex justify-between items-center"
                              >
                                <div>
                                  <p className="font-bold text-foreground">{l.firstName} {l.lastName}</p>
                                  <p className="text-[10px] text-muted-foreground">{l.company || l.email}</p>
                                </div>
                                <span className="text-[9px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded">{l.status}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Customers results */}
                      {searchResults?.customers?.length > 0 && (
                        <div>
                          <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1.5">Customers</p>
                          <div className="space-y-1">
                            {searchResults.customers.map((c: any) => (
                              <div 
                                key={c.id} 
                                onClick={() => { navigate(`/customers`); setIsSearchFocused(false); }}
                                className="p-2 hover:bg-muted rounded-lg cursor-pointer flex justify-between items-center"
                              >
                                <div>
                                  <p className="font-bold text-foreground">{c.name}</p>
                                  <p className="text-[10px] text-muted-foreground">{c.email}</p>
                                </div>
                                <span className="text-[9px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded">Customer</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Quotes results */}
                      {searchResults?.quotes?.length > 0 && (
                        <div>
                          <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1.5">Quotations</p>
                          <div className="space-y-1">
                            {searchResults.quotes.map((q: any) => (
                              <div 
                                key={q.id} 
                                onClick={() => { navigate(`/quotes`); setIsSearchFocused(false); }}
                                className="p-2 hover:bg-muted rounded-lg cursor-pointer flex justify-between items-center"
                              >
                                <div>
                                  <p className="font-bold text-foreground">{q.quoteNumber}</p>
                                  <p className="text-[10px] text-muted-foreground">${q.totalAmount}</p>
                                </div>
                                <span className="text-[9px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded">{q.status}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {(!searchResults?.leads?.length && !searchResults?.customers?.length && !searchResults?.quotes?.length) && (
                        <div className="text-center py-4 text-muted-foreground italic">No matching records found.</div>
                      )}
                    </>
                  )}
                </div>
              </>
            )}
          </div>
          <div className="flex items-center gap-4">
            {/* Notifications Popover */}
            <div className="relative">
              <button 
                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                className="p-2 text-muted-foreground hover:text-primary transition-colors relative"
              >
                <Bell className="w-4 h-4" />
                {notifications?.some((n: any) => !n.isRead) && (
                  <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-destructive rounded-full"></span>
                )}
              </button>

              {isNotificationsOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setIsNotificationsOpen(false)} />
                  <div className="absolute right-0 mt-2 w-80 bg-card border border-border rounded-xl shadow-lg z-20 py-2 animate-scale-up max-h-96 overflow-y-auto">
                    <div className="px-4 py-2 border-b border-border flex justify-between items-center">
                      <span className="font-bold text-xs">Notifications</span>
                      {notifications?.some((n: any) => !n.isRead) && (
                        <button 
                          onClick={() => readAllMutation.mutate()}
                          className="text-[10px] text-primary font-bold hover:underline"
                        >
                          Mark all read
                        </button>
                      )}
                    </div>
                    {isLoadingNotifications ? (
                      <div className="p-4 text-center text-xs text-muted-foreground animate-pulse">Loading...</div>
                    ) : !notifications || notifications.length === 0 ? (
                      <div className="p-4 text-center text-xs text-muted-foreground">No notifications</div>
                    ) : (
                      <div className="divide-y divide-border">
                        {notifications.map((n: any) => (
                          <div 
                            key={n.id} 
                            onClick={() => {
                              if (!n.isRead) markReadMutation.mutate(n.id);
                              setIsNotificationsOpen(false);
                            }}
                            className={`px-4 py-2.5 hover:bg-muted transition-colors cursor-pointer text-left ${!n.isRead ? 'bg-primary/5' : ''}`}
                          >
                            <p className="text-xs font-semibold text-foreground">{n.title || n.message}</p>
                            {n.body && <p className="text-[10px] text-muted-foreground mt-0.5">{n.body}</p>}
                            <span className="text-[9px] text-muted-foreground block mt-1">
                              {new Date(n.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
            
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

        {/* Main Content Workspace */}
        <main className="flex-1 overflow-y-auto bg-background relative">
          <Outlet />

          {/* Floating AI Assistant Drawer */}
          {isAiOpen && (
            <div className="fixed bottom-6 right-6 w-96 bg-card border border-border rounded-2xl shadow-2xl z-50 p-5 space-y-4 animate-scale-up">
              <div className="flex justify-between items-center border-b border-border pb-3">
                <h3 className="text-sm font-black text-foreground flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" /> AI Sales Assistant
                </h3>
                <button onClick={() => setIsAiOpen(false)} className="text-muted-foreground hover:text-foreground">
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-3 text-xs">
                <div className="p-3 bg-primary/5 border border-primary/10 rounded-xl space-y-1.5">
                  <p className="font-bold text-foreground">Pipeline Recommendation:</p>
                  <p className="text-muted-foreground leading-relaxed">
                    You have leads pending quotation in "Qualified" stage. Converting them today could increase monthly closure rate.
                  </p>
                </div>
                <div className="space-y-1">
                  <button 
                    onClick={() => { navigate("/pipeline"); setIsAiOpen(false); }}
                    className="w-full text-left p-2 hover:bg-primary/10 text-primary font-bold rounded-lg transition-colors"
                  >
                    → Open Pipeline Kanban
                  </button>
                  <button 
                    onClick={() => { navigate("/ai-reports"); setIsAiOpen(false); }}
                    className="w-full text-left p-2 hover:bg-primary/10 text-primary font-bold rounded-lg transition-colors"
                  >
                    → View AI Executive Summary
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
