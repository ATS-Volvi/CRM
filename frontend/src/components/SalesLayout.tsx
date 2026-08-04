import { useState, useEffect } from "react";
import { Outlet, useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  Zap, Inbox, Users, Trello, Calendar, PhoneCall, Video, CheckSquare,
  FileText, ShoppingBag, TrendingUp, Bell, Sparkles, User, LogOut, Search,
  Plus, ChevronLeft, ChevronRight, MessageSquare, ShieldAlert, Receipt, Database, Moon, Sun
} from "lucide-react";
import { NotificationDrawer } from "./NotificationDrawer";
import { AiCopilotDrawer } from "./AiCopilotDrawer";
import { CommandPalette } from "./CommandPalette";
import { SalesOrbit } from "./SalesOrbit";
import { WorkspaceTransition } from "./WorkspaceTransition";
import { OrbitProvider } from "../context/OrbitContext";

export function SalesLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isAiCopilotOpen, setIsAiCopilotOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  const repName = user?.name || "Liam Carter";
  const initials = repName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();

  return (
    <OrbitProvider>
      <div className="flex flex-col h-screen w-full bg-[#F8FAFC] dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans overflow-hidden transition-colors duration-300">
        
        {/* TOP COMPACT REPO OS TOOLBAR */}
        <header className="h-14 border-b border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl flex items-center justify-between px-6 shrink-0 z-30 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 text-white flex items-center justify-center font-bold text-xs shadow-md shadow-indigo-500/20">
              NX
            </div>
            <div>
              <span className="font-extrabold text-xs tracking-tight text-slate-900 dark:text-white block leading-none">
                SALES OPERATING SYSTEM
              </span>
              <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold block">
                Representative Portal • {repName}
              </span>
            </div>
          </div>

          {/* Omnibar Search */}
          <div className="flex-1 max-w-md mx-4">
            <button
              onClick={() => setIsCommandPaletteOpen(true)}
              className="w-full flex items-center gap-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full px-3 py-1.5 text-xs text-slate-500 dark:text-slate-400 transition-all shadow-2xs"
            >
              <Search className="w-3.5 h-3.5 text-indigo-500" />
              <span className="flex-1 text-left font-medium">Search deals, clients...</span>
              <kbd className="px-1.5 py-0.5 text-[9px] font-mono font-bold bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 rounded border border-slate-200 dark:border-slate-700">
                Ctrl+K
              </kbd>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsAiCopilotOpen(true)}
              className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-full shadow-xs hover:bg-indigo-700 transition-all"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
              <span>AI Copilot</span>
            </button>
            <button
              onClick={() => setIsNotificationsOpen(true)}
              className="p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded-full transition-colors"
            >
              <Bell className="w-4 h-4" />
            </button>
            <button
              onClick={() => logout()}
              className="p-1.5 text-slate-400 hover:text-rose-500 transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* MAIN REPO CONTENT & ORBIT */}
        <main className="flex-1 overflow-y-auto relative pb-24">
          <WorkspaceTransition>
            <Outlet />
          </WorkspaceTransition>
        </main>

        {/* SALES ORBIT FLOATING NAVIGATION */}
        <SalesOrbit
          onOpenSearch={() => setIsCommandPaletteOpen(true)}
          onOpenAi={() => setIsAiCopilotOpen(true)}
          onOpenNotifications={() => setIsNotificationsOpen(true)}
        />

        {/* MODALS */}
        <CommandPalette isOpen={isCommandPaletteOpen} onClose={() => setIsCommandPaletteOpen(false)} />
        <NotificationDrawer isOpen={isNotificationsOpen} onClose={() => setIsNotificationsOpen(false)} />
        <AiCopilotDrawer isOpen={isAiCopilotOpen} onClose={() => setIsAiCopilotOpen(false)} />
      </div>
    </OrbitProvider>
  );
}
