import { useAuth } from "../context/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { 
  ClipboardList, Shield, Users, History, Check, X, Bell, Save, AlertTriangle, Info, Sliders, CheckCircle2, XCircle, RotateCcw, Search, Zap
} from "lucide-react";
import { formatCurrency } from "../utils/currency";

import { useSearchParams } from "react-router-dom";

export default function ApprovalQueue() {
  const { token, user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const initialTab = (searchParams.get("tab") as any) || "queue";

  const [activeTab, setActiveTab] = useState<"queue" | "policy" | "profiles" | "audit">(initialTab);
  const [filterStatus, setFilterStatus] = useState("Pending");

  // Profile Edit State
  const [selectedRep, setSelectedRep] = useState<any>(null);
  const [editLimit, setEditLimit] = useState<string>("");
  const [editDiscount, setEditDiscount] = useState<string>("");
  const [editMargin, setEditMargin] = useState<string>("");
  const [editTeamLeadId, setEditTeamLeadId] = useState<string>("");
  const [profileError, setProfileError] = useState<string>("");
  const [profileSuccess, setProfileSuccess] = useState<string>("");

  // Team Filter & Search State
  const [selectedTeamFilter, setSelectedTeamFilter] = useState<string>("All");
  const [repSearchQuery, setRepSearchQuery] = useState<string>("");
  const [showBulkModal, setShowBulkModal] = useState<boolean>(false);
  const [bulkLimit, setBulkLimit] = useState<string>("500000");
  const [bulkDiscount, setBulkDiscount] = useState<string>("10");
  const [bulkMargin, setBulkMargin] = useState<string>("20");

  // Policy Form State
  const [policyMaxRep, setPolicyMaxRep] = useState<string>("");
  const [policyMaxTL, setPolicyMaxTL] = useState<string>("");
  const [policyMaxRepDisc, setPolicyMaxRepDisc] = useState<string>("");
  const [policyMaxTLDisc, setPolicyMaxTLDisc] = useState<string>("");
  const [policyMinMargin, setPolicyMinMargin] = useState<string>("");
  const [policySuccess, setPolicySuccess] = useState<string>("");

  // 1. Fetch Approvals Queue
  const { data: approvals, isLoading: loadingApprovals } = useQuery({
    queryKey: ["approvals"],
    queryFn: async () => {
      const res = await fetch("/api/v1/approvals", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to fetch approvals");
      return res.json();
    }
  });

  // 2. Fetch Admin Global Policy
  const { data: policy, refetch: refetchPolicy } = useQuery({
    queryKey: ["approvalPolicy"],
    queryFn: async () => {
      const res = await fetch("/api/v1/approval-policy", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) return null;
      const data = await res.json();
      setPolicyMaxRep(String(data.maximumSalesRepApproval ?? 2500000));
      setPolicyMaxTL(String(data.maximumTeamLeadApproval ?? 10000000));
      setPolicyMaxRepDisc(String((Number(data.maximumRepDiscount ?? 0.10) * 100).toFixed(1)));
      setPolicyMaxTLDisc(String((Number(data.maximumTeamLeadDiscount ?? 0.20) * 100).toFixed(1)));
      setPolicyMinMargin(String((Number(data.minimumAllowedMargin ?? 0.15) * 100).toFixed(1)));
      return data;
    }
  });

  // 3. Fetch Sales Approval Profiles & Salespersons
  const { data: profiles, refetch: refetchProfiles } = useQuery({
    queryKey: ["salesApprovalProfiles"],
    queryFn: async () => {
      const res = await fetch("/api/v1/sales-approval-profiles", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) return [];
      return res.json();
    }
  });

  const { data: salespersons } = useQuery({
    queryKey: ["salespersons"],
    queryFn: async () => {
      const res = await fetch("/api/v1/salespersons", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) return [];
      return res.json();
    }
  });

  // 4. Fetch Audit Logs
  const { data: auditLogs, isLoading: loadingAudit } = useQuery({
    queryKey: ["approvalAuditLogs"],
    queryFn: async () => {
      const res = await fetch("/api/v1/approval-audit-logs", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) return [];
      return res.json();
    }
  });

  // Actions Mutations
  const updateApprovalMutation = useMutation({
    mutationFn: async ({ id, status, comments }: { id: string; status: string; comments?: string }) => {
      const res = await fetch(`/api/v1/approvals/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ status, comments })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update approval");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["approvals"] });
      queryClient.invalidateQueries({ queryKey: ["approvalAuditLogs"] });
    }
  });

  const updatePolicyMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch("/api/v1/approval-policy", {
        method: "PUT",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update policy");
      }
      return res.json();
    },
    onSuccess: () => {
      refetchPolicy();
      setPolicySuccess("Global Approval Policy updated successfully!");
      setTimeout(() => setPolicySuccess(""), 4000);
    }
  });

  const saveProfileMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch("/api/v1/sales-approval-profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update profile");
      }
      return res.json();
    },
    onSuccess: () => {
      refetchProfiles();
      setSelectedRep(null);
      setProfileSuccess("Sales Representative approval profile updated!");
      setTimeout(() => setProfileSuccess(""), 4000);
    },
    onError: (err: any) => {
      setProfileError(err.message);
    }
  });

  const bulkSaveMutation = useMutation({
    mutationFn: async (repIdsToUpdate: string[]) => {
      const res = await fetch("/api/v1/approvals/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({
          salesRepIds: repIdsToUpdate,
          selfApprovalLimit: Number(bulkLimit),
          discountApprovalLimit: Number(bulkDiscount) / 100,
          minimumMargin: Number(bulkMargin) / 100
        })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update team profiles");
      }
      return res.json();
    },
    onSuccess: (_, repIds) => {
      refetchProfiles();
      setShowBulkModal(false);
      setProfileSuccess(`Updated approval limits for ${repIds.length} sales representatives successfully!`);
      setTimeout(() => setProfileSuccess(""), 4000);
    },
    onError: (err: any) => {
      setProfileError(err.message);
    }
  });

  const handleSavePolicy = () => {
    updatePolicyMutation.mutate({
      maximumSalesRepApproval: Number(policyMaxRep),
      maximumTeamLeadApproval: Number(policyMaxTL),
      maximumRepDiscount: Number(policyMaxRepDisc) / 100,
      maximumTeamLeadDiscount: Number(policyMaxTLDisc) / 100,
      minimumAllowedMargin: Number(policyMinMargin) / 100
    });
  };

  const handleOpenEditProfile = (sp: any) => {
    setSelectedRep(sp);
    setProfileError("");
    const existing = profiles?.find((p: any) => p.salesRepId === sp.id);
    setEditLimit(String(existing?.selfApprovalLimit ?? 1000000));
    setEditDiscount(String((Number(existing?.discountApprovalLimit ?? 0.10) * 100).toFixed(1)));
    setEditMargin(String((Number(existing?.minimumMargin ?? 0.20) * 100).toFixed(1)));
    setEditTeamLeadId(existing?.teamLeadId || sp.managerId || "");
  };

  const handleSaveProfile = () => {
    setProfileError("");
    saveProfileMutation.mutate({
      salesRepId: selectedRep.id,
      selfApprovalLimit: Number(editLimit),
      discountApprovalLimit: Number(editDiscount) / 100,
      minimumMargin: Number(editMargin) / 100,
      teamLeadId: editTeamLeadId || null
    });
  };

  const filteredApprovals = approvals?.filter((item: any) => {
    if (filterStatus === "All") return true;
    return item.status === filterStatus;
  });

  return (
    <div className="flex-1 overflow-y-auto bg-surface h-[calc(100vh-64px)] relative">
      <div className="max-w-[1440px] mx-auto p-8 flex flex-col gap-6 h-full">
        
        {/* Header & Tabs */}
        <div className="flex justify-between items-center bg-surface-bright p-5 rounded-xl border border-outline-variant shadow-xs">
          <div>
            <h1 className="text-2xl font-bold text-on-surface flex items-center gap-2.5">
              <Shield className="w-7 h-7 text-primary" />
              Hierarchical Quotation Approval Center
            </h1>
            <p className="text-xs text-on-surface-variant mt-1">
              3-Level Approval Hierarchy: Sales Rep → Team Lead → Admin with dynamic limit, discount & margin governance.
            </p>
          </div>

          <div className="flex items-center gap-2 bg-surface-container-low p-1.5 rounded-lg border border-outline-variant">
            <button
              onClick={() => setActiveTab("queue")}
              className={`px-4 py-2 text-xs font-bold rounded-md transition-all flex items-center gap-2 ${
                activeTab === "queue" 
                  ? "bg-primary text-white shadow-xs" 
                  : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
              }`}
            >
              <ClipboardList className="w-4 h-4" />
              Pending Queue ({approvals?.filter((a: any) => a.status === "Pending").length || 0})
            </button>
            <button
              onClick={() => setActiveTab("policy")}
              className={`px-4 py-2 text-xs font-bold rounded-md transition-all flex items-center gap-2 ${
                activeTab === "policy" 
                  ? "bg-primary text-white shadow-xs" 
                  : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
              }`}
            >
              <Sliders className="w-4 h-4" />
              Admin Policy
            </button>
            <button
              onClick={() => setActiveTab("profiles")}
              className={`px-4 py-2 text-xs font-bold rounded-md transition-all flex items-center gap-2 ${
                activeTab === "profiles" 
                  ? "bg-primary text-white shadow-xs" 
                  : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
              }`}
            >
              <Users className="w-4 h-4" />
              Rep Profiles
            </button>
            <button
              onClick={() => setActiveTab("audit")}
              className={`px-4 py-2 text-xs font-bold rounded-md transition-all flex items-center gap-2 ${
                activeTab === "audit" 
                  ? "bg-primary text-white shadow-xs" 
                  : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
              }`}
            >
              <History className="w-4 h-4" />
              Audit Trail
            </button>
          </div>
        </div>

        {/* TAB 1: PENDING APPROVALS QUEUE */}
        {activeTab === "queue" && (
          <section className="flex-1 flex flex-col bg-surface-container-lowest rounded-xl border border-outline-variant shadow-xs overflow-hidden">
            <div className="p-4 border-b border-outline-variant flex justify-between items-center bg-surface-bright">
              <div className="flex items-center gap-3">
                <span className="bg-amber-50 text-amber-700 border border-amber-200 text-xs px-3 py-1 rounded-full font-bold">
                  {approvals?.filter((item: any) => item.status === 'Pending').length || 0} Approvals Pending
                </span>
                {updateApprovalMutation.isError && (
                  <span className="text-xs text-error font-semibold bg-error/10 border border-error/20 px-3 py-1 rounded">
                    {updateApprovalMutation.error?.message}
                  </span>
                )}
              </div>
              <div className="flex gap-2 items-center">
                <select 
                  value={filterStatus} 
                  onChange={(e) => setFilterStatus(e.target.value)} 
                  className="bg-surface border border-outline-variant rounded-lg px-3 py-1.5 text-xs font-medium focus:ring-1 focus:ring-primary outline-none"
                >
                  <option value="All">All Statuses</option>
                  <option value="Pending">Pending</option>
                  <option value="Approved">Approved</option>
                  <option value="Rejected">Rejected</option>
                  <option value="Invalidated">Invalidated</option>
                </select>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-surface-container-high z-10">
                  <tr className="text-[12px] font-bold tracking-wider text-on-surface-variant uppercase border-b border-outline-variant">
                    <th className="p-4">Customer & Quote</th>
                    <th className="p-4">Sales Rep</th>
                    <th className="p-4">Quote Value</th>
                    <th className="p-4">Discount</th>
                    <th className="p-4">Margin</th>
                    <th className="p-4">Trigger Reason</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant text-xs font-medium">
                  {loadingApprovals ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-on-surface-variant animate-pulse">Loading queue...</td>
                    </tr>
                  ) : filteredApprovals?.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-on-surface-variant italic">No approval requests found for this filter.</td>
                    </tr>
                  ) : (
                    filteredApprovals?.map((item: any) => {
                      const quote = item.target;
                      const evalData = item.evaluation;
                      const lead = quote?.deal?.lead;
                      const customerName = lead?.company || (lead ? `${lead.firstName} ${lead.lastName}` : "Direct Customer");
                      const repName = item.requestedBy?.name || quote?.deal?.owner?.name || "Sales Rep";
                      const value = quote?.totalAmount || 0;
                      const discountPct = evalData?.discount ? (evalData.discount * 100).toFixed(1) + "%" : "0%";
                      const marginPct = evalData?.margin !== null && evalData?.margin !== undefined ? (evalData.margin * 100).toFixed(1) + "%" : "N/A";

                      return (
                        <tr key={item.id} className="hover:bg-surface-container-low transition-colors">
                          <td className="p-4">
                            <div className="font-bold text-on-surface text-sm">{customerName}</div>
                            <div className="text-[11px] text-primary font-semibold mt-0.5">{quote?.quoteNumber || `QT-${item.targetId.substring(0,8)}`}</div>
                          </td>
                          <td className="p-4 text-on-surface font-semibold">{repName}</td>
                          <td className="p-4 font-bold text-on-surface text-sm">{formatCurrency(value)}</td>
                          <td className="p-4 font-semibold text-amber-700">{discountPct}</td>
                          <td className="p-4 font-semibold text-green-700">{marginPct}</td>
                          <td className="p-4 max-w-[280px]">
                            <div className="bg-amber-50 text-amber-900 border border-amber-200 p-2 rounded text-[11px] font-semibold leading-relaxed">
                              {item.comments || evalData?.reason || "Approval limit threshold exceeded."}
                            </div>
                          </td>
                          <td className="p-4 text-right">
                            {item.status === "Pending" ? (
                              <div className="flex gap-1.5 justify-end">
                                <button
                                  onClick={() => updateApprovalMutation.mutate({ id: item.id, status: "Approved", comments: "Approved by Manager" })}
                                  disabled={updateApprovalMutation.isPending}
                                  className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-2xs flex items-center gap-1"
                                >
                                  <Check className="w-3.5 h-3.5" /> Approve
                                </button>
                                <button
                                  onClick={() => updateApprovalMutation.mutate({ id: item.id, status: "Rejected", comments: "Rejected" })}
                                  disabled={updateApprovalMutation.isPending}
                                  className="bg-error hover:bg-error/90 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-2xs flex items-center gap-1"
                                >
                                  <X className="w-3.5 h-3.5" /> Reject
                                </button>
                              </div>
                            ) : (
                              <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase ${
                                item.status === "Approved" ? "bg-green-100 text-green-800 border border-green-200" :
                                item.status === "Rejected" ? "bg-red-100 text-red-800 border border-red-200" :
                                "bg-slate-100 text-slate-700 border border-slate-200"
                              }`}>
                                {item.status}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* TAB 2: ADMIN GLOBAL POLICY */}
        {activeTab === "policy" && (
          <section className="bg-surface-container-lowest p-8 rounded-xl border border-outline-variant shadow-xs max-w-3xl">
            <h2 className="text-xl font-bold text-on-surface mb-2 flex items-center gap-2">
              <Sliders className="w-5 h-5 text-primary" /> Global Approval Policy Ceilings (Admin)
            </h2>
            <p className="text-xs text-on-surface-variant mb-6">
              Establish organization-wide maximum authority limits. Team Leads cannot assign limits to representatives higher than these ceilings.
            </p>

            {policySuccess && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-800 rounded-lg text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600" /> {policySuccess}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-on-surface mb-1">Maximum Sales Rep Self-Approval Ceiling (₹)</label>
                <input
                  type="number"
                  value={policyMaxRep}
                  onChange={(e) => setPolicyMaxRep(e.target.value)}
                  className="w-full bg-surface border border-outline-variant rounded-lg p-2.5 text-sm font-semibold focus:ring-1 focus:ring-primary outline-none"
                  placeholder="2500000"
                />
                <span className="text-[11px] text-on-surface-variant">Default: ₹25,00,000</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-on-surface mb-1">Maximum Team Lead Approval Ceiling (₹)</label>
                <input
                  type="number"
                  value={policyMaxTL}
                  onChange={(e) => setPolicyMaxTL(e.target.value)}
                  className="w-full bg-surface border border-outline-variant rounded-lg p-2.5 text-sm font-semibold focus:ring-1 focus:ring-primary outline-none"
                  placeholder="10000000"
                />
                <span className="text-[11px] text-on-surface-variant">Default: ₹1,00,00,000</span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-on-surface mb-1">Maximum Rep Discount Limit (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={policyMaxRepDisc}
                    onChange={(e) => setPolicyMaxRepDisc(e.target.value)}
                    className="w-full bg-surface border border-outline-variant rounded-lg p-2.5 text-sm font-semibold focus:ring-1 focus:ring-primary outline-none"
                    placeholder="10.0"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-on-surface mb-1">Maximum Team Lead Discount Limit (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={policyMaxTLDisc}
                    onChange={(e) => setPolicyMaxTLDisc(e.target.value)}
                    className="w-full bg-surface border border-outline-variant rounded-lg p-2.5 text-sm font-semibold focus:ring-1 focus:ring-primary outline-none"
                    placeholder="20.0"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-on-surface mb-1">Minimum Allowed Margin Threshold (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={policyMinMargin}
                  onChange={(e) => setPolicyMinMargin(e.target.value)}
                  className="w-full bg-surface border border-outline-variant rounded-lg p-2.5 text-sm font-semibold focus:ring-1 focus:ring-primary outline-none"
                  placeholder="15.0"
                />
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  onClick={handleSavePolicy}
                  disabled={updatePolicyMutation.isPending}
                  className="bg-primary hover:bg-primary/95 text-white px-6 py-2.5 rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-2"
                >
                  <Save className="w-4 h-4" /> Save Global Policy
                </button>
              </div>
            </div>
          </section>
        )}

        {/* TAB 3: REP APPROVAL PROFILES MANAGEMENT */}
        {activeTab === "profiles" && (() => {
          const teamLeadsList = salespersons?.filter((s: any) => s.role === "sales_manager" || s.role === "admin") || [];

          const getRepTeamLeadId = (sp: any) => {
            const prof = profiles?.find((p: any) => p.salesRepId === sp.id || p.sales_rep_id === sp.id);
            return prof?.teamLeadId || prof?.teamLead?.id || prof?.team_lead_id || sp.managerId || sp.manager_id || "unassigned";
          };

          const filteredSalespersons = salespersons?.filter((sp: any) => {
            if (sp.role === "admin") return false; // Hide admins from sales rep table

            const tlId = getRepTeamLeadId(sp);

            if (selectedTeamFilter !== "All") {
              if (selectedTeamFilter === "unassigned" && tlId !== "unassigned") return false;
              if (selectedTeamFilter !== "unassigned") {
                // Include the Team Lead manager themselves when filtering by their team
                if (sp.id === selectedTeamFilter) return true;
                if (tlId !== selectedTeamFilter) return false;
              }
            }

            if (repSearchQuery.trim()) {
              const q = repSearchQuery.toLowerCase().trim();
              const matchesName = sp.name?.toLowerCase().includes(q);
              const matchesEmail = sp.email?.toLowerCase().includes(q);
              return matchesName || matchesEmail;
            }

            return true;
          })?.sort((a: any, b: any) => {
            // Pin Team Lead to the very top of the table
            const aIsTL = a.role === "sales_manager" || a.id === selectedTeamFilter;
            const bIsTL = b.role === "sales_manager" || b.id === selectedTeamFilter;
            if (aIsTL && !bIsTL) return -1;
            if (!aIsTL && bIsTL) return 1;
            return (a.name || "").localeCompare(b.name || "");
          }) || [];

          return (
            <section className="flex-1 flex flex-col bg-surface-container-lowest rounded-xl border border-outline-variant shadow-xs overflow-hidden">
              <div className="p-4 border-b border-outline-variant bg-surface-bright flex justify-between items-center flex-wrap gap-3">
                <div>
                  <h2 className="text-lg font-bold text-on-surface flex items-center gap-2">
                    <Users className="w-5 h-5 text-primary" /> Sales Representative Approval Authority Profiles
                  </h2>
                  <p className="text-xs text-on-surface-variant">Filter by team to manage team limits or configure individual representatives.</p>
                </div>
                {profileSuccess && (
                  <span className="text-xs font-bold text-green-700 bg-green-50 border border-green-200 px-3 py-1 rounded-lg">
                    {profileSuccess}
                  </span>
                )}
              </div>

              {/* Team Filter & Search Toolbar */}
              <div className="p-4 border-b border-outline-variant bg-surface-container-low flex flex-wrap justify-between items-center gap-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Filter Team:</span>
                    <select
                      value={selectedTeamFilter}
                      onChange={(e) => setSelectedTeamFilter(e.target.value)}
                      className="bg-surface border border-outline-variant text-xs font-bold text-on-surface rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary outline-none shadow-2xs"
                    >
                      <option value="All">All Teams ({salespersons?.filter((s: any) => s.role !== 'admin').length || 0} Reps)</option>
                      {teamLeadsList.map((tl: any) => {
                        const count = salespersons?.filter((s: any) => s.role !== 'admin' && getRepTeamLeadId(s) === tl.id).length || 0;
                        return (
                          <option key={tl.id} value={tl.id}>
                            {tl.name}'s Team ({count} Reps)
                          </option>
                        );
                      })}
                      <option value="unassigned">
                        Unassigned Reps ({salespersons?.filter((s: any) => s.role !== 'admin' && getRepTeamLeadId(s) === 'unassigned').length || 0} Reps)
                      </option>
                    </select>
                  </div>

                  <div className="relative">
                    <input
                      type="text"
                      value={repSearchQuery}
                      onChange={(e) => setRepSearchQuery(e.target.value)}
                      placeholder="Search by name or email..."
                      className="w-64 bg-surface border border-outline-variant rounded-lg pl-8 pr-8 py-2 text-xs font-medium text-on-surface focus:ring-2 focus:ring-primary outline-none shadow-2xs"
                    />
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                    {repSearchQuery && (
                      <button onClick={() => setRepSearchQuery("")} className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <span className="text-xs text-slate-500 font-semibold">
                    Showing <strong className="text-on-surface font-bold">{filteredSalespersons.length}</strong> representatives
                  </span>
                </div>

                <button
                  onClick={() => setShowBulkModal(true)}
                  disabled={filteredSalespersons.length === 0}
                  className="bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-bold px-4 py-2 rounded-lg shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Zap className="w-4 h-4" /> Bulk Set Limits ({filteredSalespersons.length} Reps)
                </button>
              </div>

              <div className="flex-1 overflow-y-auto">
                {filteredSalespersons.length === 0 ? (
                  <div className="p-12 text-center text-on-surface-variant text-sm">
                    No sales representatives match the selected team filter or search criteria.
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 bg-surface-container-high z-10">
                      <tr className="text-[12px] font-bold tracking-wider text-on-surface-variant uppercase border-b border-outline-variant">
                        <th className="p-4">Member & Role</th>
                        <th className="p-4">Assigned Team Lead</th>
                        <th className="p-4">Direct Approval Limit</th>
                        <th className="p-4">Discount Limit</th>
                        <th className="p-4">Minimum Margin</th>
                        <th className="p-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant text-xs font-medium">
                      {filteredSalespersons.map((sp: any) => {
                        const prof = profiles?.find((p: any) => p.salesRepId === sp.id);
                        const isTL = sp.role === "sales_manager";
                        const tlName = isTL ? "Reports to Admin" : (prof?.teamLead?.name || salespersons?.find((s: any) => s.id === sp.managerId)?.name || "Unassigned");
                        const defaultSelfLimit = isTL ? 5000000 : 1000000;
                        const defaultDiscLimit = isTL ? 0.20 : 0.10;
                        const defaultMargin = isTL ? 0.15 : 0.20;

                        const selfLimit = prof ? formatCurrency(prof.selfApprovalLimit) : formatCurrency(defaultSelfLimit) + " (Default)";
                        const discLimit = prof ? (prof.discountApprovalLimit * 100).toFixed(1) + "%" : (defaultDiscLimit * 100).toFixed(1) + "% (Default)";
                        const minMarg = prof ? (prof.minimumMargin * 100).toFixed(1) + "%" : (defaultMargin * 100).toFixed(1) + "% (Default)";

                        return (
                          <tr key={sp.id} className={`hover:bg-surface-container-low transition-colors ${isTL ? 'bg-indigo-50/40 font-semibold' : ''}`}>
                            <td className="p-4">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-on-surface text-sm">{sp.name}</span>
                                {isTL && (
                                  <span className="bg-indigo-100 text-indigo-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-indigo-200 uppercase tracking-wider">
                                    🛡️ Team Lead
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-on-surface-variant">{sp.email}</div>
                            </td>
                            <td className="p-4 font-semibold text-on-surface">{tlName}</td>
                            <td className="p-4 font-bold text-primary text-sm">{selfLimit}</td>
                            <td className="p-4 font-semibold text-amber-700">{discLimit}</td>
                            <td className="p-4 font-semibold text-green-700">{minMarg}</td>
                            <td className="p-4 text-right">
                              <button
                                onClick={() => handleOpenEditProfile(sp)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                  isTL 
                                    ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs' 
                                    : 'bg-primary/10 hover:bg-primary/20 text-primary'
                                }`}
                              >
                                {isTL ? 'Configure Team Lead Limits' : 'Configure Limits'}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Modal for Bulk Set Team Limits */}
              {showBulkModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
                  <div className="bg-surface-container-lowest rounded-2xl max-w-lg w-full p-6 border border-outline-variant shadow-2xl animate-in fade-in zoom-in duration-150">
                    <div className="flex justify-between items-center pb-3 border-b border-outline-variant">
                      <h3 className="text-base font-bold text-on-surface flex items-center gap-2">
                        <Zap className="w-5 h-5 text-amber-600" /> Bulk Configure Team Approval Limits
                      </h3>
                      <button onClick={() => setShowBulkModal(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="py-4 space-y-4">
                      <div className="p-3.5 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs font-medium space-y-1">
                        <div>Applying default limits to <strong className="font-bold">{filteredSalespersons.length} sales representatives</strong>.</div>
                        <div className="text-[11px] text-amber-800">Scope: {selectedTeamFilter === 'All' ? 'All Teams' : `Filtered Team`}</div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-on-surface mb-1">Self-Approval Limit (SAR / ₹)</label>
                        <input
                          type="number"
                          value={bulkLimit}
                          onChange={(e) => setBulkLimit(e.target.value)}
                          className="w-full bg-surface border border-outline-variant rounded-lg p-2.5 text-sm font-semibold focus:ring-2 focus:ring-amber-500 outline-none"
                          placeholder="500000"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-on-surface mb-1">Discount Limit (%)</label>
                          <input
                            type="number"
                            step="0.1"
                            value={bulkDiscount}
                            onChange={(e) => setBulkDiscount(e.target.value)}
                            className="w-full bg-surface border border-outline-variant rounded-lg p-2.5 text-sm font-semibold focus:ring-2 focus:ring-amber-500 outline-none"
                            placeholder="10.0"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-on-surface mb-1">Minimum Margin (%)</label>
                          <input
                            type="number"
                            step="0.1"
                            value={bulkMargin}
                            onChange={(e) => setBulkMargin(e.target.value)}
                            className="w-full bg-surface border border-outline-variant rounded-lg p-2.5 text-sm font-semibold focus:ring-2 focus:ring-amber-500 outline-none"
                            placeholder="20.0"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-3 border-t border-outline-variant">
                      <button
                        onClick={() => setShowBulkModal(false)}
                        className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-surface-container rounded-lg"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => bulkSaveMutation.mutate(filteredSalespersons.map((sp: any) => sp.id))}
                        disabled={bulkSaveMutation.isPending || filteredSalespersons.length === 0}
                        className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer"
                      >
                        <CheckCircle2 className="w-4 h-4" /> Apply Limits to {filteredSalespersons.length} Reps
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </section>
          );
        })()}

            {/* Modal for Configuring Profile */}
            {selectedRep && (() => {
              const isTL = selectedRep.role === "sales_manager";
              const maxAllowedLimit = isTL ? (policy?.maximumTeamLeadApproval || 10000000) : (policy?.maximumSalesRepApproval || 2500000);
              const maxAllowedDisc = isTL ? (policy?.maximumTeamLeadDiscount || 0.20) : (policy?.maximumRepDiscount || 0.10);

              return (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                  <div className="bg-surface-container-lowest rounded-xl max-w-lg w-full p-6 border border-outline-variant shadow-xl">
                    <h3 className="text-lg font-bold text-on-surface mb-1 flex items-center gap-2">
                      {isTL ? <Shield className="w-5 h-5 text-indigo-600" /> : <Users className="w-5 h-5 text-primary" />}
                      Configure {isTL ? 'Team Lead' : 'Sales Representative'} Authority: {selectedRep.name}
                    </h3>
                    <p className="text-xs text-on-surface-variant mb-4">
                      Admin Ceiling: <strong className="text-on-surface font-bold">{formatCurrency(maxAllowedLimit)}</strong> | Max Discount: <strong className="text-on-surface font-bold">{(maxAllowedDisc * 100).toFixed(1)}%</strong>
                    </p>

                    {profileError && (
                      <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-800 rounded-lg text-xs font-bold flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                        {profileError}
                      </div>
                    )}

                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-on-surface mb-1">
                          {isTL ? 'Team Lead Direct Approval Limit (SAR / ₹)' : 'Sales Rep Self-Approval Limit (SAR / ₹)'}
                        </label>
                        <input
                          type="number"
                          value={editLimit}
                          onChange={(e) => setEditLimit(e.target.value)}
                          className="w-full bg-surface border border-outline-variant rounded-lg p-2 text-sm font-semibold outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-on-surface mb-1">
                          {isTL ? 'Team Lead Max Discount Authority (%)' : 'Sales Rep Discount Approval Limit (%)'}
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          value={editDiscount}
                          onChange={(e) => setEditDiscount(e.target.value)}
                          className="w-full bg-surface border border-outline-variant rounded-lg p-2 text-sm font-semibold outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-on-surface mb-1">
                          Minimum Margin Limit (%)
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          value={editMargin}
                          onChange={(e) => setEditMargin(e.target.value)}
                          className="w-full bg-surface border border-outline-variant rounded-lg p-2 text-sm font-semibold outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>

                      {!isTL && (
                        <div>
                          <label className="block text-xs font-bold text-on-surface mb-1">Assigned Team Lead</label>
                          <select
                            value={editTeamLeadId}
                            onChange={(e) => setEditTeamLeadId(e.target.value)}
                            className="w-full bg-surface border border-outline-variant rounded-lg p-2 text-xs font-semibold outline-none focus:ring-1 focus:ring-primary"
                          >
                            <option value="">Select Team Lead...</option>
                            {salespersons?.filter((s: any) => s.id !== selectedRep.id).map((tl: any) => (
                              <option key={tl.id} value={tl.id}>{tl.name} ({tl.role})</option>
                            ))}
                          </select>
                        </div>
                      )}

                    <div className="pt-4 flex justify-end gap-2">
                      <button
                        onClick={() => setSelectedRep(null)}
                        className="px-4 py-2 bg-surface-container hover:bg-surface-container-high rounded-lg text-xs font-bold text-on-surface-variant"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveProfile}
                        disabled={saveProfileMutation.isPending}
                        className="px-5 py-2 bg-primary hover:bg-primary/95 text-white rounded-lg text-xs font-bold transition-all shadow-xs"
                      >
                        Save Configuration
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

        {/* TAB 4: AUDIT TRAIL */}
        {activeTab === "audit" && (
          <section className="flex-1 flex flex-col bg-surface-container-lowest rounded-xl border border-outline-variant shadow-xs overflow-hidden">
            <div className="p-4 border-b border-outline-variant bg-surface-bright">
              <h2 className="text-lg font-bold text-on-surface flex items-center gap-2">
                <History className="w-5 h-5 text-primary" /> Approval Evaluation Audit Log
              </h2>
              <p className="text-xs text-on-surface-variant">Immutable record of every quotation evaluation, submission, approval, rejection, and invalidation.</p>
            </div>

            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-surface-container-high z-10">
                  <tr className="text-[12px] font-bold tracking-wider text-on-surface-variant uppercase border-b border-outline-variant">
                    <th className="p-4">Timestamp</th>
                    <th className="p-4">Quote & Rep</th>
                    <th className="p-4">Value</th>
                    <th className="p-4">Level</th>
                    <th className="p-4">Decision</th>
                    <th className="p-4">Approver</th>
                    <th className="p-4">Evaluation Audit Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant text-xs font-medium">
                  {loadingAudit ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-on-surface-variant animate-pulse">Loading audit logs...</td>
                    </tr>
                  ) : auditLogs?.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-on-surface-variant italic">No audit records found.</td>
                    </tr>
                  ) : (
                    auditLogs?.map((log: any) => (
                      <tr key={log.id} className="hover:bg-surface-container-low transition-colors">
                        <td className="p-4 text-on-surface-variant">{new Date(log.createdAt).toLocaleString()}</td>
                        <td className="p-4">
                          <div className="font-bold text-on-surface">{log.quote?.quoteNumber || `QT-${log.quoteId.substring(0,8)}`}</div>
                          <div className="text-[11px] text-on-surface-variant">{log.salesRep?.name || "Sales Rep"}</div>
                        </td>
                        <td className="p-4 font-bold text-on-surface">{formatCurrency(log.actualQuoteValue)}</td>
                        <td className="p-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            log.approvalLevel === "ADMIN" ? "bg-red-100 text-red-800" :
                            log.approvalLevel === "TEAM_LEAD" ? "bg-amber-100 text-amber-800" :
                            "bg-green-100 text-green-800"
                          }`}>
                            {log.approvalLevel}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                            log.decision === "Approved" ? "bg-green-100 text-green-800 border border-green-200" :
                            log.decision === "Rejected" ? "bg-red-100 text-red-800 border border-red-200" :
                            log.decision === "Invalidated" ? "bg-amber-100 text-amber-800 border border-amber-200" :
                            "bg-blue-100 text-blue-800 border border-blue-200"
                          }`}>
                            {log.decision}
                          </span>
                        </td>
                        <td className="p-4 font-semibold text-on-surface">{log.approver?.name || "System Auto"}</td>
                        <td className="p-4 max-w-xs text-on-surface-variant font-medium leading-relaxed">{log.reason}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

      </div>
    </div>
  );
}
