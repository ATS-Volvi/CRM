import React, { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CheckCircle2,
  AlertTriangle,
  Clock,
  RefreshCw,
  ExternalLink,
  Search,
  MessageSquare,
  Plus,
  Trash2,
  Info,
  Check,
  Code
} from "lucide-react";
import { WhatsAppTemplate } from "../types";
import { campaignsApi } from "../api/marketing";
import {
  suggestDefaultVariableValue,
  buildPreviewSegments,
  DEFAULT_SAMPLE_LEAD
} from "../utils/whatsappTemplateHelpers";

export interface WhatsAppTemplatePickerProps {
  campaignId: string;
  campaignName: string;
  templateSid: string;
  onTemplateSidChange: (sid: string) => void;
  variables: Array<{ key: string; value: string }>;
  onVariablesChange: (variables: Array<{ key: string; value: string }>) => void;
  useCustomerNames: boolean;
}

const PLACEHOLDER_OPTIONS = [
  { label: "Customer's first name ({{firstName}})", value: "{{firstName}}" },
  { label: "Customer's last name ({{lastName}})", value: "{{lastName}}" },
  { label: "Company name ({{company}})", value: "{{company}}" },
  { label: "Campaign name ({{campaignName}})", value: "{{campaignName}}" },
  { label: "Type my own text…", value: "__custom__" }
];

