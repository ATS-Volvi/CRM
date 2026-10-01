import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Mail,
  Send,
  Plus,
  Edit2,
  Trash2,
  Users,
  Eye,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Sparkles,
  Search,
  Filter,
  RefreshCw,
  X,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Ban,
  Info
} from "lucide-react";
import { campaignsApi } from "../api/marketing";
import {
  CampaignMessage,
  CampaignRecipient,
  CampaignAudienceFilter,
  AudiencePreviewResponse,
  CampaignMessageConfig
} from "../types/marketing";
import { useAuth } from "../context/AuthContext";
import { localDateTimeToUtcIso, utcIsoToLocalDisplay } from "../utils/campaignDateHelper";

interface CampaignMessagesTabProps {
  campaignId: string;
  campaignName: string;
}

const AVAILABLE_STATUSES = [
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "IN_NEGOTIATION",
  "WON",
  "CONVERTED",
  "CLOSED_LOST"
];

const PLACEHOLDERS = [
  { tag: "{{firstName}}", label: "First Name" },
  { tag: "{{lastName}}", label: "Last Name" },
  { tag: "{{company}}", label: "Company" },
  { tag: "{{campaignName}}", label: "Campaign Name" }
];

export function CampaignMessagesTab({ campaignId, campaignName }: CampaignMessagesTabProps) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userRole = (user?.role || "").toLowerCase();
  const canManage = ["admin", "director", "manager", "sales_manager"].includes(userRole);

  // Modals / Drawers state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMessage, setEditingMessage] = useState<CampaignMessage | null>(null);

  const [isPreviewDrawerOpen, setIsPreviewDrawerOpen] = useState(false);
  const [previewMessage, setPreviewMessage] = useState<CampaignMessage | null>(null);

  const [isRecipientsDrawerOpen, setIsRecipientsDrawerOpen] = useState(false);
  const [selectedMessageForRecipients, setSelectedMessageForRecipients] = useState<CampaignMessage | null>(null);
  const [recipientsPage, setRecipientsPage] = useState(1);
  const [recipientStatusFilter, setRecipientStatusFilter] = useState<string>("ALL");

  const [isSendConfirmOpen, setIsSendConfirmOpen] = useState(false);
  const [messageToSend, setMessageToSend] = useState<CampaignMessage | null>(null);
  const [confirmInput, setConfirmInput] = useState("");
  const [isScheduling, setIsScheduling] = useState(false);
  const [scheduleDateTime, setScheduleDateTime] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);

  const [messageToDelete, setMessageToDelete] = useState<CampaignMessage | null>(null);

  // Form State for Create/Edit Modal
  const [formName, setFormName] = useState("");
  const [formSubject, setFormSubject] = useState("");
  const [formBodyHtml, setFormBodyHtml] = useState("");
  const [formStatuses, setFormStatuses] = useState<string[]>([]);
  const [formMinScore, setFormMinScore] = useState<string>("");
  const [formMaxScore, setFormMaxScore] = useState<string>("");
  const [formIndustry, setFormIndustry] = useState<string>("");
  const [formCountry, setFormCountry] = useState<string>("");
  const [formError, setFormError] = useState<string | null>(null);

  // Modal live preview state
  const [modalAudiencePreview, setModalAudiencePreview] = useState<AudiencePreviewResponse | null>(null);
  const [isModalPreviewLoading, setIsModalPreviewLoading] = useState(false);

  // Query: Safety config
  const { data: config } = useQuery<CampaignMessageConfig>({
    queryKey: ["campaign-message-config", campaignId],
    queryFn: () => campaignsApi.getCampaignMessageConfig(campaignId),
    staleTime: 60000
  });

  // Query: Messages list with auto-polling when SENDING
  const {
    data: messages = [],
    isLoading: isMessagesLoading,
    refetch: refetchMessages
  } = useQuery<CampaignMessage[]>({
    queryKey: ["campaign-messages", campaignId],
    queryFn: () => campaignsApi.getCampaignMessages(campaignId),
    refetchInterval: (query) => {
      const msgs = query.state.data;
      if (Array.isArray(msgs) && msgs.some((m) => m.status === "SENDING")) {
        return 5000;
      }
      return false;
    }
  });

  // Query: Drawer Recipients
  const {
    data: recipientsData,
    isLoading: isRecipientsLoading,
    refetch: refetchRecipients
  } = useQuery({
    queryKey: [
      "campaign-message-recipients",
      campaignId,
      selectedMessageForRecipients?.id,
      recipientsPage,
      recipientStatusFilter
    ],
    queryFn: () =>
      selectedMessageForRecipients
        ? campaignsApi.getCampaignMessageRecipients(campaignId, selectedMessageForRecipients.id, {
            page: recipientsPage,
            limit: 20,
            status: recipientStatusFilter
          })
        : null,
    enabled: Boolean(selectedMessageForRecipients)
  });

  // Query: Drawer Audience Preview
  const {
    data: drawerPreviewData,
    isLoading: isDrawerPreviewLoading,
    refetch: refetchDrawerPreview
  } = useQuery<AudiencePreviewResponse>({
    queryKey: ["campaign-message-preview", campaignId, previewMessage?.id],
    queryFn: () => (previewMessage ? campaignsApi.previewAudience(campaignId, previewMessage.id) : null as any),
    enabled: Boolean(previewMessage)
  });

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingMessage(null);
    setFormName("");
    setFormSubject("");
    setFormBodyHtml(
      `<p>Hi {{firstName}},</p>\n<p>We're excited to reach out regarding our latest offerings for {{company}}.</p>\n<p>Let us know if you have a few minutes for a quick chat.</p>\n<p>Best regards,<br/>The Team</p>`
    );
    setFormStatuses(["NEW", "CONTACTED", "QUALIFIED"]);
    setFormMinScore("");
    setFormMaxScore("");
    setFormIndustry("");
    setFormCountry("");
    setFormError(null);
    setModalAudiencePreview(null);
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (msg: CampaignMessage) => {
    setEditingMessage(msg);
    setFormName(msg.name);
    setFormSubject(msg.subject);
    setFormBodyHtml(msg.bodyHtml);

    let parsedFilter: CampaignAudienceFilter = {};
    if (msg.audienceFilter) {
      try {
        parsedFilter = JSON.parse(msg.audienceFilter);
      } catch {}
    }

    setFormStatuses(parsedFilter.leadStatus || []);
    setFormMinScore(parsedFilter.minScore !== undefined ? String(parsedFilter.minScore) : "");
    setFormMaxScore(parsedFilter.maxScore !== undefined ? String(parsedFilter.maxScore) : "");
    setFormIndustry(typeof parsedFilter.industry === "string" ? parsedFilter.industry : (parsedFilter.industry || []).join(", "));
    setFormCountry(typeof parsedFilter.country === "string" ? parsedFilter.country : (parsedFilter.country || []).join(", "));
    setFormError(null);
    setModalAudiencePreview(null);
    setIsModalOpen(true);
  };

  // Insert placeholder tag into form body
  const handleInsertTag = (tag: string) => {
    setFormBodyHtml((prev) => prev + " " + tag);
  };

  // Run live audience preview in modal
  const handleRunModalPreview = async () => {
    setIsModalPreviewLoading(true);
    setFormError(null);
    try {
      const filterObj: CampaignAudienceFilter = {
        leadStatus: formStatuses.length > 0 ? formStatuses : undefined,
        minScore: formMinScore ? Number(formMinScore) : undefined,
        maxScore: formMaxScore ? Number(formMaxScore) : undefined,
        industry: formIndustry ? formIndustry.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
        country: formCountry ? formCountry.split(",").map((s) => s.trim()).filter(Boolean) : undefined
      };

      const res = await campaignsApi.previewAudience(campaignId, editingMessage?.id, filterObj);
      setModalAudiencePreview(res);
    } catch (err: any) {
      setFormError(err.message || "Failed to preview audience");
    } finally {
      setIsModalPreviewLoading(false);
    }
  };

  // Save Message Mutation (Create / Update)
  const saveMutation = useMutation({
    mutationFn: async () => {
      const filterObj: CampaignAudienceFilter = {
        leadStatus: formStatuses.length > 0 ? formStatuses : undefined,
        minScore: formMinScore ? Number(formMinScore) : undefined,
        maxScore: formMaxScore ? Number(formMaxScore) : undefined,
        industry: formIndustry ? formIndustry.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
        country: formCountry ? formCountry.split(",").map((s) => s.trim()).filter(Boolean) : undefined
      };

      const payload = {
        name: formName,
        subject: formSubject,
        bodyHtml: formBodyHtml,
        audienceFilter: JSON.stringify(filterObj)
      };

      if (editingMessage) {
        return campaignsApi.updateCampaignMessage(campaignId, editingMessage.id, payload);
      } else {
        return campaignsApi.createCampaignMessage(campaignId, payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaign-messages", campaignId] });
      setIsModalOpen(false);
    },
    onError: (err: any) => {
      setFormError(err.message || "Failed to save campaign message");
    }
  });

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: (msgId: string) => campaignsApi.deleteCampaignMessage(campaignId, msgId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaign-messages", campaignId] });
      setMessageToDelete(null);
    }
  });

  // Cancel Mutation
  const cancelMutation = useMutation({
    mutationFn: (msgId: string) => campaignsApi.cancelCampaignMessage(campaignId, msgId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaign-messages", campaignId] });
    }
  });

  // Send Mutation
  const sendMutation = useMutation({
    mutationFn: async (msgId: string) => {
      return campaignsApi.sendCampaignMessage(
        campaignId,
        msgId,
        true,
        isScheduling && scheduleDateTime ? localDateTimeToUtcIso(scheduleDateTime) : undefined
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaign-messages", campaignId] });
      setIsSendConfirmOpen(false);
      setMessageToSend(null);
      setConfirmInput("");
      setIsScheduling(false);
      setScheduleDateTime("");
      setSendError(null);
    },
    onError: (err: any) => {
      setSendError(err.message || "Failed to initiate sending");
    }
  });

  // Unschedule Mutation
  const unscheduleMutation = useMutation({
    mutationFn: (msgId: string) => campaignsApi.unscheduleCampaignMessage(campaignId, msgId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaign-messages", campaignId] });
    },
    onError: (err: any) => {
      alert(err.message || "Failed to unschedule message");
    }
  });

  // Resume Send Mutation
  const resumeMutation = useMutation({
    mutationFn: async (msgId: string) => {
      return campaignsApi.resumeCampaignMessage(campaignId, msgId, true);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaign-messages", campaignId] });
    },
    onError: (err: any) => {
      alert(err.message || "Failed to resume message send");
    }
  });


  const getStatusBadge = (status: string) => {
    switch (status) {
      case "SENDING":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 animate-pulse">
            <RefreshCw className="w-3 h-3 animate-spin" />
            Sending...
          </span>
        );
      case "SENT":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="w-3 h-3" />
            Sent
          </span>
        );
      case "PARTIAL":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            <AlertTriangle className="w-3 h-3" />
            Partially Sent
          </span>
        );
      case "CANCELLED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
            <Ban className="w-3 h-3" />
            Cancelled
          </span>
        );
      case "SCHEDULED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
            <Clock className="w-3 h-3" />
            Scheduled
          </span>
        );
      case "DRAFT":
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            Draft
          </span>
        );
    }
  };

  const getRecipientStatusBadge = (status: string) => {
    switch (status) {
      case "SENT":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200">
            SENT
          </span>
        );
      case "FAILED":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-200">
            FAILED
          </span>
        );
      case "SKIPPED":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-200">
            SKIPPED
          </span>
        );
      case "QUEUED":
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
            QUEUED
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* ── SAFETY / DRY RUN BANNER ── */}
      {config?.dryRun && (
        <div className="p-4 rounded-xl border border-amber-300/80 dark:border-amber-700/80 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/30 flex items-start gap-3 shadow-xs">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <span className="font-bold text-amber-900 dark:text-amber-200 block text-sm">
              Dry Run Simulation Mode Active
            </span>
            <p className="text-amber-800/90 dark:text-amber-300/90">
              Emails will be rendered and logged to recipient history but will <strong>not</strong> be delivered to real mailboxes.
              Max recipient cap: <strong>{config.maxRecipients}</strong>.
              {config.allowlistActive && " Test allowlist is active."}
            </p>
          </div>
        </div>
      )}

      {/* ── HEADER & ACTIONS ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Mail className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            Email Messages & Broadcasts
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Compose and broadcast targeted emails to leads attributed to this campaign.
          </p>
        </div>

        {canManage && (
          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Email Message</span>
          </button>
        )}
      </div>

      {/* ── MESSAGES LIST ── */}
      {isMessagesLoading ? (
        <div className="p-12 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
          <span className="text-xs">Loading campaign messages...</span>
        </div>
      ) : messages.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
          <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-950/60 flex items-center justify-center mx-auto text-blue-600 dark:text-blue-400">
            <Mail className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">No Email Messages Created</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              Create and trigger targeted broadcasts for qualified leads attributed to {campaignName}.
            </p>
          </div>
          {canManage && (
            <button
              onClick={handleOpenCreate}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create First Message</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {messages.map((msg) => {
            const stats = msg.stats || {
              total: 0,
              queued: 0,
              sent: 0,
              failed: 0,
              skipped: 0,
              opened: 0,
              unsubscribed: 0,
              openRatePct: 0
            };

            return (
              <div
                key={msg.id}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-5 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all space-y-4"
              >
                {/* Top Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-900 dark:text-white text-sm">{msg.name}</span>
                      {getStatusBadge(msg.status)}
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      <strong>Subject:</strong> {msg.subject}
                    </p>
                  </div>

                  <div className="text-[11px] text-slate-400 dark:text-slate-500 sm:text-right">
                    {msg.sentAt ? (
                      <span>Sent {new Date(msg.sentAt).toLocaleString()}</span>
                    ) : msg.scheduledAt && msg.status === "SCHEDULED" ? (
                      <span className="text-blue-600 dark:text-blue-400 font-semibold flex items-center gap-1 sm:justify-end">
                        <Clock className="w-3.5 h-3.5" />
                        Scheduled for {utcIsoToLocalDisplay(msg.scheduledAt)}
                      </span>
                    ) : (
                      <span>Created {new Date(msg.createdAt).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>

                {/* Stats Bar */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl text-center">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Target</span>
                    <span className="text-sm font-black text-slate-800 dark:text-slate-200">{stats.total}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Delivered / Sent</span>
                    <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">{stats.sent}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Opened</span>
                    <span className="text-sm font-black text-blue-600 dark:text-blue-400">
                      {stats.opened} ({stats.openRatePct}%)
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Unsubscribed</span>
                    <span className="text-sm font-black text-amber-600 dark:text-amber-400">{stats.unsubscribed}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Failed / Skipped</span>
                    <span className="text-sm font-black text-slate-600 dark:text-slate-400">
                      {stats.failed + stats.skipped}
                    </span>
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="flex items-center justify-between gap-3 pt-1 flex-wrap">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setPreviewMessage(msg);
                        setIsPreviewDrawerOpen(true);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-750 cursor-pointer"
                    >
                      <Users className="w-3.5 h-3.5 text-blue-500" />
                      <span>Audience Filter</span>
                    </button>

                    {stats.total > 0 && (
                      <button
                        onClick={() => {
                          setSelectedMessageForRecipients(msg);
                          setRecipientsPage(1);
                          setIsRecipientsDrawerOpen(true);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-750 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5 text-emerald-500" />
                        <span>View Recipients ({stats.total})</span>
                      </button>
                    )}
                  </div>

                  {canManage && (
                    <div className="flex items-center gap-2">
                      {(msg.status === "DRAFT" || msg.status === "SCHEDULED") && (
                        <>
                          <button
                            onClick={() => handleOpenEdit(msg)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </button>

                          {msg.status === "SCHEDULED" ? (
                            <button
                              onClick={() => unscheduleMutation.mutate(msg.id)}
                              disabled={unscheduleMutation.isPending}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/50 text-xs font-semibold text-amber-800 dark:text-amber-200 hover:bg-amber-100 cursor-pointer"
                            >
                              <Clock className="w-3.5 h-3.5 text-amber-600" />
                              <span>Unschedule</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                setMessageToSend(msg);
                                setConfirmInput("");
                                setIsScheduling(false);
                                setScheduleDateTime("");
                                setSendError(null);
                                setIsSendConfirmOpen(true);
                              }}
                              className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs cursor-pointer"
                            >
                              <Send className="w-3.5 h-3.5" />
                              <span>Send Broadcast</span>
                            </button>
                          )}
                        </>
                      )}

                      {(msg.status === "PARTIAL" || msg.status === "FAILED") && (
                        <button
                          onClick={() => resumeMutation.mutate(msg.id)}
                          disabled={resumeMutation.isPending}
                          className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs cursor-pointer"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${resumeMutation.isPending ? "animate-spin" : ""}`} />
                          <span>Resume Send</span>
                        </button>
                      )}

                      {msg.status === "SENDING" && (
                        <button
                          onClick={() => cancelMutation.mutate(msg.id)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 text-xs font-bold cursor-pointer"
                        >
                          <Ban className="w-3.5 h-3.5" />
                          <span>Stop / Cancel</span>
                        </button>
                      )}

                      {(msg.status === "DRAFT" || msg.status === "CANCELLED") && (
                        <button
                          onClick={() => setMessageToDelete(msg)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                          title="Delete message"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── CREATE / EDIT MESSAGE MODAL ── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {editingMessage ? "Edit Campaign Message" : "Create New Campaign Message"}
                </h3>
                <p className="text-xs text-slate-500">
                  Target: <strong>{campaignName}</strong>
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <div className="space-y-4 text-xs">
              {/* Message Name & Subject */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300">Message Internal Name *</label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Q4 Executive Product Update"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300">Email Subject Line *</label>
                  <input
                    type="text"
                    value={formSubject}
                    onChange={(e) => setFormSubject(e.target.value)}
                    placeholder="e.g. Exclusive CRM Demo for {{company}}"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
                  />
                </div>
              </div>

              {/* Placeholder Helper Pills */}
              <div className="space-y-1.5 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
                <span className="font-bold text-[11px] text-slate-600 dark:text-slate-300 block">
                  Click to insert dynamic placeholder:
                </span>
                <div className="flex items-center gap-2 flex-wrap">
                  {PLACEHOLDERS.map((p) => (
                    <button
                      key={p.tag}
                      type="button"
                      onClick={() => handleInsertTag(p.tag)}
                      className="px-2.5 py-1 rounded-md bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 font-mono text-[11px] hover:bg-blue-100 transition-colors cursor-pointer"
                    >
                      {p.tag} <span className="text-slate-400 text-[10px]">({p.label})</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* HTML Body */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">Body HTML Template *</label>
                <textarea
                  rows={6}
                  value={formBodyHtml}
                  onChange={(e) => setFormBodyHtml(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-xs"
                />
                <span className="text-[11px] text-slate-400 block">
                  Template is automatically wrapped with responsive company layout and compliant unsubscribe link.
                </span>
              </div>

              {/* Audience Filter Accordion / Box */}
              <div className="space-y-3 p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Filter className="w-4 h-4 text-blue-500" />
                    Target Audience Filter
                  </span>
                  <button
                    type="button"
                    onClick={handleRunModalPreview}
                    disabled={isModalPreviewLoading}
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] cursor-pointer"
                  >
                    <RefreshCw className={`w-3 h-3 ${isModalPreviewLoading ? "animate-spin" : ""}`} />
                    <span>Preview Audience</span>
                  </button>
                </div>

                {/* Status Checkboxes */}
                <div className="space-y-1.5">
                  <span className="font-semibold text-slate-600 dark:text-slate-400 text-[11px]">
                    Lead Statuses:
                  </span>
                  <div className="flex items-center gap-2 flex-wrap">
                    {AVAILABLE_STATUSES.map((st) => {
                      const isChecked = formStatuses.includes(st);
                      return (
                        <label
                          key={st}
                          className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold cursor-pointer transition-all ${
                            isChecked
                              ? "bg-blue-50 border-blue-300 text-blue-700 dark:bg-blue-950 dark:border-blue-700 dark:text-blue-300"
                              : "bg-white border-slate-200 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400"
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="hidden"
                            checked={isChecked}
                            onChange={() => {
                              if (isChecked) {
                                setFormStatuses(formStatuses.filter((s) => s !== st));
                              } else {
                                setFormStatuses([...formStatuses, st]);
                              }
                            }}
                          />
                          {st}
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Score & Industry & Country */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Min Score</label>
                    <input
                      type="number"
                      value={formMinScore}
                      onChange={(e) => setFormMinScore(e.target.value)}
                      placeholder="e.g. 50"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Max Score</label>
                    <input
                      type="number"
                      value={formMaxScore}
                      onChange={(e) => setFormMaxScore(e.target.value)}
                      placeholder="e.g. 100"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Industry</label>
                    <input
                      type="text"
                      value={formIndustry}
                      onChange={(e) => setFormIndustry(e.target.value)}
                      placeholder="e.g. Technology"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Country / Territory</label>
                    <input
                      type="text"
                      value={formCountry}
                      onChange={(e) => setFormCountry(e.target.value)}
                      placeholder="e.g. UAE, Saudi Arabia"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                    />
                  </div>
                </div>

                {/* Audience Live Preview Result inside modal */}
                {modalAudiencePreview && (
                  <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-emerald-600 dark:text-emerald-400 text-xs">
                        {modalAudiencePreview.eligibleCount} Eligible Recipients
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {modalAudiencePreview.excludedCount} Excluded (Opted out: {modalAudiencePreview.excludedByReason.optedOut}, Invalid: {modalAudiencePreview.excludedByReason.invalidEmail}, Duplicates: {modalAudiencePreview.excludedByReason.duplicate})
                      </span>
                    </div>

                    {modalAudiencePreview.sample.length > 0 && (
                      <div className="max-h-32 overflow-y-auto text-[11px] border border-slate-100 dark:border-slate-800 rounded-lg">
                        <table className="w-full text-left">
                          <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500">
                            <tr>
                              <th className="p-1.5">Name</th>
                              <th className="p-1.5">Email</th>
                              <th className="p-1.5">Score</th>
                              <th className="p-1.5">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {modalAudiencePreview.sample.map((s) => (
                              <tr key={s.id}>
                                <td className="p-1.5 font-medium">{s.firstName} {s.lastName}</td>
                                <td className="p-1.5 text-slate-500">{s.email}</td>
                                <td className="p-1.5">{s.leadScore ?? "—"}</td>
                                <td className="p-1.5 font-bold">{s.status}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saveMutation.isPending || !formName || !formSubject || !formBodyHtml}
                onClick={() => saveMutation.mutate()}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold shadow-xs cursor-pointer"
              >
                {saveMutation.isPending ? "Saving..." : editingMessage ? "Update Message" : "Create Draft"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── SEND CONFIRMATION MODAL ── */}
      {isSendConfirmOpen && messageToSend && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-950 flex items-center justify-center text-emerald-600 shrink-0">
                <Send className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Confirm Campaign Broadcast</h3>
                <p className="text-xs text-slate-500">"{messageToSend.name}"</p>
              </div>
            </div>

            {config?.dryRun && (
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 text-xs text-amber-800 dark:text-amber-200">
                <strong>Simulation:</strong> Emails will be marked sent but not delivered.
              </div>
            )}

            {sendError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 text-xs text-rose-700 dark:text-rose-300">
                {sendError}
              </div>
            )}

            {/* Schedule Option */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
              <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-semibold text-slate-700 dark:text-slate-200">
                <input
                  type="checkbox"
                  checked={isScheduling}
                  onChange={(e) => {
                    setIsScheduling(e.target.checked);
                    if (!e.target.checked) setScheduleDateTime("");
                  }}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <span>Schedule for later</span>
              </label>

              {isScheduling && (
                <div className="pt-2 space-y-1">
                  <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    Send at (Date & Time):
                  </label>
                  <input
                    type="datetime-local"
                    value={scheduleDateTime}
                    min={new Date(Date.now() + 60000).toISOString().slice(0, 16)}
                    onChange={(e) => setScheduleDateTime(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs bg-white dark:bg-slate-900"
                  />
                </div>
              )}
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300">
              {isScheduling
                ? "This will schedule the broadcast to automatically execute at the specified time. Please type SEND below to confirm:"
                : "This action will queue emails for all matching audience leads. Please type SEND below to authorize delivery:"}
            </p>

            <input
              type="text"
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              placeholder="Type SEND to confirm"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-center font-bold tracking-widest uppercase"
            />

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => {
                  setIsSendConfirmOpen(false);
                  setMessageToSend(null);
                  setIsScheduling(false);
                  setScheduleDateTime("");
                }}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                disabled={confirmInput !== "SEND" || sendMutation.isPending || (isScheduling && !scheduleDateTime)}
                onClick={() => sendMutation.mutate(messageToSend.id)}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold shadow-xs cursor-pointer"
              >
                {sendMutation.isPending
                  ? isScheduling ? "Scheduling..." : "Starting Delivery..."
                  : isScheduling ? "Schedule Broadcast" : "Authorize & Send"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── DELETE CONFIRMATION MODAL ── */}
      {messageToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Delete Campaign Message?</h3>
            <p className="text-xs text-slate-500">
              Are you sure you want to delete <strong>{messageToDelete.name}</strong>? This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setMessageToDelete(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(messageToDelete.id)}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs cursor-pointer"
              >
                {deleteMutation.isPending ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── AUDIENCE PREVIEW DRAWER ── */}
      {isPreviewDrawerOpen && previewMessage && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/50 backdrop-blur-xs">
          <div className="w-full max-w-xl bg-white dark:bg-slate-900 h-full shadow-2xl p-6 overflow-y-auto space-y-5">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
              <div className="space-y-0.5">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Audience Filter & Matching Leads</h3>
                <p className="text-xs text-slate-500">{previewMessage.name}</p>
              </div>
              <button
                onClick={() => setIsPreviewDrawerOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {isDrawerPreviewLoading ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-500" />
                Calculating matching audience...
              </div>
            ) : drawerPreviewData ? (
              <div className="space-y-4">
                {/* Stat pills */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 rounded-xl border border-emerald-200 dark:border-emerald-800">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 block">
                      Eligible Audience
                    </span>
                    <span className="text-xl font-black text-emerald-800 dark:text-emerald-200">
                      {drawerPreviewData.eligibleCount}
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                      Excluded Leads
                    </span>
                    <span className="text-xl font-black text-slate-700 dark:text-slate-300">
                      {drawerPreviewData.excludedCount}
                    </span>
                  </div>
                </div>

                {/* Excluded Breakdown */}
                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl text-xs space-y-1">
                  <span className="font-bold text-slate-700 dark:text-slate-300 block text-[11px]">
                    Automatic Exclusion Breakdown:
                  </span>
                  <div className="grid grid-cols-2 gap-2 text-slate-500 text-[11px]">
                    <div>• Opted Out: <strong>{drawerPreviewData.excludedByReason.optedOut}</strong></div>
                    <div>• Invalid/No Email: <strong>{drawerPreviewData.excludedByReason.invalidEmail}</strong></div>
                    <div>• Duplicate Email: <strong>{drawerPreviewData.excludedByReason.duplicate}</strong></div>
                    <div>• Closed/Converted: <strong>{drawerPreviewData.excludedByReason.closedStatus}</strong></div>
                  </div>
                </div>

                {/* Matching Samples */}
                <div className="space-y-2">
                  <span className="font-bold text-xs text-slate-800 dark:text-slate-200 block">
                    Sample Matching Leads (up to 10):
                  </span>
                  {drawerPreviewData.sample.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-800 rounded-xl">
                      No leads match current audience filters.
                    </div>
                  ) : (
                    <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden text-xs">
                      <table className="w-full text-left">
                        <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 text-[11px]">
                          <tr>
                            <th className="p-2.5">Name</th>
                            <th className="p-2.5">Email</th>
                            <th className="p-2.5">Company</th>
                            <th className="p-2.5">Score</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {drawerPreviewData.sample.map((s) => (
                            <tr key={s.id}>
                              <td className="p-2.5 font-semibold text-slate-900 dark:text-white">
                                {s.firstName} {s.lastName}
                              </td>
                              <td className="p-2.5 text-slate-500">{s.email}</td>
                              <td className="p-2.5 text-slate-500">{s.company || "—"}</td>
                              <td className="p-2.5 font-bold text-blue-600 dark:text-blue-400">{s.leadScore ?? "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* ── RECIPIENTS LOG DRAWER ── */}
      {isRecipientsDrawerOpen && selectedMessageForRecipients && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/50 backdrop-blur-xs">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 h-full shadow-2xl p-6 overflow-y-auto space-y-5">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Recipient Delivery History</h3>
                <p className="text-xs text-slate-500">{selectedMessageForRecipients.name}</p>
              </div>
              <button
                onClick={() => setIsRecipientsDrawerOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Filter bar */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-400">Status:</span>
              {["ALL", "SENT", "QUEUED", "FAILED", "SKIPPED"].map((st) => (
                <button
                  key={st}
                  onClick={() => {
                    setRecipientStatusFilter(st);
                    setRecipientsPage(1);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                    recipientStatusFilter === st
                      ? "bg-blue-600 text-white"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            {/* Table */}
            {isRecipientsLoading ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-500" />
                Loading recipient records...
              </div>
            ) : recipientsData && recipientsData.recipients.length > 0 ? (
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden text-xs">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 text-[11px]">
                    <tr>
                      <th className="p-2.5">Email</th>
                      <th className="p-2.5">Status</th>
                      <th className="p-2.5">Sent At</th>
                      <th className="p-2.5">Opened</th>
                      <th className="p-2.5">Unsubscribed</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {recipientsData.recipients.map((r: CampaignRecipient) => (
                      <tr key={r.id}>
                        <td className="p-2.5 font-medium text-slate-900 dark:text-white">
                          {r.email}
                          {r.skipReason && (
                            <span className="text-[10px] text-amber-500 block font-normal">
                              Reason: {r.skipReason}
                            </span>
                          )}
                          {r.error && (
                            <span className="text-[10px] text-rose-500 block font-normal">
                              Error: {r.error}
                            </span>
                          )}
                        </td>
                        <td className="p-2.5">{getRecipientStatusBadge(r.status)}</td>
                        <td className="p-2.5 text-slate-500 text-[11px]">
                          {r.sentAt ? new Date(r.sentAt).toLocaleTimeString() : "—"}
                        </td>
                        <td className="p-2.5 text-[11px]">
                          {r.openedAt ? (
                            <span className="text-emerald-600 font-bold">
                              Yes ({new Date(r.openedAt).toLocaleTimeString()})
                            </span>
                          ) : (
                            <span className="text-slate-400">No</span>
                          )}
                        </td>
                        <td className="p-2.5 text-[11px]">
                          {r.unsubscribedAt ? (
                            <span className="text-amber-600 font-bold">Yes</span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-8 text-center text-slate-400 text-xs bg-slate-50 dark:bg-slate-800 rounded-xl">
                No recipient records found matching current filter.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
