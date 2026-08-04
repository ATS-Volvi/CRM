import { useState, useEffect } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { 
  Search, Bell, Sparkles, LogOut, Command, Shield, Moon, Sun, Monitor,
  LayoutDashboard, Home, Inbox, Trello, FileText, Receipt, Users, BarChart, Settings, Database, Clock, ChevronDown
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { CommandPalette } from "./CommandPalette";
import { NotificationDrawer } from "./NotificationDrawer";
import { QuickActionFab } from "./QuickActionFab";
import { AiCopilotDrawer } from "./AiCopilotDrawer";
import { DemoStoryGuide } from "./DemoStoryGuide";
import { TopWorkspaceNav } from "./TopWorkspaceNav";
import { Sidebar } from "./Sidebar";
import { WorkspaceTransition } from "./WorkspaceTransition";
import { OrbitProvider } from "../context/OrbitContext";

export function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, token } = useAuth();

  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isAiCopilotOpen, setIsAiCopilotOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem("theme") === "dark" || document.documentElement.classList.contains("dark");
  });

  // Feature Flag: Sales Orbit vs Traditional Sidebar (default to orbit mode)
  const [useOrbitNav, setUseOrbitNav] = useState(() => {
    const saved = localStorage.getItem("use_orbit_nav");
    return saved === null ? true : saved === "true";
  });

  // Legacy sidebar collapse state
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem("sidebar_collapsed");
    return saved === null ? true : saved === "true";
  });

  // Dark mode toggle handler
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [isDarkMode]);

  useEffect(() => {
    localStorage.setItem("use_orbit_nav", String(useOrbitNav));
  }, [useOrbitNav]);

  // Keyboard shortcuts listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsCommandPaletteOpen(prev => !prev);
        return;
      }

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

  // Fetch notifications
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

  return (
    <OrbitProvider>
      <div className="flex flex-col h-screen w-full bg-[#F8FAFC] dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans overflow-hidden transition-colors duration-300">
        {/* ENTERPRISE DEMO STORY GUIDE BAR */}
        <DemoStoryGuide />

        {/* MAIN CONTENT AREA CONTAINER WITH PERSISTENT SIDEBAR */}
        <div className="flex-1 flex overflow-hidden relative">
          <Sidebar
            onOpenSearch={() => setIsCommandPaletteOpen(true)}
            onOpenAi={() => setIsAiCopilotOpen(true)}
            onOpenNotifications={() => setIsNotificationsOpen(true)}
          />
          <main className="flex-1 overflow-y-auto relative">
            <WorkspaceTransition>
              <Outlet />
            </WorkspaceTransition>
          </main>
        </div>

        {/* MODALS & DRAWERS */}
        <CommandPalette isOpen={isCommandPaletteOpen} onClose={() => setIsCommandPaletteOpen(false)} />
        <NotificationDrawer isOpen={isNotificationsOpen} onClose={() => setIsNotificationsOpen(false)} />
        <AiCopilotDrawer isOpen={isAiCopilotOpen} onClose={() => setIsAiCopilotOpen(false)} />
        <QuickActionFab />
      </div>
    </OrbitProvider>
  );
}
