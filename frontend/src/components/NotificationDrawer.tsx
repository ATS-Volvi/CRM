import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import {
  Bell, X, CheckCircle2, Clock, AlertTriangle, MessageSquare,
  FileText, Check, Search, Filter, Trash2, ArrowRight, ShieldAlert,
  Target, Layers, Zap, UserCheck, Settings, Layers2
} from "lucide-react";

interface NotificationItem {
  id: string;
  role?: string;
  type: string;
  severity?: "INFO" | "ACTION_REQUIRED" | "WARNING" | "CRITICAL";
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  actionUrl?: string | null;
  link?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  groupKey?: string | null;
  groupCount?: number;
}

export function NotificationDrawer({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [filter, setFilter] = useState<"all" | "unread" | "action">("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [isGroupedMode, setIsGroupedMode] = useState<boolean>(false);
  const [search, setSearch] = useState("");

  const userRole = (user?.role || "sales_rep").toUpperCase();
  const roleDisplay = userRole === "ADMIN" || userRole === "DIRECTOR" ? "Admin" : userRole === "SALES_MANAGER" || userRole === "TEAM_LEAD" ? "Team Lead" : "Sales Representative";

  const { data: notifications = [], isLoading } = useQuery<NotificationItem[]>({
    queryKey: ["notificationsDrawer", isGroupedMode, categoryFilter],
    queryFn: async () => {
      if (!token) return [];
      const params = new URLSearchParams();
      if (isGroupedMode) params.append("grouped", "true");
      if (categoryFilter !== "all") params.append("entityType", categoryFilter);

      const res = await fetch(`/api/v1/notifications?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!token && isOpen
  });

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/v1/notifications/${id}/read`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notificationsDrawer"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    }
  });

  const readAllMutation = useMutation({
    mutationFn: async () => {
      await fetch("/api/v1/notifications/read-all", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notificationsDrawer"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    }
  });

  const filtered = useMemo(() => {
    return notifications.filter(n => {
      if (filter === "unread" && n.isRead) return false;
      if (filter === "action" && n.severity !== "ACTION_REQUIRED" && n.severity !== "CRITICAL") return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return n.title.toLowerCase().includes(q) || n.message.toLowerCase().includes(q);
      }
      return true;
    });
  }, [notifications, filter, search]);

  const handleNotificationClick = (item: NotificationItem) => {
    if (!item.isRead) {
      markReadMutation.mutate(item.id);
    }

    const targetUrl = item.actionUrl || item.link;
    if (targetUrl) {
      navigate(targetUrl);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs z-50 flex justify-end animate-fade-in" onClick={onClose}>
      <div
        className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-slide-left border-l border-slate-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-slate-900">Notification Center</h2>
                <span className="px-2 py-0.5 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-full text-[10px] font-black uppercase tracking-wider">
                  {roleDisplay}
                </span>
              </div>
              <p className="text-xs text-slate-500">Role-aware alerts & operational nudges</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-slate-600 transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Bar & Controls */}
        <div className="p-4 border-b border-slate-100 space-y-3 bg-slate-50/30">
          <div className="flex items-center justify-between gap-2">
            <div className="flex gap-1.5 overflow-x-auto pb-0.5">
              <button
                onClick={() => setFilter("all")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors shrink-0 ${
                  filter === "all" ? "bg-slate-900 text-white" : "bg-white text-slate-600 border border-slate-200"
                }`}
              >
                All ({notifications.length})
              </button>
              <button
                onClick={() => setFilter("unread")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors shrink-0 ${
                  filter === "unread" ? "bg-indigo-600 text-white" : "bg-white text-slate-600 border border-slate-200"
                }`}
              >
                Unread ({notifications.filter(n => !n.isRead).length})
              </button>
              <button
                onClick={() => setFilter("action")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors shrink-0 ${
                  filter === "action" ? "bg-rose-600 text-white" : "bg-white text-slate-600 border border-slate-200"
                }`}
              >
                Action Required
              </button>
            </div>

            {notifications.some(n => !n.isRead) && (
              <button
                onClick={() => readAllMutation.mutate()}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 shrink-0"
              >
                <Check className="w-3.5 h-3.5" /> Mark all read
              </button>
            )}
          </div>

          {/* Category Tabs & Grouping Toggle */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex gap-1 overflow-x-auto text-[11px] font-bold text-slate-600">
              {["all", "LEAD", "QUOTE", "APPROVAL", "TASK", "SYSTEM"].map(cat => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-2.5 py-1 rounded-md capitalize border transition-all ${
                    categoryFilter === cat ? "bg-indigo-50 border-indigo-200 text-indigo-700 font-extrabold" : "border-transparent text-slate-500 hover:bg-slate-100"
                  }`}
                >
                  {cat === "all" ? "All Categories" : cat.toLowerCase()}
                </button>
              ))}
            </div>

            <button
              onClick={() => setIsGroupedMode(!isGroupedMode)}
              className={`p-1.5 rounded-lg border text-xs font-bold transition-all flex items-center gap-1 shrink-0 ${
                isGroupedMode ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
              }`}
              title="Group similar notifications"
            >
              <Layers2 className="w-3.5 h-3.5" />
              <span>Group</span>
            </button>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search notifications..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Scrollable Notification List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {isLoading ? (
            <div className="p-8 text-center text-xs text-slate-400">Loading role notifications...</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-slate-400 space-y-2">
              <Bell className="w-8 h-8 mx-auto opacity-30 text-indigo-500" />
              <p className="text-sm font-bold text-slate-700">No notifications found</p>
              <p className="text-xs">All clear for {roleDisplay} workflow!</p>
            </div>
          ) : (
            filtered.map(n => (
              <NotificationRow
                key={n.id}
                item={n}
                onClick={() => handleNotificationClick(n)}
              />
            ))
          )}
        </div>

        {/* Role Footer Info */}
        <div className="p-3 border-t border-slate-100 bg-slate-50 text-[11px] text-slate-500 flex items-center justify-between">
          <span className="font-semibold">Role Context: {userRole}</span>
          <span className="text-indigo-600 font-bold">{filtered.filter(n => !n.isRead).length} unread alerts</span>
        </div>
      </div>
    </div>
  );
}

function NotificationRow({ item, onClick }: { item: NotificationItem; onClick: () => void }) {
  const severity = item.severity || "INFO";

  const severityStyles: Record<string, { bg: string; border: string; text: string; iconBg: string }> = {
    INFO: { bg: "bg-white", border: "border-slate-200", text: "text-slate-700", iconBg: "bg-slate-100 text-slate-600" },
    ACTION_REQUIRED: { bg: "bg-blue-50/60", border: "border-blue-200", text: "text-blue-900", iconBg: "bg-blue-100 text-blue-700" },
    WARNING: { bg: "bg-amber-50/60", border: "border-amber-200", text: "text-amber-900", iconBg: "bg-amber-100 text-amber-700" },
    CRITICAL: { bg: "bg-rose-50/60", border: "border-rose-200", text: "text-rose-900", iconBg: "bg-rose-100 text-rose-700" }
  };

  const style = severityStyles[severity] || severityStyles.INFO;

  return (
    <div
      onClick={onClick}
      className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex gap-3 shadow-2xs hover:shadow-md ${style.bg} ${style.border} ${
        !item.isRead ? "ring-1 ring-indigo-500/30" : "opacity-80"
      }`}
    >
      <div className={`p-2.5 rounded-xl shrink-0 ${style.iconBg} flex items-center justify-center self-start`}>
        {severity === "CRITICAL" ? (
          <ShieldAlert className="w-4 h-4 text-rose-600" />
        ) : severity === "WARNING" ? (
          <AlertTriangle className="w-4 h-4 text-amber-600" />
        ) : severity === "ACTION_REQUIRED" ? (
          <Zap className="w-4 h-4 text-blue-600" />
        ) : (
          <Bell className="w-4 h-4 text-slate-500" />
        )}
      </div>

      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
            severity === 'CRITICAL' ? 'bg-rose-100 text-rose-800' :
            severity === 'WARNING' ? 'bg-amber-100 text-amber-800' :
            severity === 'ACTION_REQUIRED' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-600'
          }`}>
            {severity.replace('_', ' ')}
          </span>

          <span className="text-[10px] text-slate-400 font-medium shrink-0">
            {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        <p className={`text-xs font-bold ${style.text}`}>{item.title}</p>
        <p className="text-xs text-slate-600 leading-snug">{item.message}</p>

        {item.actionUrl && (
          <div className="pt-1 flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800">
            <span>View Record</span>
            <ArrowRight className="w-3 h-3" />
          </div>
        )}
      </div>
    </div>
  );
}
