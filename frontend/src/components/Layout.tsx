import { Outlet, Link, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { LayoutDashboard, Inbox, Trello, Receipt, FileText, Settings, Key, CheckSquare, BarChart, Search, Bell, Plus, Users, Calendar, UserPlus, PhoneCall, FileEdit, Menu, X, Moon, Sun } from "lucide-react";

export function Layout() {
  const location = useLocation();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    setIsDarkMode(document.documentElement.classList.contains('dark'));
  }, []);

  const toggleDarkMode = () => {
    const isDark = document.documentElement.classList.toggle('dark');
    setIsDarkMode(isDark);
  };

  const navItems = [
    { name: "My Today", path: "/today", icon: Calendar },
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
      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setIsMobileMenuOpen(false)}></div>
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-[260px] transform transition-transform duration-200 ease-in-out lg:relative lg:translate-x-0 border-r border-outline-variant bg-surface-container-lowest flex flex-col ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 border-b border-outline-variant flex justify-between items-center">
          <h2 className="text-title-sm text-primary font-bold">Nexus CRM</h2>
          <button onClick={() => setIsMobileMenuOpen(false)} className="lg:hidden text-on-surface-variant hover:text-primary">
            <X className="w-5 h-5" />
          </button>
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
                <Icon className="w-5 h-5 flex-shrink-0" />
                <span className="truncate">{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </aside>
      
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-[64px] bg-surface-container-lowest border-b border-outline-variant flex items-center justify-between px-4 lg:px-6 z-30 sticky top-0">
          <div className="flex items-center flex-1 max-w-xl gap-4">
            <button onClick={() => setIsMobileMenuOpen(true)} className="lg:hidden p-2 text-on-surface-variant hover:text-primary">
              <Menu className="w-6 h-6" />
            </button>
            <div className="relative w-full hidden sm:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant w-5 h-5" aria-hidden="true" />
              <input 
                type="text" 
                aria-label="Search leads, companies or files"
                className="w-full bg-surface border-none rounded-full pl-10 pr-4 py-2 text-body-sm focus:ring-2 focus:ring-primary focus:outline-none" 
                placeholder="Search leads, companies or files..." 
              />
            </div>
          </div>
          <div className="flex items-center gap-2 lg:gap-4">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-surface-container-high rounded-full">
              <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
              <span className="text-[12px] font-semibold tracking-wider text-primary">Live Sync</span>
            </div>
            <div className="flex items-center gap-1">
              <button 
                onClick={toggleDarkMode}
                className="p-2 text-on-surface-variant hover:text-primary transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg"
                aria-label="Toggle Dark Mode"
              >
                {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
            </div>
            
            <div className="relative">
              <button 
                onClick={() => { setShowNotifications(!showNotifications); setShowQuickAdd(false); }}
                className="p-2 text-on-surface-variant hover:text-primary transition-colors relative focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg"
                aria-label="Notifications"
              >
                <Bell className="w-5 h-5" />
                <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-error text-white text-[10px] font-bold flex items-center justify-center rounded-full">3</span>
              </button>
              
              {showNotifications && (
                <div className="absolute right-0 top-full mt-2 w-[300px] lg:w-80 bg-surface border border-outline-variant rounded-xl shadow-lg overflow-hidden z-50">
                  <div className="p-3 border-b border-outline-variant bg-surface-container-low flex justify-between items-center">
                    <h4 className="font-bold text-sm">Notifications</h4>
                    <button className="text-[10px] text-primary hover:underline font-bold uppercase">Mark all read</button>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    <div className="p-3 hover:bg-surface-container-lowest border-b border-outline-variant/30 cursor-pointer">
                      <p className="text-sm font-bold">Deal Won: Al Futtaim</p>
                      <p className="text-xs text-on-surface-variant mt-0.5">Sarah J. closed the deal for $45,000</p>
                      <p className="text-[10px] text-outline mt-1">2 mins ago</p>
                    </div>
                    <div className="p-3 hover:bg-surface-container-lowest border-b border-outline-variant/30 cursor-pointer bg-primary/5">
                      <div className="flex items-center justify-between mb-0.5">
                        <p className="text-sm font-bold text-primary">Approval Required</p>
                        <div className="w-2 h-2 bg-primary rounded-full"></div>
                      </div>
                      <p className="text-xs text-on-surface-variant">Quote QT-1200 exceeds 15% discount limit</p>
                      <p className="text-[10px] text-outline mt-1">1 hour ago</p>
                    </div>
                    <div className="p-3 hover:bg-surface-container-lowest cursor-pointer bg-primary/5">
                      <div className="flex items-center justify-between mb-0.5">
                        <p className="text-sm font-bold text-primary">New Lead Assigned</p>
                        <div className="w-2 h-2 bg-primary rounded-full"></div>
                      </div>
                      <p className="text-xs text-on-surface-variant">TechCorp Inc has been assigned to you</p>
                      <p className="text-[10px] text-outline mt-1">3 hours ago</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="relative">
              <button 
                onClick={() => { setShowQuickAdd(!showQuickAdd); setShowNotifications(false); }}
                className="flex items-center gap-1 lg:gap-2 py-2 px-3 lg:px-4 bg-primary text-on-primary font-bold rounded-lg shadow-md hover:bg-primary-container transition-all active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
                aria-label="Quick Add Menu"
              >
                <Plus className="w-5 h-5" />
                <span className="text-sm hidden sm:inline">Quick Add</span>
              </button>

              {showQuickAdd && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-surface border border-outline-variant rounded-xl shadow-lg overflow-hidden z-50 p-2 space-y-1">
                  <button className="w-full flex items-center gap-3 p-2 hover:bg-surface-container-low rounded-lg text-sm font-medium transition-colors text-left">
                    <UserPlus className="w-4 h-4 text-primary" /> Add New Lead
                  </button>
                  <button className="w-full flex items-center gap-3 p-2 hover:bg-surface-container-low rounded-lg text-sm font-medium transition-colors text-left">
                    <PhoneCall className="w-4 h-4 text-secondary" /> Log a Call
                  </button>
                  <button className="w-full flex items-center gap-3 p-2 hover:bg-surface-container-low rounded-lg text-sm font-medium transition-colors text-left">
                    <FileEdit className="w-4 h-4 text-tertiary" /> Create Quote
                  </button>
                  <button className="w-full flex items-center gap-3 p-2 hover:bg-surface-container-low rounded-lg text-sm font-medium transition-colors text-left">
                    <Calendar className="w-4 h-4 text-error" /> Schedule Meeting
                  </button>
                </div>
              )}
            </div>
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
