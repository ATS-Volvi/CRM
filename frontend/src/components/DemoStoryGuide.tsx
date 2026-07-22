import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Play, ChevronRight, CheckCircle2, Sparkles, X } from "lucide-react";

export function DemoStoryGuide() {
  const navigate = useNavigate();
  const [isVisible, setIsVisible] = useState(true);
  const [currentStep, setCurrentStep] = useState(1);

  const steps = [
    { step: 1, label: "1. Lead Ingestion", path: "/leads/new", desc: "Capture inbound lead from website or voice parser" },
    { step: 2, label: "2. Qualification & Meeting", path: "/activities", desc: "Schedule site survey & technical qualification" },
    { step: 3, label: "3. Proposal & Quote", path: "/quotes/new", desc: "Build quotation with BOM line items & discount approval" },
    { step: 4, label: "4. PO & Invoice", path: "/purchase-orders", desc: "Verify PO & issue NET 30 invoice" },
    { step: 5, label: "5. Customer 360", path: "/customers", desc: "Manage ongoing account timeline & AI insights" },
  ];

  if (!isVisible) return null;

  const active = steps.find(s => s.step === currentStep) || steps[0];

  return (
    <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white border-b border-indigo-900/50 px-4 py-2 flex items-center justify-between shadow-md shrink-0 text-xs">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <span className="flex items-center gap-1 font-bold text-amber-400 shrink-0">
          <Sparkles className="w-3.5 h-3.5" /> ENTERPRISE DEMO MODE
        </span>
        
        <div className="hidden md:flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {steps.map(s => (
            <button
              key={s.step}
              onClick={() => {
                setCurrentStep(s.step);
                navigate(s.path);
              }}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all flex items-center gap-1 ${
                s.step === currentStep
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "text-slate-400 hover:text-white hover:bg-white/10"
              }`}
            >
              {s.step < currentStep ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : null}
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <span className="text-[11px] text-slate-300 hidden lg:inline">{active.desc}</span>
        <button
          onClick={() => {
            const next = currentStep < 5 ? currentStep + 1 : 1;
            setCurrentStep(next);
            navigate(steps[next - 1].path);
          }}
          className="flex items-center gap-1 px-3 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold rounded-lg transition-colors"
        >
          Next Demo Step <ChevronRight className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => setIsVisible(false)} className="p-1 text-slate-400 hover:text-white">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
