import React from "react";
import { X, CheckCircle2, AlertTriangle, ArrowRight, Send, PhoneCall, Calendar, FileText, ShieldAlert } from "lucide-react";
import { useNavigate } from "react-router-dom";

export interface EvidenceItem {
  type: string;
  description: string;
  timestamp: string | Date;
  entityId?: string;
  isCustomerSide: boolean;
}

export interface StageValidationData {
  allowed: boolean;
  fromStage: string;
  toStage: string;
  transitionType?: "AUTOMATIC" | "VALIDATED_MANUAL" | "RESTRICTED";
  missingRequirements: string[];
  evidence: EvidenceItem[];
  verificationStatus: "VERIFIED" | "NEEDS_REVIEW";
}

interface StageEvidenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  recordName: string;
  recordId: string;
  validation: StageValidationData | null;
  onForceBypass?: () => void;
  daysInStage?: number;
  lastCustomerActivity?: string;
}

export const StageEvidenceModal: React.FC<StageEvidenceModalProps> = ({
  isOpen,
  onClose,
  recordName,
  recordId,
  validation,
  onForceBypass,
  daysInStage = 0,
  lastCustomerActivity = "Recent"
}) => {
  const navigate = useNavigate();

  if (!isOpen || !validation) return null;

  const isVerified = validation.allowed || validation.verificationStatus === "VERIFIED";

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className={`p-6 flex items-center justify-between border-b ${
          isVerified ? "bg-emerald-50/80 border-emerald-100" : "bg-amber-50/80 border-amber-100"
        }`}>
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-2xl ${
              isVerified ? "bg-emerald-500 text-white" : "bg-amber-500 text-white"
            }`}>
              {isVerified ? <CheckCircle2 className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-slate-500">Stage Validation</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                  isVerified ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"
                }`}>
                  {isVerified ? "Verified ✓" : "Needs Review ⚠"}
                </span>
              </div>
              <h3 className="text-lg font-black text-slate-900 mt-0.5">
                {validation.fromStage} <ArrowRight className="inline w-4 h-4 mx-1 text-slate-400" /> {validation.toStage}
              </h3>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          
          {/* Target Record Info */}
          <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-center justify-between text-xs">
            <div>
              <span className="text-slate-400 font-bold block text-[10px] uppercase">Record Name</span>
              <span className="font-extrabold text-slate-900 text-sm">{recordName}</span>
            </div>
            <div className="text-right">
              <span className="text-slate-400 font-bold block text-[10px] uppercase">Stage Age</span>
              <span className="font-extrabold text-slate-800">{daysInStage} days in stage</span>
            </div>
          </div>

          {/* MISSING REQUIREMENTS SECTION */}
          {!isVerified && validation.missingRequirements.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-rose-700 flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-rose-600" /> Missing Stage Entry Criteria ({validation.missingRequirements.length})
              </h4>
              <div className="space-y-2">
                {validation.missingRequirements.map((req, idx) => (
                  <div key={idx} className="p-3.5 bg-rose-50/70 border border-rose-200 rounded-2xl flex items-start justify-between gap-3 text-xs">
                    <div className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-rose-200 text-rose-800 font-black text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <span className="font-bold text-rose-900 leading-snug">{req}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* ACTION SHORTCUTS */}
              <div className="pt-2 flex flex-wrap gap-2">
                <button
                  onClick={() => { onClose(); navigate(`/quotations/builder?leadId=${recordId}`); }}
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-xs"
                >
                  <Send className="w-3.5 h-3.5" /> Send Quote
                </button>
                <button
                  onClick={() => { onClose(); navigate(`/leads/${recordId}`); }}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold rounded-xl text-xs flex items-center gap-1.5 transition-all"
                >
                  <PhoneCall className="w-3.5 h-3.5" /> Log Outbound Contact
                </button>
                <button
                  onClick={() => { onClose(); navigate(`/leads/${recordId}`); }}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold rounded-xl text-xs flex items-center gap-1.5 transition-all"
                >
                  <Calendar className="w-3.5 h-3.5" /> Schedule Meeting
                </button>
              </div>
            </div>
          )}

          {/* VERIFIED EVIDENCE TIMELINE */}
          <div className="space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center justify-between">
              <span>Verified Stage Evidence</span>
              <span className="text-[10px] text-slate-400 font-normal">Last activity: {lastCustomerActivity}</span>
            </h4>

            {validation.evidence.length === 0 ? (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-center text-slate-400 text-xs font-bold">
                No customer-side evidence recorded yet.
              </div>
            ) : (
              <div className="space-y-2">
                {validation.evidence.map((item, idx) => (
                  <div key={idx} className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl ${
                        item.isCustomerSide ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"
                      }`}>
                        <FileText className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="font-extrabold text-slate-900 block">{item.description}</span>
                        <span className="text-[10px] text-slate-400 font-mono font-semibold">
                          {item.isCustomerSide ? "Customer-side Evidence" : "System Validation"} • {new Date(item.timestamp).toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-black rounded-full shrink-0">
                      Satisfied ✓
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          {onForceBypass && !isVerified ? (
            <button
              onClick={onForceBypass}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-extrabold rounded-xl text-xs transition-all shadow-xs flex items-center gap-1.5"
            >
              <ShieldAlert className="w-4 h-4" /> Force Manager Override
            </button>
          ) : <div />}

          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-black rounded-xl text-xs transition-all cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
