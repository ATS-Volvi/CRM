import { useAuth } from "../context/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { 
  GripVertical, Package, Globe, RefreshCw, Award, 
  ArrowRight, Users, Map, Repeat, Delete, Plus, Home,
  Sliders, CalendarOff, X, Zap, BarChart3, ShieldCheck, History, Sparkles, TrendingUp, CheckCircle2, AlertCircle, Eye, Shield, Save
} from "lucide-react";
import { formatCurrency } from "../utils/currency";

export default function AssignmentRules() {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<"distribution" | "profiles" | "policy" | "audits" | "automations">("distribution");
  const [showAddRuleModal, setShowAddRuleModal] = useState(false);
  const [showAddAutomationModal, setShowAddAutomationModal] = useState(false);
  const [newRule, setNewRule] = useState({ name: "", description: "", ruleType: "round-robin", criteria: "All Leads", action: "" });
  const [newAutomation, setNewAutomation] = useState({
    name: "",
    stageName: "Proposal",
    actionType: "create_task",
    taskTitle: "Follow-up proposal parameters",
    dueDays: 2
  });
  const [fallbackUser, setFallbackUser] = useState("Sales Ops Manager");
  const [selectedAudit, setSelectedAudit] = useState<any>(null);

  // Policy Weights State
  const [policyForm, setPolicyForm] = useState<any>({
    conversionRate: 0.20,
    industrySkill: 0.20,
    territoryMatch: 0.10,
    revenuePerformance: 0.10,
    experienceTier: 0.10,
    responseTime: 0.05,
    slaCompliance: 0.05,
    workloadCapacity: 0.10,
    fairnessDistribution: 0.05,
    managerRating: 0.05,
    highValueThreshold: 10000000,
    bayesianPrior: 0.25,
    bayesianWeight: 3,
    isPerformanceRoutingEnabled: true
  });
  const [policySuccessMsg, setPolicySuccessMsg] = useState("");

  // 1. Fetch Assignment Policy
  const { data: policyData } = useQuery<any>({
    queryKey: ["salesAssignmentPolicy"],
    queryFn: async () => {
      const res = await fetch("/api/v1/assignment/policy", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (data && data.weights) {
        const parsedWeights = typeof data.weights === "string" ? JSON.parse(data.weights) : data.weights;
        setPolicyForm({
          ...parsedWeights,
          highValueThreshold: data.highValueThreshold ?? 10000000,
          bayesianPrior: data.bayesianPrior ?? 0.25,
          bayesianWeight: data.bayesianWeight ?? 3,
          isPerformanceRoutingEnabled: data.isPerformanceRoutingEnabled ?? true
        });
      }
      return data;
    }
  });

  const updatePolicyMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch("/api/v1/assignment/policy", {
        method: "PUT",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["salesAssignmentPolicy"] });
      setPolicySuccessMsg("Assignment Policy weights & thresholds saved successfully!");
      setTimeout(() => setPolicySuccessMsg(""), 4000);
    }
  });

  // 2. Fetch Rep Performance Profiles
  const { data: repProfiles = [], isLoading: isLoadingProfiles, refetch: refetchProfiles } = useQuery<any[]>({
    queryKey: ["repPerformanceProfiles"],
    queryFn: async () => {
      const res = await fetch("/api/v1/assignment/rep-profiles", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) return [];
      return res.json();
    }
  });

  // 3. Fetch Assignment Audits
  const { data: assignmentAudits = [], isLoading: isLoadingAudits } = useQuery<any[]>({
    queryKey: ["assignmentAudits"],
    queryFn: async () => {
      const res = await fetch("/api/v1/assignment/audits", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) return [];
      return res.json();
    }
  });

  // 4. Existing Automations & Capacities
  const { data: automations = [], refetch: refetchAutomations } = useQuery<any[]>({
    queryKey: ["automationRules"],
    queryFn: async () => {
      const res = await fetch("/api/v1/automations", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) return [];
      return res.json();
    }
  });

  const createAutomationMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/v1/automations", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      refetchAutomations();
      setShowAddAutomationModal(false);
      setNewAutomation({ name: "", stageName: "Proposal", actionType: "create_task", taskTitle: "Follow-up proposal parameters", dueDays: 2 });
    }
  });

  const deleteAutomationMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/v1/automations/${id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      refetchAutomations();
    }
  });

  const { data: capacities = [], isLoading: isLoadingCapacities, refetch: refetchCapacities } = useQuery<any[]>({
    queryKey: ["salespersonsCapacities"],
    queryFn: async () => {
      const res = await fetch("/api/v1/assignment-rules/capacities", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to fetch capacities");
      return res.json();
    }
  });

  const balanceLimitsMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/v1/assignment-rules/balance-capacity", {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (data) => {
      alert(data.message || "Limits balanced successfully!");
      refetchCapacities();
    },
    onError: (err: any) => {
      alert("Failed to balance limits: " + err.message);
    }
  });

  const { data: rules, isLoading } = useQuery({
    queryKey: ["assignmentRules"],
    queryFn: async () => {
      const res = await fetch("/api/v1/assignment-rules", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to fetch assignment rules");
      return res.json();
    }
  });

  const createRuleMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/v1/assignment-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assignmentRules"] });
      setShowAddRuleModal(false);
      setNewRule({ name: "", description: "", ruleType: "round-robin", criteria: "All Leads", action: "" });
    }
  });

  const deleteRuleMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/v1/assignment-rules/${id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assignmentRules"] });
    }
  });

  const handleSavePolicyWeights = () => {
    updatePolicyMutation.mutate({
      weights: {
        conversionRate: Number(policyForm.conversionRate),
        industrySkill: Number(policyForm.industrySkill),
        territoryMatch: Number(policyForm.territoryMatch),
        revenuePerformance: Number(policyForm.revenuePerformance),
        experienceTier: Number(policyForm.experienceTier),
        responseTime: Number(policyForm.responseTime),
        slaCompliance: Number(policyForm.slaCompliance),
        workloadCapacity: Number(policyForm.workloadCapacity),
        fairnessDistribution: Number(policyForm.fairnessDistribution),
        managerRating: Number(policyForm.managerRating)
      },
      highValueThreshold: Number(policyForm.highValueThreshold),
      bayesianPrior: Number(policyForm.bayesianPrior),
      bayesianWeight: Number(policyForm.bayesianWeight),
      isPerformanceRoutingEnabled: Boolean(policyForm.isPerformanceRoutingEnabled)
    });
  };

  const handleExportLogic = () => {
    if (!rules || rules.length === 0) {
      alert("No rules to export.");
      return;
    }
    const headers = ["Rule Name", "Description", "Type", "Criteria", "Action", "Active"];
    const rows = rules.map((r: any) => [
      r.name || "Unnamed Rule",
      r.description || "",
      r.ruleType || "round-robin",
      r.criteria || "All Leads",
      (r.assignTo ? `Assign to ${r.assignTo.name}` : r.action) || "",
      r.isActive ?? r.active ?? true ? "YES" : "NO"
    ]);
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map((row: any) => row.map((val: any) => `"${val.replace(/"/g, '""')}"`).join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "assignment_rules_logic.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#FAF8FF] min-h-[calc(100vh-88px)] relative">
      {/* Top Bar Shell */}
      <header className="h-16 flex justify-between items-center px-8 bg-white border-b border-slate-200/80 sticky top-0 z-40 shadow-2xs flex-wrap gap-3">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setActiveTab("distribution")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === "distribution" ? "bg-[#2563EB] text-white shadow-2xs" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Rules & Capacities
            </button>
            <button
              onClick={() => setActiveTab("profiles")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === "profiles" ? "bg-[#2563EB] text-white shadow-2xs" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" /> Rep Performance & Fit Scores ({repProfiles.length})
            </button>
            <button
              onClick={() => setActiveTab("policy")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === "policy" ? "bg-[#2563EB] text-white shadow-2xs" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              <Sliders className="w-3.5 h-3.5" /> Engine Weights & Policy
            </button>
            <button
              onClick={() => setActiveTab("audits")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === "audits" ? "bg-[#2563EB] text-white shadow-2xs" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              <History className="w-3.5 h-3.5" /> Assignment Audit Trail ({assignmentAudits.length})
            </button>
            <button
              onClick={() => setActiveTab("automations")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === "automations" ? "bg-[#2563EB] text-white shadow-2xs" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Stage Automations ({automations.length})
            </button>
          </div>

          <div className="h-4 w-[1px] bg-slate-200"></div>
          <div className="flex items-center gap-2 text-[#2563EB] font-bold">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-500 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#2563EB]"></span>
            </span>
            <span className="text-xs font-bold">Performance-Aware Assignment Engine Active</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {activeTab === "distribution" && (
            <button 
              onClick={() => setShowAddRuleModal(true)}
              className="bg-[#2563EB] hover:bg-blue-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all shadow-2xs flex items-center gap-1.5 active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Add Rule
            </button>
          )}
          {activeTab === "automations" && (
            <button 
              onClick={() => setShowAddAutomationModal(true)}
              className="bg-[#2563EB] hover:bg-blue-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all shadow-2xs flex items-center gap-1.5 active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Add Automation
            </button>
          )}
        </div>
      </header>

      {/* Main Workspace Area */}
      <main className="p-8 max-w-[1440px] mx-auto">
        {/* TAB 1: DISTRIBUTION RULES */}
        {activeTab === "distribution" && (
          <div className="flex gap-8 items-start">
            <div className="flex-1 space-y-6">
              <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-2xs">
                <h3 className="text-lg font-bold text-[#191B23]">Active Distribution Hierarchy</h3>
                <p className="text-xs text-slate-500 mt-1">Rules are evaluated sequentially. Protected ownership (Manual/Channel/Account/Contact/Deal) takes priority.</p>
              </div>

              <div className="space-y-4">
                {isLoading ? (
                  <div className="p-8 text-center text-slate-400 font-medium animate-pulse">Loading assignment rules...</div>
                ) : !rules || rules.length === 0 ? (
                  <div className="p-12 bg-white border border-slate-200/80 rounded-2xl text-center text-slate-500 font-medium">
                    No active rules found. Click "Add Rule" to create custom routing rules.
                  </div>
                ) : (
                  rules.map((rule: any, idx: number) => (
                    <div key={rule.id} className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs hover:shadow-md transition-all flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <span className="w-7 h-7 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-xs font-black text-slate-600">
                          {idx + 1}
                        </span>
                        <div>
                          <div className="font-bold text-sm text-[#191B23] flex items-center gap-2">
                            {rule.name || `Rule #${idx + 1}`}
                            <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-blue-50 text-[#2563EB] border border-blue-200">
                              {rule.ruleType || "round-robin"}
                            </span>
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            Criteria: <code className="bg-slate-100 px-1.5 py-0.5 rounded text-[11px] font-semibold text-slate-700">{rule.criteria}</code>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="text-xs font-bold text-[#191B23]">
                            {rule.assignTo ? rule.assignTo.name : rule.action}
                          </div>
                          <div className="text-[11px] text-slate-400 font-medium">
                            {rule.lastAssignedAt ? `Last: ${new Date(rule.lastAssignedAt).toLocaleTimeString()}` : "Not yet assigned"}
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            if (confirm("Delete this assignment rule?")) deleteRuleMutation.mutate(rule.id);
                          }}
                          className="p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-all cursor-pointer"
                        >
                          <Delete className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Sidebar Capacity */}
            <aside className="w-80 flex flex-col gap-6 shrink-0">
              <section className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                  <h4 className="text-[11px] font-black uppercase tracking-wider text-[#6B7280]">Agent Capacity</h4>
                  <Sliders className="w-4 h-4 text-[#2563EB]" />
                </div>
                <div className="space-y-3.5 max-h-[420px] overflow-y-auto pr-1">
                  {isLoadingCapacities ? (
                    <div className="text-xs text-slate-400 animate-pulse font-medium">Loading capacities...</div>
                  ) : capacities.map((cap: any) => {
                    const percentage = Math.min(100, Math.round((cap.current / cap.max) * 100));
                    const isOverloaded = cap.current >= cap.max;
                    const barColor = isOverloaded ? "bg-rose-500" : percentage > 80 ? "bg-amber-500" : "bg-[#2563EB]";
                    return (
                      <div key={cap.id || cap.name} className="space-y-1">
                        <div className="flex justify-between text-xs font-bold">
                          <span className="text-[#191B23]">{cap.name}</span>
                          <span className={`${isOverloaded ? "text-rose-600 font-black" : "text-slate-500"}`}>
                            {cap.current} / {cap.max} leads
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200/60">
                          <div className={`${barColor} h-full rounded-full transition-all duration-300`} style={{ width: `${percentage}%` }}></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <button 
                  onClick={() => balanceLimitsMutation.mutate()}
                  disabled={balanceLimitsMutation.isPending}
                  className="w-full py-2 bg-blue-50 hover:bg-blue-100 text-[#2563EB] font-bold text-xs rounded-xl border border-blue-200 transition-all cursor-pointer"
                >
                  {balanceLimitsMutation.isPending ? "Balancing..." : "Balance All Limits"}
                </button>
              </section>
            </aside>
          </div>
        )}

        {/* TAB 2: REP PERFORMANCE PROFILES & FIT SCORES */}
        {activeTab === "profiles" && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-2xs flex justify-between items-center flex-wrap gap-4">
              <div>
                <h3 className="text-lg font-bold text-[#191B23] flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-[#2563EB]" /> Calculated Representative Performance Profiles
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Empirical conversion metrics, Bayesian smoothed rates, response performance, SLA compliance, and capacity load.
                </p>
              </div>
              <button
                onClick={() => refetchProfiles()}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Refresh Profiles
              </button>
            </div>

            {isLoadingProfiles ? (
              <div className="p-12 text-center text-slate-400 font-medium animate-pulse">Calculating rep performance profiles...</div>
            ) : repProfiles.length === 0 ? (
              <div className="p-12 bg-white border border-slate-200/80 rounded-2xl text-center text-slate-500 font-medium">
                No active sales representative profiles available.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {repProfiles.map((p: any) => (
                  <div key={p.userId} className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-2xs hover:shadow-md transition-all space-y-4 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-bold text-[#191B23] text-base">{p.name}</h4>
                          <span className="text-[11px] font-semibold text-slate-500">{p.role} • {p.experienceTier} ({p.experienceYears} yrs)</span>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-black text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-lg">
                            Score: {p.performanceScore}/100
                          </span>
                        </div>
                      </div>

                      {/* Skills Badges */}
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {p.skills && p.skills.length > 0 ? (
                          p.skills.map((sk: string) => (
                            <span key={sk} className="text-[10px] font-extrabold px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md border border-slate-200">
                              {sk}
                            </span>
                          ))
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">No industry skills tagged</span>
                        )}
                      </div>

                      {/* Performance Grid */}
                      <div className="grid grid-cols-2 gap-3 mt-4 pt-3 border-t border-slate-100 text-xs">
                        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Bayesian Conv.</span>
                          <strong className="text-emerald-700 font-extrabold text-sm">{(p.bayesianConversionRate * 100).toFixed(1)}%</strong>
                          <span className="text-[10px] text-slate-400 block font-medium">Raw: {(p.rawConversionRate * 100).toFixed(0)}% ({p.convertedLeads}/{p.totalLeadsAssigned})</span>
                        </div>
                        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Opportunity Win</span>
                          <strong className="text-indigo-700 font-extrabold text-sm">{(p.opportunityWinRate * 100).toFixed(1)}%</strong>
                          <span className="text-[10px] text-slate-400 block font-medium">{p.wonDeals} won deals</span>
                        </div>
                        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Revenue Won</span>
                          <strong className="text-blue-700 font-extrabold text-sm">{formatCurrency(p.totalRevenueWon)}</strong>
                          <span className="text-[10px] text-slate-400 block font-medium">Avg: {formatCurrency(p.averageDealSize)}</span>
                        </div>
                        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Avg Response</span>
                          <strong className="text-amber-700 font-extrabold text-sm">{p.averageFirstResponseMinutes} mins</strong>
                          <span className="text-[10px] text-slate-400 block font-medium">SLA: {(p.slaComplianceRate * 100).toFixed(0)}%</span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex justify-between items-center text-xs text-slate-500 font-semibold">
                      <span>Workload: <strong className="text-slate-900">{p.openLeadCount} / {p.maxOpenLeads} leads</strong></span>
                      <span>Rating: <strong className="text-amber-600 font-bold">★ {p.managerPerformanceRating.toFixed(1)}</strong></span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: ENGINE WEIGHTS & POLICY */}
        {activeTab === "policy" && (
          <div className="space-y-6 max-w-4xl">
            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-2xs">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-bold text-[#191B23] flex items-center gap-2">
                    <Sliders className="w-5 h-5 text-[#2563EB]" /> Performance-Aware Routing Weights & Policy
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Configure factor weights for the Rep Suitability Scoring Model (total should sum to 100%).
                  </p>
                </div>
                {policySuccessMsg && (
                  <span className="text-xs font-bold text-green-700 bg-green-50 border border-green-200 px-3 py-1.5 rounded-lg">
                    {policySuccessMsg}
                  </span>
                )}
              </div>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-2xs space-y-6">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Scoring Factor Weights (%)</h4>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Conversion Performance (Default: 20%)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    value={policyForm.conversionRate}
                    onChange={(e) => setPolicyForm({ ...policyForm, conversionRate: parseFloat(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Industry / Skill Match (Default: 20%)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    value={policyForm.industrySkill}
                    onChange={(e) => setPolicyForm({ ...policyForm, industrySkill: parseFloat(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Territory Match (Default: 10%)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    value={policyForm.territoryMatch}
                    onChange={(e) => setPolicyForm({ ...policyForm, territoryMatch: parseFloat(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Revenue Performance (Default: 10%)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    value={policyForm.revenuePerformance}
                    onChange={(e) => setPolicyForm({ ...policyForm, revenuePerformance: parseFloat(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Experience Tier (Default: 10%)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    value={policyForm.experienceTier}
                    onChange={(e) => setPolicyForm({ ...policyForm, experienceTier: parseFloat(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Workload / Capacity (Default: 10%)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    value={policyForm.workloadCapacity}
                    onChange={(e) => setPolicyForm({ ...policyForm, workloadCapacity: parseFloat(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Response Speed (Default: 5%)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    value={policyForm.responseTime}
                    onChange={(e) => setPolicyForm({ ...policyForm, responseTime: parseFloat(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Fairness / Distribution (Default: 5%)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    value={policyForm.fairnessDistribution}
                    onChange={(e) => setPolicyForm({ ...policyForm, fairnessDistribution: parseFloat(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-900"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
                <div>
                  <span className="text-xs font-bold text-slate-600 block">High-Value Lead Threshold (₹ / SAR)</span>
                  <input
                    type="number"
                    value={policyForm.highValueThreshold}
                    onChange={(e) => setPolicyForm({ ...policyForm, highValueThreshold: parseFloat(e.target.value) })}
                    className="mt-1 bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-bold text-slate-900 w-48"
                  />
                </div>

                <button
                  onClick={handleSavePolicyWeights}
                  disabled={updatePolicyMutation.isPending}
                  className="bg-[#2563EB] hover:bg-blue-700 text-white font-bold text-xs px-6 py-3 rounded-xl transition-all shadow-2xs flex items-center gap-2 cursor-pointer"
                >
                  <Save className="w-4 h-4" /> Save Engine Weights
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: ASSIGNMENT AUDIT TRAIL */}
        {activeTab === "audits" && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-2xs">
              <h3 className="text-lg font-bold text-[#191B23] flex items-center gap-2">
                <History className="w-5 h-5 text-[#2563EB]" /> Intelligent Lead Assignment Audit Trail
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Immutable audit log detailing lead priority, evaluated candidate scores, winning candidate, and human-readable explanation logic.
              </p>
            </div>

            {isLoadingAudits ? (
              <div className="p-12 text-center text-slate-400 font-medium animate-pulse">Loading assignment audit logs...</div>
            ) : assignmentAudits.length === 0 ? (
              <div className="p-12 bg-white border border-slate-200/80 rounded-2xl text-center text-slate-500 font-medium italic">
                No lead assignment audit records logged yet.
              </div>
            ) : (
              <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-2xs">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200/80 text-[11px] font-black uppercase text-slate-400 tracking-wider">
                    <tr>
                      <th className="p-4">Timestamp</th>
                      <th className="p-4">Lead & Company</th>
                      <th className="p-4">Priority Score</th>
                      <th className="p-4">Assigned Representative</th>
                      <th className="p-4">Assignment Type</th>
                      <th className="p-4">Human-Readable Explanation Reason</th>
                      <th className="p-4 text-right">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                    {assignmentAudits.map((a: any) => (
                      <tr key={a.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="p-4 text-slate-400 font-semibold">{new Date(a.createdAt).toLocaleString()}</td>
                        <td className="p-4">
                          <div className="font-bold text-slate-900">{a.lead?.firstName ? `${a.lead.firstName} ${a.lead.lastName}` : `Lead #${a.leadId?.substring(0,8)}`}</div>
                          <div className="text-[11px] text-slate-500">{a.lead?.company || "Prospect"}</div>
                        </td>
                        <td className="p-4">
                          <span className="bg-blue-50 text-blue-800 font-extrabold px-2.5 py-1 rounded-lg border border-blue-200">
                            {a.leadPriorityScore}/100
                          </span>
                        </td>
                        <td className="p-4 font-bold text-slate-900">{a.assignedTo?.name || "Unassigned"}</td>
                        <td className="p-4">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                            a.assignmentType === "PERFORMANCE_BEST_FIT" ? "bg-emerald-100 text-emerald-800 border border-emerald-200" :
                            a.assignmentType === "MANUAL" ? "bg-amber-100 text-amber-800 border border-amber-200" :
                            "bg-blue-100 text-blue-800 border border-blue-200"
                          }`}>
                            {a.assignmentType}
                          </span>
                        </td>
                        <td className="p-4 max-w-md text-slate-600 font-semibold leading-relaxed">{a.reason}</td>
                        <td className="p-4 text-right">
                          <button
                            onClick={() => setSelectedAudit(a)}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-800 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5 inline mr-1" /> View Candidates
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Audit Modal */}
            {selectedAudit && (
              <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl max-w-xl w-full p-6 border border-slate-200 shadow-2xl space-y-4">
                  <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                    <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-blue-600" /> Candidate Evaluation Breakdown
                    </h3>
                    <button onClick={() => setSelectedAudit(null)} className="text-slate-400 hover:text-slate-600">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="space-y-3">
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700">
                      <div>Lead: <strong>{selectedAudit.lead?.firstName} {selectedAudit.lead?.lastName}</strong> ({selectedAudit.lead?.company || 'Prospect'})</div>
                      <div>Winning Score: <strong className="text-emerald-700">{selectedAudit.winningScore}/100</strong></div>
                      <div>Explanation: {selectedAudit.reason}</div>
                    </div>

                    <h4 className="text-xs font-bold uppercase text-slate-400">Evaluated Candidates:</h4>
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                      {(() => {
                        const candidates = typeof selectedAudit.candidateScores === "string" ? JSON.parse(selectedAudit.candidateScores || "[]") : selectedAudit.candidateScores;
                        if (!candidates || candidates.length === 0) {
                          return <div className="text-xs text-slate-400 italic">No detailed candidate scores recorded for this direct/manual assignment.</div>;
                        }
                        return candidates.map((c: any, i: number) => (
                          <div key={i} className="p-3 bg-white border border-slate-200 rounded-xl text-xs flex justify-between items-center">
                            <div>
                              <strong className="text-slate-900 text-sm block">{c.repName} ({c.repRole})</strong>
                              <span className="text-[11px] text-slate-500">{c.explanationText}</span>
                            </div>
                            <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${i === 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}>
                              Score: {c.finalScore}/100
                            </span>
                          </div>
                        ));
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 5: AUTOMATIONS */}
        {activeTab === "automations" && (
          <div className="space-y-4">
            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-2xs">
              <h3 className="text-lg font-bold text-[#191B23]">Pipeline Stage Automations</h3>
              <p className="text-xs text-slate-500 mt-1">Automatically trigger tasks, notifications, or stage actions when deals enter a pipeline stage.</p>
            </div>

            {automations.length === 0 ? (
              <div className="p-12 bg-white border border-slate-200/80 rounded-2xl text-center text-slate-500 font-medium">
                No pipeline automations created. Click "Add Automation" to configure automated actions.
              </div>
            ) : (
              automations.map((a: any) => (
                <div key={a.id} className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs flex justify-between items-center">
                  <div>
                    <strong className="text-slate-900 font-bold text-sm block">{a.name}</strong>
                    <span className="text-xs text-slate-500">Stage: <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">{a.stageName}</code> • Action: {a.actionType}</span>
                  </div>
                  <button
                    onClick={() => deleteAutomationMutation.mutate(a.id)}
                    className="p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 cursor-pointer"
                  >
                    <Delete className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </main>

      {/* Add Rule Modal */}
      {showAddRuleModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 border border-slate-200 shadow-2xl space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">Add New Assignment Rule</h3>
              <button onClick={() => setShowAddRuleModal(false)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Rule Name</label>
                <input
                  type="text"
                  value={newRule.name}
                  onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                  placeholder="e.g. Manufacturing Leads to West Team"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-semibold outline-none"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Rule Type</label>
                <select
                  value={newRule.ruleType}
                  onChange={(e) => setNewRule({ ...newRule, ruleType: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-semibold outline-none"
                >
                  <option value="Round-robin">Round-robin</option>
                  <option value="Direct-assignment">Direct Assignment</option>
                  <option value="Load-balanced">Load Balanced</option>
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Criteria JSON or Keyword</label>
                <input
                  type="text"
                  value={newRule.criteria}
                  onChange={(e) => setNewRule({ ...newRule, criteria: e.target.value })}
                  placeholder='{"industry":"Manufacturing"}'
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-semibold outline-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button onClick={() => setShowAddRuleModal(false)} className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl">Cancel</button>
              <button
                onClick={() => createRuleMutation.mutate(newRule)}
                disabled={createRuleMutation.isPending}
                className="px-5 py-2 bg-[#2563EB] hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-2xs cursor-pointer"
              >
                Create Rule
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Automation Modal */}
      {showAddAutomationModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 border border-slate-200 shadow-2xl space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">Add Stage Automation</h3>
              <button onClick={() => setShowAddAutomationModal(false)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Automation Name</label>
                <input
                  type="text"
                  value={newAutomation.name}
                  onChange={(e) => setNewAutomation({ ...newAutomation, name: e.target.value })}
                  placeholder="e.g. Proposal Follow-up Task"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-semibold outline-none"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Pipeline Stage</label>
                <select
                  value={newAutomation.stageName}
                  onChange={(e) => setNewAutomation({ ...newAutomation, stageName: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-semibold outline-none"
                >
                  <option value="Proposal">Proposal</option>
                  <option value="Qualified">Qualified</option>
                  <option value="Negotiation">Negotiation</option>
                  <option value="Contract Sent">Contract Sent</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button onClick={() => setShowAddAutomationModal(false)} className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl">Cancel</button>
              <button
                onClick={() => createAutomationMutation.mutate(newAutomation)}
                disabled={createAutomationMutation.isPending}
                className="px-5 py-2 bg-[#2563EB] hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-2xs cursor-pointer"
              >
                Create Automation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
