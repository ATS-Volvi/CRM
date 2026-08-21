import { useAuth } from "../../context/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Edit2, Trash2, Check, X, MessageSquare, AlertTriangle, CheckCircle2 } from "lucide-react";
import { MasterDataNav } from "../../components/MasterDataNav";

const CHANNEL_OPTIONS = ["email", "sms", "in_app", "whatsapp"];
const LANGUAGE_OPTIONS = [
  { value: "ar", label: "العربية (Arabic)" },
  { value: "en", label: "English" }
];

const STUB_SID_PATTERN = /^HX_.*_stub$/;

function isStubSid(sid: string | null | undefined): boolean {
  return Boolean(sid && STUB_SID_PATTERN.test(sid));
}

const EMPTY_FORM = {
  name: "",
  channel: "email",
  subject: "",
  body: "",
  triggerEvent: "",
  twilioContentSid: "",
  contentVariables: "",
  language: "ar"
};

export default function MessageTemplates() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<any>(EMPTY_FORM);

  const { data: templates, isLoading } = useQuery<any[]>({
    queryKey: ["messageTemplates"],
    queryFn: async () => {
      const res = await fetch("/api/v1/message-templates", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to fetch message templates");
      return res.json();
    }
  });

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const url = editingId
        ? `/api/v1/message-templates/${editingId}`
        : "/api/v1/message-templates";
      const method = editingId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          ...data,
          twilioContentSid: data.twilioContentSid?.trim() || null,
          contentVariables: data.contentVariables?.trim() || null,
          language: data.language || "ar"
        })
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messageTemplates"] });
      setIsFormOpen(false);
      setEditingId(null);
      setFormData(EMPTY_FORM);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/v1/message-templates/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to delete template");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["messageTemplates"] })
  });

  function openNew() {
    setEditingId(null);
    setFormData(EMPTY_FORM);
    setIsFormOpen(true);
  }

  function openEdit(tmpl: any) {
    setEditingId(tmpl.id);
    setFormData({
      name: tmpl.name ?? "",
      channel: tmpl.channel ?? "email",
      subject: tmpl.subject ?? "",
      body: tmpl.body ?? "",
      triggerEvent: tmpl.triggerEvent ?? "",
      twilioContentSid: tmpl.twilioContentSid ?? "",
      contentVariables: typeof tmpl.contentVariables === "string"
        ? tmpl.contentVariables
        : (tmpl.contentVariables ? JSON.stringify(tmpl.contentVariables) : ""),
      language: tmpl.language ?? "ar"
    });
    setIsFormOpen(true);
  }

  const whatsappTemplates = (templates ?? []).filter((t: any) => t.channel === "whatsapp");
  const otherTemplates = (templates ?? []).filter((t: any) => t.channel !== "whatsapp");

  return (
    <div className="min-h-screen bg-background">
      <MasterDataNav />

      <div className="max-w-5xl mx-auto px-4 pb-16 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-on-surface">Message Templates</h1>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Manage email, SMS, WhatsApp Business, and in-app notification templates.
            </p>
          </div>
          <button
            onClick={openNew}
            className="flex items-center gap-2 px-3.5 py-2 bg-primary text-white rounded-xl text-xs font-bold shadow-sm hover:opacity-90 transition-opacity"
          >
            <Plus className="w-3.5 h-3.5" /> New Template
          </button>
        </div>

        {/* WhatsApp Business Templates — Approval Status Banner */}
        {whatsappTemplates.length > 0 && (
          <div className="border border-emerald-200 bg-emerald-50/50 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-900">
              <MessageSquare className="w-4 h-4 text-emerald-600" />
              WhatsApp Business Templates — Approval Status
            </div>
            {whatsappTemplates.map((tmpl: any) => {
              const isStub = isStubSid(tmpl.twilioContentSid);
              const hasNoSid = !tmpl.twilioContentSid;
              const isApproved = !isStub && !hasNoSid;
              return (
                <div
                  key={tmpl.id}
                  className={`flex items-start gap-3 p-3 rounded-lg border text-xs ${
                    isApproved
                      ? "bg-white border-emerald-200 text-emerald-900"
                      : "bg-amber-50 border-amber-200 text-amber-900"
                  }`}
                >
                  <div className="mt-0.5 shrink-0">
                    {isApproved
                      ? <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      : <AlertTriangle className="w-4 h-4 text-amber-500" />}
                  </div>
                  <div className="flex-1 space-y-0.5">
                    <div className="font-bold">{tmpl.name}</div>
                    <div className="font-mono text-[11px] opacity-75">
                      {isApproved
                        ? `Content SID: ${tmpl.twilioContentSid}`
                        : isStub
                        ? `Stub SID detected (${tmpl.twilioContentSid}) — paste real HX... SID from Twilio to activate`
                        : "No Content SID — template not yet approved or configured"}
                    </div>
                  </div>
                  <button
                    onClick={() => openEdit(tmpl)}
                    className={`shrink-0 px-2.5 py-1 rounded-lg font-bold text-[11px] border ${
                      isApproved
                        ? "border-emerald-300 text-emerald-700 hover:bg-emerald-100"
                        : "border-amber-300 text-amber-800 bg-white hover:bg-amber-100"
                    }`}
                  >
                    {isApproved ? "Edit" : "Add Content SID"}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Template Table */}
        {isLoading ? (
          <div className="text-xs text-on-surface-variant p-6 text-center">Loading templates…</div>
        ) : (
          <div className="border border-outline-variant rounded-2xl overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-surface-container border-b border-outline-variant">
                  <th className="text-left px-4 py-3 font-bold text-on-surface-variant">Name</th>
                  <th className="text-left px-4 py-3 font-bold text-on-surface-variant">Channel</th>
                  <th className="text-left px-4 py-3 font-bold text-on-surface-variant">Language</th>
                  <th className="text-left px-4 py-3 font-bold text-on-surface-variant">Trigger Event</th>
                  <th className="text-left px-4 py-3 font-bold text-on-surface-variant">Content SID</th>
                  <th className="text-left px-4 py-3 font-bold text-on-surface-variant">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {(templates ?? []).map((tmpl: any) => {
                  const isWA = tmpl.channel === "whatsapp";
                  const isStub = isWA && isStubSid(tmpl.twilioContentSid);
                  return (
                    <tr key={tmpl.id} className="hover:bg-surface-container transition-colors">
                      <td className="px-4 py-3 font-semibold text-on-surface max-w-[180px] truncate">
                        {tmpl.name}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          tmpl.channel === "whatsapp" ? "bg-emerald-100 text-emerald-800" :
                          tmpl.channel === "email" ? "bg-blue-100 text-blue-800" :
                          tmpl.channel === "sms" ? "bg-purple-100 text-purple-800" :
                          "bg-slate-100 text-slate-700"
                        }`}>
                          {tmpl.channel}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-on-surface-variant">
                        {tmpl.language ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-on-surface-variant font-mono text-[11px]">
                        {tmpl.triggerEvent ?? "—"}
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] max-w-[160px] truncate text-on-surface-variant">
                        {isWA
                          ? (tmpl.twilioContentSid ?? <span className="text-amber-600">Not set</span>)
                          : "—"}
                      </td>
                      <td className="px-4 py-3">
                        {isWA ? (
                          isStub ? (
                            <span className="flex items-center gap-1 text-amber-600 font-bold text-[10px]">
                              <AlertTriangle className="w-3 h-3" /> Stub
                            </span>
                          ) : tmpl.twilioContentSid ? (
                            <span className="flex items-center gap-1 text-emerald-700 font-bold text-[10px]">
                              <CheckCircle2 className="w-3 h-3" /> Live
                            </span>
                          ) : (
                            <span className="text-amber-600 font-bold text-[10px]">Pending SID</span>
                          )
                        ) : (
                          <span className="text-slate-400 text-[10px]">N/A</span>
                        )}
                      </td>
                      <td className="px-4 py-3 flex items-center gap-2 justify-end">
                        <button
                          onClick={() => openEdit(tmpl)}
                          className="p-1.5 rounded-lg hover:bg-surface-container text-on-surface-variant hover:text-on-surface transition-colors"
                          title="Edit template"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Delete template "${tmpl.name}"?`)) {
                              deleteMutation.mutate(tmpl.id);
                            }
                          }}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-on-surface-variant hover:text-red-600 transition-colors"
                          title="Delete template"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {(templates ?? []).length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-on-surface-variant text-xs">
                      No templates found. Create one to get started.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 w-full max-w-lg space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-outline-variant pb-3">
              <h2 className="font-bold text-on-surface">
                {editingId ? "Edit Template" : "New Template"}
              </h2>
              <button onClick={() => { setIsFormOpen(false); setEditingId(null); }}>
                <X className="w-4 h-4 text-on-surface-variant" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              {/* Name */}
              <div>
                <label className="block font-bold text-on-surface-variant mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData((p: any) => ({ ...p, name: e.target.value }))}
                  className="w-full bg-surface border border-outline rounded-lg p-2 text-xs"
                  placeholder="e.g. WhatsApp Call Summary (Arabic)"
                />
              </div>

              {/* Channel + Language row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-on-surface-variant mb-1">Channel</label>
                  <select
                    value={formData.channel}
                    onChange={e => setFormData((p: any) => ({ ...p, channel: e.target.value }))}
                    className="w-full bg-surface border border-outline rounded-lg p-2 text-xs"
                  >
                    {CHANNEL_OPTIONS.map(ch => (
                      <option key={ch} value={ch}>{ch}</option>
                    ))}
                  </select>
                </div>
                {(formData.channel === "whatsapp" || formData.language) && (
                  <div>
                    <label className="block font-bold text-on-surface-variant mb-1">Language</label>
                    <select
                      value={formData.language}
                      onChange={e => setFormData((p: any) => ({ ...p, language: e.target.value }))}
                      className="w-full bg-surface border border-outline rounded-lg p-2 text-xs"
                    >
                      {LANGUAGE_OPTIONS.map(l => (
                        <option key={l.value} value={l.value}>{l.label}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Subject (email / sms only) */}
              {formData.channel !== "whatsapp" && (
                <div>
                  <label className="block font-bold text-on-surface-variant mb-1">Subject</label>
                  <input
                    type="text"
                    value={formData.subject}
                    onChange={e => setFormData((p: any) => ({ ...p, subject: e.target.value }))}
                    className="w-full bg-surface border border-outline rounded-lg p-2 text-xs"
                    placeholder="Email subject line"
                  />
                </div>
              )}

              {/* Body */}
              <div>
                <label className="block font-bold text-on-surface-variant mb-1">
                  Body / Template Text <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={4}
                  value={formData.body}
                  onChange={e => setFormData((p: any) => ({ ...p, body: e.target.value }))}
                  className="w-full bg-surface border border-outline rounded-lg p-2 text-xs font-mono"
                  placeholder={
                    formData.channel === "whatsapp"
                      ? "مرحباً {{1}}، شكراً لوقتك في المكالمة…"
                      : "Hello {{lead_name}},\n\nYour message here…"
                  }
                />
              </div>

              {/* Trigger Event */}
              <div>
                <label className="block font-bold text-on-surface-variant mb-1">Trigger Event</label>
                <input
                  type="text"
                  value={formData.triggerEvent}
                  onChange={e => setFormData((p: any) => ({ ...p, triggerEvent: e.target.value }))}
                  className="w-full bg-surface border border-outline rounded-lg p-2 text-xs font-mono"
                  placeholder="e.g. call_summary_ar, deal_won"
                />
              </div>

              {/* WhatsApp-specific fields */}
              {formData.channel === "whatsapp" && (
                <>
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1 text-[11px] text-emerald-900">
                    <div className="font-bold flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5" />
                      WhatsApp Business — Content API fields
                    </div>
                    <p className="opacity-80">
                      Paste the approved <strong>HX…</strong> Content SID from your Twilio console after Meta approves the template.
                    </p>
                  </div>

                  <div>
                    <label className="block font-bold text-on-surface-variant mb-1">
                      Twilio Content SID
                    </label>
                    <input
                      type="text"
                      value={formData.twilioContentSid}
                      onChange={e => setFormData((p: any) => ({ ...p, twilioContentSid: e.target.value }))}
                      className={`w-full bg-surface border rounded-lg p-2 text-xs font-mono ${
                        isStubSid(formData.twilioContentSid)
                          ? "border-amber-400 bg-amber-50"
                          : "border-outline"
                      }`}
                      placeholder="HXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    />
                    {isStubSid(formData.twilioContentSid) && (
                      <p className="text-[10px] text-amber-700 font-semibold mt-1 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        This is a stub SID — replace with real HX… value from Twilio to activate.
                      </p>
                    )}
                    {formData.twilioContentSid && !isStubSid(formData.twilioContentSid) && (
                      <p className="text-[10px] text-emerald-700 font-semibold mt-1 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Looks good.
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block font-bold text-on-surface-variant mb-1">
                      Content Variables (JSON)
                    </label>
                    <textarea
                      rows={2}
                      value={formData.contentVariables}
                      onChange={e => setFormData((p: any) => ({ ...p, contentVariables: e.target.value }))}
                      className="w-full bg-surface border border-outline rounded-lg p-2 text-xs font-mono"
                      placeholder='{"1":"leadName","2":"callNotes","3":"nextSteps"}'
                    />
                    <p className="text-[10px] text-on-surface-variant mt-0.5">
                      Maps <code>{"{{1}}"}</code>, <code>{"{{2}}"}</code>, <code>{"{{3}}"}</code> variable positions to field names.
                    </p>
                  </div>
                </>
              )}

              {/* Save / Cancel */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => { setIsFormOpen(false); setEditingId(null); }}
                  className="px-4 py-2 border border-outline rounded-lg text-xs font-bold text-on-surface-variant hover:bg-surface-container"
                >
                  Cancel
                </button>
                <button
                  onClick={() => saveMutation.mutate(formData)}
                  disabled={!formData.name.trim() || !formData.body.trim() || saveMutation.isPending}
                  className="px-4 py-2 bg-primary text-white rounded-lg text-xs font-bold shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Check className="w-3.5 h-3.5" />
                  {saveMutation.isPending ? "Saving…" : "Save Template"}
                </button>
              </div>

              {saveMutation.isError && (
                <p className="text-[11px] text-red-600 font-semibold">
                  Error: {(saveMutation.error as any)?.message}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
