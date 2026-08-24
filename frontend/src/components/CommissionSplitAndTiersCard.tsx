import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Percent,
  Layers,
  Users,
  ShieldCheck,
  CheckCircle,
  AlertCircle,
  HelpCircle,
  Save,
  RotateCcw,
  Sparkles,
  Info,
  Check,
  Briefcase,
  Sliders,
  ChevronRight
} from "lucide-react";

interface Salesperson {
  id: string;
  name: string;
  email: string;
  role: string;
  experienceTier?: string;
  isAvailable?: boolean;
}

const DEFAULT_KNOWN_TIERS = [
  { id: "senior_ae", label: "Senior AE (Role)", type: "role", description: "Dedicated closing senior account executives" },
  { id: "Senior Sales Representative", label: "Senior Sales Representative", type: "tier", description: "Experienced sales reps with high closing track record" },
  { id: "Enterprise AE", label: "Enterprise AE", type: "tier", description: "Strategic and enterprise tier account closers" },
  { id: "Strategic AE", label: "Strategic AE", type: "tier", description: "Key accounts & large deal negotiation specialist" },
  { id: "Closer", label: "Closer Tier", type: "tier", description: "Designated commercial closing specialist" },
  { id: "manager", label: "Sales Manager (Role)", type: "role", description: "Sales leadership / escalation closers" },
  { id: "sales_rep", label: "Sales Representative (Role)", type: "role", description: "Frontline qualifying SDRs and reps" },
  { id: "Sales Representative", label: "Sales Representative (Tier)", type: "tier", description: "Standard sales experience tier" }
];

