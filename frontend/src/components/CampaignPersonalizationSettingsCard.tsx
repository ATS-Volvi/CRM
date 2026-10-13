import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { UserCheck, Shield, CheckCircle, AlertTriangle, ToggleLeft, ToggleRight } from "lucide-react";

export function CampaignPersonalizationSettingsCard() {
  const { token, user } = useAuth();
  const queryClient = useQueryClient();
  const userRole = (user?.role || "").toLowerCase();
  const canManage = ["admin", "director", "manager"].includes(userRole);

  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Fetch setting
  const { data: settingData, isLoading } = useQuery({
    queryKey: ["workspaceSetting", "use_customer_names_in_campaigns"],
    queryFn: async () => {
      const res = await fetch("/api/v1/workspace/settings/use_customer_names_in_campaigns", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        if (res.status === 404) return { value: "false" };
        throw new Error("Failed to load workspace setting");
      }
      return res.json();
    },
    enabled: !!token
  });

  const isEnabled = settingData?.value === "true";

  const updateSettingMutation = useMutation({
    mutationFn: async (newValue: boolean) => {
      const res = await fetch("/api/v1/workspace/settings/use_customer_names_in_campaigns", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          value: newValue ? "true" : "false",
          description: "Use customer names in campaigns (default OFF)"
        })
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to update setting");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["workspaceSetting", "use_customer_names_in_campaigns"], data);
      queryClient.invalidateQueries({ queryKey: ["workspaceSetting", "use_customer_names_in_campaigns"] });
      setStatusMessage({
        type: "success",
        text: data.value === "true"
          ? "Customer name personalization is now ENABLED for campaigns."
          : "Customer name personalization is now DISABLED. Campaigns will use 'Customer' safely."
      });
      setTimeout(() => setStatusMessage(null), 4000);
    },
    onError: (err: any) => {
      setStatusMessage({ type: "error", text: err.message || "Failed to update setting" });
    }
  });

  if (!canManage) {
    return null;
  }

  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 shadow-sm space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-on-surface flex items-center gap-2">
          <UserCheck className="w-5 h-5 text-indigo-600" />
          Campaign Personalization Safety
        </h3>
        <span
          className={`text-xs px-2.5 py-1 rounded-full font-bold ${
            isEnabled
              ? "bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-200"
              : "bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200"
          }`}
        >
          {isEnabled ? "Names Enabled" : "Safe Default (Names OFF)"}
        </span>
      </div>

      <p className="text-sm text-on-surface-variant leading-relaxed">
        Control whether recipient first and last names are dynamically rendered into campaign email subjects, email bodies, and WhatsApp messages.
      </p>

      {statusMessage && (
        <div
          className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 animate-fade-in ${
            statusMessage.type === "success"
              ? "bg-emerald-50 border border-emerald-300 text-emerald-800"
              : "bg-red-50 border border-red-300 text-red-800"
          }`}
        >
          {statusMessage.type === "success" ? (
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
          )}
          {statusMessage.text}
        </div>
      )}

      <div className="p-4 rounded-xl border border-outline-variant bg-surface space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-on-surface">Use customer names in campaigns</h4>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              When disabled (default), campaign messages address recipients safely as <span className="font-semibold text-on-surface">&ldquo;Customer&rdquo;</span> with clean whitespace and punctuation.
              When enabled, real lead names will be substituted into templates.
            </p>
          </div>

          <button
            type="button"
            disabled={isLoading || updateSettingMutation.isPending}
            onClick={() => updateSettingMutation.mutate(!isEnabled)}
            className={`p-1.5 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
              isEnabled ? "text-indigo-600 hover:text-indigo-700" : "text-slate-400 hover:text-slate-600"
            }`}
            title={isEnabled ? "Click to disable name personalization" : "Click to enable name personalization"}
          >
            {isEnabled ? (
              <ToggleRight className="w-8 h-8 text-indigo-600" />
            ) : (
              <ToggleLeft className="w-8 h-8 text-slate-400" />
            )}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs pt-2 border-t border-outline-variant/60">
          <div className="p-2.5 rounded-lg bg-surface-container-low border border-outline-variant/40">
            <span className="font-bold text-slate-700 dark:text-slate-300 block mb-1">When OFF (Default):</span>
            <ul className="list-disc list-inside space-y-0.5 text-slate-600 dark:text-slate-400 text-[11px]">
              <li><code>&#123;&#123;firstName&#125;&#125;</code> renders as &ldquo;Customer&rdquo;</li>
              <li><code>&#123;&#123;lastName&#125;&#125;</code> renders as empty (tidied)</li>
              <li>Composer hides name chips</li>
              <li>WhatsApp variables fallback to &ldquo;Customer&rdquo;</li>
            </ul>
          </div>
          <div className="p-2.5 rounded-lg bg-surface-container-low border border-outline-variant/40">
            <span className="font-bold text-slate-700 dark:text-slate-300 block mb-1">When ON:</span>
            <ul className="list-disc list-inside space-y-0.5 text-slate-600 dark:text-slate-400 text-[11px]">
              <li><code>&#123;&#123;firstName&#125;&#125;</code> and <code>&#123;&#123;lastName&#125;&#125;</code> use lead data</li>
              <li>Missing names safely handled</li>
              <li>Composer exposes all chips</li>
              <li>Unbalanced &amp; unknown tokens stripped</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
