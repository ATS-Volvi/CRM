import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ShieldAlert,
  Mail,
  CheckCircle2,
  XCircle,
  Clock,
  Ban,
  UserCheck,
  Globe,
  RefreshCw,
  Search,
  Filter,
  Eye,
  Trash2,
  Plus,
  Inbox,
  AlertCircle,
  Layers,
  Sparkles,
} from "lucide-react";
import { leadFilterApi, FlaggedEmailItem, SenderRuleItem } from "../api/leadFilter";
import { useAuth } from "../context/AuthContext";

export default function HeldEmails() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const ALLOWED_FILTER_ROLES = ["admin", "director", "manager", "sales_manager"];
  const userRole = (user?.role || "").toLowerCase();
  const isAllowed = Boolean(user && ALLOWED_FILTER_ROLES.includes(userRole));

  const [activeTab, setActiveTab] = useState<
    "review" | "pending_clarification" | "archived" | "shadow_log" | "sender_rules"
  >("review");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedItem, setSelectedItem] = useState<FlaggedEmailItem | null>(null);

  // New sender rule modal state
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [ruleType, setRuleType] = useState<"allow" | "block">("allow");
  const [ruleMatchType, setRuleMatchType] = useState<"email" | "domain">("email");
  const [ruleValue, setRuleValue] = useState("");
  const [ruleNote, setRuleNote] = useState("");

  // Action status message
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const showNotification = (msg: string) => {
    setActionNotice(msg);
    setTimeout(() => setActionNotice(null), 4000);
  };

  // 1. Fetch Stats
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery({
    queryKey: ["leadFilterStats"],
    queryFn: () => leadFilterApi.getFilterStats(),
    refetchInterval: 15000,
    enabled: isAllowed,
  });

  // 2. Fetch Held Emails (Tabs: review, pending_clarification, archived)
  const isHeldTab = ["review", "pending_clarification", "archived"].includes(activeTab);
  const {
    data: heldData,
    isLoading: heldLoading,
    refetch: refetchHeld,
  } = useQuery({
    queryKey: ["heldEmails", activeTab, page, search],
    queryFn: () =>
      leadFilterApi.getHeldEmails({
        disposition: activeTab,
        page,
        limit: 15,
        search,
      }),
    enabled: isAllowed && isHeldTab,
  });

  // 3. Fetch Shadow Logs
  const {
    data: shadowData,
    isLoading: shadowLoading,
    refetch: refetchShadow,
  } = useQuery({
    queryKey: ["shadowLogs", page],
    queryFn: () => leadFilterApi.getShadowLogs({ page, limit: 15 }),
    enabled: isAllowed && activeTab === "shadow_log",
  });

  // 4. Fetch Sender Rules
  const {
    data: senderRules,
    isLoading: rulesLoading,
    refetch: refetchRules,
  } = useQuery({
    queryKey: ["senderRules"],
    queryFn: () => leadFilterApi.getSenderRules(),
    enabled: isAllowed && activeTab === "sender_rules",
  });

  // Mutations
  const promoteMutation = useMutation({
    mutationFn: ({ id, addAllowlist }: { id: string; addAllowlist: boolean }) =>
      leadFilterApi.promoteHeldEmail(id, addAllowlist),
    onSuccess: (data) => {
      showNotification(`Successfully promoted email to Lead (#${data.leadId})`);
      queryClient.invalidateQueries({ queryKey: ["heldEmails"] });
      queryClient.invalidateQueries({ queryKey: ["leadFilterStats"] });
      setSelectedItem(null);
    },
    onError: (err: any) => {
      showNotification(`Failed to promote: ${err.message}`);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({
      id,
      options,
    }: {
      id: string;
      options: { blockSender?: boolean; blockDomain?: boolean };
    }) => leadFilterApi.rejectHeldEmail(id, options),
    onSuccess: () => {
      showNotification("Email rejected successfully");
      queryClient.invalidateQueries({ queryKey: ["heldEmails"] });
      queryClient.invalidateQueries({ queryKey: ["leadFilterStats"] });
      setSelectedItem(null);
    },
    onError: (err: any) => {
      showNotification(`Failed to reject: ${err.message}`);
    },
  });

  const createRuleMutation = useMutation({
    mutationFn: leadFilterApi.createSenderRule,
    onSuccess: () => {
      showNotification("Sender rule created successfully");
      setShowRuleModal(false);
      setRuleValue("");
      setRuleNote("");
      queryClient.invalidateQueries({ queryKey: ["senderRules"] });
    },
    onError: (err: any) => {
      showNotification(`Error: ${err.message}`);
    },
  });

  const deleteRuleMutation = useMutation({
    mutationFn: leadFilterApi.deleteSenderRule,
    onSuccess: () => {
      showNotification("Sender rule deleted");
      queryClient.invalidateQueries({ queryKey: ["senderRules"] });
    },
    onError: (err: any) => {
      showNotification(`Error deleting rule: ${err.message}`);
    },
  });

  const refreshAll = () => {
    refetchStats();
    if (isHeldTab) refetchHeld();
    if (activeTab === "shadow_log") refetchShadow();
    if (activeTab === "sender_rules") refetchRules();
  };

  if (!isAllowed) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-6 text-center">
          <ShieldAlert className="w-12 h-12 text-amber-500 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">
            Access Denied
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            You do not have permission to access Held Emails. This section is restricted to administrators and managers.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-xl">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">
                Held Emails & Intent Gate
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Filtering newsletters, bulk mail, and non-leads to protect sales rep pipelines.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {stats?.mode && (
            <span
              className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border ${
                stats.mode === "enforce"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800"
                  : stats.mode === "shadow"
                  ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800"
                  : "bg-slate-100 text-slate-600 border-slate-200"
              }`}
            >
              Mode: {stats.mode}
            </span>
          )}
          <button
            onClick={refreshAll}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Notification Banner */}
      {actionNotice && (
        <div className="p-3 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 rounded-xl text-xs font-semibold flex items-center justify-between animate-fade-in">
          <span>{actionNotice}</span>
          <button onClick={() => setActionNotice(null)} className="text-blue-500 hover:text-blue-700">
            &times;
          </button>
        </div>
      )}

      {/* Stats Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-bold mb-1">
            <span>Needs Review</span>
            <AlertCircle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            {statsLoading ? "..." : stats?.needsReviewCount ?? 0}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">Pending human verification</div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-bold mb-1">
            <span>Waiting for Reply</span>
            <Clock className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            {statsLoading ? "..." : stats?.waitingReplyCount ?? 0}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">Clarification auto-reply sent</div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-bold mb-1">
            <span>Archived Today</span>
            <Ban className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            {statsLoading ? "..." : stats?.archivedToday ?? 0}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">Junk / newsletters archived</div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-bold mb-1">
            <span>Promoted to Lead</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
            {statsLoading ? "..." : stats?.promotedAfterHold ?? 0}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">False positive proxy</div>
        </div>
      </div>

      {/* Tabs and Search Controls */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-2 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-2">
          {/* Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
            <button
              onClick={() => {
                setActiveTab("review");
                setPage(1);
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-2 ${
                activeTab === "review"
                  ? "bg-primary text-white shadow-xs font-black"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              <span>Needs Review</span>
              {stats?.needsReviewCount ? (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-amber-500 text-white">
                  {stats.needsReviewCount}
                </span>
              ) : null}
            </button>

            <button
              onClick={() => {
                setActiveTab("pending_clarification");
                setPage(1);
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-2 ${
                activeTab === "pending_clarification"
                  ? "bg-primary text-white shadow-xs font-black"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              <span>Waiting for Reply</span>
              {stats?.waitingReplyCount ? (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-blue-500 text-white">
                  {stats.waitingReplyCount}
                </span>
              ) : null}
            </button>

            <button
              onClick={() => {
                setActiveTab("archived");
                setPage(1);
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
                activeTab === "archived"
                  ? "bg-primary text-white shadow-xs font-black"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              Archived
            </button>

            <button
              onClick={() => {
                setActiveTab("shadow_log");
                setPage(1);
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
                activeTab === "shadow_log"
                  ? "bg-primary text-white shadow-xs font-black"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              Shadow Log
            </button>

            <button
              onClick={() => {
                setActiveTab("sender_rules");
                setPage(1);
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
                activeTab === "sender_rules"
                  ? "bg-primary text-white shadow-xs font-black"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              Sender Rules
            </button>
          </div>

          {/* Search bar (for email tabs) */}
          {isHeldTab && (
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search sender, subject..."
                className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          )}

          {activeTab === "sender_rules" && (
            <button
              onClick={() => setShowRuleModal(true)}
              className="px-3 py-1.5 bg-primary text-white rounded-xl text-xs font-bold flex items-center gap-1.5 hover:bg-primary/90 transition-colors shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Sender Rule</span>
            </button>
          )}
        </div>

        {/* Content Table Area */}
        <div className="mt-2 overflow-x-auto">
          {/* TAB 1, 2, 3: Held Emails (review, pending_clarification, archived) */}
          {isHeldTab && (
            <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-[11px] font-black uppercase text-slate-400 border-y border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Sender</th>
                  <th className="py-2.5 px-3">Subject & Snippet</th>
                  <th className="py-2.5 px-3">Label</th>
                  <th className="py-2.5 px-3">Score</th>
                  <th className="py-2.5 px-3">AI Reason</th>
                  <th className="py-2.5 px-3">Received</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {heldLoading ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      Loading emails...
                    </td>
                  </tr>
                ) : heldData?.items?.length ? (
                  heldData.items.map((item) => {
                    const emailBody =
                      item.payload?.text ||
                      item.payload?.body ||
                      item.payload?.["stripped-text"] ||
                      item.explanation ||
                      "";
                    const snippet = emailBody.slice(0, 100);

                    return (
                      <tr
                        key={item.id}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="py-3 px-3">
                          <div className="font-bold text-slate-900 dark:text-white truncate max-w-[180px]">
                            {item.senderEmail || item.payload?.from || "Unknown"}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {item.channel || "email"}
                          </div>
                        </td>
                        <td className="py-3 px-3 max-w-[240px]">
                          <div className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                            {item.subject || "No Subject"}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate mt-0.5">
                            {snippet || "No body content available"}
                          </div>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              item.intentLabel === "new_enquiry"
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                : item.intentLabel === "vendor_pitch"
                                ? "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300"
                                : item.intentLabel === "newsletter"
                                ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                                : item.intentLabel === "too_vague"
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                                : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                            }`}
                          >
                            {item.intentLabel || "unclassified"}
                          </span>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <div className="font-bold text-slate-900 dark:text-white">
                            {item.intentScore ?? "--"}
                          </div>
                        </td>
                        <td className="py-3 px-3 max-w-[220px]">
                          <div className="text-[11px] text-slate-600 dark:text-slate-400 truncate">
                            {item.explanation || item.reason || "--"}
                          </div>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap text-[11px] text-slate-400">
                          {new Date(item.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setSelectedItem(item)}
                              className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors"
                              title="View Details"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>

                            {item.disposition !== "promoted" && (
                              <button
                                onClick={() =>
                                  promoteMutation.mutate({
                                    id: item.id,
                                    addAllowlist: false,
                                  })
                                }
                                disabled={promoteMutation.isPending}
                                className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-lg text-[11px] font-bold transition-colors"
                              >
                                Promote
                              </button>
                            )}

                            {item.disposition !== "rejected" && (
                              <button
                                onClick={() =>
                                  rejectMutation.mutate({
                                    id: item.id,
                                    options: {},
                                  })
                                }
                                disabled={rejectMutation.isPending}
                                className="px-2 py-1 hover:bg-rose-50 dark:hover:bg-rose-950/60 text-rose-600 rounded-lg text-[11px] font-bold transition-colors"
                              >
                                Reject
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      No emails found in this category.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}

          {/* TAB 4: Shadow Log */}
          {activeTab === "shadow_log" && (
            <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-[11px] font-black uppercase text-slate-400 border-y border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Sender</th>
                  <th className="py-2.5 px-3">Subject</th>
                  <th className="py-2.5 px-3">Decision Action</th>
                  <th className="py-2.5 px-3">Score</th>
                  <th className="py-2.5 px-3">Reason</th>
                  <th className="py-2.5 px-3">Blocked?</th>
                  <th className="py-2.5 px-3">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {shadowLoading ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      Loading shadow logs...
                    </td>
                  </tr>
                ) : shadowData?.items?.length ? (
                  shadowData.items.map((log) => (
                    <tr
                      key={log.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">
                        {log.senderEmail}
                      </td>
                      <td className="py-2.5 px-3 max-w-[200px] truncate">
                        {log.subject}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            log.action === "CREATE_LEAD"
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                              : log.action === "ATTACH_EXISTING"
                              ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                              : log.action === "PENDING_CLARIFY"
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                              : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                          }`}
                        >
                          {log.action}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-bold">{log.leadScore}</td>
                      <td className="py-2.5 px-3 max-w-[260px] truncate text-[11px] text-slate-500">
                        {log.reason}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {log.wouldHaveBlocked ? (
                          <span className="text-rose-600 font-bold">Yes (held/archived)</span>
                        ) : (
                          <span className="text-emerald-600 font-bold">No (allowed)</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap text-[11px] text-slate-400">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      No shadow decision logs yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}

          {/* TAB 5: Sender Rules */}
          {activeTab === "sender_rules" && (
            <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-[11px] font-black uppercase text-slate-400 border-y border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Rule Type</th>
                  <th className="py-2.5 px-3">Match Type</th>
                  <th className="py-2.5 px-3">Value</th>
                  <th className="py-2.5 px-3">Note</th>
                  <th className="py-2.5 px-3">Created</th>
                  <th className="py-2.5 px-3 text-right">Delete</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {rulesLoading ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      Loading rules...
                    </td>
                  </tr>
                ) : senderRules?.length ? (
                  senderRules.map((rule) => (
                    <tr
                      key={rule.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                            rule.type === "allow"
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                              : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                          }`}
                        >
                          {rule.type}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 uppercase text-[10px] font-bold text-slate-400">
                        {rule.matchType}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">
                        {rule.value}
                      </td>
                      <td className="py-2.5 px-3 text-[11px] text-slate-500">
                        {rule.note || "--"}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap text-[11px] text-slate-400">
                        {new Date(rule.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={() => deleteRuleMutation.mutate(rule.id)}
                          className="p-1 hover:bg-rose-100 text-rose-600 rounded transition-colors"
                          title="Delete Rule"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      No sender rules created yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Detail / Action Modal for Held Email */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  Held Email Inspection
                </h3>
                <p className="text-xs text-slate-400">
                  {selectedItem.senderEmail || selectedItem.payload?.from}
                </p>
              </div>
              <button
                onClick={() => setSelectedItem(null)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                &times;
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="font-bold text-slate-400 uppercase text-[10px] block">
                  Subject
                </span>
                <p className="text-slate-900 dark:text-white font-semibold text-sm">
                  {selectedItem.subject || "No Subject"}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl">
                <div>
                  <span className="text-[10px] text-slate-400 block font-bold">Intent Label</span>
                  <span className="font-extrabold text-slate-800 dark:text-slate-200 uppercase">
                    {selectedItem.intentLabel || "--"}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-bold">Score</span>
                  <span className="font-extrabold text-slate-800 dark:text-slate-200">
                    {selectedItem.intentScore ?? "--"} / 100
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-bold">Disposition</span>
                  <span className="font-extrabold text-slate-800 dark:text-slate-200 uppercase">
                    {selectedItem.disposition || "review"}
                  </span>
                </div>
              </div>

              <div>
                <span className="font-bold text-slate-400 uppercase text-[10px] block mb-1">
                  AI Reason
                </span>
                <p className="text-slate-700 dark:text-slate-300 bg-amber-50 dark:bg-amber-950/40 p-2.5 rounded-xl border border-amber-200 dark:border-amber-900 text-xs">
                  {selectedItem.explanation || selectedItem.reason || "None recorded"}
                </p>
              </div>

              <div>
                <span className="font-bold text-slate-400 uppercase text-[10px] block mb-1">
                  Raw Message Body
                </span>
                <pre className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-mono whitespace-pre-wrap max-h-48 overflow-y-auto text-slate-800 dark:text-slate-200">
                  {selectedItem.payload?.text ||
                    selectedItem.payload?.body ||
                    JSON.stringify(selectedItem.payload, null, 2)}
                </pre>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
              <div className="flex gap-2">
                <button
                  onClick={() =>
                    rejectMutation.mutate({
                      id: selectedItem.id,
                      options: { blockSender: true },
                    })
                  }
                  className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 rounded-xl text-xs font-bold transition-colors"
                >
                  Block Sender
                </button>
                <button
                  onClick={() =>
                    rejectMutation.mutate({
                      id: selectedItem.id,
                      options: { blockDomain: true },
                    })
                  }
                  className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 rounded-xl text-xs font-bold transition-colors"
                >
                  Block Domain
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() =>
                    promoteMutation.mutate({
                      id: selectedItem.id,
                      addAllowlist: true,
                    })
                  }
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Promote & Allowlist</span>
                </button>
                <button
                  onClick={() =>
                    promoteMutation.mutate({
                      id: selectedItem.id,
                      addAllowlist: false,
                    })
                  }
                  className="px-3 py-1.5 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary/90 transition-colors"
                >
                  Promote to Lead
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add Sender Rule */}
      {showRuleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                Add Sender Rule
              </h3>
              <button
                onClick={() => setShowRuleModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                &times;
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  Rule Type
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setRuleType("allow")}
                    className={`flex-1 py-1.5 rounded-xl font-bold text-xs border ${
                      ruleType === "allow"
                        ? "bg-emerald-50 border-emerald-500 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                        : "border-slate-200 text-slate-600"
                    }`}
                  >
                    Allowlist (Bypass)
                  </button>
                  <button
                    type="button"
                    onClick={() => setRuleType("block")}
                    className={`flex-1 py-1.5 rounded-xl font-bold text-xs border ${
                      ruleType === "block"
                        ? "bg-rose-50 border-rose-500 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                        : "border-slate-200 text-slate-600"
                    }`}
                  >
                    Blocklist (Archive)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  Match Type
                </label>
                <select
                  value={ruleMatchType}
                  onChange={(e: any) => setRuleMatchType(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold"
                >
                  <option value="email">Exact Email</option>
                  <option value="domain">Entire Domain</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  Value ({ruleMatchType === "email" ? "e.g. buyer@company.com" : "e.g. spamdomain.com"})
                </label>
                <input
                  type="text"
                  value={ruleValue}
                  onChange={(e) => setRuleValue(e.target.value)}
                  placeholder={ruleMatchType === "email" ? "client@example.com" : "marketing.domain.com"}
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  Note / Reason
                </label>
                <input
                  type="text"
                  value={ruleNote}
                  onChange={(e) => setRuleNote(e.target.value)}
                  placeholder="Optional internal justification"
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
              <button
                onClick={() => setShowRuleModal(false)}
                className="px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  createRuleMutation.mutate({
                    type: ruleType,
                    matchType: ruleMatchType,
                    value: ruleValue,
                    note: ruleNote,
                  })
                }
                disabled={!ruleValue.trim() || createRuleMutation.isPending}
                className="px-4 py-1.5 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary/90"
              >
                Save Rule
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
