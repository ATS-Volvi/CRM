import { Outlet, Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Inbox, Trello, Receipt, FileText, Settings, Key, CheckSquare, BarChart } from "lucide-react";

export function Layout() {
  const location = useLocation();
  const navItems = [
    { name: "Management Dashboard", path: "/", icon: LayoutDashboard },
    { name: "KPI Dashboard", path: "/kpi", icon: BarChart },
    { name: "Lead Inbox", path: "/leads", icon: Inbox },
    { name: "Pipeline", path: "/pipeline", icon: Trello },
    { name: "Quotes", path: "/quotes", icon: FileText },
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
      
      <main className="flex-1 overflow-y-auto bg-surface-bright">
        <Outlet />
      </main>
    </div>
  );
}