export function CommissionSplitAndTiersCard() {
  const { token, user } = useAuth();
  const queryClient = useQueryClient();

  const [splitPctInput, setSplitPctInput] = useState<string>("20.0");
  const [selectedTiers, setSelectedTiers] = useState<string[]>([
    "senior_ae",
    "Senior Sales Representative",
    "Enterprise AE",
    "Strategic AE",
    "Closer"
  ]);
  const [customTierInput, setCustomTierInput] = useState<string>("");
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // 1. Fetch default_qualifying_split_pct setting
  const { data: splitSetting, isLoading: isLoadingSplit } = useQuery({
    queryKey: ["workspaceSetting", "default_qualifying_split_pct"],
    queryFn: async () => {
      const res = await fetch("/api/v1/workspace/settings/default_qualifying_split_pct", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to fetch split setting");
      return res.json();
    },
    enabled: !!token
  });

  // 2. Fetch closing_tier_names setting
  const { data: tiersSetting, isLoading: isLoadingTiers } = useQuery({
    queryKey: ["workspaceSetting", "closing_tier_names"],
    queryFn: async () => {
      const res = await fetch("/api/v1/workspace/settings/closing_tier_names", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to fetch closing tiers setting");
      return res.json();
    },
    enabled: !!token
  });

  // 3. Fetch salespersons for team distribution
  const { data: salespersons, isLoading: isLoadingSalespersons } = useQuery<Salesperson[]>({
    queryKey: ["salespersons"],
    queryFn: async () => {
      const res = await fetch("/api/v1/salespersons", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to fetch representatives");
      return res.json();
    },
    enabled: !!token
  });

  // Initialize state from fetched backend settings
  useEffect(() => {
    if (splitSetting?.value !== undefined) {
      setSplitPctInput(String(splitSetting.value));
    }
  }, [splitSetting]);

  useEffect(() => {
    if (tiersSetting?.value) {
      const raw = String(tiersSetting.value).trim();
      let parsed: string[] = [];
      if (raw.startsWith("[") && raw.endsWith("]")) {
        try {
          parsed = JSON.parse(raw);
        } catch (e) {
          parsed = raw.split(",").map((s) => s.trim()).filter(Boolean);
        }
      } else {
        parsed = raw.split(",").map((s) => s.trim()).filter(Boolean);
      }
      if (parsed.length > 0) {
        setSelectedTiers(parsed);
      }
    }
  }, [tiersSetting]);

  // Mutations to update settings
  const saveSplitMutation = useMutation({
    mutationFn: async (val: string) => {
      const res = await fetch("/api/v1/workspace/settings/default_qualifying_split_pct", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          value: val,
          description: "Default qualifying rep (SDR) commission split % upon opportunity conversion"
        })
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    }
  });

  const saveTiersMutation = useMutation({
    mutationFn: async (tiers: string[]) => {
      const res = await fetch("/api/v1/workspace/settings/closing_tier_names", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          value: tiers.join(", "),
          description: "Comma-separated list of experience tiers and roles designated as Opportunity Closers"
        })
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    }
  });

  const handleSaveAll = async () => {
    try {
      const numVal = parseFloat(splitPctInput);
      if (isNaN(numVal) || numVal < 0 || numVal > 100) {
        setStatusMessage({ type: "error", text: "Qualifying split percentage must be between 0% and 100%." });
        return;
      }

      if (selectedTiers.length === 0) {
        setStatusMessage({ type: "error", text: "Please designate at least one Closing Tier or Role." });
        return;
      }

      await saveSplitMutation.mutateAsync(numVal.toFixed(1));
      await saveTiersMutation.mutateAsync(selectedTiers);

      queryClient.invalidateQueries({ queryKey: ["workspaceSetting"] });
      setStatusMessage({ type: "success", text: "Commission split and closer tier configuration saved successfully!" });
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err: any) {
      setStatusMessage({ type: "error", text: err.message || "Failed to save configuration." });
    }
  };

  const handleResetDefaults = () => {
    setSplitPctInput("20.0");
    setSelectedTiers(["senior_ae", "Senior Sales Representative", "Enterprise AE", "Strategic AE", "Closer"]);
  };

  const toggleTier = (tierId: string) => {
    setSelectedTiers((prev) => {
      const isSelected = prev.some((t) => t.toLowerCase() === tierId.toLowerCase());
      if (isSelected) {
        return prev.filter((t) => t.toLowerCase() !== tierId.toLowerCase());
      } else {
        return [...prev, tierId];
      }
    });
  };

  const handleAddCustomTier = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = customTierInput.trim();
    if (!trimmed) return;
    if (!selectedTiers.some((t) => t.toLowerCase() === trimmed.toLowerCase())) {
      setSelectedTiers((prev) => [...prev, trimmed]);
    }
    setCustomTierInput("");
  };

  // Compute team tier distribution
  const reps = salespersons || [];
  const totalReps = reps.length;

  const normalizedClosingTiers = selectedTiers.map((t) => t.toLowerCase().trim());

  const tierDistribution = React.useMemo(() => {
    const map: Record<string, { count: number; roleCount: number; isCloser: boolean; members: string[] }> = {};

    reps.forEach((r) => {
      const tierKey = r.experienceTier || "Sales Representative";
      const roleKey = r.role || "sales_rep";
      const isCloser =
        normalizedClosingTiers.includes(tierKey.toLowerCase().trim()) ||
        normalizedClosingTiers.includes(roleKey.toLowerCase().trim());

      const groupKey = `${tierKey} (${roleKey})`;
      if (!map[groupKey]) {
        map[groupKey] = { count: 0, roleCount: 0, isCloser, members: [] };
      }
      map[groupKey].count++;
      if (map[groupKey].members.length < 4) {
        map[groupKey].members.push(r.name);
      }
    });

    return Object.entries(map).map(([key, data]) => ({
      name: key,
      count: data.count,
      isCloser: data.isCloser,
      sampleMembers: data.members
    }));
  }, [reps, normalizedClosingTiers]);

  const closerCount = reps.filter((r) => {
    const tier = (r.experienceTier || "").toLowerCase().trim();
    const role = (r.role || "").toLowerCase().trim();
    return normalizedClosingTiers.includes(tier) || normalizedClosingTiers.includes(role);
  }).length;

  const qualifierCount = totalReps - closerCount;

  const splitNum = isNaN(parseFloat(splitPctInput)) ? 20 : Math.min(100, Math.max(0, parseFloat(splitPctInput)));
  const closerSplitNum = 100 - splitNum;

  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 sm:p-8 shadow-sm space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-outline-variant/60 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
              <Percent className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-on-surface">Opportunity Split & Closer Tier Configuration</h3>
              <p className="text-xs text-on-surface-variant">
                Configure two-tier commercial assignments between Qualifying SDRs and Closing AEs, default commission splits, and closing tiers.
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleResetDefaults}
            type="button"
            className="px-3.5 py-2 bg-surface hover:bg-surface-container-high border border-outline-variant rounded-xl text-xs font-semibold text-on-surface-variant flex items-center gap-1.5 transition-all active:scale-95"
            title="Reset split to 20/80 and standard senior AE tiers"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Defaults
          </button>
          <button
            onClick={handleSaveAll}
            disabled={saveSplitMutation.isPending || saveTiersMutation.isPending}
            type="button"
            className="px-5 py-2 bg-primary hover:bg-primary/90 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saveSplitMutation.isPending || saveTiersMutation.isPending ? "Saving..." : "Save Configuration"}
          </button>
        </div>
      </div>

      {statusMessage && (
        <div
          className={`p-4 rounded-xl text-xs font-bold flex items-center gap-2 animate-fade-in ${
            statusMessage.type === "success"
              ? "bg-emerald-50 border border-emerald-300 text-emerald-800"
              : "bg-rose-50 border border-rose-300 text-rose-800"
          }`}
        >
          {statusMessage.type === "success" ? (
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Grid: Split Percentage & Tier Mapping */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Col (5 cols): Default Qualifying Split % */}
        <div className="lg:col-span-5 space-y-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-bold text-on-surface flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-primary" />
                Default Qualifying Rep (SDR) Split %
              </label>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                {splitNum.toFixed(1)}% SDR / {closerSplitNum.toFixed(1)}% AE
              </span>
            </div>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              When a qualified lead is converted into an Opportunity and auto-assigned to a distinct closing AE, this percentage is allocated to the originating qualifying representative. The remainder is allocated to the closing AE.
            </p>
          </div>

          {/* Stepper Input & Range Slider */}
          <div className="p-5 bg-surface rounded-2xl border border-outline-variant space-y-4">
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={splitPctInput}
                  onChange={(e) => setSplitPctInput(e.target.value)}
                  className="w-full bg-surface-container-lowest border border-outline rounded-xl px-4 py-2.5 text-sm font-bold text-on-surface focus:ring-2 focus:ring-primary focus:outline-none"
                  placeholder="20.0"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-on-surface-variant">
                  %
                </span>
              </div>
              <div className="flex gap-1">
                {[15, 20, 25, 30, 35].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setSplitPctInput(preset.toFixed(1))}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      Math.abs(splitNum - preset) < 0.1
                        ? "bg-primary text-white shadow-sm"
                        : "bg-surface-container hover:bg-surface-container-high text-on-surface"
                    }`}
                  >
                    {preset}%
                  </button>
                ))}
              </div>
            </div>

            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={splitNum}
              onChange={(e) => setSplitPctInput(parseFloat(e.target.value).toFixed(1))}
              className="w-full h-2 bg-surface-container rounded-lg appearance-none cursor-pointer accent-primary"
            />

            {/* Split Visualization Bar */}
            <div className="space-y-1.5 pt-2">
              <div className="h-4 w-full rounded-full overflow-hidden flex shadow-inner bg-surface-container">
                <div
                  style={{ width: `${splitNum}%` }}
                  className="bg-gradient-to-r from-indigo-500 to-indigo-600 transition-all duration-300 flex items-center justify-center text-[10px] font-extrabold text-white"
                >
                  {splitNum >= 15 ? `${splitNum.toFixed(0)}%` : ""}
                </div>
                <div
                  style={{ width: `${closerSplitNum}%` }}
                  className="bg-gradient-to-r from-emerald-500 to-emerald-600 transition-all duration-300 flex items-center justify-center text-[10px] font-extrabold text-white"
                >
                  {closerSplitNum >= 15 ? `${closerSplitNum.toFixed(0)}%` : ""}
                </div>
              </div>
              <div className="flex justify-between text-[11px] font-semibold text-on-surface-variant px-1">
                <span className="flex items-center gap-1 text-indigo-700">
                  <span className="w-2 h-2 rounded-full bg-indigo-500" />
                  Qualifying Rep (SDR): <strong>{splitNum.toFixed(1)}%</strong>
                </span>
                <span className="flex items-center gap-1 text-emerald-700">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  Closing AE: <strong>{closerSplitNum.toFixed(1)}%</strong>
                </span>
              </div>
            </div>

            {/* Live Simulation Card */}
            <div className="p-3 bg-surface-container-lowest rounded-xl border border-outline-variant/80 text-xs space-y-1">
              <p className="font-bold text-on-surface flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                Example Commission Credit (₹10,00,000 Opportunity)
              </p>
              <div className="flex justify-between text-[11px] pt-1">
                <span className="text-on-surface-variant">SDR Credit:</span>
                <span className="font-mono font-bold text-indigo-700">₹{((1000000 * splitNum) / 100).toLocaleString("en-IN")}</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-on-surface-variant">Closing AE Credit:</span>
                <span className="font-mono font-bold text-emerald-700">₹{((1000000 * closerSplitNum) / 100).toLocaleString("en-IN")}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Col (7 cols): Tier-to-Role Mapping & Team Distribution */}
        <div className="lg:col-span-7 space-y-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-bold text-on-surface flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-primary" />
                Closing Tier & Role Mapping
              </label>
              <span className="text-xs text-on-surface-variant">
                {selectedTiers.length} designated closer tiers
              </span>
            </div>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Select which representative experience tiers and roles are eligible to receive second-tier Deal assignments as Closing AEs. Reps not in these tiers will qualify leads as SDRs.
            </p>
          </div>

          {/* Tier Selection Chips */}
          <div className="p-5 bg-surface rounded-2xl border border-outline-variant space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {DEFAULT_KNOWN_TIERS.map((tier) => {
                const isSelected = selectedTiers.some((t) => t.toLowerCase() === tier.id.toLowerCase());
                return (
                  <button
                    key={tier.id}
                    type="button"
                    onClick={() => toggleTier(tier.id)}
                    className={`p-3 rounded-xl border text-left transition-all flex items-start justify-between gap-2 ${
                      isSelected
                        ? "bg-emerald-50/70 border-emerald-300 text-emerald-950 shadow-sm"
                        : "bg-surface-container-lowest border-outline-variant hover:border-outline text-on-surface"
                    }`}
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold">{tier.label}</span>
                        <span
                          className={`text-[9px] px-1.5 py-0.2 rounded font-mono uppercase ${
                            tier.type === "role" ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {tier.type}
                        </span>
                      </div>
                      <p className="text-[10px] text-on-surface-variant line-clamp-1">{tier.description}</p>
                    </div>
                    <div
                      className={`w-4 h-4 rounded-md border flex items-center justify-center mt-0.5 shrink-0 transition-colors ${
                        isSelected ? "bg-emerald-600 border-emerald-600 text-white" : "border-outline bg-surface"
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Add Custom Tier / Role */}
            <form onSubmit={handleAddCustomTier} className="flex gap-2 pt-2 border-t border-outline-variant/60">
              <input
                type="text"
                value={customTierInput}
                onChange={(e) => setCustomTierInput(e.target.value)}
                placeholder="Add custom tier/role (e.g. Key Account Executive)..."
                className="flex-1 bg-surface-container-lowest border border-outline rounded-xl px-3.5 py-2 text-xs text-on-surface focus:ring-2 focus:ring-primary focus:outline-none"
              />
              <button
                type="submit"
                disabled={!customTierInput.trim()}
                className="px-3.5 py-2 bg-secondary hover:bg-secondary/90 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50"
              >
                Add Tier
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Team Distribution & Impact Section */}
      <div className="pt-2 border-t border-outline-variant/60 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h4 className="text-sm font-bold text-on-surface flex items-center gap-1.5">
              <Users className="w-4 h-4 text-primary" />
              Current Team Distribution & Closer Eligibility
            </h4>
            <p className="text-xs text-on-surface-variant">
              Live breakdown of representatives across configured tiers.
            </p>
          </div>
          <div className="flex gap-2">
            <span className="px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-bold">
              {closerCount} Closing AEs ({totalReps > 0 ? ((closerCount / totalReps) * 100).toFixed(0) : 0}%)
            </span>
            <span className="px-3 py-1 bg-indigo-50 text-indigo-800 border border-indigo-200 rounded-lg text-xs font-bold">
              {qualifierCount} Qualifying SDRs ({totalReps > 0 ? ((qualifierCount / totalReps) * 100).toFixed(0) : 0}%)
            </span>
          </div>
        </div>

        {/* Tier Distribution Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {tierDistribution.map((item) => (
            <div
              key={item.name}
              className={`p-3.5 rounded-xl border space-y-2 ${
                item.isCloser
                  ? "bg-emerald-50/40 border-emerald-200"
                  : "bg-surface border-outline-variant"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-on-surface">{item.name}</span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                    item.isCloser
                      ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                      : "bg-slate-100 text-slate-700 border border-slate-200"
                  }`}
                >
                  {item.isCloser ? "Closing AE" : "Qualifying Rep"}
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-extrabold text-on-surface">{item.count}</span>
                <span className="text-[11px] text-on-surface-variant">
                  {totalReps > 0 ? ((item.count / totalReps) * 100).toFixed(1) : 0}% of team
                </span>
              </div>
              {item.sampleMembers.length > 0 && (
                <p className="text-[10px] text-on-surface-variant truncate">
                  e.g. {item.sampleMembers.join(", ")}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
