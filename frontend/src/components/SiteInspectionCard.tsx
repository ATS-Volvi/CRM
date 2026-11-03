import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ClipboardCheck,
  MapPin,
  Lock,
  CheckCircle2,
  AlertCircle,
  Truck,
  FileText,
  ChevronRight,
  PlusCircle,
  Clock,
  ExternalLink,
  ShieldAlert,
  User,
} from "lucide-react";
import { siteInspectionApi } from "../api/siteInspection";
import {
  getStatusStyle,
  getInspectionRag,
  SiteInspectionRecord,
  SiteInspectionGateResult,
  getAssignmentDisplay,
  APPROVER_ROLES,
} from "../lib/siteInspection";
import { SiteInspectionRequestModal } from "./SiteInspectionRequestModal";
import { useAuth } from "../context/AuthContext";

export function useLeadSiteInspection(leadId?: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["lead-site-inspection", leadId],
    queryFn: () => siteInspectionApi.getLeadSiteInspection(leadId!),
    enabled: Boolean(leadId),
  });

  const requestMutation = useMutation({
    mutationFn: (options?: any) => siteInspectionApi.requestInspection(leadId!, options),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-site-inspection", leadId] });
      queryClient.invalidateQueries({ queryKey: ["lead", leadId] });
    },
  });

  return {
    ...query,
    gate: query.data?.gate as SiteInspectionGateResult | undefined,
    inspection: query.data?.inspection as SiteInspectionRecord | null | undefined,
    requestInspection: requestMutation.mutateAsync,
    isRequesting: requestMutation.isPending,
  };
}

