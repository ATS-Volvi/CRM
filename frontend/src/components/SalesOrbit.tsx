import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Inbox,
  Users,
  Trello,
  Calendar,
  Sparkles,
  BarChart2,
  Settings,
  FileText,
  Search,
  Plus,
  MessageSquare,
  PhoneCall,
  Quote,
  Archive,
  Clock,
  Tag,
  UserCheck,
  TrendingUp,
  Receipt,
  FileCode,
  Layers,
  Zap,
  Globe,
  Share2,
  Bell,
  Filter,
  CheckSquare,
  Activity,
  DollarSign,
  ChevronUp,
  X,
  Compass,
  Command,
  HelpCircle
} from "lucide-react";
import { useOrbit } from "../context/OrbitContext";
import { useAuth } from "../context/AuthContext";

interface OrbitItemConfig {
  id: string;
  label: string;
  icon: React.ElementType;
  path?: string;
  badge?: string | number;
  color?: string;
  action?: () => void;
}

export const SalesOrbit: React.FC<{
  onOpenSearch: () => void;
  onOpenAi: () => void;
  onOpenNotifications: () => void;
}> = ({ onOpenSearch, onOpenAi, onOpenNotifications }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { mode, activeTabId, setActiveTabId } = useOrbit();
  const { user } = useAuth();
  
  const [isExpanded, setIsExpanded] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Close expansion when route changes
  useEffect(() => {
    setIsExpanded(false);
  }, [location.pathname]);

  // 6 Primary Admin Workspaces
  const globalItems: OrbitItemConfig[] = [
    { id: "mission_control", label: "Mission Control", icon: Zap, path: "/home" },
    { id: "team", label: "Team Workspace", icon: UserCheck, path: "/salespersons" },
    { id: "customers", label: "Customers 360", icon: Users, path: "/customers" },
    { id: "sales", label: "Sales & Pipeline", icon: Trello, path: "/pipeline" },
    { id: "ai", label: "AI Employee", icon: Sparkles, color: "text-amber-400", path: "/ai-reports" },
    { id: "workspace", label: "Workspace Config", icon: Settings, path: "/settings" },
  ];

  // Context-specific actions mapped directly to system context specs
  const contextItemsMap: Record<string, OrbitItemConfig[]> = {
    mission_control: [
      { id: "urgent_tasks", label: "Urgent Tasks", icon: CheckSquare, path: "/home" },
      { id: "team_snap", label: "Team Snapshot", icon: UserCheck, path: "/salespersons" },
      { id: "cust_360", label: "Customer 360", icon: Users, path: "/customers" },
      { id: "pipeline_snap", label: "Pipeline", icon: Trello, path: "/pipeline" },
      { id: "ai_recs", label: "AI Summary", icon: Sparkles, path: "/ai-reports" },
      { id: "new_lead", label: "New Lead", icon: Plus, path: "/leads/new" },
    ],
    team: [
      { id: "team_list", label: "All Reps", icon: Users, path: "/salespersons" },
      { id: "assign_rules", label: "Assignment Rules", icon: Filter, path: "/rules" },
      { id: "performance", label: "KPI Performance", icon: TrendingUp, path: "/kpi text" },
      { id: "ai_coaching", label: "AI Coaching", icon: Sparkles, action: onOpenAi },
    ],
    customers: [
      { id: "timeline", label: "Timeline", icon: Clock, action: () => setActiveTabId("timeline") },
      { id: "inbox_conv", label: "Omnichannel Inbox", icon: MessageSquare, path: "/communications" },
      { id: "invoices", label: "Invoices", icon: Receipt, action: () => setActiveTabId("invoices") },
      { id: "documents", label: "Documents", icon: FileCode, action: () => setActiveTabId("documents") },
      { id: "tasks", label: "Tasks", icon: CheckSquare, action: () => setActiveTabId("tasks") },
      { id: "ai_health", label: "AI Health Score", icon: Sparkles, action: onOpenAi },
    ],
    sales: [
      { id: "kanban", label: "Pipeline Kanban", icon: Trello, path: "/pipeline" },
      { id: "new_quote", label: "Generate Quote", icon: Plus, path: "/quotes/new" },
      { id: "invoices", label: "Invoices & Billing", icon: Receipt, path: "/invoices" },
      { id: "purchase_orders", label: "Purchase Orders", icon: Layers, path: "/purchase-orders" },
      { id: "approvals", label: "Approval Queue", icon: CheckSquare, path: "/approvals" },
      { id: "ai_forecast", label: "AI Sales Forecast", icon: Sparkles, action: onOpenAi },
    ],
    ai: [
      { id: "chat_ai", label: "Conversational Analytics", icon: MessageSquare, path: "/ai-reports" },
      { id: "copilot", label: "AI Copilot", icon: Sparkles, action: onOpenAi },
      { id: "automation", label: "AI Workflows", icon: Zap, path: "/automation" },
    ],
    workspace: [
      { id: "sys_settings", label: "Workspace Config", icon: Settings, path: "/settings" },
      { id: "master_data", label: "Master Data", icon: Layers, path: "/master-data/requirements" },
      { id: "automation_e", label: "Workflow Engine", icon: Zap, path: "/automation" },
      { id: "rules_e", label: "Assignment Rules", icon: Filter, path: "/rules" },
    ]
  };

  // Determine current items to render
  const currentItems = contextItemsMap[mode] || globalItems;

  const handleItemClick = (item: OrbitItemConfig) => {
    if (item.action) {
      item.action();
    } else if (item.path) {
      navigate(item.path);
    }
    setIsExpanded(false);
  };

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center pointer-events-none select-none">
      
      {/* RADIATING CIRCULAR EXPANDED ORBIT */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={{ type: "spring", stiffness: 350, damping: 25 }}
            className="absolute bottom-16 pointer-events-auto flex items-center justify-center"
            style={{ width: "320px", height: "320px" }}
          >
            {/* Ambient Background Backdrop Glow */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 rounded-full bg-slate-950/80 backdrop-blur-2xl border border-white/10 shadow-2xl shadow-indigo-500/20" 
            />

            {/* Central OS Command Trigger Ring */}
            <div className="relative z-10 flex flex-col items-center justify-center text-center p-4">
              <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-1">
                {mode.toUpperCase()} ORBIT
              </span>
              <p className="text-xs font-semibold text-white/90 max-w-[140px] truncate">
                {hoveredIndex !== null && currentItems[hoveredIndex]
                  ? currentItems[hoveredIndex].label
                  : "Select Workspace"}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <button
                  onClick={onOpenSearch}
                  className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                  title="Search (CTRL+K)"
                >
                  <Search className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={onOpenAi}
                  className="p-1.5 rounded-full bg-indigo-500/30 hover:bg-indigo-500/50 text-indigo-300 transition-colors"
                  title="AI Copilot"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Orbiting Radial Action Nodes */}
            {currentItems.map((item, index) => {
              const total = currentItems.length;
              // Distribute along top semi-circle / full radial arc (-150 to +150 deg)
              const angleDeg = -135 + (index * (270 / (total - 1 || 1)));
              const angleRad = (angleDeg * Math.PI) / 180;
              const radius = 120; // Radius in pixels
              const x = Math.cos(angleRad) * radius;
              const y = Math.sin(angleRad) * radius;

              const Icon = item.icon;
              const isHovered = hoveredIndex === index;

              return (
                <motion.div
                  key={item.id}
                  initial={{ x: 0, y: 0, opacity: 0, scale: 0.2 }}
                  animate={{ x, y, opacity: 1, scale: 1 }}
                  exit={{ x: 0, y: 0, opacity: 0, scale: 0.2 }}
                  transition={{
                    type: "spring",
                    stiffness: 400,
                    damping: 24,
                    delay: index * 0.03,
                  }}
                  className="absolute z-20"
                  onMouseEnter={() => setHoveredIndex(index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                >
                  <button
                    onClick={() => handleItemClick(item)}
                    className={`group relative flex items-center justify-center w-12 h-12 rounded-full border transition-all duration-200 shadow-lg ${
                      isHovered
                        ? "bg-indigo-600 border-indigo-300 text-white scale-125 shadow-indigo-500/50 z-30"
                        : "bg-slate-900/90 border-slate-700/80 text-slate-200 hover:border-slate-400"
                    }`}
                  >
                    <Icon className={`w-5 h-5 ${item.color || ""}`} />

                    {/* Badge */}
                    {item.badge && (
                      <span className="absolute -top-1 -right-1 px-1.5 py-0.5 text-[9px] font-black bg-rose-500 text-white rounded-full border border-slate-900 shadow-sm">
                        {item.badge}
                      </span>
                    )}

                    {/* Hover Label Tooltip Floating Arc */}
                    <AnimatePresence>
                      {isHovered && (
                        <motion.div
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 2 }}
                          className="absolute bottom-14 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-white text-[11px] font-bold whitespace-nowrap shadow-xl pointer-events-none"
                        >
                          {item.label}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </button>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* IDLE FLOATING SALES ORBIT DOCK CAPSULE */}
      <motion.div
        className="pointer-events-auto flex items-center gap-2 px-3 py-2 rounded-full bg-slate-950/85 backdrop-blur-2xl border border-white/15 shadow-2xl shadow-indigo-950/50 ring-1 ring-white/10 group"
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.96 }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
      >
        {/* Core Pulsing Orbit Trigger Button */}
        <button
          onClick={() => setIsExpanded(prev => !prev)}
          className="relative flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 text-white shadow-md shadow-indigo-500/30 overflow-hidden shrink-0"
          title="Toggle Sales Orbit"
        >
          {/* Subtle Breathing Pulse Glow Animation */}
          <span className="absolute inset-0 rounded-full bg-indigo-400/30 animate-ping opacity-75" />
          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            {isExpanded ? <X className="w-5 h-5" /> : <Compass className="w-5 h-5" />}
          </motion.div>
        </button>

        {/* Quick Horizontal Dock Items */}
        <div className="flex items-center gap-1 pl-1 pr-2">
          {globalItems.slice(0, 5).map(item => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.id}
                onClick={() => handleItemClick(item)}
                className={`relative p-2 rounded-full text-xs font-medium transition-all ${
                  isActive
                    ? "bg-indigo-600/30 text-indigo-300 border border-indigo-500/40"
                    : "text-slate-400 hover:text-white hover:bg-white/10"
                }`}
                title={item.label}
              >
                <Icon className="w-4 h-4" />
                {isActive && (
                  <motion.span
                    layoutId="activeOrbitIndicator"
                    className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-indigo-400"
                  />
                )}
              </button>
            );
          })}

          <div className="w-[1px] h-5 bg-white/15 mx-1" />

          {/* Global Search Quick Trigger */}
          <button
            onClick={onOpenSearch}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/15 text-slate-300 text-[11px] font-bold transition-all border border-white/10"
          >
            <Search className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden sm:inline">Search</span>
            <kbd className="text-[9px] font-mono text-slate-400 bg-white/10 px-1 rounded">⌘K</kbd>
          </button>

          {/* AI Quick Trigger */}
          <button
            onClick={onOpenAi}
            className="p-2 rounded-full text-amber-300 hover:bg-amber-500/20 transition-all"
            title="AI Sales Copilot"
          >
            <Sparkles className="w-4 h-4 animate-pulse" />
          </button>
        </div>
      </motion.div>
    </div>
  );
};
