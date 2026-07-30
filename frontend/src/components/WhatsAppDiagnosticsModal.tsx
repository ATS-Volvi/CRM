import React, { useState, useEffect } from "react";
import {
  X,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Activity,
  Terminal,
  Search,
  ShieldAlert,
  Zap,
  Check,
  Copy,
  ExternalLink,
  Trash2,
  CheckCircle,
  HelpCircle,
  FileCode,
  Radio,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { apiClient } from "../lib/apiClient";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

interface HealthChecklist {
  key: string;
  title: string;
  configured: boolean;
  value: string;
  status: "ok" | "warning" | "error" | "info";
}

interface HealthData {
  state: "healthy" | "degraded" | "error" | "simulation";
  isSimulation: boolean;
  errorCount24h: number;
  warnCount24h: number;
  totalLogs24h: number;
  metaApiReachable: boolean;
  metaApiLatencyMs: number;
  metaApiDetails: any;
  checklist: HealthChecklist[];
  webhookEndpoint: string;
}

interface WhatsAppLogItem {
  id: string;
  timestamp: string;
  level: "ERROR" | "WARN" | "INFO" | "DEBUG";
  category: string;
  event: string;
  message: string;
  details: any;
  phone?: string;
  messageId?: string;
  resolved: boolean;
}

export const WhatsAppDiagnosticsModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<"logs" | "health" | "simulation">("logs");
  
  // Health State
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loadingHealth, setLoadingHealth] = useState<boolean>(false);

  // Logs State
  const [logs, setLogs] = useState<WhatsAppLogItem[]>([]);
  const [totalLogs, setTotalLogs] = useState<number>(0);
  const [loadingLogs, setLoadingLogs] = useState<boolean>(false);
  
  // Filters
  const [levelFilter, setLevelFilter] = useState<string>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [showResolved, setShowResolved] = useState<boolean>(false);

  // Connection Test
  const [testingConn, setTestingConn] = useState<boolean>(false);
  const [connResult, setConnResult] = useState<any>(null);

  // Webhook Test
  const [testingWebhook, setTestingWebhook] = useState<boolean>(false);
  const [webhookResult, setWebhookResult] = useState<any>(null);

  // Selected Log Drawer
  const [selectedLog, setSelectedLog] = useState<WhatsAppLogItem | null>(null);
  const [copiedId, setCopiedId] = useState<boolean>(false);

  // ─── Fetch Health ──────────────────────────────────────────────────────────
  const fetchHealth = async () => {
    setLoadingHealth(true);
    try {
      const res = await apiClient("/api/v1/whatsapp/health");
      if (res.ok) {
        const data = await res.json();
        setHealth(data);
      }
    } catch (err) {
      console.error("Failed to fetch WhatsApp health status:", err);
    } finally {
      setLoadingHealth(false);
    }
  };

  // ─── Fetch Logs ───────────────────────────────────────────────────────────
  const fetchLogs = async () => {
    setLoadingLogs(true);
    try {
      const params = new URLSearchParams();
      if (levelFilter !== "ALL") params.append("level", levelFilter);
      if (categoryFilter !== "ALL") params.append("category", categoryFilter);
      if (searchQuery) params.append("search", searchQuery);
      if (!showResolved) params.append("resolved", "false");

      const res = await apiClient(`/api/v1/whatsapp/logs?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
        setTotalLogs(data.total || 0);
      }
    } catch (err) {
      console.error("Failed to fetch WhatsApp error logs:", err);
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchHealth();
      fetchLogs();
    }
  }, [isOpen, levelFilter, categoryFilter, showResolved]);

  if (!isOpen) return null;

  // ─── Action Handlers ───────────────────────────────────────────────────────
  const handleTestConnection = async () => {
    setTestingConn(true);
    setConnResult(null);
    try {
      const res = await apiClient("/api/v1/whatsapp/logs/test-connection", { method: "POST" });
      const data = await res.json();
      setConnResult(data);
      fetchHealth();
      fetchLogs();
    } catch (err: any) {
      setConnResult({ success: false, error: err.message });
    } finally {
      setTestingConn(false);
    }
  };

  const handleTestWebhook = async () => {
    setTestingWebhook(true);
    setWebhookResult(null);
    try {
      const res = await apiClient("/api/v1/whatsapp/logs/test-webhook", { method: "POST" });
      const data = await res.json();
      setWebhookResult(data);
      fetchHealth();
      fetchLogs();
    } catch (err: any) {
      setWebhookResult({ success: false, error: err.message });
    } finally {
      setTestingWebhook(false);
    }
  };

  const handleResolveLog = async (id: string) => {
    try {
      await apiClient(`/api/v1/whatsapp/logs/${id}/resolve`, { method: "POST" });
      setLogs(prev => prev.map(l => l.id === id ? { ...l, resolved: true } : l));
      if (selectedLog?.id === id) {
        setSelectedLog(prev => prev ? { ...prev, resolved: true } : null);
      }
    } catch (err) {
      console.error("Failed to resolve log:", err);
    }
  };

  const handleClearLogs = async () => {
    if (!window.confirm("Are you sure you want to clear all WhatsApp log entries?")) return;
    try {
      await apiClient("/api/v1/whatsapp/logs", { method: "DELETE" });
      setLogs([]);
      setTotalLogs(0);
      fetchHealth();
    } catch (err) {
      console.error("Failed to clear logs:", err);
    }
  };

  const handleCopyText = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  // ─── Helpers ───────────────────────────────────────────────────────────────
  const getLevelBadge = (level: string) => {
    switch (level) {
      case "ERROR":
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500/15 text-rose-600 border border-rose-500/20 flex items-center gap-1 w-fit"><ShieldAlert className="w-3 h-3" /> ERROR</span>;
      case "WARN":
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/15 text-amber-600 border border-amber-500/20 flex items-center gap-1 w-fit"><AlertTriangle className="w-3 h-3" /> WARN</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-500/15 text-blue-600 border border-blue-500/20 flex items-center gap-1 w-fit"><Activity className="w-3 h-3" /> INFO</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-6xl max-h-[90vh] shadow-2xl flex flex-col overflow-hidden text-slate-100 font-sans">
        
        {/* HEADER */}
        <div className="px-6 py-4 bg-slate-950 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black tracking-tight text-white">WhatsApp Business Diagnostics & Error Logs</h2>
                <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  v18.0 Meta Cloud API
                </span>
              </div>
              <p className="text-xs text-slate-400">Real-time troubleshooting, Meta Graph API error parsing & webhook simulation</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* HEALTH QUICK BANNER */}
        <div className="px-6 py-3 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between text-xs gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-bold">Overall System Health:</span>
              {health?.state === "healthy" && (
                <span className="flex items-center gap-1.5 font-bold px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Healthy & Operational
                </span>
              )}
              {health?.state === "simulation" && (
                <span className="flex items-center gap-1.5 font-bold px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  <AlertTriangle className="w-3.5 h-3.5" /> Simulation Mode (Missing Credentials)
                </span>
              )}
              {health?.state === "degraded" && (
                <span className="flex items-center gap-1.5 font-bold px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-400 border border-amber-500/30">
                  <AlertTriangle className="w-3.5 h-3.5" /> Degraded ({health.errorCount24h} errors in 24h)
                </span>
              )}
              {health?.state === "error" && (
                <span className="flex items-center gap-1.5 font-bold px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  <ShieldAlert className="w-3.5 h-3.5" /> Critical Error Detected
                </span>
              )}
            </div>

            <div className="h-4 w-[1px] bg-slate-800" />

            <div className="flex items-center gap-3 font-mono text-slate-300 text-[11px]">
              <span>Errors (24h): <strong className={health?.errorCount24h ? "text-rose-400" : "text-emerald-400"}>{health?.errorCount24h || 0}</strong></span>
              <span>Warnings (24h): <strong className={health?.warnCount24h ? "text-amber-400" : "text-slate-400"}>{health?.warnCount24h || 0}</strong></span>
              <span>Total Audit Events: <strong>{health?.totalLogs24h || 0}</strong></span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleTestConnection}
              disabled={testingConn}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all"
            >
              <Radio className={`w-3.5 h-3.5 ${testingConn ? "animate-pulse" : ""}`} />
              {testingConn ? "Testing Meta API..." : "Test Meta Connection"}
            </button>

            <button
              onClick={handleTestWebhook}
              disabled={testingWebhook}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 font-bold text-xs flex items-center gap-1.5 border border-slate-700 transition-all"
            >
              <Terminal className="w-3.5 h-3.5 text-blue-400" />
              {testingWebhook ? "Simulating Webhook..." : "Simulate Webhook"}
            </button>
          </div>
        </div>

        {/* NAVIGATION TABS */}
        <div className="px-6 bg-slate-950 border-b border-slate-800 flex items-center gap-6 text-xs font-bold">
          <button
            onClick={() => setActiveTab("logs")}
            className={`py-3 border-b-2 flex items-center gap-2 transition-all ${
              activeTab === "logs" ? "border-emerald-500 text-emerald-400" : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            Audit & Error Logs ({totalLogs})
          </button>

          <button
            onClick={() => setActiveTab("health")}
            className={`py-3 border-b-2 flex items-center gap-2 transition-all ${
              activeTab === "health" ? "border-emerald-500 text-emerald-400" : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Activity className="w-4 h-4" />
            System Setup & Diagnostic Checklist
          </button>

          <button
            onClick={() => setActiveTab("simulation")}
            className={`py-3 border-b-2 flex items-center gap-2 transition-all ${
              activeTab === "simulation" ? "border-emerald-500 text-emerald-400" : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Terminal className="w-4 h-4 text-blue-400" />
            Live Webhook & API Test Console
          </button>
        </div>

        {/* TAB 1: AUDIT & ERROR LOGS */}
        {activeTab === "logs" && (
          <div className="flex-1 flex flex-col overflow-hidden p-6 space-y-4">
            {/* FILTER BAR */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 flex-1 min-w-[240px]">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && fetchLogs()}
                    placeholder="Search logs by phone, message, event, or error code..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
                  />
                </div>
                <button
                  onClick={fetchLogs}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingLogs ? "animate-spin" : ""}`} />
                </button>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <select
                  value={levelFilter}
                  onChange={e => setLevelFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-300 focus:outline-none"
                >
                  <option value="ALL">All Levels</option>
                  <option value="ERROR">Errors Only</option>
                  <option value="WARN">Warnings</option>
                  <option value="INFO">Info</option>
                </select>

                <select
                  value={categoryFilter}
                  onChange={e => setCategoryFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-300 focus:outline-none"
                >
                  <option value="ALL">All Categories</option>
                  <option value="CONFIGURATION">Configuration</option>
                  <option value="OUTBOUND_SEND">Outbound Send</option>
                  <option value="DELIVERY_STATUS">Delivery Status</option>
                  <option value="WEBHOOK_VERIFICATION">Webhook Verification</option>
                  <option value="INBOUND_PAYLOAD">Inbound Payload</option>
                  <option value="LEAD_ASSOCIATION">Lead Association</option>
                  <option value="API_ERROR">API Errors</option>
                </select>

                <label className="flex items-center gap-1.5 cursor-pointer text-slate-400 select-none px-2 py-1 bg-slate-950 border border-slate-800 rounded-xl">
                  <input
                    type="checkbox"
                    checked={showResolved}
                    onChange={e => setShowResolved(e.target.checked)}
                    className="accent-emerald-500 rounded"
                  />
                  Show Resolved
                </label>

                {logs.length > 0 && (
                  <button
                    onClick={handleClearLogs}
                    className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors"
                    title="Clear Log History"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* LOG TABLE */}
            <div className="flex-1 border border-slate-800/80 rounded-xl bg-slate-950 overflow-y-auto">
              {loadingLogs ? (
                <div className="p-12 text-center text-slate-500 flex flex-col items-center justify-center gap-2">
                  <RefreshCw className="w-6 h-6 animate-spin text-emerald-400" />
                  <p className="text-xs">Fetching audit logs...</p>
                </div>
              ) : logs.length === 0 ? (
                <div className="p-12 text-center text-slate-500 flex flex-col items-center justify-center gap-2">
                  <CheckCircle className="w-8 h-8 text-emerald-500/50" />
                  <p className="text-sm font-bold text-slate-300">No Error Logs Found</p>
                  <p className="text-xs text-slate-500">Your WhatsApp integration has no logged issues for the selected filter criteria.</p>
                </div>
              ) : (
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-900/90 text-slate-400 sticky top-0 border-b border-slate-800 uppercase font-mono text-[10px] tracking-wider">
                    <tr>
                      <th className="py-2.5 px-4">Level</th>
                      <th className="py-2.5 px-4">Timestamp</th>
                      <th className="py-2.5 px-4">Category</th>
                      <th className="py-2.5 px-4">Event</th>
                      <th className="py-2.5 px-4">Phone / Recipient</th>
                      <th className="py-2.5 px-4">Description</th>
                      <th className="py-2.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50 font-mono">
                    {logs.map(log => {
                      const isSelected = selectedLog?.id === log.id;
                      return (
                        <tr
                          key={log.id}
                          onClick={() => setSelectedLog(isSelected ? null : log)}
                          className={`cursor-pointer transition-colors hover:bg-slate-900/60 ${
                            isSelected ? "bg-slate-800/60" : log.resolved ? "opacity-50 bg-slate-950" : ""
                          }`}
                        >
                          <td className="py-3 px-4">{getLevelBadge(log.level)}</td>
                          <td className="py-3 px-4 text-slate-400 whitespace-nowrap text-[11px]">
                            {new Date(log.timestamp).toLocaleString([], { dateStyle: "short", timeStyle: "medium" })}
                          </td>
                          <td className="py-3 px-4 font-bold text-slate-300">{log.category}</td>
                          <td className="py-3 px-4 font-bold text-emerald-400">{log.event}</td>
                          <td className="py-3 px-4 text-slate-300 font-mono">{log.phone || "—"}</td>
                          <td className="py-3 px-4 text-slate-200 max-w-md truncate font-sans text-xs">
                            {log.message}
                          </td>
                          <td className="py-3 px-4 text-right font-sans">
                            <div className="flex items-center justify-end gap-2" onClick={e => e.stopPropagation()}>
                              {!log.resolved && log.level === "ERROR" && (
                                <button
                                  onClick={() => handleResolveLog(log.id)}
                                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-emerald-400 text-[11px] font-bold"
                                >
                                  Mark Resolved
                                </button>
                              )}
                              <ChevronRight className={`w-4 h-4 text-slate-500 transition-transform ${isSelected ? "rotate-90" : ""}`} />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* EXPANDED LOG DRAWER / DETAILS MODAL */}
            {selectedLog && (
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3 text-xs animate-in slide-in-from-bottom-2">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    {getLevelBadge(selectedLog.level)}
                    <span className="font-bold text-white text-sm">{selectedLog.event}</span>
                    <span className="text-slate-400">({selectedLog.category})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCopyText(JSON.stringify(selectedLog, null, 2))}
                      className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 flex items-center gap-1"
                    >
                      {copiedId ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      Copy JSON
                    </button>
                    <button
                      onClick={() => setSelectedLog(null)}
                      className="p-1 rounded text-slate-500 hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 bg-slate-900/60 p-3 rounded-lg border border-slate-800 font-mono text-[11px]">
                  <div>
                    <span className="text-slate-500 block text-[10px]">TIMESTAMP</span>
                    <span className="text-slate-200">{new Date(selectedLog.timestamp).toISOString()}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">PHONE / RECIPIENT</span>
                    <span className="text-slate-200">{selectedLog.phone || "N/A"}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">MESSAGE ID</span>
                    <span className="text-slate-200 truncate block">{selectedLog.messageId || "N/A"}</span>
                  </div>
                </div>

                {/* REMEDIATION TIP BANNER */}
                {selectedLog.details?.remediationTip && (
                  <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-emerald-400">
                      <HelpCircle className="w-4 h-4" /> Recommended Solution / Remediation Guidance
                    </div>
                    <p className="text-xs leading-relaxed text-emerald-100">{selectedLog.details.remediationTip}</p>
                  </div>
                )}

                {/* META ERROR CODE DETAILS */}
                {selectedLog.details?.metaErrorCode && (
                  <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-200 space-y-1 font-mono">
                    <div className="font-bold text-rose-400 text-xs">
                      Meta Cloud API Error Code: {selectedLog.details.metaErrorCode}
                      {selectedLog.details.metaErrorSubcode ? ` (Subcode: ${selectedLog.details.metaErrorSubcode})` : ""}
                    </div>
                    {selectedLog.details.fbTraceId && (
                      <div className="text-[11px] text-rose-300">Facebook Trace ID: {selectedLog.details.fbTraceId}</div>
                    )}
                  </div>
                )}

                {/* RAW DETAILS JSON */}
                <div className="space-y-1">
                  <span className="text-slate-400 font-bold uppercase text-[10px]">Diagnostic Context & Raw Details</span>
                  <pre className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-emerald-300 font-mono overflow-x-auto max-h-48">
                    {JSON.stringify(selectedLog.details, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: HEALTH & DIAGNOSTIC CHECKLIST */}
        {activeTab === "health" && (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="grid grid-cols-2 gap-6">
              {/* CHECKLIST */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-black text-sm text-white flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Configuration Diagnostic Checklist
                  </h3>
                  <button
                    onClick={fetchHealth}
                    className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-bold flex items-center gap-1"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingHealth ? "animate-spin" : ""}`} /> Refresh
                  </button>
                </div>

                <div className="space-y-3">
                  {health?.checklist.map(item => (
                    <div
                      key={item.key}
                      className="p-3 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between text-xs"
                    >
                      <div className="space-y-0.5">
                        <span className="font-bold text-slate-200 block">{item.title}</span>
                        <span className="font-mono text-[11px] text-slate-400">{item.value}</span>
                      </div>
                      <div>
                        {item.status === "ok" ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">PASS</span>
                        ) : item.status === "warning" ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">WARNING</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">FAILED</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* WEBHOOK URL SETUP */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-4">
                <h3 className="font-black text-sm text-white flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-blue-400" /> Webhook Ingestion Configuration
                </h3>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="text-slate-400 font-bold block mb-1">Webhook Callback URL</label>
                    <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 p-2 rounded-lg font-mono text-[11px]">
                      <span className="text-emerald-400 truncate flex-1">{window.location.origin}/api/v1/whatsapp/webhook</span>
                      <button
                        onClick={() => handleCopyText(`${window.location.origin}/api/v1/whatsapp/webhook`)}
                        className="p-1 text-slate-400 hover:text-white"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-slate-400 font-bold block mb-1">Webhook Verify Token</label>
                    <div className="bg-slate-900 border border-slate-800 p-2 rounded-lg font-mono text-[11px] text-amber-300">
                      nexus_whatsapp_webhook_secret_2026
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 space-y-2 text-slate-300">
                    <span className="font-bold text-white block">Required Meta Webhook Subscription Fields:</span>
                    <ul className="list-disc pl-4 space-y-1 text-[11px] text-slate-400">
                      <li><strong className="text-slate-200">messages</strong> (Inbound customer text, media, location)</li>
                      <li><strong className="text-slate-200">message_template_status_update</strong> (Template approvals)</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* TROUBLESHOOTING GUIDE */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-3">
              <h3 className="font-black text-sm text-white flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-amber-400" /> Common WhatsApp Omnichannel Issue Resolution Guide
              </h3>

              <div className="grid grid-cols-3 gap-4 text-xs">
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                  <span className="font-bold text-rose-400 block">1. Meta API Error 190 (Token Expired)</span>
                  <p className="text-slate-400 text-[11px]">Generate a Permanent System User Access Token in Meta Business Manager. Avoid using temporary 24-hour test tokens.</p>
                </div>

                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                  <span className="font-bold text-amber-400 block">2. Meta Error 131030 (Recipient Not Allowed)</span>
                  <p className="text-slate-400 text-[11px]">In Meta Development Mode, add recipient phone numbers in Meta Developer Portal -&gt; WhatsApp -&gt; API Setup dropdown.</p>
                </div>

                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                  <span className="font-bold text-blue-400 block">3. Meta Error 131026 (24-Hour Window)</span>
                  <p className="text-slate-400 text-[11px]">Outbound messages sent 24 hours after last customer response require an approved Meta Message Template.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: LIVE SIMULATION & CONSOLE */}
        {activeTab === "simulation" && (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="grid grid-cols-2 gap-6">
              {/* CONNECTION TEST BOX */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-black text-sm text-white flex items-center gap-2">
                    <Radio className="w-4 h-4 text-emerald-400" /> Meta Graph API Live Connection Test
                  </h3>
                  <button
                    onClick={handleTestConnection}
                    disabled={testingConn}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${testingConn ? "animate-spin" : ""}`} />
                    Run Test
                  </button>
                </div>

                <p className="text-xs text-slate-400">Pings Facebook Graph API endpoint with configured WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID.</p>

                {connResult && (
                  <div className={`p-4 rounded-xl border text-xs font-mono space-y-2 ${connResult.success ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-200" : "bg-rose-500/10 border-rose-500/30 text-rose-200"}`}>
                    <div className="font-bold text-sm flex items-center justify-between">
                      <span>{connResult.success ? "SUCCESS: Connection Verified" : "FAILURE: Connection Rejected"}</span>
                      {connResult.latencyMs && <span className="text-[11px] text-slate-400">{connResult.latencyMs}ms</span>}
                    </div>
                    <p className="font-sans text-xs">{connResult.message || connResult.error}</p>
                    {connResult.remediation && (
                      <div className="p-2.5 rounded bg-slate-900 border border-slate-800 text-amber-300 font-sans text-xs mt-2">
                        <strong>Fix Tip:</strong> {connResult.remediation}
                      </div>
                    )}
                    <pre className="p-2 rounded bg-slate-900 border border-slate-800 text-[10px] overflow-x-auto text-slate-300 max-h-32">
                      {JSON.stringify(connResult, null, 2)}
                    </pre>
                  </div>
                )}
              </div>

              {/* WEBHOOK SIMULATION BOX */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-black text-sm text-white flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-blue-400" /> Inbound Webhook Pipeline Simulator
                  </h3>
                  <button
                    onClick={handleTestWebhook}
                    disabled={testingWebhook}
                    className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${testingWebhook ? "animate-spin" : ""}`} />
                    Simulate Inbound Message
                  </button>
                </div>

                <p className="text-xs text-slate-400">Injects a dry-run Meta webhook payload to verify message extraction, lead lookup, and idempotency logic.</p>

                {webhookResult && (
                  <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3 font-mono text-xs">
                    <div className="font-bold text-white">Simulation Pipeline Execution Logs:</div>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {webhookResult.traceLogs?.map((log: any, idx: number) => (
                        <div key={idx} className="flex items-start gap-2 text-[11px]">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${log.status === "success" ? "bg-emerald-500/20 text-emerald-400" : log.status === "error" ? "bg-rose-500/20 text-rose-400" : "bg-blue-500/20 text-blue-400"}`}>
                            {log.status.toUpperCase()}
                          </span>
                          <span className="text-slate-300 font-bold">{log.step}:</span>
                          <span className="text-slate-400 font-sans">{log.message}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
