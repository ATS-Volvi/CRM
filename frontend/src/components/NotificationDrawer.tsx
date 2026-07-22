import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import {
  Bell, X, CheckCircle2, Clock, AlertTriangle, MessageSquare,
  FileText, Check, Search, Filter, Trash2, ArrowRight
} from "lucide-react";

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export function NotificationDrawer({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [search, setSearch] = useState("");

  const { data: notifications = [], isLoading } = useQuery<NotificationItem[]>({
    queryKey: ["notificationsDrawer"],
    queryFn: async () => {
      if (!token) return [];
      const res = await fetch("/api/v1/notifications", {
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
      if (search.trim()) {
        const q = search.toLowerCase();
        return n.title.toLowerCase().includes(q) || n.message.toLowerCase().includes(q);
      }
      return true;
    });
  }, [notifications, filter, search]);

  const grouped = useMemo(() => {
    const today: NotificationItem[] = [];
    const yesterday: NotificationItem[] = [];
    const earlier: NotificationItem[] = [];

    const now = new Date();
    filtered.forEach(n => {
      const d = new Date(n.createdAt);
      const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
      if (diffDays === 0) today.push(n);
      else if (diffDays === 1) yesterday.push(n);
      else earlier.push(n);
    });

    return { today, yesterday, earlier };
  }, [filtered]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs z-50 flex justify-end animate-fade-in" onClick={onClose}>
      <div
        className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-slide-left border-l border-slate-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">Notification Center</h2>
              <p className="text-xs text-slate-400">Updates, alerts & operational nudges</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter bar & Actions */}
        <div className="p-4 border-b border-slate-100 space-y-3 bg-slate-50/50">
          <div className="flex items-center justify-between gap-2">
            <div className="flex gap-1.5">
              <button
                onClick={() => setFilter("all")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  filter === "all" ? "bg-indigo-600 text-white" : "bg-white text-slate-600 border border-slate-200"
                }`}
              >
                All ({notifications.length})
              </button>
              <button
                onClick={() => setFilter("unread")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  filter === "unread" ? "bg-indigo-600 text-white" : "bg-white text-slate-600 border border-slate-200"
                }`}
              >
                Unread ({notifications.filter(n => !n.isRead).length})
              </button>
            </div>
            {notifications.some(n => !n.isRead) && (
              <button
                onClick={() => readAllMutation.mutate()}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1"
              >
                <Check className="w-3.5 h-3.5" /> Mark all read
              </button>
            )}
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Filter notifications..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400"
            />
          </div>
        </div>

        {/* Scrollable list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {isLoading ? (
            <div className="p-8 text-center text-xs text-slate-400">Loading notifications...</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-slate-400 space-y-2">
              <Bell className="w-8 h-8 mx-auto opacity-30" />
              <p className="text-sm font-semibold">No notifications</p>
              <p className="text-xs">You're all caught up!</p>
            </div>
          ) : (
            <>
              {grouped.today.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Today</p>
                  {grouped.today.map(n => (
                    <NotificationRow key={n.id} item={n} onMarkRead={id => markReadMutation.mutate(id)} />
                  ))}
                </div>
              )}

              {grouped.yesterday.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Yesterday</p>
                  {grouped.yesterday.map(n => (
                    <NotificationRow key={n.id} item={n} onMarkRead={id => markReadMutation.mutate(id)} />
                  ))}
                </div>
              )}

              {grouped.earlier.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Earlier</p>
                  {grouped.earlier.map(n => (
                    <NotificationRow key={n.id} item={n} onMarkRead={id => markReadMutation.mutate(id)} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function NotificationRow({ item, onMarkRead }: { item: NotificationItem; onMarkRead: (id: string) => void }) {
  return (
    <div
      onClick={() => !item.isRead && onMarkRead(item.id)}
      className={`p-3.5 rounded-xl border transition-all cursor-pointer flex gap-3 ${
        item.isRead ? "bg-white border-slate-100 opacity-75" : "bg-indigo-50/50 border-indigo-100 shadow-xs"
      }`}
    >
      <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${item.isRead ? "bg-transparent" : "bg-indigo-600"}`} />
      <div className="flex-1 min-w-0 space-y-1">
        <p className="text-xs font-bold text-slate-800">{item.title}</p>
        <p className="text-xs text-slate-600 leading-snug">{item.message}</p>
        <p className="text-[10px] text-slate-400 pt-1">{new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
      </div>
    </div>
  );
}