export const WhatsAppTemplatePicker: React.FC<WhatsAppTemplatePickerProps> = ({
  campaignId,
  campaignName,
  templateSid,
  onTemplateSidChange,
  variables,
  onVariablesChange,
  useCustomerNames
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [isManualMode, setIsManualMode] = useState(false);
  const [hasEvaluatedInitialMode, setHasEvaluatedInitialMode] = useState(false);

  // Fetch Twilio Content Templates
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isFetching
  } = useQuery({
    queryKey: ["campaignWhatsAppTemplates", campaignId],
    queryFn: () => campaignsApi.getWhatsAppTemplates(campaignId, false),
    staleTime: 60_000,
    retry: 1
  });

  const templates = useMemo(() => data?.templates || [], [data?.templates]);

  // Find currently selected template from list
  const selectedTemplate = useMemo(() => {
    if (!templateSid) return null;
    return templates.find((t) => t.sid === templateSid) || null;
  }, [templateSid, templates]);

  // Automatic fallback evaluation when data loads or on error
  useEffect(() => {
    if (hasEvaluatedInitialMode) return;

    if (isError) {
      setIsManualMode(true);
      setHasEvaluatedInitialMode(true);
      return;
    }

    if (data && !isLoading) {
      // If editing an existing message with a SID not present in fetched templates, open manual fallback
      if (templateSid && !templates.some((t) => t.sid === templateSid)) {
        setIsManualMode(true);
      }
      setHasEvaluatedInitialMode(true);
    }
  }, [data, isLoading, isError, templateSid, templates, hasEvaluatedInitialMode]);

  // Handle template selection
  const handleSelectTemplate = (template: WhatsAppTemplate) => {
    if (template.approvalStatus === "disabled") return;

    onTemplateSidChange(template.sid);

    // Auto-create blanks with sensible suggested defaults
    const newVars: Array<{ key: string; value: string }> = template.variables.map((vKey) => {
      // If the user already provided a value for this key, keep it
      const existing = variables.find((v) => v.key === vKey);
      if (existing && existing.value) {
        return { key: vKey, value: existing.value };
      }

      // Suggest default
      const suggested = suggestDefaultVariableValue(
        vKey,
        template.body,
        template.sampleValues?.[vKey]
      );
      return { key: vKey, value: suggested || "{{firstName}}" };
    });

    onVariablesChange(newVars.length > 0 ? newVars : [{ key: "1", value: "{{firstName}}" }]);
  };

  // Update a single blank variable
  const handleVariableValueChange = (vKey: string, newValue: string) => {
    const updated = [...variables];
    const idx = updated.findIndex((v) => v.key === vKey);
    if (idx >= 0) {
      updated[idx] = { ...updated[idx], value: newValue };
    } else {
      updated.push({ key: vKey, value: newValue });
    }
    onVariablesChange(updated);
  };

  // Filter templates by search
  const filteredTemplates = useMemo(() => {
    if (!searchQuery.trim()) return templates;
    const q = searchQuery.toLowerCase().trim();
    return templates.filter((t) => {
      return (
        t.friendlyName.toLowerCase().includes(q) ||
        t.body.toLowerCase().includes(q) ||
        (t.category && t.category.toLowerCase().includes(q)) ||
        t.language.toLowerCase().includes(q) ||
        t.sid.toLowerCase().includes(q)
      );
    });
  }, [templates, searchQuery]);

  // Sample lead data for preview bubble
  const sampleLead = useMemo(
    () => ({
      ...DEFAULT_SAMPLE_LEAD,
      campaignName: campaignName || "Special Promotion"
    }),
    [campaignName]
  );

  // Live preview segments
  const previewSegments = useMemo(() => {
    if (!selectedTemplate) return [];
    return buildPreviewSegments(selectedTemplate.body, variables, useCustomerNames, sampleLead);
  }, [selectedTemplate, variables, useCustomerNames, sampleLead]);

  return (
    <div className="space-y-4">
      {/* Simulation / Demo Notice Banner */}
      {data?.simulated && !isManualMode && (
        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-xs">
          <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-bold block">Demo Mode (Twilio credentials not configured in environment)</span>
            <span className="text-[11px] text-amber-700 dark:text-amber-300">
              Showing pre-configured sample templates. You can test template selection, auto-suggested blanks, and live WhatsApp preview.
            </span>
          </div>
        </div>
      )}

      {/* Header controls bar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <label className="font-bold text-slate-800 dark:text-slate-200 text-sm block">
            {isManualMode ? "Manual Twilio Template Configuration" : "Twilio WhatsApp Content Template"}
          </label>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            {isManualMode
              ? "Enter your Content Template SID and variable mappings manually."
              : "Pick an approved WhatsApp template from your Twilio Console."}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {!isManualMode && (
            <>
              <button
                type="button"
                onClick={() => refetch()}
                disabled={isFetching}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors cursor-pointer disabled:opacity-50"
                title="Force refresh templates from Twilio"
              >
                <RefreshCw className={`w-3 h-3 ${isFetching ? "animate-spin text-blue-600" : ""}`} />
                <span>Refresh</span>
              </button>

              <a
                href="https://console.twilio.com/us1/develop/sms/content-template-builder"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors"
              >
                <span>Create in Twilio</span>
                <ExternalLink className="w-3 h-3 text-slate-400" />
              </a>
            </>
          )}

          {/* Toggle manual vs picker */}
          <button
            type="button"
            onClick={() => setIsManualMode((prev) => !prev)}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
          >
            {isManualMode ? (
              <>
                <MessageSquare className="w-3 h-3" />
                <span>Switch to Template Picker</span>
              </>
            ) : (
              <>
                <Code className="w-3 h-3" />
                <span>Advanced: Enter SID manually</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ─── MANUAL FALLBACK MODE ────────────────────────────────────────────── */}
      {isManualMode ? (
        <div className="space-y-3.5 p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/40">
          {isError && (
            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">Could not load templates from Twilio</span>
                <span className="text-[11px] text-rose-700 dark:text-rose-300">
                  {(error as any)?.message || "You can enter your Content Template SID manually below."}
                </span>
              </div>
            </div>
          )}

          <div className="space-y-1">
            <label className="font-bold text-slate-700 dark:text-slate-300 text-xs">
              Twilio Content Template SID *
            </label>
            <input
              type="text"
              value={templateSid}
              onChange={(e) => onTemplateSidChange(e.target.value.trim())}
              placeholder="e.g. HXb5b6284949743428bdced15205d49610"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-xs"
            />
            <span className="text-[11px] text-slate-400 block">
              Enter the HX Content Template SID from your Twilio Console.
            </span>
          </div>

          {/* Key -> Value variable mapper */}
          <div className="space-y-2 p-3 bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-700 dark:text-slate-300 text-xs">
                Template Variables (Key → Value Mapping)
              </span>
              <button
                type="button"
                onClick={() =>
                  onVariablesChange([...variables, { key: String(variables.length + 1), value: "" }])
                }
                className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 font-bold flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Variable</span>
              </button>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] text-slate-500">Insert tag into value:</span>
              {["{{firstName}}", "{{lastName}}", "{{company}}", "{{campaignName}}"].map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => {
                    const lastIdx = variables.length - 1;
                    if (lastIdx >= 0) {
                      const updated = [...variables];
                      updated[lastIdx].value = updated[lastIdx].value
                        ? `${updated[lastIdx].value} ${tag}`
                        : tag;
                      onVariablesChange(updated);
                    } else {
                      onVariablesChange([{ key: "1", value: tag }]);
                    }
                  }}
                  className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 font-mono text-[10px] text-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  {tag}
                </button>
              ))}
            </div>

            {variables.map((v, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  type="text"
                  value={v.key}
                  onChange={(e) => {
                    const updated = [...variables];
                    updated[idx].key = e.target.value;
                    onVariablesChange(updated);
                  }}
                  placeholder="Key (e.g. 1)"
                  className="w-24 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs bg-white dark:bg-slate-800 font-mono"
                />
                <input
                  type="text"
                  value={v.value}
                  onChange={(e) => {
                    const updated = [...variables];
                    updated[idx].value = e.target.value;
                    onVariablesChange(updated);
                  }}
                  placeholder="Value or placeholder (e.g. {{firstName}})"
                  maxLength={1024}
                  className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs bg-white dark:bg-slate-800 font-mono"
                />
                {variables.length > 1 && (
                  <button
                    type="button"
                    onClick={() => onVariablesChange(variables.filter((_, i) => i !== idx))}
                    className="p-1 text-slate-400 hover:text-rose-500 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
            <span className="text-[10px] text-slate-400 block">
              Twilio Content variables are trimmed and capped at 1,024 characters each.
            </span>
          </div>
        </div>
      ) : (
        /* ─── STEP 1: CHOOSE YOUR WHATSAPP TEMPLATE ────────────────────────── */
        <div className="space-y-4">
          {/* Search bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search templates by name, body content, or category..."
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Loading state */}
          {isLoading && (
            <div className="p-8 text-center border border-dashed border-slate-200 dark:border-slate-700 rounded-xl space-y-2">
              <RefreshCw className="w-5 h-5 text-blue-600 animate-spin mx-auto" />
              <span className="text-xs text-slate-500 block font-medium">
                Fetching Twilio WhatsApp templates...
              </span>
            </div>
          )}

          {/* Empty state */}
          {!isLoading && filteredTemplates.length === 0 && (
            <div className="p-8 text-center border border-dashed border-slate-200 dark:border-slate-700 rounded-xl space-y-2">
              <MessageSquare className="w-6 h-6 text-slate-400 mx-auto" />
              <span className="text-xs text-slate-600 dark:text-slate-400 font-bold block">
                {searchQuery ? "No templates match your search" : "No WhatsApp Content Templates found"}
              </span>
              <span className="text-[11px] text-slate-500 block max-w-sm mx-auto">
                Create and submit a template in the Twilio Console, or click "Advanced" to enter a template SID manually.
              </span>
            </div>
          )}

          {/* Template cards grid */}
          {!isLoading && filteredTemplates.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-72 overflow-y-auto pr-1">
              {filteredTemplates.map((template) => {
                const isSelected = selectedTemplate?.sid === template.sid;
                const isApproved = template.approvalStatus === "approved";

                return (
                  <div
                    key={template.sid}
                    onClick={() => handleSelectTemplate(template)}
                    className={`relative p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? "border-blue-600 dark:border-blue-500 bg-blue-50/50 dark:bg-blue-900/20 ring-2 ring-blue-500/30"
                        : "border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800/80 hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-sm"
                    }`}
                  >
                    {/* Card Header */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-slate-900 dark:text-white text-xs truncate">
                            {template.friendlyName}
                          </span>
                          {template.category && (
                            <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold uppercase bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                              {template.category}
                            </span>
                          )}
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-mono uppercase bg-slate-100 dark:bg-slate-800 text-slate-500">
                            {template.language}
                          </span>
                        </div>
                      </div>

                      {/* Approval Status Badge */}
                      <div className="shrink-0">
                        {isApproved ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Approved</span>
                          </span>
                        ) : template.approvalStatus === "unsubmitted" ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Ready</span>
                          </span>
                        ) : template.approvalStatus === "pending" || template.approvalStatus === "received" ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300">
                            <Clock className="w-3 h-3" />
                            <span>Pending Review</span>
                          </span>
                        ) : (
                          <span
                            title={template.rejectionReason || "Template rejected by WhatsApp"}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300"
                          >
                            <AlertTriangle className="w-3 h-3" />
                            <span>{template.approvalStatus}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Body snippet preview */}
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-3 mb-2.5 font-normal leading-relaxed">
                      {template.body || "No body text preview"}
                    </p>

                    {/* Card Footer */}
                    <div className="flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                      <span>
                        {template.variables.length > 0
                          ? `${template.variables.length} ${template.variables.length === 1 ? "blank" : "blanks"} ({{${template.variables.join("}}, {{")}}})`
                          : "No blanks"}
                      </span>

                      {isSelected ? (
                        <span className="inline-flex items-center gap-0.5 text-blue-600 dark:text-blue-400 font-bold">
                          <Check className="w-3 h-3" /> Selected
                        </span>
                      ) : (
                        <span className="text-blue-600 dark:text-blue-400 font-semibold opacity-0 group-hover:opacity-100">
                          Click to select →
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ─── STEP 2: FILL IN THE BLANKS ─────────────────────────────────── */}
          {selectedTemplate && (
            <div className="space-y-4 pt-3 border-t border-slate-200 dark:border-slate-800">
              {/* Auto-linked Content SID Notification Banner */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-blue-50/90 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-xs text-blue-900 dark:text-blue-200">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                  <span>
                    Template <strong>{selectedTemplate.friendlyName}</strong> selected. Content SID <code className="px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900 font-mono text-[11px] font-bold text-blue-800 dark:text-blue-200">{selectedTemplate.sid}</code> is automatically linked.
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-800 dark:text-slate-200 text-xs">
                    Step 2: Fill in the Blanks ({selectedTemplate.variables.length})
                  </h4>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Map each placeholder in "{selectedTemplate.friendlyName}" to lead properties or custom text.
                  </span>
                </div>
              </div>

              {selectedTemplate.variables.length === 0 ? (
                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl text-xs text-slate-500">
                  This template does not require any dynamic variables.
                </div>
              ) : (
                <div className="space-y-2.5 p-3.5 bg-slate-50/80 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
                  {selectedTemplate.variables.map((vKey) => {
                    const currentVal = variables.find((v) => v.key === vKey)?.value || "";
                    const isKnownTag = [
                      "{{firstName}}",
                      "{{lastName}}",
                      "{{company}}",
                      "{{campaignName}}"
                    ].includes(currentVal);
                    const dropdownSelection = isKnownTag ? currentVal : currentVal ? "__custom__" : "{{firstName}}";
                    const sampleHint = selectedTemplate.sampleValues?.[vKey];

                    return (
                      <div
                        key={vKey}
                        className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700/80 space-y-2"
                      >
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300">
                              {`{{${vKey}}}`}
                            </span>
                            {sampleHint && (
                              <span className="text-[11px] text-slate-400">
                                Twilio sample: <span className="font-mono text-slate-600 dark:text-slate-300">"{sampleHint}"</span>
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Dropdown for placeholder option */}
                        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                          <select
                            value={dropdownSelection}
                            onChange={(e) => {
                              const sel = e.target.value;
                              if (sel === "__custom__") {
                                handleVariableValueChange(vKey, currentVal && !isKnownTag ? currentVal : "");
                              } else {
                                handleVariableValueChange(vKey, sel);
                              }
                            }}
                            className="w-full sm:w-72 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-blue-500"
                          >
                            {PLACEHOLDER_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>

                          {/* Custom Text input if selected */}
                          {dropdownSelection === "__custom__" && (
                            <input
                              type="text"
                              value={currentVal}
                              onChange={(e) => handleVariableValueChange(vKey, e.target.value)}
                              placeholder="Enter custom text..."
                              maxLength={1024}
                              className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* Clarification Notice */}
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 pt-1 space-y-0.5">
                    <span>
                      • Note: Empty blanks default to "Customer".
                    </span>
                    {!useCustomerNames && (
                      <span className="block text-amber-600 dark:text-amber-400 font-medium">
                        • Workspace setting "Use customer names in campaigns" is OFF: name placeholders will deliver as "Customer".
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* ─── LIVE WHATSAPP-STYLE PREVIEW BUBBLE ──────────────────────── */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700 dark:text-slate-300 text-xs flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Live WhatsApp Preview (Sample Lead: {sampleLead.firstName} at {sampleLead.company})</span>
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex justify-start">
                  <div className="max-w-md w-full p-3.5 rounded-2xl rounded-tl-sm bg-[#d9fdd3] dark:bg-[#005c4b] text-slate-800 dark:text-emerald-50 shadow-sm border border-emerald-300/40 dark:border-emerald-700/50 relative space-y-2">
                    <p className="text-xs leading-relaxed whitespace-pre-wrap font-sans">
                      {previewSegments.map((segment, sIdx) => {
                        if (segment.isHighlight) {
                          return (
                            <mark
                              key={sIdx}
                              title={`Substituted for {{${segment.varKey}}}`}
                              className="px-1 py-0.2 mx-0.5 rounded font-semibold bg-emerald-200/90 dark:bg-emerald-600/80 text-emerald-950 dark:text-white inline-block shadow-xs"
                            >
                              {segment.text}
                            </mark>
                          );
                        }
                        return <span key={sIdx}>{segment.text}</span>;
                      })}
                    </p>

                    <div className="flex items-center justify-end gap-1 text-[10px] text-slate-500 dark:text-emerald-200/70 pt-1">
                      <span>12:45 PM</span>
                      <span className="text-blue-500 dark:text-emerald-300 font-bold">✓✓</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
