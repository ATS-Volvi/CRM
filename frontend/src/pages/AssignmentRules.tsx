import { useAuth } from "../context/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { 
  GripVertical, Package, Globe, RefreshCw, Award, 
  ArrowRight, Users, Map, Repeat, Delete, Plus, Home,
  Sliders, CalendarOff, X
} from "lucide-react";

export default function AssignmentRules() {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<"distribution" | "automations">("distribution");
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
      <header className="h-16 flex justify-between items-center px-8 bg-white border-b border-slate-200/80 sticky top-0 z-40 shadow-2xs">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setActiveTab("distribution")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === "distribution" ? "bg-[#2563EB] text-white shadow-2xs" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Lead Distribution Rules
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
            <span className="text-xs font-bold">Real-time automation engine active</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {activeTab === "distribution" ? (
            <button 
              onClick={() => setShowAddRuleModal(true)}
              className="bg-[#2563EB] hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-xs transition-all active:scale-95 flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Distribution Rule</span>
            </button>
          ) : (
            <button 
              onClick={() => setShowAddAutomationModal(true)}
              className="bg-[#2563EB] hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-xs transition-all active:scale-95 flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Automation Rule</span>
            </button>
          )}
        </div>
      </header>

      {/* Builder Workspace */}
      <div className="p-8 max-w-[1440px] mx-auto w-full">
        {activeTab === "automations" ? (
          <div className="space-y-6">
            <div className="flex justify-between items-center bg-card border border-border p-5 rounded-xl shadow-2xs">
              <div>
                <h3 className="text-xl font-extrabold text-foreground">Stage Change Automation Rules</h3>
                <p className="text-xs text-muted-foreground">
                  Configure automated actions ("When deal stage changes to X → Create Task / Send Email / Reassign").
                </p>
              </div>
              <button 
                onClick={() => setShowAddAutomationModal(true)}
                className="px-4 py-2 bg-primary text-primary-foreground font-bold text-xs rounded-xl shadow-2xs hover:opacity-90 transition-all flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" /> Create Automation Rule
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {automations.map((rule: any) => (
                <div key={rule.id} className="bg-card border border-border rounded-xl p-4 shadow-2xs space-y-3 relative group">
                  <div className="flex justify-between items-start">
                    <span className="px-2 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded text-[10px] font-bold uppercase">
                      {rule.triggerType}
                    </span>
                    <button 
                      onClick={() => deleteAutomationMutation.mutate(rule.id)}
                      className="text-muted-foreground hover:text-destructive text-xs"
                      title="Delete Rule"
                    >
                      <Delete className="w-4 h-4" />
                    </button>
                  </div>

                  <div>
                    <h4 className="text-sm font-black text-foreground">{rule.name}</h4>
                    <p className="text-xs text-muted-foreground font-medium mt-1">
                      When stage changes to <strong className="text-primary">{rule.triggerCondition?.stageName || rule.triggerCondition?.toStage || "Any"}</strong>:
                    </p>
                    <div className="mt-2 p-2 bg-muted/50 rounded border border-border text-xs font-semibold text-foreground">
                      Action: {rule.actionType === "create_task" ? `Create Task "${rule.actionConfig?.taskTitle || 'Follow-up'}"` : rule.actionType}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* CREATE AUTOMATION MODAL */}
            {showAddAutomationModal && (
              <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
                <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4 animate-scale-up">
                  <div className="flex justify-between items-center border-b border-border pb-3">
                    <h3 className="text-sm font-black text-foreground">New Stage Automation Rule</h3>
                    <button onClick={() => setShowAddAutomationModal(false)}><X className="w-4 h-4 text-muted-foreground" /></button>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div>
                      <label className="block font-bold text-muted-foreground mb-1">Rule Name</label>
                      <input 
                        type="text" 
                        value={newAutomation.name}
                        onChange={e => setNewAutomation({ ...newAutomation, name: e.target.value })}
                        placeholder="e.g. Auto Task on Proposal Stage"
                        className="w-full bg-muted border border-border rounded-lg p-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-muted-foreground mb-1">When Deal Stage Changes To</label>
                      <select 
                        value={newAutomation.stageName}
                        onChange={e => setNewAutomation({ ...newAutomation, stageName: e.target.value })}
                        className="w-full bg-muted border border-border rounded-lg p-2 text-xs font-bold text-foreground"
                      >
                        <option value="New">New</option>
                        <option value="Contacted">Contacted</option>
                        <option value="Qualified">Qualified</option>
                        <option value="Meeting/Demo">Meeting/Demo</option>
                        <option value="Proposal">Proposal</option>
                        <option value="Negotiation">Negotiation</option>
                        <option value="Won">Won</option>
                        <option value="Lost">Lost</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold text-muted-foreground mb-1">Action To Take</label>
                      <select 
                        value={newAutomation.actionType}
                        onChange={e => setNewAutomation({ ...newAutomation, actionType: e.target.value })}
                        className="w-full bg-muted border border-border rounded-lg p-2 text-xs font-bold text-foreground"
                      >
                        <option value="create_task">Create Follow-up Task</option>
                        <option value="send_message">Send Automated Email</option>
                        <option value="assign_user">Reassign Rep</option>
                      </select>
                    </div>

                    {newAutomation.actionType === "create_task" && (
                      <div>
                        <label className="block font-bold text-muted-foreground mb-1">Task Title</label>
                        <input 
                          type="text" 
                          value={newAutomation.taskTitle}
                          onChange={e => setNewAutomation({ ...newAutomation, taskTitle: e.target.value })}
                          className="w-full bg-muted border border-border rounded-lg p-2 text-xs font-semibold"
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 justify-end pt-3 border-t border-border">
                    <button onClick={() => setShowAddAutomationModal(false)} className="px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted rounded-lg">Cancel</button>
                    <button 
                      onClick={() => {
                        if (!newAutomation.name) return alert("Rule name is required.");
                        createAutomationMutation.mutate({
                          name: newAutomation.name,
                          triggerType: "stage_change",
                          triggerCondition: { stageName: newAutomation.stageName },
                          actionType: newAutomation.actionType,
                          actionConfig: { taskTitle: newAutomation.taskTitle, dueDays: newAutomation.dueDays }
                        });
                      }}
                      className="px-4 py-1.5 text-xs font-bold bg-primary text-primary-foreground rounded-lg shadow-2xs"
                    >
                      Save Automation
                    </button>
                  </div>

                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex gap-8 w-full">
        {/* Rules List Area */}
        <div className="flex-1 space-y-4">
          <div className="flex justify-between items-end mb-4">
            <div>
              <h3 className="text-2xl font-bold text-on-surface">Lead Distribution Hierarchy</h3>
              <p className="text-sm text-on-surface-variant">Rules are executed in order. Drag to prioritize.</p>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={handleExportLogic}
                className="px-4 py-2 text-secondary font-bold text-[12px] uppercase border border-secondary rounded-lg hover:bg-surface-container"
              >
                Export Logic
              </button>
              <button 
                onClick={() => setShowAddRuleModal(true)}
                className="px-4 py-2 bg-primary text-on-primary font-bold text-[12px] uppercase rounded-lg flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> Create New Rule
              </button>
            </div>
          </div>

          {isLoading ? (
            <div className="p-8 text-center text-on-surface-variant animate-pulse">Loading rules...</div>
          ) : (
            rules?.map((rule: any, i: number) => {
              const isActive = rule.isActive ?? rule.active ?? true;
              const ruleName = rule.name || `Assignment Rule ${rule.priority || i+1}`;
              const ruleDesc = rule.description || `Priority: ${rule.priority || 'Standard'}`;
              const ruleCondition = rule.criteria || rule.condition || 'All Leads';
              const ruleAction = (rule.assignTo ? `Assign to ${rule.assignTo.name}` : rule.action) || 'No action';
              const ruleType = (rule.ruleType || rule.type || 'round-robin').toLowerCase();

              const renderCriteria = (criteriaStr: string) => {
                if (!criteriaStr) return <span className="text-sm font-medium text-on-surface-variant">All Leads</span>;
                try {
                  const parsed = JSON.parse(criteriaStr);
                  if (Array.isArray(parsed)) {
                    return parsed.map((c: any, idx: number) => {
                      const fieldName = c.field 
                        ? c.field.replace(/([A-Z])/g, ' $1').replace(/^./, (str: string) => str.toUpperCase()) 
                        : "";
                      let op = c.operator || "=";
                      if (op === "equals") op = "=";
                      if (op === "greaterThan") op = ">";
                      if (op === "lessThan") op = "<";
                      
                      return (
                        <span key={idx} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-primary/10 text-primary border border-primary/20">
                          <span className="opacity-80">{fieldName}</span>
                          <span className="text-primary font-extrabold">{op}</span>
                          <span className="font-extrabold">"{c.value}"</span>
                        </span>
                      );
                    });
                  }
                } catch (e) {
                  // Fallback if not JSON
                }
                return <span className="text-sm font-medium text-on-surface">{criteriaStr}</span>;
              };

              return (
              <div key={rule.id} className={`bg-card border ${!isActive ? 'border-border opacity-60 bg-muted/30' : 'border-border'} rounded-xl p-4 flex items-center gap-4 group hover:shadow-2xs transition-shadow`}>
                <div className={`cursor-move ${!isActive ? 'opacity-20' : 'opacity-40 group-hover:opacity-100'} text-muted-foreground flex-shrink-0`}>
                  <GripVertical className="w-5 h-5" />
                </div>
                
                {/* Icon mapping based on rule type */}
                <div className={`w-9 h-9 rounded-lg flex-shrink-0 flex items-center justify-center border 
                  ${ruleType === 'product' ? 'bg-primary/10 text-primary border-primary/20' : 
                    ruleType === 'geo' ? 'bg-secondary/10 text-secondary border-secondary/20' : 
                    ruleType === 'round-robin' ? 'bg-secondary/10 text-secondary border-secondary/20' : 
                    ruleType === 'criteria' ? 'bg-primary/10 text-primary border-primary/20' :
                    'bg-muted text-muted-foreground border-border'}`}>
                  {ruleType === 'product' && <Package className="w-5 h-5" />}
                  {ruleType === 'geo' && <Globe className="w-5 h-5" />}
                  {ruleType === 'round-robin' && <RefreshCw className="w-5 h-5" />}
                  {ruleType === 'skill' && <Award className="w-5 h-5" />}
                  {ruleType === 'criteria' && <Sliders className="w-6 h-6" />}
                </div>

                <div className="flex-1 grid grid-cols-12 items-center gap-4 min-w-0">
                  <div className="col-span-4 min-w-0">
                    <h4 className="text-base font-bold text-on-surface truncate">{ruleName}</h4>
                    <p className="text-sm text-on-surface-variant truncate">{ruleDesc}</p>
                  </div>
                  <div className="col-span-4 flex items-center gap-2 flex-wrap min-w-0">
                    <div className="px-2 py-0.5 bg-surface-container-low text-on-surface-variant text-[11px] font-bold rounded uppercase border border-outline-variant/30 flex-shrink-0">IF</div>
                    {isActive ? (
                      <div className="flex flex-wrap gap-1.5 items-center min-w-0">
                        {renderCriteria(ruleCondition)}
                      </div>
                    ) : (
                      <span className="text-sm font-medium italic text-on-surface-variant">Disabled</span>
                    )}
                  </div>
                  <div className="col-span-4 flex items-center gap-2 min-w-0">
                    <ArrowRight className="w-5 h-5 text-outline flex-shrink-0" />
                    {isActive ? (
                      <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold border truncate
                        ${ruleType === 'product' ? 'bg-secondary/10 text-secondary border-secondary/20' :
                          ruleType === 'geo' ? 'bg-secondary/10 text-secondary border-secondary/20' :
                          'bg-primary/10 text-primary border-primary/20'}`}>
                        {ruleType === 'product' && <Users className="w-4 h-4 flex-shrink-0" />}
                        {ruleType === 'geo' && <Map className="w-4 h-4 flex-shrink-0" />}
                        {ruleType === 'round-robin' && <Repeat className="w-4 h-4 flex-shrink-0" />}
                        {ruleType === 'criteria' && <Users className="w-4 h-4 flex-shrink-0" />}
                        <span className="truncate">{ruleAction}</span>
                      </div>
                    ) : (
                      <span className="text-sm text-outline truncate">No action assigned</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4 flex-shrink-0">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only toggle-switch" defaultChecked={isActive} />
                    <div className={`w-11 h-6 rounded-full transition-colors relative ${isActive ? 'bg-primary' : 'bg-outline-variant'}`}>
                      <div className={`absolute top-1 bg-white w-4 h-4 rounded-full transition-transform ${isActive ? 'left-6' : 'left-1'}`}></div>
                    </div>
                  </label>
                  <Delete 
                    onClick={() => {
                      if (confirm("Are you sure you want to delete this rule?")) {
                        deleteRuleMutation.mutate(rule.id);
                      }
                    }}
                    className="w-6 h-6 text-outline cursor-pointer hover:text-error" 
                  />
                </div>
              </div>
            );
            })
          )}

          {/* Fallback Rule */}
          <div className="bg-surface-container border-2 border-dashed border-outline-variant rounded-xl p-4 flex items-center gap-4 mt-6">
            <div className="w-10 h-10 rounded-full bg-outline-variant/30 flex items-center justify-center text-on-surface-variant">
              <Home className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h4 className="text-base font-bold text-on-surface">Global Fallback</h4>
              <p className="text-sm text-on-surface-variant">If no rules match, assign to <span className="font-bold underline">{fallbackUser}</span></p>
            </div>
            <button 
              onClick={() => {
                const target = prompt("Enter new global fallback representative or manager:", fallbackUser);
                if (target) setFallbackUser(target);
              }}
              className="text-primary font-bold text-[12px] uppercase"
            >
              Edit Strategy
            </button>
          </div>
        </div>

        {/* Right Sidebar: Capacity & Status */}
        <aside className="w-80 flex flex-col gap-6 shrink-0">
          {/* Capacity Meter Widget */}
          <section className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h4 className="text-[11px] font-black uppercase tracking-wider text-[#6B7280]">Agent Capacity</h4>
              <Sliders className="w-4 h-4 text-[#2563EB]" />
            </div>
            <div className="space-y-3.5 max-h-[420px] overflow-y-auto pr-1">
              {isLoadingCapacities ? (
                <div className="text-xs text-slate-400 animate-pulse font-medium">Loading capacities...</div>
              ) : capacities.length === 0 ? (
                <div className="text-xs text-slate-400 font-medium">No active salespersons found.</div>
              ) : (
                capacities.map((cap: any) => {
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
                })
              )}
            </div>
            <button 
              onClick={() => {
                if (confirm("Redistribute open leads and balance agent capacities in database?")) {
                  balanceLimitsMutation.mutate();
                }
              }}
              disabled={balanceLimitsMutation.isPending}
              className="w-full py-2 bg-blue-50 hover:bg-blue-100 text-[#2563EB] font-bold text-xs rounded-xl border border-blue-200 transition-all active:scale-95 disabled:opacity-50"
            >
              {balanceLimitsMutation.isPending ? "Balancing..." : "Balance All Limits"}
            </button>
          </section>


          {/* Out of Office Status */}
          <section className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-sm flex-1">
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-[12px] font-bold uppercase text-on-surface-variant">Availability Toggle</h4>
              <CalendarOff className="w-5 h-5 text-outline" />
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between py-2 border-b border-outline-variant/30">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-surface-container border border-outline-variant flex items-center justify-center font-bold text-xs">AK</div>
                  <span className="text-sm">Ahmed K.</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only toggle-switch" defaultChecked />
                  <div className="w-8 h-4 bg-primary rounded-full relative scale-75">
                    <div className="absolute left-4 top-0.5 bg-white w-3 h-3 rounded-full"></div>
                  </div>
                </label>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-outline-variant/30">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-surface-container border border-outline-variant flex items-center justify-center font-bold text-xs">SL</div>
                  <span className="text-sm">Sarah L.</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only toggle-switch" defaultChecked />
                  <div className="w-8 h-4 bg-primary rounded-full relative scale-75">
                    <div className="absolute left-4 top-0.5 bg-white w-3 h-3 rounded-full"></div>
                  </div>
                </label>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-outline-variant/30">
                <div className="flex items-center gap-3 opacity-50 italic">
                  <div className="w-8 h-8 rounded-full bg-surface-container border border-outline-variant flex items-center justify-center font-bold text-xs">RM</div>
                  <span className="text-sm">Rahul M.</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only toggle-switch" />
                  <div className="w-8 h-4 bg-outline-variant rounded-full relative scale-75">
                    <div className="absolute left-1 top-0.5 bg-white w-3 h-3 rounded-full"></div>
                  </div>
                </label>
              </div>
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-surface-container border border-outline-variant flex items-center justify-center font-bold text-xs">JW</div>
                  <span className="text-sm">Jessica W.</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only toggle-switch" defaultChecked />
                  <div className="w-8 h-4 bg-primary rounded-full relative scale-75">
                    <div className="absolute left-4 top-0.5 bg-white w-3 h-3 rounded-full"></div>
                  </div>
                </label>
              </div>
            </div>
          </section>
        </aside>
          </div>
        )}
      </div>

      {/* Footer Stats integrated into non-blocking bottom bar */}
      <div className="fixed bottom-4 right-8 z-30 pointer-events-none">
        <div className="bg-slate-900/90 backdrop-blur-md text-white rounded-2xl px-5 py-2.5 shadow-xl border border-slate-800 pointer-events-auto flex items-center gap-4 text-xs font-bold">
          <div className="flex items-center gap-2 pr-4 border-r border-slate-700">
            <span className="text-blue-400 text-lg font-black">128</span>
            <span className="text-[10px] font-extrabold uppercase text-slate-300">Leads Assigned Today</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-emerald-400 text-lg font-black">4.2s</span>
            <span className="text-[10px] font-extrabold uppercase text-slate-300">Avg Routing Time</span>
          </div>
        </div>
      </div>

      {/* Add Rule Modal */}
      {showAddRuleModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl border border-outline-variant shadow-2xl overflow-hidden flex flex-col">
            <div className="bg-primary text-on-primary px-6 py-4 flex items-center justify-between">
              <h3 className="font-bold text-sm tracking-wider uppercase">Create Assignment Rule</h3>
              <button 
                onClick={() => setShowAddRuleModal(false)}
                className="text-on-primary/85 hover:text-on-primary"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">Rule Name</label>
                <input 
                  type="text" 
                  value={newRule.name}
                  onChange={e => setNewRule({ ...newRule, name: e.target.value })}
                  placeholder="e.g. Technology Leads Route"
                  className="w-full bg-surface border border-outline rounded-lg p-3 text-sm focus:ring-1 focus:ring-primary focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">Description</label>
                <input 
                  type="text" 
                  value={newRule.description}
                  onChange={e => setNewRule({ ...newRule, description: e.target.value })}
                  placeholder="e.g. Route tech leads to enterprise sales"
                  className="w-full bg-surface border border-outline rounded-lg p-3 text-sm focus:ring-1 focus:ring-primary focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">Rule Type</label>
                  <select 
                    value={newRule.ruleType}
                    onChange={e => setNewRule({ ...newRule, ruleType: e.target.value })}
                    className="w-full bg-surface border border-outline rounded-lg p-3 text-sm focus:ring-1 focus:ring-primary focus:outline-none cursor-pointer"
                  >
                    <option value="round-robin">Round Robin</option>
                    <option value="product">Product</option>
                    <option value="geo">Geo</option>
                    <option value="criteria">Criteria-Based</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">Criteria (JSON array)</label>
                  <input 
                    type="text" 
                    value={newRule.criteria}
                    onChange={e => setNewRule({ ...newRule, criteria: e.target.value })}
                    placeholder='[{"field":"industry","operator":"equals","value":"Technology"}]'
                    className="w-full bg-surface border border-outline rounded-lg p-3 text-sm focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">Assignee / Action Text</label>
                <input 
                  type="text" 
                  value={newRule.action}
                  onChange={e => setNewRule({ ...newRule, action: e.target.value })}
                  placeholder="e.g. Enterprise Team"
                  className="w-full bg-surface border border-outline rounded-lg p-3 text-sm focus:ring-1 focus:ring-primary focus:outline-none"
                  required
                />
              </div>
            </div>

            <div className="bg-surface-container-low px-6 py-4 border-t border-outline-variant flex justify-end gap-2">
              <button 
                onClick={() => setShowAddRuleModal(false)}
                className="px-4 py-2 border border-outline-variant rounded-lg text-sm font-semibold hover:bg-surface-container"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  createRuleMutation.mutate({
                    name: newRule.name,
                    description: newRule.description,
                    ruleType: newRule.ruleType,
                    criteria: newRule.criteria,
                    action: newRule.action,
                    priority: (rules?.length || 0) + 1,
                    isActive: true
                  });
                }}
                disabled={createRuleMutation.isPending || !newRule.name || !newRule.action}
                className="px-5 py-2 bg-primary text-white text-sm font-bold rounded-lg hover:opacity-90 disabled:opacity-50"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
