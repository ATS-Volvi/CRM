import { useAuth } from "../context/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Settings as SettingsIcon, Shield, CheckCircle, RefreshCw, UserCheck, ToggleLeft, ToggleRight, Users, Mail } from "lucide-react";

export default function Settings() {
  const { token, user } = useAuth();
  const queryClient = useQueryClient();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [authCode, setAuthCode] = useState("");
  const [showCodeInput, setShowCodeInput] = useState(false);

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
    enabled: !!token && ["admin", "director", "sales_manager"].includes(user?.role || "")
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
    enabled: !!token && ["admin", "director", "sales_manager"].includes(user?.role || "")
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
          {["admin", "director", "sales_manager"].includes(mySettings?.role || user?.role || "") && (
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
    </div>
  );
}
