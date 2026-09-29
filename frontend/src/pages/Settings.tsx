import { useAuth } from "../context/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { 
  Settings as SettingsIcon, Shield, CheckCircle, RefreshCw, UserCheck, 
  ToggleLeft, ToggleRight, Users, Mail, MessageCircle, Copy, ExternalLink, 
  Check, ShieldAlert, Globe, AlertCircle, ArrowRightLeft, Plus, Save, TrendingUp
} from "lucide-react";
import { WhatsAppDiagnosticsModal } from "../components/WhatsAppDiagnosticsModal";
import { DealAssignmentSettingsCard } from "../components/DealAssignmentSettingsCard";
import { CommissionSplitAndTiersCard } from "../components/CommissionSplitAndTiersCard";
import { useOrgCurrency } from "../context/OrgSettingsContext";

export default function Settings() {
  const { token, user } = useAuth();
  const queryClient = useQueryClient();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [authCode, setAuthCode] = useState("");
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  const webhookUrl = `${window.location.origin}/api/v1/whatsapp/webhook`;

  const copyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 2000);
  };

  // Fetch current user settings
  const { data: mySettings } = useQuery({
    queryKey: ["mySettings"],
    queryFn: async () => {
      const res = await fetch("/api/v1/users/me/settings", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to fetch settings");
      return res.json();
    }
  });

  // Fetch Gmail status
  const { data: gmailConfig, refetch: refetchGmail } = useQuery({
    queryKey: ["gmailStatus"],
    queryFn: async () => {
      const res = await fetch("/api/v1/gmail/status", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to fetch Gmail status");
      return res.json();
    }
  });

  const connectGmailMutation = useMutation({
    mutationFn: async (code: string) => {
      const res = await fetch("/api/v1/gmail/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ code })
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gmailStatus"] });
      setMessage("Gmail connected successfully!");
      setAuthCode("");
      setShowCodeInput(false);
      setTimeout(() => setMessage(null), 3000);
    },
    onError: (err: any) => {
      alert(err.message || "Failed to connect Gmail");
    }
  });

  const syncGmailMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/v1/gmail/sync", {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["gmailStatus"] });
      setMessage(`Sync complete! Ingested ${data.ingestedCount} new leads.`);
      setTimeout(() => setMessage(null), 4000);
    },
    onError: (err: any) => {
      alert(err.message || "Sync failed");
    }
  });

  const disconnectGmailMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/v1/gmail/disconnect", {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gmailStatus"] });
      setMessage("Gmail disconnected.");
      setTimeout(() => setMessage(null), 3000);
    }
  });

  const handleStartOAuth = async () => {
    try {
      const res = await fetch("/api/v1/gmail/auth-url", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to generate Auth URL");
      const { url } = await res.json();
      
      // If mock client id, open mock prompt
      if (url.includes("MOCK_CLIENT_ID")) {
        const mockCode = prompt("Enter mock authorization code (e.g. mock_auth_code_123) to complete simulated integration:");
        if (mockCode) {
          connectGmailMutation.mutate(mockCode);
        }
      } else {
        window.open(url, "_blank");
        setShowCodeInput(true);
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Fetch direct reports (team members)
  const { data: team } = useQuery<any[]>({
    queryKey: ["myTeam"],
    queryFn: async () => {
      const res = await fetch("/api/v1/users/me/team", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to fetch team members");
      return res.json();
    },
    enabled: !!token && ["admin", "director", "manager"].includes(user?.role || "")
  });

  // Fetch all potential managers
  const { data: salespersons } = useQuery<any[]>({
    queryKey: ["salespersons"],
    queryFn: async () => {
      const res = await fetch("/api/v1/salespersons", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to fetch representatives");
      return res.json();
    },
    enabled: !!token && ["admin", "director", "manager"].includes(user?.role || "")
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/v1/users/me/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mySettings"] });
      setMessage("Settings updated successfully!");
      setPassword("");
      setConfirmPassword("");
      setTimeout(() => setMessage(null), 3000);
    }
  });

  const reassignManagerMutation = useMutation({
    mutationFn: async ({ memberId, managerId }: { memberId: string; managerId: string | null }) => {
      const res = await fetch("/api/v1/users/team/reassign", {
        method: "PUT",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ memberId, managerId })
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["myTeam"] });
      setMessage("Team manager reassigned successfully!");
      setTimeout(() => setMessage(null), 3000);
    }
  });

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      alert("Passwords do not match!");
      return;
    }
    updateSettingsMutation.mutate({ password });
  };

  const handleAvailabilityToggle = () => {
    if (!mySettings) return;
    updateSettingsMutation.mutate({ isAvailable: !mySettings.isAvailable });
  };

  return (
    <div className="flex-1 overflow-y-auto bg-surface h-[calc(100vh-64px)] relative">
      <div className="max-w-[1000px] mx-auto p-8 space-y-8">
        
        {/* Page Header */}
        <div className="space-y-1">
          <h2 className="text-4xl font-bold text-on-surface flex items-center gap-2.5">
            <SettingsIcon className="w-9 h-9 text-primary" />
            User Settings
          </h2>
          <p className="text-base text-on-surface-variant">Update your password, set availability, and manage direct reports.</p>
        </div>

        {/* Quick Access to Workspace Configurations & Master Data */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-outline-variant/60 pb-3">
            <div>
              <h3 className="text-lg font-bold text-on-surface">Workspace Master Data & Administration</h3>
              <p className="text-xs text-on-surface-variant">Access system parameters, price books, and workflow configurations.</p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { name: "Requirements", path: "/master-data/requirements" },
              { name: "Line Items", path: "/master-data/line-items" },
              { name: "Construction Items", path: "/master-data/construction-items" },
              { name: "Pricing Grid", path: "/master-data/pricing" },
              { name: "Lead Sources", path: "/master-data/lead-sources" },
              { name: "KPI Master", path: "/master-data/kpis" },
              { name: "Price Book", path: "/price-book" },
              { name: "Assignment Rules", path: "/rules" },
              { name: "Workflow Engine", path: "/automation" },
              { name: "Approval Queue", path: "/approvals" }
            ].map(item => (
              <a
                key={item.name}
                href={item.path}
                className="p-3 bg-surface hover:bg-surface-container-high border border-outline-variant rounded-xl text-xs font-bold text-on-surface hover:text-primary transition-all flex items-center justify-between group"
              >
                <span>{item.name}</span>
                <span className="text-on-surface-variant group-hover:translate-x-0.5 transition-transform">→</span>
              </a>
            ))}
          </div>
        </div>

        {/* Organization Settings & Exchange Rates (Admin only) */}
        {["admin"].includes(mySettings?.role || user?.role || "") && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <OrgSettingsCard />
            <ExchangeRatesCard />
          </div>
        )}

        {/* Senior AE Deal Assignment & Capacity Settings */}
        {["admin", "director", "manager"].includes(mySettings?.role || user?.role || "") && (
          <>
            <CommissionSplitAndTiersCard />
            <DealAssignmentSettingsCard />
          </>
        )}

        {message && (
          <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-xl p-4 text-sm font-semibold flex items-center gap-2 animate-fade-in">
            <CheckCircle className="w-5 h-5 text-emerald-600" />
            {message}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Left Column: Security and Status */}
          <div className="space-y-8">
            {/* Availability card */}
            <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 shadow-sm space-y-4">
              <h3 className="text-lg font-bold text-on-surface flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-primary" />
                Availability Status
              </h3>
              <p className="text-sm text-on-surface-variant">Configure whether you are currently eligible to receive new lead assignments dynamically.</p>
              
              <div className="flex items-center justify-between p-4 bg-surface rounded-xl border border-outline-variant">
                <div>
                  <p className="font-bold text-sm">Accepting New Leads</p>
                  <p className="text-xs text-on-surface-variant mt-0.5">Toggle availability status on the lead engine</p>
                </div>
                <button 
                  onClick={handleAvailabilityToggle}
                  disabled={updateSettingsMutation.isPending}
                  className="focus:outline-none hover:opacity-90 active:scale-95 transition-all"
                >
                  {mySettings?.isAvailable ? (
                    <ToggleRight className="w-12 h-12 text-primary" />
                  ) : (
                    <ToggleLeft className="w-12 h-12 text-on-surface-variant" />
                  )}
                </button>
              </div>
            </div>

            {/* Gmail Connector Card */}
            <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 shadow-sm space-y-4">
              <h3 className="text-lg font-bold text-on-surface flex items-center gap-2">
                <Mail className="w-5 h-5 text-primary" />
                Gmail Lead Ingestion
              </h3>
              <p className="text-sm text-on-surface-variant">
                Connect your business Gmail account to automatically monitor and ingest incoming customer emails as leads.
              </p>

              {gmailConfig?.connected ? (
                <div className="space-y-4">
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1">
                    <p className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Connected Account</p>
                    <p className="text-sm font-bold text-emerald-950">{gmailConfig.email}</p>
                    <p className="text-[11px] text-emerald-700">
                      Last Checked: {gmailConfig.lastSyncedAt ? new Date(gmailConfig.lastSyncedAt).toLocaleString() : "Never"}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => syncGmailMutation.mutate()}
                      disabled={syncGmailMutation.isPending}
                      className="flex-1 py-2.5 bg-primary text-white font-bold rounded-lg hover:opacity-90 active:scale-95 transition-all text-xs shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      <RefreshCw className={`w-4 h-4 ${syncGmailMutation.isPending ? "animate-spin" : ""}`} />
                      Sync Now
                    </button>
                    <button
                      onClick={() => {
                        if (confirm("Disconnect Gmail account? Lead ingestion for this account will stop.")) {
                          disconnectGmailMutation.mutate();
                        }
                      }}
                      disabled={disconnectGmailMutation.isPending}
                      className="py-2.5 px-4 bg-surface-container text-error font-bold rounded-lg hover:bg-surface-container-high transition-colors text-xs"
                    >
                      Disconnect
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <button
                    onClick={handleStartOAuth}
                    className="w-full py-3 bg-primary text-white font-bold rounded-lg hover:opacity-90 active:scale-95 transition-all shadow-md flex items-center justify-center gap-2"
                  >
                    <Mail className="w-5 h-5" />
                    Connect Gmail Account
                  </button>

                  {showCodeInput && (
                    <div className="border border-outline-variant rounded-xl p-4 bg-surface space-y-3">
                      <p className="text-xs text-on-surface-variant leading-relaxed">
                        Consent tab opened in a new window. Copy the authorization code from the redirect URL and paste below to complete setup:
                      </p>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={authCode}
                          onChange={(e) => setAuthCode(e.target.value)}
                          placeholder="4/0AdQt8..."
                          className="flex-1 bg-surface border border-outline rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                        />
                        <button
                          onClick={() => connectGmailMutation.mutate(authCode)}
                          disabled={connectGmailMutation.isPending || !authCode.trim()}
                          className="px-4 py-2 bg-secondary text-white text-xs font-bold rounded-lg hover:opacity-90 disabled:opacity-50"
                        >
                          Submit
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* WhatsApp Business API Card */}
            <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 shadow-sm space-y-4">
              <h3 className="text-lg font-bold text-on-surface flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-emerald-600" />
                WhatsApp Business API
              </h3>
              <p className="text-sm text-on-surface-variant">
                Receive and send WhatsApp messages via Meta Cloud API. Incoming messages auto-create leads and activity logs.
              </p>

              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-bold text-emerald-800">Webhook Endpoint Registered</span>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Webhook URL (paste in Meta Developer Console)</p>
                  <div className="flex items-center gap-2 bg-white border border-emerald-300 rounded-lg px-3 py-2">
                    <code className="text-[11px] text-slate-700 flex-1 truncate font-mono">{webhookUrl}</code>
                    <button
                      onClick={copyWebhook}
                      className="shrink-0 text-emerald-600 hover:text-emerald-800 transition-colors"
                      title="Copy webhook URL"
                    >
                      {copiedWebhook ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-emerald-700 font-bold">Verify Token</p>
                    <p className="font-mono text-slate-700">nexus_whatsapp_webhook_secret_2026</p>
                  </div>
                  <div>
                    <p className="text-emerald-700 font-bold">API Version</p>
                    <p className="text-slate-700">Meta Cloud API v18.0</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2 text-xs">
                <p className="font-bold text-on-surface-variant uppercase tracking-wider text-[10px]">Setup Checklist</p>
                {[
                  { done: true, label: "WHATSAPP_TOKEN configured in .env" },
                  { done: true, label: "WHATSAPP_PHONE_NUMBER_ID configured in .env" },
                  { done: true, label: "Webhook endpoint live at /api/v1/whatsapp/webhook" },
                  { done: false, label: "Register webhook URL in Meta Developer Console" },
                  { done: false, label: "Add phone number to WhatsApp Business API" },
                ].map((step, i) => (
                  <div key={i} className={`flex items-center gap-2 p-2 rounded-lg ${step.done ? "bg-emerald-50 text-emerald-800" : "bg-slate-50 text-slate-500"}`}>
                    <CheckCircle className={`w-3.5 h-3.5 shrink-0 ${step.done ? "text-emerald-600" : "text-slate-300"}`} />
                    {step.label}
                  </div>
                ))}
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-3">
                <a
                  href="https://developers.facebook.com/docs/whatsapp/cloud-api/get-started"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-xs font-bold text-emerald-700 hover:text-emerald-800 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Meta Cloud API Docs
                </a>

                <button
                  type="button"
                  onClick={() => setShowDiagnostics(true)}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 text-emerald-400 hover:bg-slate-800 text-xs font-extrabold flex items-center gap-1.5 transition-all shadow-sm"
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  Launch Diagnostics & Logs
                </button>
              </div>
            </div>

            {/* Profile info & Password change */}
            <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 shadow-sm space-y-6">
              <h3 className="text-lg font-bold text-on-surface flex items-center gap-2">
                <Shield className="w-5 h-5 text-secondary" />
                Security & Role info
              </h3>

              <div className="space-y-2 text-sm">
                <p><span className="font-bold">Role:</span> <span className="bg-secondary/15 text-secondary font-bold px-2 py-0.5 rounded text-xs">{mySettings?.role || user?.role}</span></p>
                <p><span className="font-bold">Email:</span> {mySettings?.email || user?.email}</p>
              </div>

              <form onSubmit={handlePasswordSubmit} className="space-y-4 border-t border-outline-variant pt-6">
                <h4 className="font-bold text-sm">Update Password</h4>
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">New Password</label>
                  <input 
                    type="password" 
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-surface border border-outline rounded-lg p-3 text-sm focus:ring-1 focus:ring-primary focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">Confirm New Password</label>
                  <input 
                    type="password" 
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-surface border border-outline rounded-lg p-3 text-sm focus:ring-1 focus:ring-primary focus:outline-none"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={updateSettingsMutation.isPending || !password.trim()}
                  className="w-full py-3 bg-primary text-white font-bold rounded-lg hover:opacity-90 active:scale-95 transition-all shadow-md disabled:opacity-50"
                >
                  Change Password
                </button>
              </form>
            </div>

          </div>

          {/* Right Column: Team Management (if applicable) */}
          {["admin", "director", "manager"].includes(mySettings?.role || user?.role || "") && (
            <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 shadow-sm space-y-6">
              <h3 className="text-lg font-bold text-on-surface flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-600" />
                Team Reports ({team?.length || 0})
              </h3>
              <p className="text-sm text-on-surface-variant">View representatives reporting directly to you and manage their manager assignments.</p>

              <div className="space-y-4 divide-y divide-outline-variant">
                {team?.length === 0 ? (
                  <p className="text-sm text-on-surface-variant py-4">No team members report to you directly.</p>
                ) : (
                  team?.map((member: any) => (
                    <div key={member.id} className="pt-4 first:pt-0 space-y-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-bold text-sm">{member.name}</p>
                          <p className="text-xs text-on-surface-variant">{member.email} | {member.role}</p>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded font-semibold ${
                          member.isAvailable ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                        }`}>
                          {member.isAvailable ? "Available" : "OOO"}
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                        <label className="text-xs text-on-surface-variant font-bold whitespace-nowrap">Reassign Manager:</label>
                        <select
                          value={member.managerId || ""}
                          onChange={(e) => reassignManagerMutation.mutate({ 
                            memberId: member.id, 
                            managerId: e.target.value || null 
                          })}
                          className="flex-1 bg-surface border border-outline rounded-lg px-2 py-1.5 text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                        >
                          <option value="">No Manager (Direct/Independent)</option>
                          {salespersons
                            ?.filter(s => s.id !== member.id) // Cannot manage yourself
                            ?.map(s => (
                              <option key={s.id} value={s.id}>{s.name} ({s.role})</option>
                            ))}
                        </select>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

        </div>

      </div>

      <WhatsAppDiagnosticsModal
        isOpen={showDiagnostics}
        onClose={() => setShowDiagnostics(false)}
      />
    </div>
  );
}

function OrgSettingsCard() {
  const { defaultCurrency, updateOrgCurrency } = useOrgCurrency();
  const [currency, setCurrency] = useState(defaultCurrency);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    setCurrency(defaultCurrency);
  }, [defaultCurrency]);

  const handleSave = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      await updateOrgCurrency(currency);
      setFeedback({ type: "success", text: "Organization default currency saved successfully!" });
      setTimeout(() => setFeedback(null), 4000);
    } catch (e: any) {
      setFeedback({ type: "error", text: e.message || "Failed to save organization settings." });
    } finally {
      setSaving(false);
    }
  };

  const currencyOptions = [
    { code: "SAR", label: "SAR — Saudi Riyal (ر.س)" },
    { code: "INR", label: "INR — Indian Rupee (₹)" },
    { code: "USD", label: "USD — US Dollar ($)" },
    { code: "AED", label: "AED — UAE Dirham (د.إ)" },
    { code: "EUR", label: "EUR — Euro (€)" },
    { code: "GBP", label: "GBP — British Pound (£)" }
  ];

  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-outline-variant/60 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <Globe className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-on-surface">Organization Settings</h3>
            <p className="text-xs text-on-surface-variant">Manage organization-wide preferences and defaults.</p>
          </div>
        </div>
      </div>

      {feedback && (
        <div className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
          feedback.type === "success" ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-rose-50 text-rose-800 border border-rose-200"
        }`}>
          {feedback.type === "success" ? <Check className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-rose-600" />}
          {feedback.text}
        </div>
      )}

      {currency !== defaultCurrency && (
        <div className="p-3.5 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs space-y-1.5 animate-in fade-in duration-200">
          <div className="flex items-center gap-1.5 font-bold text-amber-800">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            Notice: Thresholds and Limits
          </div>
          <p className="leading-relaxed">
            Thresholds, limits and targets are <strong>NOT converted</strong> automatically. Review them after saving.
          </p>
          <div className="flex gap-4 pt-1 text-[11px] font-bold">
            <Link to="/approvals" className="text-amber-800 underline hover:text-amber-950 flex items-center gap-1">
              Approval Policy <ExternalLink className="w-3 h-3" />
            </Link>
            <Link to="/rules" className="text-amber-800 underline hover:text-amber-950 flex items-center gap-1">
              Lead Policy <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        </div>
      )}

      <div className="space-y-3">
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Default Currency
          </label>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="w-full bg-surface border border-outline rounded-xl px-3 py-2 text-xs font-semibold focus:ring-1 focus:ring-primary focus:outline-none"
          >
            {currencyOptions.map((c) => (
              <option key={c.code} value={c.code}>
                {c.label}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-on-surface-variant mt-1.5 leading-relaxed">
            Applies to new records. Existing records keep their own currency. Stored amounts are never converted.
          </p>
        </div>

        <div className="pt-2">
          <button
            onClick={handleSave}
            disabled={saving || currency === defaultCurrency}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-2 cursor-pointer"
          >
            {saving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
            Save Organization Settings
          </button>
        </div>
      </div>
    </div>
  );
}

function ExchangeRatesCard() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [fromCurr, setFromCurr] = useState("USD");
  const [toCurr, setToCurr] = useState("SAR");
  const [rateVal, setRateVal] = useState("3.75");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const { data: exchangeRatesData, isLoading } = useQuery<{
    rates?: any[];
    missingRates?: string[];
    placeholderRates?: string[];
    orgCurrency?: string;
  }>({
    queryKey: ["exchangeRates"],
    queryFn: async () => {
      const res = await fetch("/api/v1/settings/exchange-rates", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) return { rates: [], missingRates: [], placeholderRates: [] };
      const json = await res.json();
      return Array.isArray(json) ? { rates: json, missingRates: [], placeholderRates: [] } : json;
    },
    enabled: !!token
  });

  const exchangeRates = exchangeRatesData?.rates || [];
  const missingRates = exchangeRatesData?.missingRates || [];
  const placeholderRates = exchangeRatesData?.placeholderRates || [];

  const saveRateMutation = useMutation({
    mutationFn: async (payload: { fromCurrency: string; toCurrency: string; rate: number }) => {
      const res = await fetch("/api/v1/settings/exchange-rates", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update exchange rate");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exchangeRates"] });
      setSuccessMsg(`Rate for ${fromCurr}/${toCurr} updated successfully!`);
      setErrorMsg(null);
      setTimeout(() => setSuccessMsg(null), 4000);
    },
    onError: (err: any) => {
      setErrorMsg(err.message || "Failed to save exchange rate.");
      setSuccessMsg(null);
    }
  });

  const handleSaveRate = (e: React.FormEvent) => {
    e.preventDefault();
    const rate = parseFloat(rateVal);
    if (isNaN(rate) || rate <= 0) {
      setErrorMsg("Please enter a valid positive number for rate.");
      return;
    }
    if (fromCurr === toCurr) {
      setErrorMsg("From and To currencies must be different.");
      return;
    }
    saveRateMutation.mutate({ fromCurrency: fromCurr, toCurrency: toCurr, rate });
  };

  const currencyList = ["SAR", "USD", "INR", "AED", "EUR", "GBP"];

  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 shadow-sm space-y-4 flex flex-col justify-between">
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-outline-variant/60 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <ArrowRightLeft className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-on-surface">Exchange Rates</h3>
              <p className="text-xs text-on-surface-variant">Admin-maintained currency conversion rates for comparisons.</p>
            </div>
          </div>
        </div>

        {/* Missing or Placeholder Rates Warning Banner */}
        {(missingRates.length > 0 || placeholderRates.length > 0) && (
          <div className="p-3 bg-amber-50 border border-amber-300 text-amber-900 rounded-xl text-xs font-semibold flex items-start gap-2 shadow-xs">
            <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <div className="font-bold">Needs Admin Review:</div>
              {missingRates.length > 0 && (
                <div>• Missing conversion rates for: <span className="font-bold text-amber-800">{missingRates.join(", ")}</span> to Org Currency.</div>
              )}
              {placeholderRates.length > 0 && (
                <div>• Placeholder rates awaiting admin verification: <span className="font-bold text-amber-800">{placeholderRates.join(", ")}</span>.</div>
              )}
            </div>
          </div>
        )}

        {/* User Decision Mandatory Warning Callout */}
        <div className="p-3 bg-blue-50/80 border border-blue-200 text-blue-900 rounded-xl text-xs font-semibold leading-relaxed">
          ℹ️ Used for approval-limit comparisons and totals only. Stored amounts are never converted.
        </div>

        {successMsg && (
          <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-semibold flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600" />
            {successMsg}
          </div>
        )}

        {errorMsg && (
          <div className="p-3 bg-rose-50 text-rose-800 border border-rose-200 rounded-xl text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600" />
            {errorMsg}
          </div>
        )}

        {/* Existing Rates Table */}
        <div className="space-y-2">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Configured Rates</span>
          {isLoading ? (
            <div className="text-xs text-slate-400 animate-pulse py-2">Loading exchange rates...</div>
          ) : exchangeRates.length === 0 ? (
            <div className="text-xs text-slate-400 py-3 bg-slate-50 rounded-xl text-center">No custom exchange rates configured yet.</div>
          ) : (
            <div className="max-h-48 overflow-y-auto border border-outline-variant rounded-xl divide-y divide-outline-variant">
              {exchangeRates.map((r: any) => (
                <div
                  key={r.id || `${r.fromCurrency}_${r.toCurrency}`}
                  onClick={() => {
                    setFromCurr(r.fromCurrency);
                    setToCurr(r.toCurrency);
                    setRateVal(String(r.rate));
                  }}
                  className="p-2.5 flex justify-between items-center text-xs bg-surface hover:bg-slate-50 cursor-pointer transition-colors"
                  title="Click to edit this exchange rate"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">
                      1 {r.fromCurrency} = <span className="text-blue-700">{r.rate}</span> {r.toCurrency}
                    </span>
                    {(r.needsReview || r.isPlaceholder) && (
                      <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 border border-amber-300 rounded text-[10px] font-bold">
                        Needs Review
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {r.updatedAt ? new Date(r.updatedAt).toLocaleDateString() : ""}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Rate Entry Form */}
        <form onSubmit={handleSaveRate} className="pt-2 space-y-3">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Add or Update Rate</span>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">From</label>
              <select
                value={fromCurr}
                onChange={(e) => setFromCurr(e.target.value)}
                className="w-full bg-surface border border-outline rounded-lg p-2 text-xs font-bold"
              >
                {currencyList.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">To</label>
              <select
                value={toCurr}
                onChange={(e) => setToCurr(e.target.value)}
                className="w-full bg-surface border border-outline rounded-lg p-2 text-xs font-bold"
              >
                {currencyList.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Rate</label>
              <input
                type="number"
                step="0.0001"
                min="0.000001"
                value={rateVal}
                onChange={(e) => setRateVal(e.target.value)}
                className="w-full bg-surface border border-outline rounded-lg p-2 text-xs font-bold"
                placeholder="3.75"
                required
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={saveRateMutation.isPending}
            className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
          >
            {saveRateMutation.isPending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save Exchange Rate
          </button>
        </form>
      </div>

    </div>
  );
}
