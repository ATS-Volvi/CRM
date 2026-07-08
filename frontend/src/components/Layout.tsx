import { Outlet, Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Inbox, Trello, Receipt, FileText, Settings, Key, CheckSquare, BarChart, Search, Bell, Plus, Users } from "lucide-react";

export function Layout() {
  const location = useLocation();
  const navItems = [
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

  return (
    <div className="flex h-screen w-full bg-surface text-on-surface">
      <aside className="w-[260px] border-r border-outline-variant bg-surface-container-lowest flex flex-col">
        <div className="p-6 border-b border-outline-variant">
          <h2 className="text-title-sm text-primary font-bold">Nexus CRM</h2>
        </div>
        <nav className="flex-1 overflow-y-auto p-4 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path || (location.pathname.startsWith(item.path) && item.path !== "/");
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center space-x-3 px-3 py-2 rounded-lg text-body-sm transition-colors ${
                  isActive
                    ? "bg-primary-container text-on-primary-container font-medium"
                    : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </aside>
      
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-[64px] bg-surface-container-lowest border-b border-outline-variant flex items-center justify-between px-6 z-40 sticky top-0">
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
            <div className="flex items-center gap-2 px-3 py-1 bg-surface-container-high rounded-full">
              <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
              <span className="text-[12px] font-semibold tracking-wider text-primary">Live Sync</span>
            </div>
            <div className="flex items-center gap-1">
              <button className="p-2 text-on-surface-variant hover:text-primary transition-colors relative">
                <Bell className="w-5 h-5" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-error rounded-full"></span>
              </button>
            </div>
            <button className="flex items-center gap-2 py-2 px-4 bg-primary text-on-primary font-bold rounded-lg shadow-md hover:bg-primary-container transition-all active:scale-95">
              <Plus className="w-5 h-5" />
              <span className="text-sm">+ Quick Add</span>
            </button>
            <div className="flex items-center ml-2">
              <div className="w-8 h-8 rounded-full border border-outline-variant bg-surface-variant flex items-center justify-center text-primary font-bold">AK</div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-surface-bright">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