export function SiteInspectionCard({
  leadId,
  leadStatus,
}: {
  leadId: string;
  leadStatus?: string;
}) {
  const { user } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { gate, inspection, isLoading, isError, requestInspection, isRequesting } =
    useLeadSiteInspection(leadId);

  const userRole = (user?.role || "").toLowerCase();
  const isApprover = APPROVER_ROLES.includes(userRole);
  const isAssignedInspector =
    Boolean(inspection) &&
    userRole === "site_manager" &&
    (!inspection?.assignedToId || inspection.assignedToId === user?.id);

  const status = inspection?.status || gate?.status || "NOT_REQUESTED";
  const statusInfo = getStatusStyle(status);
  const assignmentDisplay = getAssignmentDisplay(inspection);

  const isGateLocked = gate ? !gate.allowed : status !== "APPROVED";

  const activeServices = inspection?.services?.filter((s) => s.isActive) || [];

  return (
    <>
      <div className="bg-white dark:bg-slate-900 border border-face-line dark:border-slate-800 rounded-2xl p-5 shadow-[0_2px_16px_rgba(40,50,120,0.06)] space-y-3.5 relative overflow-hidden">
        {/* Card Header */}
        <div className="flex items-center justify-between border-b border-face-line dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-face-green-light dark:bg-face-green-dark/40 text-face-green dark:text-face-green-mint flex items-center justify-center">
              <ClipboardCheck className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-xs font-black uppercase tracking-wider text-face-ink dark:text-white">
                  Site Inspection
                </h3>
                {inspection?.priority && inspection.priority !== "NORMAL" && (
                  <span
                    className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                      inspection.priority === "URGENT"
                        ? "bg-face-red-light text-face-red dark:bg-rose-950/60 dark:text-rose-300"
                        : "bg-face-field text-face-muted dark:bg-slate-800 dark:text-slate-400"
                    }`}
                  >
                    {inspection.priority}
                  </span>
                )}
              </div>
              <span className="text-[10px] text-face-muted font-medium block">
                Required for Qualification
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border ${statusInfo.badgeBg}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dotColor}`} />
              {assignmentDisplay?.headerStatusOverride || statusInfo.label}
            </span>
          </div>
        </div>

        {/* Lock Notice when gate is active & not approved */}
        {isGateLocked && (
          <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 rounded-xl flex items-start gap-2.5">
            <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="text-[11px] leading-snug">
              <p className="font-bold text-amber-900 dark:text-amber-200">
                Lead Qualification Gate Locked
              </p>
              <p className="text-amber-700 dark:text-amber-300/80 mt-0.5">
                {gate?.message || "Requires site manager audit and supervisor approval."}
              </p>
            </div>
          </div>
        )}

        {/* Inspection Details if present */}
        {inspection ? (
          <div className="space-y-3 pt-1">
            {/* Assigned Site Inspector / Request & Acceptance State Block */}
            {assignmentDisplay && (
              <div
                className={`p-2.5 rounded-xl border flex items-start justify-between gap-2.5 ${
                  assignmentDisplay.state === "UNASSIGNED"
                    ? "bg-amber-50/70 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/60"
                    : assignmentDisplay.state === "DECLINED"
                    ? "bg-rose-50/70 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/60"
                    : "bg-face-field dark:bg-slate-800/60 border-face-line dark:border-slate-800"
                }`}
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  {assignmentDisplay.email || assignmentDisplay.name !== "Not assigned yet" ? (
                    <div className="w-8 h-8 rounded-full bg-face-green-light dark:bg-face-green-dark/40 text-face-green dark:text-face-green-mint font-bold text-xs flex items-center justify-center shrink-0 border border-face-green/20 dark:border-face-green-dark/60 mt-0.5">
                      {assignmentDisplay.initials || "SI"}
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 font-bold text-xs flex items-center justify-center shrink-0 border border-amber-300 dark:border-amber-800 mt-0.5">
                      <User className="w-4 h-4" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <span className="text-[10px] uppercase font-bold text-face-muted dark:text-slate-400 block tracking-wider leading-none">
                      {assignmentDisplay.title}
                    </span>
                    <p className="text-xs font-bold text-face-ink dark:text-white truncate mt-0.5">
                      {assignmentDisplay.name}
                    </p>
                    {assignmentDisplay.email && (
                      <p className="text-[10px] text-face-muted dark:text-slate-400 truncate">
                        {assignmentDisplay.email}
                      </p>
                    )}
                    {assignmentDisplay.subline && (
                      <p className="text-[10px] text-face-muted dark:text-slate-400 mt-1 flex items-center gap-1.5 flex-wrap">
                        <span>{assignmentDisplay.subline}</span>
                        {assignmentDisplay.isOverdue && (
                          <span className="px-1.5 py-0.2 bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 text-[9px] font-black uppercase rounded">
                            Overdue
                          </span>
                        )}
                      </p>
                    )}
                    {assignmentDisplay.approverHint && isApprover && (
                      <p className="text-[10px] text-face-green dark:text-face-green-mint font-semibold mt-1">
                        {assignmentDisplay.approverHint}
                      </p>
                    )}
                  </div>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider shrink-0 ${
                    assignmentDisplay.pillVariant === "green"
                      ? "bg-face-green-light text-face-green dark:bg-face-green-dark/30 dark:text-face-green-mint border border-face-green/30 dark:border-face-green-dark"
                      : assignmentDisplay.pillVariant === "red"
                      ? "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800"
                      : "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                  }`}
                >
                  {assignmentDisplay.pillText}
                </span>
              </div>
            )}

            {/* Stage B SLA RAG Countdown */}
            {(() => {
              const ragInfo = getInspectionRag(inspection);
              return (
                <div className={`flex items-center justify-between px-3 py-2 rounded-xl border ${ragInfo.badgeBg} text-xs font-bold`}>
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${ragInfo.dotColor}`} />
                    <span>{ragInfo.label}</span>
                  </div>
                  <span className="font-mono text-[11px] font-extrabold">{ragInfo.countdown}</span>
                </div>
              );
            })()}

            {inspection.siteAreaName && (
              <div className="flex items-center gap-1.5 text-xs font-semibold text-face-ink dark:text-slate-300 bg-face-field dark:bg-slate-800/40 px-2.5 py-1.5 rounded-lg border border-face-line dark:border-slate-800">
                <MapPin className="w-3.5 h-3.5 text-face-green shrink-0" />
                <span className="truncate">Area: {inspection.siteAreaName}</span>
              </div>
            )}

            {/* Key Metrics Grid */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-face-field dark:bg-slate-800/60 p-2.5 rounded-xl border border-face-line dark:border-slate-800">
                <span className="text-[10px] uppercase font-bold text-face-muted block tracking-wider">
                  Base → Site
                </span>
                <p className="text-sm font-extrabold text-face-ink dark:text-white mt-0.5">
                  {inspection.baseToSiteStraightKm != null
                    ? `${inspection.baseToSiteStraightKm} km`
                    : "—"}
                </p>
                <span className="text-[9px] text-face-muted">
                  {inspection.baseName || "Base not set"}
                </span>
              </div>

              <div className="bg-face-field dark:bg-slate-800/60 p-2.5 rounded-xl border border-face-line dark:border-slate-800">
                <span className="text-[10px] uppercase font-bold text-face-muted block tracking-wider">
                  Cycle Distance
                </span>
                <p className="text-sm font-extrabold text-face-ink dark:text-white mt-0.5">
                  {inspection.totalCycleKm != null ? `${inspection.totalCycleKm} km` : "—"}
                </p>
                <span className="text-[9px] text-face-muted">
                  {inspection.estFuelLitres != null
                    ? `~${inspection.estFuelLitres}L Diesel`
                    : "Est. Fuel"}
                </span>
              </div>
            </div>

            {/* Active Scopes */}
            <div>
              <span className="text-[10px] uppercase font-bold text-face-muted block mb-1.5 tracking-wider">
                Waste Scopes ({activeServices.length})
              </span>
              {activeServices.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {activeServices.map((svc) => (
                    <span
                      key={svc.serviceType}
                      className="px-2 py-0.5 bg-face-green-light dark:bg-face-green-dark/40 text-face-green-dark dark:text-face-green-mint border border-face-green/30 dark:border-face-green-dark text-[10px] font-bold rounded-md"
                    >
                      {svc.serviceType} · {svc.distanceKm} km
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-xs text-face-muted italic">No waste scope configured yet</span>
              )}
            </div>

            {/* Meta summary footer */}
            <div className="flex items-center justify-between text-[11px] text-face-muted pt-1 border-t border-face-line dark:border-slate-800">
              <span className="flex items-center gap-1">
                <FileText className="w-3.5 h-3.5 text-face-muted" />
                {inspection.attachments?.length || 0} attachment{inspection.attachments?.length !== 1 ? "s" : ""}
              </span>
              {!isAssignedInspector && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-face-muted dark:text-slate-400">
                  <Lock className="w-3 h-3 text-face-muted" />
                  Read-only
                </span>
              )}
            </div>

            {/* Link to form */}
            <Link
              to={`/site-inspections/${inspection.id}`}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-face-green hover:bg-face-green-dark text-white text-xs font-bold rounded-xl transition-all shadow-xs"
            >
              <span>{isAssignedInspector ? "Open Inspection Portal" : "View Inspection (Read-only)"}</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>
        ) : (
          /* Empty / Request CTA */
          <div className="space-y-3 pt-1">
            <p className="text-xs text-face-muted leading-relaxed">
              No inspection has been requested yet. Requesting an inspection will dispatch a Site
              Manager to assess distance, site access, and waste logistics.
            </p>

            <button
              onClick={() => setIsModalOpen(true)}
              disabled={isRequesting}
              className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 bg-face-green hover:bg-face-green-dark text-white text-xs font-bold rounded-xl transition-all shadow-sm shadow-face-green/20 disabled:opacity-50 cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>{isRequesting ? "Dispatching..." : "Request Site Inspection"}</span>
            </button>
          </div>
        )}
      </div>

      <SiteInspectionRequestModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={async (payload) => {
          await requestInspection(payload);
        }}
        isSubmitting={isRequesting}
      />
    </>
  );
}
