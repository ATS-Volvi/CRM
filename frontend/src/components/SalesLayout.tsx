import { useState } from "react";
import { Outlet, useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  Zap, Inbox, Users, Trello, Calendar, PhoneCall, Video, CheckSquare,
  FileText, ShoppingBag, TrendingUp, Bell, Sparkles, User, LogOut, Search,
  Plus, ChevronLeft, ChevronRight, MessageSquare, ShieldAlert
} from "lucide-react";
import { NotificationDrawer } from "./NotificationDrawer";
import { AiCopilotDrawer } from "./AiCopilotDrawer";
import { CommandPalette } from "./CommandPalette";

export function SalesLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isAiCopilotOpen, setIsAiCopilotOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const repName = user?.name || "Liam Carter";
  const initials = repName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();

  const salesNavItems = [
    { name: "My Dashboard", path: "/rep-portal", icon: Zap },
    { name: "My Leads", path: "/leads", icon: Inbox },
    { name: "My Customers", path: "/customers", icon: Users },
    { name: "Pipeline Kanban", path: "/pipeline", icon: Trello },
    { name: "Activities & Calendar", path: "/activities", icon: Calendar },
    { name: "Quotations & Orders", path: "/quotes", icon: FileText },
    { name: "AI Sales Copilot", path: "#", icon: Sparkles, onClick: () => setIsAiCopilotOpen(true) },
  ];

  return (
    <div className="flex h-screen w-full bg-slate-100 text-slate-900 font-sans overflow-hidden">
      
      {/* SALES REPRESENTATIVE SIDEBAR */}
      <aside className={`bg-gradient-to-b from-indigo-950 via-slate-900 to-indigo-950 text-white flex flex-col h-full shrink-0 transition-all duration-300 ${isCollapsed ? "w-16" : "w-[260px]"}`}>
        
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-white/10 shrink-0">
          {!isCollapsed && (
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-black text-sm shadow-md">
                S
              </div>
              <div>
                <span className="font-extrabold text-sm tracking-tight text-white block">SALES WORKSPACE</span>
                <span className="text-[10px] text-amber-300 font-bold uppercase tracking-wider block">Individual Representative</span>
              </div>
            </div>
          )}
          <button
            onClick={() => setIsCollapsed(prev => !prev)}
            className="p-1.5 hover:bg-white/10 rounded-lg text-slate-300 transition-colors mx-auto"
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Rep Identity Card */}
        {!isCollapsed && (
          <div className="p-3 mx-3 my-3 bg-white/5 border border-white/10 rounded-xl flex items-center gap-3 shrink-0">
            <div className="w-9 h-9 rounded-full bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center shrink-0">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-white truncate">{repName}</p>
              <p className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Active Sales Rep
              </p>
            </div>
          </div>
        )}

        {/* Navigation Menu */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1 no-scrollbar">
          <p className={`text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-2 ${isCollapsed ? "hidden" : "block"}`}>
            My Daily Selling Modules
          </p>
          {salesNavItems.map(item => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.name}
                onClick={() => {
                  if (item.onClick) item.onClick();
                  else navigate(item.path);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  isActive
                    ? "bg-amber-400 text-slate-950 shadow-sm"
                    : "text-slate-300 hover:bg-white/10 hover:text-white"
                }`}
                title={isCollapsed ? item.name : undefined}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-slate-950" : "text-amber-300"}`} />
                {!isCollapsed && <span>{item.name}</span>}
              </button>
            );
          })}
        </nav>

        {/* Footer Sign Out */}
        <div className="p-3 border-t border-white/10 shrink-0">
          <button
            onClick={() => { logout(); navigate("/login"); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-all"
          >
            <LogOut className="w-4 h-4 text-red-400" />
            {!isCollapsed && <span>Sign Out</span>}
          </button>
        </div>

      </aside>

      {/* MAIN CONTENT WORKSPACE */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        
        {/* TOP HEADER BAR */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 gap-4 shadow-xs">
          
          {/* Global Search input */}
          <div className="flex-1 max-w-md">
            <button
              onClick={() => setIsCommandPaletteOpen(true)}
              className="w-full flex items-center gap-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-500 transition-all"
            >
              <Search className="w-4 h-4 text-slate-400" />
              <span className="flex-1 text-left font-medium">Search my assigned leads, deals, quotes...</span>
              <kbd className="px-2 py-0.5 text-[10px] font-mono font-bold bg-white text-slate-400 rounded border border-slate-200">
                CTRL + K
              </kbd>
            </button>
          </div>

          {/* Quick Actions & Copilot Button */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => navigate("/leads/new")}
              className="flex items-center gap-1 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Lead
            </button>
            <button
              onClick={() => navigate("/quotes/new")}
              className="flex items-center gap-1 px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-bold rounded-lg transition-colors"
            >
              <FileText className="w-3.5 h-3.5" /> Quote
            </button>

            <button
              onClick={() => setIsAiCopilotOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 text-xs font-black rounded-xl shadow-xs transition-all"
            >
              <Sparkles className="w-3.5 h-3.5" /> AI Sales Assistant
            </button>

            <button
              onClick={() => setIsNotificationsOpen(true)}
              className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all relative"
            >
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />
            </button>

            <div className="w-8 h-8 rounded-full bg-indigo-600 text-white font-extrabold text-xs flex items-center justify-center shadow-xs">
              {initials}
            </div>
          </div>
        </header>

        {/* DYNAMIC SALES PAGE CONTENT */}
        <main className="flex-1 overflow-y-auto bg-slate-50">
          <Outlet />
        </main>
      </div>

      {/* DRAWERS & DIALOGS */}
      <NotificationDrawer isOpen={isNotificationsOpen} onClose={() => setIsNotificationsOpen(false)} />
      <AiCopilotDrawer isOpen={isAiCopilotOpen} onClose={() => setIsAiCopilotOpen(false)} />
      <CommandPalette isOpen={isCommandPaletteOpen} onClose={() => setIsCommandPaletteOpen(false)} />

    </div>
  );
}
