import { useState } from "react";
import {
  Zap, Shield, CheckCircle2, AlertTriangle, Clock, Play, Pause,
  Users, FileText, ArrowRight, Activity, Filter, RefreshCw, ChevronRight,
  TrendingUp, CheckSquare, Bell
} from "lucide-react";

export default function WorkflowAutomation() {
  const [filter, setFilter] = useState("all");

  const workflows = [
    {
      id: "wf-1",
      name: "Lead Ingestion → Auto Assignment → Task Escalation",
      trigger: "New Lead Created (Web / API)",
      actions: ["Assign Sales Rep via Round-Robin", "Send Email Acknowledgement", "Create 24h Follow-up Task", "Escalate to Manager if Uncontacted in 24h"],
      status: "Active",
      executions: 1420,
      lastRun: "2 mins ago"
    },
    {
      id: "wf-2",
      name: "Meeting Completed → Follow-up Reminder & Activity Log",
      trigger: "Meeting Marked Completed",
      actions: ["Generate Meeting Summary Log", "Schedule 3-Day Follow-up Task", "Send Thank-You Email"],
      status: "Active",
      executions: 840,
      lastRun: "15 mins ago"
    },
    {
      id: "wf-3",
      name: "High Discount Quote → Approval Queue & Manager Nudge",
      trigger: "Quote Created with >15% Discount",
      actions: ["Lock Quote Status", "Create Approval Request for Manager", "Send Priority Notification"],
      status: "Active",
      executions: 185,
      lastRun: "1 hour ago"
    },
    {
      id: "wf-4",
      name: "Quote Approved → PO Generation & Finance Nudge",
      trigger: "Quote Status Changed to Accepted",
      actions: ["Auto-Generate Purchase Order", "Create Draft Invoice (NET 30)", "Update Opportunity to Won", "Mark Customer Active"],
      status: "Active",
      executions: 312,
      lastRun: "3 hours ago"
    },
    {
      id: "wf-5",
      name: "Stale Opportunity Risk Alert (>7 Days Inactive)",
      trigger: "No Activity for 7 Days on Open Deal",
      actions: ["Flag Deal Risk Badge", "Send Slack/Email Alert to Rep", "Suggest Manager Review"],
      status: "Active",
      executions: 95,
      lastRun: "Today, 08:00 AM"
    }
  ];

  const executionHistory = [
    { id: "e1", workflow: "Lead Ingestion → Auto Assignment", target: "Lead #LD-2025-01420 (Aegis Systems)", time: "2 mins ago", status: "Success" },
    { id: "e2", workflow: "Meeting Completed → Activity Log", target: "Meeting w/ Apex Pharma", time: "15 mins ago", status: "Success" },
    { id: "e3", workflow: "Quote Approved → PO Generation", target: "Quote QT-2025-05012 (SAR 642.5K)", time: "3 hours ago", status: "Success" },
    { id: "e4", workflow: "Stale Opportunity Risk Alert", target: "Deal: Starlight Energy Renewal", time: "Today, 08:00 AM", status: "Success" },
  ];

  return (
    <div className="bg-slate-50 min-h-[calc(100vh-64px)] p-6 space-y-6">
      
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-purple-50 text-purple-600 rounded-xl">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Workflow Automation & Engine</h1>
            <p className="text-xs text-slate-500">Salesforce Flow / Dynamics Business Process Flows backend engine for automated execution</p>
          </div>
        </div>

        <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs">
          <Zap className="w-3.5 h-3.5" /> Test Engine Triggers
        </button>
      </div>

      {/* Grid: Active Automated Flows & Execution History */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Active Automated Flows (2 Cols) */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <Activity className="w-4 h-4 text-purple-600" /> Active Business Process Flows ({workflows.length})
          </h2>

          <div className="space-y-4">
            {workflows.map(wf => (
              <div key={wf.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 uppercase">
                      ● {wf.status}
                    </span>
                    <h3 className="text-sm font-bold text-slate-900 mt-1">{wf.name}</h3>
                    <p className="text-xs font-semibold text-indigo-600 mt-0.5">Trigger: {wf.trigger}</p>
                  </div>
                  <span className="text-xs text-slate-400 font-semibold">{wf.executions} executions</span>
                </div>

                {/* Steps Chain */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex items-center gap-2 overflow-x-auto no-scrollbar">
                  {wf.actions.map((act, i) => (
                    <div key={i} className="flex items-center gap-2 shrink-0">
                      <span className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 shadow-2xs">
                        {act}
                      </span>
                      {i < wf.actions.length - 1 && <ArrowRight className="w-3 h-3 text-slate-300" />}
                    </div>
                  ))}
                </div>

                <div className="flex justify-between items-center text-xs text-slate-400 pt-1">
                  <span>Last executed {wf.lastRun}</span>
                  <span className="font-bold text-indigo-600 cursor-pointer hover:underline">View Flow Logs →</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Execution History & Role Matrix (1 Col) */}
        <div className="space-y-6">

          {/* Real-time Execution History */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-600" /> Automation Execution Audit Log
            </h3>
            <div className="space-y-3">
              {executionHistory.map(e => (
                <div key={e.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800">{e.workflow}</span>
                    <span className="text-[10px] text-emerald-600 font-bold px-1.5 py-0.5 bg-emerald-50 rounded">✓ {e.status}</span>
                  </div>
                  <p className="text-xs text-slate-500 truncate">{e.target}</p>
                  <p className="text-[10px] text-slate-400 text-right">{e.time}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Role Notification Rules */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Bell className="w-4 h-4 text-amber-600" /> Role Notification Matrix
            </h3>
            <div className="space-y-2 text-xs text-slate-700">
              <div className="p-2.5 bg-slate-50 rounded-lg">
                <p className="font-bold text-indigo-700">Sales Representative</p>
                <p className="text-slate-500">Task assignments, meeting reminders, lead updates</p>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-lg">
                <p className="font-bold text-purple-700">Sales Manager</p>
                <p className="text-slate-500">Target alerts, quote approvals, team escalations</p>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-lg">
                <p className="font-bold text-emerald-700">Finance Team</p>
                <p className="text-slate-500">Quote approvals, invoice requests, PO verifications</p>
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
