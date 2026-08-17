import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { formatCurrency } from "../utils/currency";
import { ChevronDown, ChevronRight, DollarSign, Check, Search, MessageCircle } from "lucide-react";

/** Priority Badge: Derived from lead.leadScore (Score >= 70 Hot, 40-69 Warm, < 40 Cold) */
export function PriorityBadge({ leadScore }: { leadScore?: number }) {
  const score = Number(leadScore || 50);
  let label = "Warm";
  let badgeStyle = "bg-amber-50 text-amber-700 border-amber-200";

  if (score >= 70) {
    label = "Hot";
    badgeStyle = "bg-rose-50 text-rose-700 border-rose-200";
  } else if (score < 40) {
    label = "Cold";
    badgeStyle = "bg-blue-50 text-blue-700 border-blue-200";
  }

  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${badgeStyle}`}>
      {label}
    </span>
  );
}

function WhatsAppBadge({ lead }: { lead: any }) {
  const isWhatsApp =
    (lead.communicationChannel || "").toLowerCase() === "whatsapp" ||
    (lead.source || "").toLowerCase() === "whatsapp";
  if (!isWhatsApp) return null;

  const unread = lead.unreadWhatsappCount || 0;
  const preview = lead.body ? lead.body.slice(0, 40) + (lead.body.length > 40 ? "…" : "") : null;
  const lastTime = lead.lastWhatsappAt
    ? new Date(lead.lastWhatsappAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div className="flex flex-col gap-0.5 mt-1">
      <div className="flex items-center gap-1">
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-50 border border-emerald-200 rounded text-[10px] font-bold text-emerald-700">
          <MessageCircle className="w-2.5 h-2.5 fill-emerald-500 text-emerald-500" />
          WhatsApp
        </span>
        {unread > 0 && (
          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-black">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
        {lastTime && (
          <span className="text-[10px] text-on-surface-variant font-medium ml-0.5">{lastTime}</span>
        )}
      </div>
      {preview && (
        <p className="text-[10px] text-on-surface-variant italic truncate max-w-[200px]">"{preview}"</p>
      )}
    </div>
  );
}

const STATUS_CONFIG: Record<string, { bg: string; text: string; bar: string; border: string; hover: string }> = {
  NEW: { bg: "bg-blue-50", text: "text-blue-700", bar: "#93c5fd", border: "border-blue-200", hover: "hover:bg-blue-100/70 hover:border-blue-300" },
  CONTACTED: { bg: "bg-amber-50", text: "text-amber-700", bar: "#fcd34d", border: "border-amber-200", hover: "hover:bg-amber-100/70 hover:border-amber-300" },
  QUALIFIED: { bg: "bg-purple-50", text: "text-purple-700", bar: "#d8b4fe", border: "border-purple-200", hover: "hover:bg-purple-100/70 hover:border-purple-300" },
  CONVERTED: { bg: "bg-emerald-50", text: "text-emerald-700", bar: "#6ee7b7", border: "border-emerald-200", hover: "hover:bg-emerald-100/70 hover:border-emerald-300" },
  NOT_CONVERTED: { bg: "bg-rose-50", text: "text-rose-700", bar: "#fda4af", border: "border-rose-200", hover: "hover:bg-rose-100/70 hover:border-rose-300" },
  // Legacy display fallbacks (normalised server-side, kept for graceful degradation)
  New: { bg: "bg-blue-50", text: "text-blue-700", bar: "#93c5fd", border: "border-blue-200", hover: "hover:bg-blue-100/70 hover:border-blue-300" },
  Contacted: { bg: "bg-amber-50", text: "text-amber-700", bar: "#fcd34d", border: "border-amber-200", hover: "hover:bg-amber-100/70 hover:border-amber-300" },
  Qualified: { bg: "bg-purple-50", text: "text-purple-700", bar: "#d8b4fe", border: "border-purple-200", hover: "hover:bg-purple-100/70 hover:border-purple-300" },
  Won: { bg: "bg-emerald-50", text: "text-emerald-700", bar: "#6ee7b7", border: "border-emerald-200", hover: "hover:bg-emerald-100/70 hover:border-emerald-300" },
  Lost: { bg: "bg-rose-50", text: "text-rose-700", bar: "#fda4af", border: "border-rose-200", hover: "hover:bg-rose-100/70 hover:border-rose-300" },
};

/** Human-readable label for Lead status enum values */
const LEAD_STATUS_LABEL: Record<string, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  QUALIFIED: "Qualified",
  CONVERTED: "Converted",
  NOT_CONVERTED: "Not Converted"
};

const DEFAULT_STATUS_CONFIG = { bg: "bg-slate-100", text: "text-slate-600", bar: "#cbd5e1", border: "border-slate-300", hover: "hover:bg-slate-200/70 hover:border-slate-400" };

function getAvatarColor(name: string) {
  const colors = [
    "bg-blue-600 text-white",
    "bg-purple-600 text-white",
    "bg-emerald-600 text-white",
    "bg-amber-600 text-white",
    "bg-rose-600 text-white",
    "bg-indigo-600 text-white",
    "bg-cyan-600 text-white",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function getInitials(name?: string) {
  if (!name || name === "Unassigned") return "UN";
  const parts = name.trim().split(" ");
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

interface LeadBoardProps {
  searchQuery?: string;
  onSearchChange?: (val: string) => void;
}

export function LeadBoard({ searchQuery = "", onSearchChange }: LeadBoardProps) {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [internalSearch, setInternalSearch] = useState("");
  const activeSearch = searchQuery || internalSearch;

  const [editingStatusId, setEditingStatusId] = useState<string | null>(null);
  const [editingOwnerId, setEditingOwnerId] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const { data: leads = [], isLoading } = useQuery<any[]>({
    queryKey: ["leads"],
    queryFn: async () => {
      const res = await fetch("/api/v1/leads", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to fetch leads");
      return res.json();
    },
    enabled: !!token,
    refetchInterval: 15000,
    refetchIntervalInBackground: false,
  });

  const { data: salespersons = [] } = useQuery<any[]>({
    queryKey: ["salespersons"],
    queryFn: async () => {
      const res = await fetch("/api/v1/salespersons", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!token
  });

  const updateLeadMutation = useMutation({
    mutationFn: async ({ leadId, payload }: { leadId: string; payload: any }) => {
      const res = await fetch(`/api/v1/leads/${leadId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error("Failed to update lead");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      setEditingStatusId(null);
      setEditingOwnerId(null);
    }
  });

  const filteredLeads = useMemo(() => {
    return leads.filter((lead: any) => {
      const numberStr = lead.leadNumber || "";
      const nameStr = `${lead.firstName} ${lead.lastName}`.toLowerCase();
      const companyStr = (lead.company || "").toLowerCase();
      const sourceStr = (lead.source || "").toLowerCase();
      return (
        numberStr.toLowerCase().includes(activeSearch.toLowerCase()) ||
        nameStr.includes(activeSearch.toLowerCase()) ||
        companyStr.includes(activeSearch.toLowerCase()) ||
        sourceStr.includes(activeSearch.toLowerCase())
      );
    });
  }, [leads, activeSearch]);

  const groupedLeads = useMemo(() => {
    const groups: Record<string, any[]> = {
      NEW: [],
      CONTACTED: [],
      QUALIFIED: [],
      CONVERTED: [],
      NOT_CONVERTED: []
    };

    filteredLeads.forEach((lead: any) => {
      const status = (lead.status || "NEW").toUpperCase();
      const normKey = ["NEW", "CONTACTED", "QUALIFIED", "CONVERTED", "NOT_CONVERTED"].includes(status)
        ? status
        : "NEW";
      groups[normKey].push(lead);
    });

    return groups;
  }, [filteredLeads]);

  const toggleGroupCollapse = (key: string) => {
    setCollapsedGroups(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const availableStatuses = ["NEW", "CONTACTED", "QUALIFIED", "CONVERTED", "NOT_CONVERTED"];

  return (
    <div className="space-y-6">
      {!onSearchChange && (
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white border border-slate-200 p-4 rounded-2xl shadow-xs">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search leads, companies..."
              value={internalSearch}
              onChange={(e) => setInternalSearch(e.target.value)}
              className="w-full bg-slate-100/80 border border-transparent rounded-xl pl-9 pr-4 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:bg-white focus:border-blue-500"
            />
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end text-xs font-semibold text-slate-500">
            <span>Showing <strong className="text-slate-900">{filteredLeads.length}</strong> leads</span>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="p-12 text-center text-xs font-bold text-slate-400 animate-pulse">
          Loading leads board...
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedLeads).map(([groupKey, groupItems]) => {
            const isCollapsed = collapsedGroups[groupKey];
            const groupConfig = STATUS_CONFIG[groupKey] || DEFAULT_STATUS_CONFIG;
            const groupSum = groupItems.reduce((acc, item) => acc + (Number(item.leadScore || 50) * 100), 0);

            return (
              <div
                key={groupKey}
                className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden transition-all"
                style={{ borderLeft: `6px solid ${groupConfig.bar}` }}
              >
                <div
                  onClick={() => toggleGroupCollapse(groupKey)}
                  className="flex items-center justify-between p-4 bg-slate-50/50 hover:bg-slate-50 cursor-pointer select-none border-b border-slate-200/60 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <button className="text-slate-400 hover:text-slate-600">
                      {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
                      <span>{LEAD_STATUS_LABEL[groupKey] || groupKey}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${groupConfig.bg} ${groupConfig.text} ${groupConfig.border}`}>
                        {groupItems.length} {groupItems.length === 1 ? "item" : "items"}
                      </span>
                    </h2>
                  </div>

                  <div className="flex items-center gap-4 text-xs font-semibold text-slate-500">
                    <span className="flex items-center gap-1 font-bold text-slate-900 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs">
                      <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{formatCurrency(groupSum)}</span>
                    </span>
                  </div>
                </div>

                {!isCollapsed && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200/60 bg-white text-[10px] uppercase font-black text-slate-400 tracking-wider">
                          <th className="py-2.5 px-4 w-72">Company & Contact</th>
                          <th className="py-2.5 px-4 w-28">Priority</th>
                          <th className="py-2.5 px-4 w-32">Status</th>
                          <th className="py-2.5 px-4 w-36">Next Action</th>
                          <th className="py-2.5 px-4 w-44">Assigned Rep</th>
                          <th className="py-2.5 px-4 w-32 text-right">Expected Value</th>
                          <th className="py-2.5 px-4 w-44">Contact Email</th>
                          <th className="py-2.5 px-4 w-28">Source</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {groupItems.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="py-6 text-center text-xs text-slate-400 italic">
                              No leads in this stage
                            </td>
                          </tr>
                        ) : (
                          groupItems.map((lead: any) => {
                            const statusCfg = STATUS_CONFIG[lead.status] || DEFAULT_STATUS_CONFIG;
                            const repName = lead.assignedTo?.name || "Unassigned";
                            const isEditingStatus = editingStatusId === lead.id;
                            const isEditingOwner = editingOwnerId === lead.id;
                            const expectedVal = Number(lead.leadScore || 50) * 100;
                            const nextAct = lead.nextAction || (lead.status === "New" ? "Reply to Lead" : lead.status === "Contacted" ? "Qualify Lead" : "Prepare Quote");

                            return (
                              <tr key={lead.id} className="hover:bg-slate-50/80 transition-colors group">
                                <td className="py-3 px-4">
                                  <Link
                                    to={`/leads/${lead.id}`}
                                    className="font-bold text-slate-900 hover:text-blue-600 transition-colors block text-xs"
                                  >
                                    {lead.company || `${lead.firstName} ${lead.lastName}`}
                                  </Link>
                                  <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                                    Contact: {lead.firstName} {lead.lastName} • {lead.leadNumber || "N/A"}
                                  </p>
                                  <WhatsAppBadge lead={lead} />
                                </td>

                                <td className="py-3 px-4">
                                  <PriorityBadge leadScore={lead.leadScore} />
                                </td>

                                <td className="py-3 px-4 relative">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingStatusId(isEditingStatus ? null : lead.id);
                                      setEditingOwnerId(null);
                                    }}
                                    className={`px-3 py-1 rounded-lg text-[11px] font-bold border ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border} ${statusCfg.hover} transition-all flex items-center justify-between w-28`}
                                  >
                                    <span className="truncate">{lead.status}</span>
                                    <ChevronDown className="w-3 h-3 opacity-70 ml-1" />
                                  </button>

                                  {isEditingStatus && (
                                    <div
                                      className="absolute z-30 top-11 left-4 w-36 bg-white border border-slate-200 rounded-xl shadow-xl p-1.5 space-y-1"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <div className="text-[9px] font-extrabold uppercase text-slate-400 px-2 py-1 border-b border-slate-100">
                                        Change Status
                                      </div>
                                      {availableStatuses.map(st => {
                                        const stCfg = STATUS_CONFIG[st] || DEFAULT_STATUS_CONFIG;
                                        const isSelected = lead.status === st;
                                        return (
                                          <button
                                            key={st}
                                            onClick={() => {
                                              updateLeadMutation.mutate({
                                                leadId: lead.id,
                                                payload: { status: st }
                                              });
                                            }}
                                            className={`w-full text-left px-2 py-1 rounded-lg text-[11px] font-bold flex items-center justify-between transition-colors border ${stCfg.bg} ${stCfg.text} ${stCfg.border}`}
                                          >
                                            <span>{st}</span>
                                            {isSelected && <Check className={`w-3 h-3 ${stCfg.text}`} />}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  )}
                                </td>

                                <td className="py-3 px-4">
                                  <span className="px-2 py-0.5 rounded-lg text-[10px] font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-200 inline-flex items-center gap-1">
                                    🎯 {nextAct}
                                  </span>
                                </td>

                                <td className="py-3 px-4 relative">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingOwnerId(isEditingOwner ? null : lead.id);
                                      setEditingStatusId(null);
                                    }}
                                    className="flex items-center gap-2 p-1 rounded-lg hover:bg-slate-100 transition-all text-xs"
                                    title={`Assigned Rep: ${repName}`}
                                  >
                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center font-black text-[9px] shadow-2xs shrink-0 ${getAvatarColor(repName)}`}>
                                      {getInitials(repName)}
                                    </div>
                                    <span className="font-semibold text-slate-800 truncate max-w-[90px]">{repName}</span>
                                  </button>

                                  {isEditingOwner && (
                                    <div
                                      className="absolute z-30 top-11 left-4 w-48 bg-white border border-slate-200 rounded-xl shadow-xl p-1.5 space-y-1 max-h-48 overflow-y-auto"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <div className="text-[9px] font-extrabold uppercase text-slate-400 px-2 py-1 border-b border-slate-100">
                                        Assign Rep
                                      </div>
                                      {salespersons.map((sp: any) => {
                                        const isSelected = lead.assignedTo?.id === sp.id;
                                        return (
                                          <button
                                            key={sp.id}
                                            onClick={() => {
                                              updateLeadMutation.mutate({
                                                leadId: lead.id,
                                                payload: { assignedToId: sp.id }
                                              });
                                            }}
                                            className={`w-full text-left px-2 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-between transition-colors ${
                                              isSelected ? "bg-blue-50 text-blue-700 font-bold" : "hover:bg-slate-100 text-slate-700"
                                            }`}
                                          >
                                            <span className="truncate">{sp.name}</span>
                                            {isSelected && <Check className="w-3 h-3 text-blue-600" />}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  )}
                                </td>

                                <td className="py-3 px-4 text-right font-black text-slate-900">
                                  {formatCurrency(expectedVal)}
                                </td>

                                <td className="py-3 px-4 text-slate-600 font-medium truncate max-w-[170px]">
                                  {lead.email || "No email"}
                                </td>

                                <td className="py-3 px-4">
                                  <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 text-[10px] font-bold">
                                    {lead.source || "Website"}
                                  </span>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
