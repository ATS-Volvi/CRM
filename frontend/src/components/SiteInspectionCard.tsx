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
} from "lucide-react";
import { siteInspectionApi } from "../api/siteInspection";
import { getStatusStyle, SiteInspectionRecord, SiteInspectionGateResult } from "../lib/siteInspection";
import { SiteInspectionRequestModal } from "./SiteInspectionRequestModal";

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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { gate, inspection, isLoading, isError, requestInspection, isRequesting } =
    useLeadSiteInspection(leadId);

  const status = inspection?.status || gate?.status || "NOT_REQUESTED";
  const statusInfo = getStatusStyle(status);

  const isGateLocked = gate ? !gate.allowed : status !== "APPROVED";

  const activeServices = inspection?.services?.filter((s) => s.isActive) || [];

  return (
    <>
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-3.5 relative overflow-hidden">
        {/* Card Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <ClipboardCheck className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                  Site Inspection
                </h3>
                {inspection?.priority && inspection.priority !== "NORMAL" && (
                  <span
                    className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                      inspection.priority === "URGENT"
                        ? "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
                        : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                    }`}
                  >
                    {inspection.priority}
                  </span>
                )}
              </div>
              <span className="text-[10px] text-slate-400 font-medium block">
                Required for Qualification
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {inspection?.assignmentState && inspection.assignmentState !== "ASSIGNED" && (
              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                {inspection.assignmentState.replace(/_/g, " ")}
              </span>
            )}
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border ${statusInfo.badgeBg}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dotColor}`} />
              {statusInfo.label}
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
            {inspection.siteAreaName && (
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/40 px-2.5 py-1.5 rounded-lg border border-slate-100 dark:border-slate-800">
                <MapPin className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                <span className="truncate">Area: {inspection.siteAreaName}</span>
              </div>
            )}

            {/* Key Metrics Grid */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                  Base → Site
                </span>
                <p className="text-sm font-extrabold text-slate-900 dark:text-white mt-0.5">
                  {inspection.baseToSiteStraightKm != null
                    ? `${inspection.baseToSiteStraightKm} km`
                    : "—"}
                </p>
                <span className="text-[9px] text-slate-400">
                  {inspection.baseName || "Base not set"}
                </span>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                  Cycle Distance
                </span>
                <p className="text-sm font-extrabold text-slate-900 dark:text-white mt-0.5">
                  {inspection.totalCycleKm != null ? `${inspection.totalCycleKm} km` : "—"}
                </p>
                <span className="text-[9px] text-slate-400">
                  {inspection.estFuelLitres != null
                    ? `~${inspection.estFuelLitres}L Diesel`
                    : "Est. Fuel"}
                </span>
              </div>
            </div>

            {/* Active Scopes */}
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1.5 tracking-wider">
                Waste Scopes ({activeServices.length})
              </span>
              {activeServices.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {activeServices.map((svc) => (
                    <span
                      key={svc.serviceType}
                      className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-[10px] font-bold rounded-md"
                    >
                      {svc.serviceType} · {svc.distanceKm} km
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-xs text-slate-400 italic">No waste scope configured yet</span>
              )}
            </div>

            {/* Meta summary footer */}
            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100 dark:border-slate-800">
              <span className="flex items-center gap-1">
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                {inspection.attachments?.length || 0} attachment{inspection.attachments?.length !== 1 ? "s" : ""}
              </span>
              <span className="truncate max-w-[150px]">
                {inspection.assignedTo ? `Assigned: ${inspection.assignedTo.name}` : "Unassigned"}
              </span>
            </div>

            {/* Link to form */}
            <Link
              to={`/site-inspections/${inspection.id}`}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold rounded-xl transition-all shadow-xs"
            >
              <span>Open Inspection Portal</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>
        ) : (
          /* Empty / Request CTA */
          <div className="space-y-3 pt-1">
            <p className="text-xs text-slate-500 leading-relaxed">
              No inspection has been requested yet. Requesting an inspection will dispatch a Site
              Manager to assess distance, site access, and waste logistics.
            </p>

            <button
              onClick={() => setIsModalOpen(true)}
              disabled={isRequesting}
              className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm shadow-indigo-600/20 disabled:opacity-50 cursor-pointer"
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
