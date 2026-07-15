import { useState } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Inbox, Trello, Receipt, FileText, Settings, Key, CheckSquare, BarChart, Search, Bell, Plus, Users, Home, Database, ChevronDown, ChevronRight, LogOut, Mail } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export function Layout() {
  const location = useLocation();
  const { user, logout } = useAuth();
  const initials = user?.name 
    ? user.name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase() 
    : "U";

  const navItems = [
    { name: "My Dashboard", path: "/home", icon: Home },
    { name: "Management Dashboard", path: "/", icon: LayoutDashboard },
    { name: "KPI Dashboard", path: "/kpi", icon: BarChart },
    { name: "Sales Representatives", path: "/salespersons", icon: Users },
    { name: "Lead Inbox", path: "/leads", icon: Inbox },
    { name: "Pipeline", path: "/pipeline", icon: Trello },
    { name: "Quotes", path: "/quotes", icon: FileText },
    { name: "Invoices", path: "/invoices", icon: Receipt },
    { name: "Price Book", path: "/price-book", icon: Receipt },
    { name: "Purchase Orders", path: "/purchase-orders", icon: CheckSquare },
    { name: "Approvals", path: "/approvals", icon: Key },
    { name: "Assignment Rules", path: "/rules", icon: Settings },
  ];

  const [isMasterExpanded, setIsMasterExpanded] = useState(location.pathname.startsWith("/master-data"));
  const isMasterActive = location.pathname.startsWith("/master-data");
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);

  return (
    <div className="flex h-screen w-full bg-surface text-on-surface">
      <aside className="w-[260px] border-r border-outline-variant bg-surface-container-lowest flex flex-col">
        <div className="p-6 border-b border-outline-variant">
          <h2 className="text-title-sm text-primary font-bold">Nexus CRM</h2>
        </div>
        <nav className="flex-1 overflow-y-auto p-4 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.name}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
                }`}
              >
                <Icon className="w-5 h-5" />
                {item.name}
              </Link>
            );
          })}
          
          <div>
            <button
              onClick={() => setIsMasterExpanded(!isMasterExpanded)}
              className={`w-full flex items-center justify-between px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                isMasterActive
                  ? "bg-primary/5 text-primary"
                  : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
              }`}
            >
              <div className="flex items-center gap-3">
                <Database className="w-5 h-5" />
                <span>Master Data</span>
              </div>
              {isMasterExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
            
            {isMasterExpanded && (
              <div className="pl-11 mt-1 space-y-1">
                <Link
                  to="/master-data/requirements"
                  className={`block px-4 py-2 rounded-lg text-xs font-semibold ${
                    location.pathname === "/master-data/requirements"
                      ? "text-primary bg-primary/5"
                      : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
                  }`}
                >
                  Requirements
                </Link>
                <Link
                  to="/master-data/line-items"
                  className={`block px-4 py-2 rounded-lg text-xs font-semibold ${
                    location.pathname === "/master-data/line-items"
                      ? "text-primary bg-primary/5"
                      : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
                  }`}
                >
                  Line Items
                </Link>
                <Link
                  to="/master-data/construction-items"
                  className={`block px-4 py-2 rounded-lg text-xs font-semibold ${
                    location.pathname === "/master-data/construction-items"
                      ? "text-primary bg-primary/5"
                      : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
                  }`}
                >
                  Construction Items
                </Link>
                <Link
                  to="/master-data/pricing"
                  className={`block px-4 py-2 rounded-lg text-xs font-semibold ${
                    location.pathname === "/master-data/pricing"
                      ? "text-primary bg-primary/5"
                      : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
                  }`}
                >
                  Pricing Grid
                </Link>
              </div>
            )}
          </div>
        </nav>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-[72px] border-b border-outline-variant bg-surface-container-lowest px-8 flex items-center justify-between gap-4">
          <div className="flex items-center flex-1 max-w-xl">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant w-5 h-5" />
              <input 
                type="text" 
                className="w-full bg-surface border-none rounded-full pl-10 pr-4 py-2 text-body-sm focus:ring-1 focus:ring-primary" 
                placeholder="Search leads, companies or files..." 
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button className="p-2 text-on-surface-variant hover:text-primary transition-colors relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-error rounded-full"></span>
            </button>
            
            <div className="relative">
              <button 
                onClick={() => setIsQuickAddOpen(!isQuickAddOpen)}
                className="flex items-center gap-2 py-2 px-4 bg-primary text-on-primary font-bold rounded-lg shadow-md hover:bg-primary-container transition-all active:scale-95"
              >
                <Plus className="w-5 h-5" />
                <span className="text-sm">+ Quick Add</span>
              </button>

              {isQuickAddOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setIsQuickAddOpen(false)} />
                  <div className="absolute right-0 mt-2 w-56 bg-white border border-outline-variant rounded-xl shadow-xl z-20 py-2 animate-scale-up">
                    <Link 
                      to="/leads" 
                      onClick={() => setIsQuickAddOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm font-semibold text-on-surface hover:bg-slate-50 transition-colors"
                    >
                      <Inbox className="w-4 h-4 text-primary" />
                      Add New Lead
                    </Link>
                    <Link 
                      to="/quotes/new" 
                      onClick={() => setIsQuickAddOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm font-semibold text-on-surface hover:bg-slate-50 transition-colors"
                    >
                      <FileText className="w-4 h-4 text-secondary" />
                      Build New Quote
                    </Link>
                    <Link 
                      to="/purchase-orders" 
                      onClick={() => setIsQuickAddOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm font-semibold text-on-surface hover:bg-slate-50 transition-colors"
                    >
                      <CheckSquare className="w-4 h-4 text-emerald-600" />
                      New Purchase Order
                    </Link>
                    <Link 
                      to="/rules" 
                      onClick={() => setIsQuickAddOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm font-semibold text-on-surface hover:bg-slate-50 transition-colors"
                    >
                      <Settings className="w-4 h-4 text-amber-500" />
                      Add Assignment Rule
                    </Link>
                  </div>
                </>
              )}
            </div>

            <div className="flex items-center ml-2">
              <div className="w-8 h-8 rounded-full border border-outline-variant bg-surface-variant flex items-center justify-center text-primary font-bold" title={user?.name || "User"}>
                {initials}
              </div>
            </div>
            <button 
              onClick={() => {
                logout();
                window.location.href = "/login";
              }}
              className="ml-2 flex items-center gap-1 p-2 text-on-surface-variant hover:text-error transition-colors rounded-lg"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-surface-bright">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
