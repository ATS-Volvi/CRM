import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import {
  Zap, Plus, CheckCircle2, AlertTriangle, Clock, Play, Pause,
  Users, FileText, ArrowRight, Activity, Filter, RefreshCw, ChevronRight,
  TrendingUp, CheckSquare, Bell, Edit3, Trash2, X
} from "lucide-react";

export default function WorkflowAutomation() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState("all");
  const [showCreateModal, setShowCreateModal] = useState(false);

  // New Rule Form State
  const [name, setName] = useState("");
  const [triggerType, setTriggerType] = useState("lead_created");
  const [sourceCondition, setSourceCondition] = useState("Website");
  const [actionType, setActionType] = useState("lead_intake_full");
  const [slaHours, setSlaHours] = useState("4");
  const [templateName, setTemplateName] = useState("default");

  // Fetch Rules from DB
  const { data: dbRules = [], isLoading } = useQuery<any[]>({
    queryKey: ["automationRules"],
    queryFn: async () => {
      const res = await fetch("/api/v1/automation-rules", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!token
  });

  // Toggle Rule Status Mutation
  const toggleRuleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await fetch(`/api/v1/automation-rules/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ isActive: !isActive })
      });
      if (!res.ok) throw new Error("Failed to update rule");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automationRules"] });
    }
  });

  // Create Rule Mutation
  const createRuleMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/v1/automation-rules", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          name: name || `Automated ${sourceCondition} Intake`,
          triggerType,
          triggerCondition: { source: sourceCondition },
          actionType,
          actionConfig: {
            sendResponse: true,
            createTask: true,
            assignOwner: true,
            slaHours: Number(slaHours),
            templateName
          },
          isActive: true
        })
      });
      if (!res.ok) throw new Error("Failed to create automation rule");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automationRules"] });
      setShowCreateModal(false);
      setName("");
    }
  });

  // Delete Rule Mutation
  const deleteRuleMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/v1/automation-rules/${id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to delete rule");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automationRules"] });
    }
  });

  // Fallback preset rules if DB is empty
  const defaultIntakeRules = [
    {
      id: "preset-1",
      name: "New Website Lead Intake",
      triggerType: "lead_created",
      triggerCondition: { source: "Website" },
      actionType: "lead_intake_full",
      actionConfig: { sendResponse: true, createTask: true, assignOwner: true, slaHours: 4 },
      isActive: true
    },
    {
      id: "preset-2",
      name: "New WhatsApp Lead Intake",
      triggerType: "lead_created",
      triggerCondition: { source: "WhatsApp" },
      actionType: "lead_intake_full",
      actionConfig: { sendResponse: true, createTask: true, assignOwner: true, slaHours: 1 },
      isActive: true
    },
    {
      id: "preset-3",
      name: "New Email Lead Intake",
      triggerType: "lead_created",
      triggerCondition: { source: "Email" },
      actionType: "lead_intake_full",
      actionConfig: { sendResponse: true, createTask: true, assignOwner: true, slaHours: 4 },
      isActive: true
    },
    {
      id: "preset-4",
      name: "Cold Call & Manual Intake",
      triggerType: "lead_created",
      triggerCondition: { source: "Cold Call / Manual" },
      actionType: "create_task_only",
      actionConfig: { sendResponse: false, createTask: true, assignOwner: true, slaHours: 24 },
      isActive: true
    }
  ];

  const rulesList = dbRules.length > 0 ? dbRules : defaultIntakeRules;

  return (
    <div className="bg-slate-50 dark:bg-slate-900 min-h-[calc(100vh-64px)] p-6 space-y-6">
      
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-purple-50 dark:bg-purple-950/60 text-purple-600 rounded-xl">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">Automation Rules & Intake Workflows</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">Configure universal lead intake rules, SLA response timing, channel routing & automatic task generation</p>
          </div>
        </div>

        <button 
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Add Automation Rule
        </button>
      </div>

      {/* Main Rules Table & Execution Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Rules Table (2 Cols) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <Activity className="w-4 h-4 text-purple-600" /> Active Intake Automation Rules ({rulesList.length})
            </h2>
            <span className="text-xs text-slate-400 font-semibold">Engine Status: ● Operational</span>
          </div>

          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-[11px] font-extrabold uppercase text-slate-500 tracking-wider">
                  <th className="p-4">Rule Name</th>
                  <th className="p-4">Trigger & Condition</th>
                  <th className="p-4">Automated Actions</th>
                  <th className="p-4">SLA Target</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700 text-xs">
                {rulesList.map((rule: any) => {
                  const srcCond = rule.triggerCondition?.source || "All Sources";
                  const sla = rule.actionConfig?.slaHours || 4;
                  return (
                    <tr key={rule.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/30 transition-colors">
                      <td className="p-4 font-bold text-slate-900 dark:text-white">
                        {rule.name}
                      </td>
                      <td className="p-4">
                        <div className="space-y-0.5">
                          <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-100 dark:border-indigo-900 block w-fit">
                            WHEN: Lead Created
                          </span>
                          <span className="text-[11px] text-slate-600 dark:text-slate-300 font-semibold block">
                            IF Source = {srcCond}
                          </span>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-wrap gap-1">
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded text-[10px] font-bold border border-emerald-200">
                            Auto-Response
                          </span>
                          <span className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded text-[10px] font-bold border border-purple-200">
                            Assign Owner
                          </span>
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-[10px] font-bold border border-blue-200">
                            Follow-Up Task
                          </span>
                        </div>
                      </td>
                      <td className="p-4 font-bold text-slate-700 dark:text-slate-300">
                        {sla} Hours
                      </td>
                      <td className="p-4">
                        <button
                          onClick={() => toggleRuleMutation.mutate({ id: rule.id, isActive: rule.isActive })}
                          className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase transition-all cursor-pointer ${
                            rule.isActive
                              ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                              : "bg-slate-100 text-slate-500 border border-slate-300"
                          }`}
                        >
                          {rule.isActive ? "● Active" : "○ Inactive"}
                        </button>
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => deleteRuleMutation.mutate(rule.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 rounded transition-colors"
                          title="Delete Rule"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* System Diagnostics & Role SLA Matrix (1 Col) */}
        <div className="space-y-6">

          {/* Standard SLA Matrix Card */}
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-600" /> Intake SLA & Response Timing
            </h3>
            <div className="space-y-2.5 text-xs">
              <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl space-y-0.5">
                <div className="flex justify-between items-center">
                  <span className="font-extrabold text-red-800 dark:text-red-300">High Priority Lead (Score ≥80)</span>
                  <span className="font-black text-red-700 bg-white px-2 py-0.5 rounded text-[10px]">1 Hour SLA</span>
                </div>
                <p className="text-[11px] text-red-600 dark:text-red-400">Immediate response required. Automatic escalation task generated.</p>
              </div>

              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl space-y-0.5">
                <div className="flex justify-between items-center">
                  <span className="font-extrabold text-amber-800 dark:text-amber-300">Normal Priority Lead (Score 40-79)</span>
                  <span className="font-black text-amber-700 bg-white px-2 py-0.5 rounded text-[10px]">4 Hours SLA</span>
                </div>
                <p className="text-[11px] text-amber-600 dark:text-amber-400">Standard response window. Follow-up task scheduled for assigned rep.</p>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl space-y-0.5">
                <div className="flex justify-between items-center">
                  <span className="font-extrabold text-slate-800 dark:text-slate-200">Low Priority Lead (Score &lt;40)</span>
                  <span className="font-black text-slate-700 bg-white px-2 py-0.5 rounded text-[10px]">24 Hours SLA</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Low score lead. 1 business day response SLA task created.</p>
              </div>
            </div>
          </div>

          {/* Engine Integration Diagnostics */}
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-xs space-y-3">
            <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Channel Integration Status
            </h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center p-2 bg-slate-50 dark:bg-slate-700/40 rounded-lg">
                <span className="font-bold text-slate-700 dark:text-slate-300">Website Forms & Public API</span>
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">Active (Email Auto-Resp)</span>
              </div>
              <div className="flex justify-between items-center p-2 bg-slate-50 dark:bg-slate-700/40 rounded-lg">
                <span className="font-bold text-slate-700 dark:text-slate-300">WhatsApp Webhook (Twilio)</span>
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">Active (WA Auto-Resp)</span>
              </div>
              <div className="flex justify-between items-center p-2 bg-slate-50 dark:bg-slate-700/40 rounded-lg">
                <span className="font-bold text-slate-700 dark:text-slate-300">Inbound Email / Gmail Connector</span>
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">Active (Thread Reply)</span>
              </div>
              <div className="flex justify-between items-center p-2 bg-slate-50 dark:bg-slate-700/40 rounded-lg">
                <span className="font-bold text-slate-700 dark:text-slate-300">Cold Call / Manual Ingest</span>
                <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">Task Generation Only</span>
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* CREATE AUTOMATION RULE MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
              <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Zap className="w-5 h-5 text-indigo-600" /> Create Automation Rule
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Rule Name</label>
                <input
                  type="text"
                  placeholder="e.g. Website Lead Intake Automation"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg p-2.5 font-semibold text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Trigger Event</label>
                  <select
                    value={triggerType}
                    onChange={e => setTriggerType(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg p-2.5 font-bold"
                  >
                    <option value="lead_created">New Lead Created</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Lead Source Condition</label>
                  <select
                    value={sourceCondition}
                    onChange={e => setSourceCondition(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg p-2.5 font-bold"
                  >
                    <option value="Website">Website</option>
                    <option value="WhatsApp">WhatsApp</option>
                    <option value="Email">Email</option>
                    <option value="Instagram">Instagram</option>
                    <option value="Facebook">Facebook</option>
                    <option value="Cold Call">Cold Call</option>
                    <option value="Manual Entry">Manual Entry</option>
                    <option value="Voice Parser">Voice Parser</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">SLA Target (Hours)</label>
                <select
                  value={slaHours}
                  onChange={e => setSlaHours(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg p-2.5 font-bold"
                >
                  <option value="1">1 Hour (High Priority)</option>
                  <option value="4">4 Hours (Normal Priority)</option>
                  <option value="24">24 Hours (Low Priority)</option>
                </select>
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                disabled={createRuleMutation.isPending}
                onClick={() => createRuleMutation.mutate()}
                className="flex-1 py-2 bg-indigo-600 text-white font-bold rounded-xl text-xs hover:bg-indigo-700 transition-all shadow-xs"
              >
                {createRuleMutation.isPending ? "Saving..." : "Save Rule"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
