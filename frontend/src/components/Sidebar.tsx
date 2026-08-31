import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { 
  LayoutDashboard, Home, Inbox, Trello, FileText, Receipt, 
  Users, BarChart, Settings, Clock, ChevronLeft, 
  ChevronRight, MessageSquare, CheckSquare, Search, Bell, Sparkles, LogOut, ChevronDown, Layers, Package, Building2, LifeBuoy, Target,
  UserCheck, Shield, Briefcase, Megaphone
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

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

  const primaryNavItems: NavItem[] = [
    { label: "Dashboard", path: "/", icon: LayoutDashboard },
    { 
      label: "Sales Division", 
      icon: Briefcase,
      subItems: [
        { label: "Leads", path: "/leads", icon: Users },
        { label: "Campaigns", path: "/campaigns", icon: Megaphone },
        { label: "Opportunities", path: "/opportunities", icon: Target },
        { label: "Pipeline", path: "/pipeline", icon: Trello },
      ]
    },
    { 
      label: "CRM", 
      icon: Building2,
      subItems: [
        { label: "Accounts", path: "/accounts", icon: Building2 },
        { label: "Contacts", path: "/contacts", icon: Users },
        { label: "Business Users", path: "/salespersons", icon: UserCheck },
      ]
    },
    { label: "Settings", path: "/master-data/requirements", icon: Settings },
  ];

  // Track open dropdowns (default open for active route)
  const [openDropdowns, setOpenDropdowns] = useState<Record<string, boolean>>({
    "Sales Division": true,
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
      className={`bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col justify-between transition-all duration-300 z-20 shrink-0 select-none ${
        isCollapsed ? "w-16" : "w-64"
      }`}
    >
      {/* Sidebar Header */}
      <div className="p-4 border-b border-slate-100 dark:border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          {!isCollapsed && <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-xl text-white flex items-center justify-center font-black text-xs shadow-md ${
                  userRole === "sales_rep" 
                    ? "bg-gradient-to-tr from-purple-600 via-indigo-600 to-emerald-500 shadow-purple-500/30" 
                    : "bg-gradient-to-tr from-blue-600 to-indigo-600 shadow-blue-500/20"
                }`}>
                  NX
                </div>
                <div>
                  <span className="font-extrabold text-sm tracking-tight text-slate-900 dark:text-white block leading-none">
                    NEXUS CRM
                  </span>
                  <span className={`text-[10px] font-bold block ${
                    userRole === "sales_rep" ? "text-purple-600 dark:text-purple-400" : "text-blue-600 dark:text-blue-400"
                  }`}>
                    {userRole === "sales_rep" ? "Sales OS Rep" : "Workspace OS"}
                  </span>
                </div>
              </div>
            }
            {isCollapsed && (
              <div className={`w-8 h-8 rounded-xl text-white flex items-center justify-center font-black text-xs mx-auto shadow-md ${
                userRole === "sales_rep"
                  ? "bg-gradient-to-tr from-purple-600 to-emerald-500 shadow-purple-500/30"
                  : "bg-gradient-to-tr from-blue-600 to-indigo-600 shadow-blue-500/20"
              }`}>
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
                className={`flex-1 flex items-center gap-2 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-xl px-2.5 py-1.5 text-xs font-bold transition-all ${
                  isCollapsed ? "justify-center" : ""
                }`}
                title="AI Copilot"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0 animate-pulse" />
                {!isCollapsed && <span>AI Copilot</span>}
              </button>
            )}

            {onOpenNotifications && (
              <button
                onClick={onOpenNotifications}
                className="p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300 rounded-xl transition-colors shrink-0"
                title="Notifications"
              >
                <Bell className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 5 Core Pillars Navigation List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1.5 no-scrollbar">
        {primaryNavItems.map((item) => {
          const Icon = item.icon;
          const hasSubItems = item.subItems && item.subItems.length > 0;
          const isDropdownOpen = !!openDropdowns[item.label];
          
          const isItemActive = item.path 
            ? (location.pathname === item.path || (item.path !== "/" && location.pathname.startsWith(item.path)))
            : (item.subItems?.some(sub => location.pathname === sub.path || (sub.path !== "/" && location.pathname.startsWith(sub.path))) || false);

          if (hasSubItems) {
            return (
              <div key={item.label} className="space-y-1">
                <button
                  type="button"
                  onClick={() => {
                    if (isCollapsed) {
                      toggleCollapse();
                    }
                    toggleDropdown(item.label);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl font-bold text-xs transition-all group cursor-pointer ${
                    isItemActive
                      ? "bg-primary/10 text-primary dark:bg-primary/20"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"
                  }`}
                  title={isCollapsed ? item.label : undefined}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`p-1 rounded-lg transition-colors ${
                      isItemActive ? "text-primary font-black" : "text-slate-500 dark:text-slate-400 group-hover:text-slate-800 dark:group-hover:text-white"
                    }`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    {!isCollapsed && <span className="truncate">{item.label}</span>}
                  </div>

                  {!isCollapsed && (
                    <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isDropdownOpen ? "rotate-0" : "-rotate-90"}`} />
                  )}
                </button>

                {/* Sub-items list */}
                {isDropdownOpen && !isCollapsed && (
                  <div className="pl-4 pr-1 py-1 space-y-1 ml-3 border-l-2 border-slate-200 dark:border-slate-800">
                    {item.subItems!.map((sub) => {
                      const SubIcon = sub.icon;
                      const isSubActive = location.pathname === sub.path || (sub.path !== "/" && location.pathname.startsWith(sub.path));

                      return (
                        <Link
                          key={sub.path}
                          to={sub.path}
                          className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                            isSubActive
                              ? "bg-primary text-white shadow-2xs font-bold"
                              : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900"
                          }`}
                        >
                          <SubIcon className="w-3.5 h-3.5" />
                          <span className="truncate">{sub.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          return (
            <Link
              key={item.path}
              to={item.path!}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold text-xs transition-all group relative ${
                isItemActive
                  ? "bg-primary text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"
              }`}
              title={isCollapsed ? item.label : undefined}
            >
              <div className={`p-1 rounded-lg transition-colors ${
                isItemActive ? "text-white" : "text-slate-500 dark:text-slate-400 group-hover:text-slate-800 dark:group-hover:text-white"
              }`}>
                <Icon className="w-4 h-4" />
              </div>

              {!isCollapsed && (
                <div className="flex-1 flex items-center justify-between">
                  <span className="truncate">{item.label}</span>
                  {item.badge && (
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                      {item.badge}
                    </span>
                  )}
                </div>
              )}
            </Link>
          );
        })}
      </div>

      {/* Sidebar Footer User Info */}
      <div className="p-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
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
