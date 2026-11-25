import { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Bot, Zap, ArrowRight, Minus, Maximize2, Pause, Play, X, ArrowUpRight, ChevronDown } from "lucide-react";
import { useAuth } from "./AuthContext";
import { useBrand } from "./BrandContext";

export type VolviTab = "copilot" | "alerts" | "playbook";

export interface VolviStepGuidance {
  id?: string;
  stepNumber?: number;          // 1 to 8
  stageName: string;            // e.g. "Step 1 of 8 • Pre-Sales Lead Qualification"
  message: string;              // e.g. "Lead created for saud w (260 kW continuous duty)"
  explanation: string;          // e.g. "Verify technical load parameters and site constraints before generating CPQ quote."
  recommendedAction: string;    // e.g. "Dispatch Field Engineer for Site Survey"
  actionLabel: string;          // e.g. "Proceed to Site Inspections (Step 2)"
  actionPath?: string;          // e.g. "/site-inspections"
  onAction?: () => void;
  technicalTip?: string;        // e.g. "SEC standard requires 25% headroom and verification of motor starting inrush."
  suggestedPrompt?: string;     // e.g. "Recommend generator rating for 260 kW with 3x DOL motor inrush"
}

export interface ParkedTask {
  id: string;
  title: string;              // e.g. "Rental Quotation (EN-QT-2026-1049)" or "NEOM Concrete Batching Plant"
  stepNumber: number;         // e.g. 4 or 6
  stageName: string;          // e.g. "Rental CPQ Quoting"
  path: string;               // exact URL with query params
  actionLabel?: string;       // e.g. "Draft Rental Contracts (Step 6)"
  parkedAt: number;           // timestamp
}

interface VolviAssistContextType {
  isAssistOpen: boolean;
  openAssist: (prompt?: string, tab?: VolviTab) => void;
  closeAssist: () => void;
  toggleAssist: () => void;
  activeGuidance: VolviStepGuidance | null;
  triggerGuidance: (guidance: VolviStepGuidance) => void;
  dismissGuidance: () => void;
  dismissActiveTask: () => void;
  guidanceHistory: VolviStepGuidance[];
  currentPrompt: string;
  setCurrentPrompt: (prompt: string) => void;
  activeAssistTab: VolviTab;
  setActiveAssistTab: (tab: VolviTab) => void;
  unreadCount: number;
  setUnreadCount: (count: number) => void;
  isMinimized: boolean;
  setIsMinimized: (val: boolean) => void;
  isPaused: boolean;
  setIsPaused: (val: boolean) => void;
  parkedTask: ParkedTask | null;
  parkedTasks: ParkedTask[];
  resumeParkedTask: (taskId?: string) => void;
  clearParkedTask: (taskId?: string) => void;
  clearAllParkedTasks: () => void;
  parkCurrentTask: (override?: Partial<ParkedTask>) => void;
}

const VolviAssistContext = createContext<VolviAssistContextType | undefined>(undefined);

const LIFECYCLE_STEPS = [
  { num: 1, name: "Leads" },
  { num: 2, name: "Sizing" },
  { num: 3, name: "Pipeline" },
  { num: 4, name: "Rental CPQ" },
  { num: 5, name: "Credit & KYC" },
  { num: 6, name: "Contracts" },
  { num: 7, name: "Fleet Dispatch" },
  { num: 8, name: "Approvals" },
];

/**
 * Intelligent Lifecycle Step Guidance Resolver based on current route.
 * Guarantees that Volvi Guide is PERMANENTLY docked and active across every page.
 */
function getRouteDefaultGuidance(pathname: string): VolviStepGuidance {
  // Step 1: Pre-Sales Lead Qualification
  if (pathname.startsWith("/leads")) {
    return {
      stepNumber: 1,
      stageName: "Step 1 of 8 • Pre-Sales Lead Qualification",
      message: "Lead intake & electrical load qualification active",
      explanation: "Verify load profile and site electrical constraints. Dispatch a field engineer for on-site Megger ground resistance audit & motor inrush survey before quoting.",
      recommendedAction: "Dispatch Technical Site Inspection",
      actionLabel: "Proceed to Site Inspections (Step 2)",
      actionPath: "/site-inspections",
      technicalTip: "SEC standard requires minimum 25% continuous headroom and verifying 3x motor inrush on Direct-On-Line (DOL) starters.",
      suggestedPrompt: "How do I calculate motor starting inrush for a 260 kW continuous load generator?",
    };
  }

  // Step 2: Technical Sizing & Site Inspections
  if (pathname.startsWith("/site-inspections")) {
    return {
      stepNumber: 2,
      stageName: "Step 2 of 8 • Pre-Sales Technical Sizing",
      message: "Site Survey & Technical Feasibility Assessment",
      explanation: "Review field measurements: peak load, inrush multiplier, cable route meters, and soil load-bearing capacity before commercial quoting.",
      recommendedAction: "Review Site Survey Cockpit",
      actionLabel: "Review Survey Cockpit (Step 2)",
      actionPath: pathname,
      technicalTip: "Pre-populating CPQ locks certified survey BoQ specifications and prevents sizing errors or rate leakage.",
      suggestedPrompt: "What technical checks must be verified before approving generator site inspection?",
    };
  }

  // Step 3: Sales Pipeline & Commercial Deals
  if (pathname.startsWith("/pipeline") || pathname.startsWith("/opportunities") || pathname.startsWith("/deals")) {
    return {
      stepNumber: 3,
      stageName: "Step 3 of 8 • Commercial Sales Pipeline",
      message: "Commercial opportunity qualification & stage velocity",
      explanation: "Review deal margin, pricing multipliers, and equipment specifications before generating formal client quotation.",
      recommendedAction: "Configure Commercial Rental Package in CPQ",
      actionLabel: "Build Commercial Quote (Step 4)",
      actionPath: "/rental-cpq/builder",
      technicalTip: "KSA commercial power rentals require a minimum 30-day billing cycle with separate mobilization line items.",
      suggestedPrompt: "What are standard mob/demob fee structures across Riyadh and Eastern Province hubs?",
    };
  }

  // Step 4: Rental CPQ Quoting & Sizing
  if (pathname.startsWith("/rental-cpq") || pathname.startsWith("/quotes")) {
    return {
      stepNumber: 4,
      stageName: "Step 4 of 8 • Rental CPQ Quoting & Rate Card",
      message: "Generator package & auxiliary BoQ items configured",
      explanation: "Quotation total and commercial terms calculated. Submit for financial credit underwriting or fast-track 100% advance deposit gate.",
      recommendedAction: "Submit Quote for KYC & Credit Underwriting",
      actionLabel: "Open Credit & KYC Desk (Step 5)",
      actionPath: "/credit-kyc",
      technicalTip: "100% Advance Payment automatically clears credit risk and bypasses corporate underwriting delays. 30/60-day terms require SIMAH verification.",
      suggestedPrompt: "How does 100% advance payment expedite mobilization clearance under Energia credit policy?",
    };
  }

  // Step 5: Financial KYC & Credit Gate
  if (pathname.startsWith("/credit-kyc")) {
    return {
      stepNumber: 5,
      stageName: "Step 5 of 8 • Financial KYC & Credit Gate",
      message: "Corporate risk evaluation & payment security verification",
      explanation: "Verify commercial registration (CR), SIMAH credit rating, and approve payment terms. Once approved, proceed to contract drafting.",
      recommendedAction: "Generate Master Rental Agreement & SLAs",
      actionLabel: "Draft Rental Contract (Step 6)",
      actionPath: "/rental-contracts",
      technicalTip: "Contracts cannot be signed until either 100% advance payment is received or underwriters approve credit limit.",
      suggestedPrompt: "What documents are legally required for corporate SIMAH credit verification in KSA?",
    };
  }

  // Step 6: Master Rental Agreement & SLAs
  if (pathname.startsWith("/rental-contracts")) {
    return {
      stepNumber: 6,
      stageName: "Step 6 of 8 • Master Rental Agreement Assembly",
      message: "Formulate & Execute Master Equipment Rental Agreement",
      explanation: "Draft the legal equipment lease, attach technical BoQ specifications, and secure client & company digital signatures before fleet dispatch.",
      recommendedAction: "Generate Contract & Complete Dual Signatures",
      actionLabel: "Generate & Sign Contract (Step 6)",
      actionPath: "/rental-contracts",
      technicalTip: "Energia standard requires dual digital execution (Client Signatory + Regional Director) to activate the 4-hour SLA warranty.",
      suggestedPrompt: "What legal clauses are mandatory in industrial power rental agreements in Saudi Arabia?",
    };
  }

  // Step 8: Executive Governance & Approvals
  if (pathname.startsWith("/approval-queue") || pathname.startsWith("/approvals")) {
    return {
      stepNumber: 8,
      stageName: "Step 8 of 8 • Executive Governance & Approvals",
      message: "Executive sign-off queue for high-value contracts and rate discounts",
      explanation: "Review pending rate variance exceptions, extended credit terms, and non-standard equipment clauses to unblock dispatch.",
      recommendedAction: "Approve Terms & Return to Fleet Desk",
      actionLabel: "Inspect Fleet Dispatch (Step 7)",
      actionPath: "/fleet-availability",
      technicalTip: "Commercial discounts >15% off standard tariff require Regional Commercial Director sign-off.",
      suggestedPrompt: "What triggers an automated escalation to the Executive Approval Queue?",
    };
  }

  // Default / Step 7: Operations & Fleet Availability Desk / Dashboard
  return {
    stepNumber: 7,
    stageName: "Step 7 of 8 • Operations & Fleet Telemetry",
    message: "Regional fleet dispatch & real-time load telemetry active",
    explanation: "342 units deployed (90% load factor) across Riyadh, Jubail, and Dammam. Review live SCADA telemetry or qualify new inbound leads.",
    recommendedAction: "Inspect New Inbound Lead Opportunities",
    actionLabel: "Qualify Inbound Leads (Step 1)",
    actionPath: "/leads",
    technicalTip: "Tier 3 Cummins/Perkins generators running >85% continuous load require oil and filter service every 250 engine hours.",
    suggestedPrompt: "How do I optimize fleet allocation between Riyadh and Jubail hubs to maximize rental yield?",
  };
}

export function VolviAssistProvider({ children }: { children: ReactNode }) {
  const { themeColor } = useBrand();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, token } = useAuth();

  const isPublicRoute =
    location.pathname === "/login" ||
    location.pathname.startsWith("/quote") ||
    location.pathname.startsWith("/q/") ||
    location.pathname.startsWith("/kyc/") ||
    location.pathname.startsWith("/feedback/");

  const shouldShowGuide = Boolean(isAuthenticated && token && !isPublicRoute);

  const [isAssistOpen, setIsAssistOpen] = useState(false);
  const [activeAssistTab, setActiveAssistTab] = useState<VolviTab>("copilot");
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [currentPrompt, setCurrentPrompt] = useState("");
  const [customGuidance, setCustomGuidance] = useState<VolviStepGuidance | null>(null);
  const [isMinimized, setIsMinimized] = useState(() => {
    return localStorage.getItem("volvi_guide_minimized") === "true";
  });
  const [isPaused, setIsPaused] = useState<boolean>(() => {
    return sessionStorage.getItem("volvi_guide_paused") === "true";
  });
  const [isParkedTrayOpen, setIsParkedTrayOpen] = useState<boolean>(false);

  // Multi-Task Queue (Up to 5 concurrent parked tasks)
  const [parkedTasks, setParkedTasks] = useState<ParkedTask[]>(() => {
    try {
      const saved = sessionStorage.getItem("volvi_parked_tasks");
      if (saved) return JSON.parse(saved);
      const single = sessionStorage.getItem("volvi_parked_task");
      if (single) return [JSON.parse(single)];
      return [];
    } catch {
      return [];
    }
  });

  // Set of dismissed tasks in the current session
  const [dismissedTasks, setDismissedTasks] = useState<string[]>(() => {
    try {
      const saved = sessionStorage.getItem("volvi_dismissed_tasks");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [guidanceHistory, setGuidanceHistory] = useState<VolviStepGuidance[]>([]);

  const prevLocationRef = useRef<string>(
    sessionStorage.getItem("volvi_prev_url") || (location.pathname + location.search)
  );
  const currentGuidanceRef = useRef<VolviStepGuidance | null>(null);

  // Sync isMinimized to localStorage
  useEffect(() => {
    localStorage.setItem("volvi_guide_minimized", String(isMinimized));
  }, [isMinimized]);

  // Sync isPaused to sessionStorage
  useEffect(() => {
    sessionStorage.setItem("volvi_guide_paused", String(isPaused));
  }, [isPaused]);

  // Sync parkedTasks to sessionStorage
  useEffect(() => {
    if (parkedTasks.length > 0) {
      sessionStorage.setItem("volvi_parked_tasks", JSON.stringify(parkedTasks));
      sessionStorage.setItem("volvi_parked_task", JSON.stringify(parkedTasks[0]));
    } else {
      sessionStorage.removeItem("volvi_parked_tasks");
      sessionStorage.removeItem("volvi_parked_task");
    }
  }, [parkedTasks]);

  // Keep ref up to date
  useEffect(() => {
    currentGuidanceRef.current = customGuidance;
  }, [customGuidance]);

  // Intelligent Auto-Sync & Auto-Parking on Navigation
  useEffect(() => {
    const prevUrl = prevLocationRef.current;
    const currentUrl = location.pathname + location.search;

    if (prevUrl !== currentUrl) {
      if (!isAuthenticated || !token || isPublicRoute) {
        prevLocationRef.current = currentUrl;
        return;
      }
      const prevGuidance = currentGuidanceRef.current || getRouteDefaultGuidance(prevUrl);
      const newGuidance = getRouteDefaultGuidance(location.pathname);

      // 1. If we return to a parked task's original page, automatically unpark/clear it
      const matchedParkedIndex = parkedTasks.findIndex(
        t => currentUrl === t.path || location.pathname === t.path.split("?")[0]
      );
      if (matchedParkedIndex !== -1) {
        setParkedTasks(prev => prev.filter((_, idx) => idx !== matchedParkedIndex));
      } 
      // 2. If leaving an active workflow step and moving to a different step/page, auto-park up to 5 tasks!
      else if (prevGuidance && prevGuidance.stepNumber && prevGuidance.stepNumber !== newGuidance.stepNumber) {
        const titleCandidate = prevGuidance.stageName.includes("•") 
          ? prevGuidance.stageName.split("•")[1]?.trim() 
          : prevGuidance.message || prevGuidance.stageName;

        const newTask: ParkedTask = {
          id: prevGuidance.id || String(Date.now()),
          title: titleCandidate,
          stepNumber: prevGuidance.stepNumber,
          stageName: prevGuidance.stageName,
          path: prevUrl,
          actionLabel: prevGuidance.actionLabel,
          parkedAt: Date.now()
        };

        setParkedTasks(prev => {
          const filtered = prev.filter(t => t.path !== prevUrl && t.id !== newTask.id);
          return [newTask, ...filtered].slice(0, 5); // Keep at most 5 tasks
        });
      }

      // 3. Auto-Sync: Reset custom guidance so the current page's default lifecycle step appears immediately
      setCustomGuidance(null);
      prevLocationRef.current = currentUrl;
      sessionStorage.setItem("volvi_prev_url", currentUrl);
    }
  }, [location.pathname, location.search, parkedTasks]);

  const resumeParkedTask = (taskId?: string) => {
    const target = taskId ? parkedTasks.find(t => t.id === taskId) : parkedTasks[0];
    if (target) {
      const targetPath = target.path;
      setParkedTasks(prev => prev.filter(t => t.id !== target.id));
      setIsPaused(false);
      navigate(targetPath);
    }
  };

  const clearParkedTask = (taskId?: string) => {
    if (taskId) {
      setParkedTasks(prev => prev.filter(t => t.id !== taskId));
    } else {
      setParkedTasks(prev => prev.slice(1));
    }
  };

  const clearAllParkedTasks = () => {
    setParkedTasks([]);
  };

  const dismissActiveTask = () => {
    const active = customGuidance || getRouteDefaultGuidance(location.pathname);
    const key = active.id || active.message || active.stageName;
    setDismissedTasks(prev => {
      const updated = [...prev.filter(k => k !== key), key];
      try {
        sessionStorage.setItem("volvi_dismissed_tasks", JSON.stringify(updated));
      } catch {}
      return updated;
    });
    setCustomGuidance(null);
  };

  const parkCurrentTask = (override?: Partial<ParkedTask>) => {
    const active = customGuidance || getRouteDefaultGuidance(location.pathname);
    const newTask: ParkedTask = {
      id: override?.id || String(Date.now()),
      title: override?.title || active.message || active.stageName,
      stepNumber: override?.stepNumber || active.stepNumber || 1,
      stageName: override?.stageName || active.stageName,
      path: override?.path || location.pathname + location.search,
      actionLabel: override?.actionLabel || active.actionLabel,
      parkedAt: Date.now()
    };
    setParkedTasks(prev => [newTask, ...prev.filter(t => t.id !== newTask.id)].slice(0, 5));
  };

  const openAssist = (prompt?: string, tab?: VolviTab) => {
    if (prompt) {
      setCurrentPrompt(prompt);
      setActiveAssistTab("copilot");
    } else if (tab) {
      setActiveAssistTab(tab);
    }
    setIsAssistOpen(true);
  };

  const closeAssist = () => {
    setIsAssistOpen(false);
  };

  const toggleAssist = () => {
    setIsAssistOpen(prev => !prev);
  };

  const dismissGuidance = () => {
    setIsMinimized(true);
  };

  const triggerGuidance = (guidance: VolviStepGuidance) => {
    const key = guidance.id || guidance.message || guidance.stageName;
    if (dismissedTasks.includes(key)) {
      // User explicitly dismissed this task recommendation! Respect their choice.
      return;
    }
    setCustomGuidance(guidance);
    setIsMinimized(false);
    setIsPaused(false);
    setGuidanceHistory(prev => [guidance, ...prev.slice(0, 19)]);
  };

  // Compute displayed guidance: custom override takes precedence, fallback to permanent route guidance
  const displayedGuidance: VolviStepGuidance = customGuidance || getRouteDefaultGuidance(location.pathname);
  const currentStep = displayedGuidance.stepNumber || 1;
  const isDismissable = Boolean(
    customGuidance ||
    displayedGuidance.message.toLowerCase().includes("action required") ||
    displayedGuidance.message.toLowerCase().includes("approved")
  );

  const handleActionClick = () => {
    const action = displayedGuidance.onAction;
    const path = displayedGuidance.actionPath;
    if (action) {
      action();
    } else if (path) {
      navigate(path);
    }
  };

  return (
    <VolviAssistContext.Provider
      value={{
        isAssistOpen,
        openAssist,
        closeAssist,
        toggleAssist,
        activeGuidance: displayedGuidance,
        triggerGuidance,
        dismissGuidance,
        dismissActiveTask,
        guidanceHistory,
        currentPrompt,
        setCurrentPrompt,
        activeAssistTab,
        setActiveAssistTab,
        unreadCount,
        setUnreadCount,
        isMinimized,
        setIsMinimized,
        isPaused,
        setIsPaused,
        parkedTask: parkedTasks[0] || null,
        parkedTasks,
        resumeParkedTask,
        clearParkedTask,
        clearAllParkedTasks,
        parkCurrentTask,
      }}
    >
      {children}

      {/* FLOATING PROACTIVE NEXT-STEP POP-UP (VOLVI GUIDE) - ONLY SHOWN WHEN AUTHENTICATED */}
      {shouldShowGuide && (
        isMinimized ? (
          /* Sleek Minimized Floating Pill */
        <aside
          aria-label="Volvi Guide Minimized Step"
          className="fixed bottom-6 right-6 z-50 pointer-events-auto animate-fade-in"
        >
          <button
            type="button"
            onClick={() => setIsMinimized(false)}
            className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-white hover:bg-slate-50 text-[var(--crm-text-heading)] shadow-[0_8px_24px_rgba(37,99,235,0.18)] border border-[var(--crm-primary)] cursor-pointer active:scale-95 transition-all group"
            title="Expand Volvi Guide Next Step Guidance"
          >
            <div className="w-6 h-6 rounded-lg bg-[var(--crm-primary-soft)] border border-[var(--crm-chip-light)] flex items-center justify-center text-[var(--crm-primary)] shadow-2xs">
              {isPaused ? <Pause className="w-3.5 h-3.5 text-amber-600" /> : <Bot className="w-3.5 h-3.5 animate-pulse text-[var(--crm-primary)]" />}
            </div>
            <div className="text-left">
              <div className="text-[9px] font-black uppercase tracking-wider text-[#64748B] flex items-center gap-1.5">
                <span>{isPaused ? "Volvi Guide • Paused" : `Volvi Guide • Step ${currentStep} of 8`}</span>
                {parkedTasks.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800 text-[9px] font-black shadow-xs border border-amber-200">
                    {parkedTasks.length} Paused
                  </span>
                )}
              </div>
              <div className="text-xs font-black text-[#0F172A] flex items-center gap-1">
                <span>{isPaused ? "Free Exploration Mode" : displayedGuidance.actionLabel}</span>
                {!isPaused && <ArrowRight className="w-3 h-3 text-[var(--crm-primary)] group-hover:translate-x-0.5 transition-transform" />}
              </div>
            </div>
            <Maximize2 className="w-3.5 h-3.5 text-[#64748B] ml-1 group-hover:text-[var(--crm-primary)] transition-colors" />
          </button>
        </aside>
      ) : (
        /* Full Floating Step Box Pop-up (Permanently Docked) */
        <aside
          aria-label="Volvi Guide Next Step Guidance"
          className="fixed bottom-6 right-6 z-50 max-w-sm sm:max-w-md w-full bg-white text-[var(--crm-text-body)] rounded-3xl shadow-[0_8px_24px_rgba(37,99,235,0.18)] border border-[var(--crm-primary)] p-5 animate-fade-in transition-all pointer-events-auto"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-[var(--crm-row-divider)]">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-xl bg-[var(--crm-primary-soft)] border border-[var(--crm-chip-light)] flex items-center justify-center text-[var(--crm-primary)] shadow-2xs">
                {isPaused ? <Pause className="w-4 h-4 text-amber-600" /> : <Bot className="w-4 h-4 animate-pulse" />}
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-black tracking-tight text-[#0F172A] uppercase">Volvi Guide</span>
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                    isPaused 
                      ? "bg-amber-50 text-amber-700 border-amber-200" 
                      : "bg-[#DCFCE7] text-[#16A34A] border-emerald-200"
                  }`}>
                    {isPaused ? "Free Roam Mode" : `Step ${currentStep} of 8`}
                  </span>
                </div>
                <div className="text-[10px] text-[#64748B] font-semibold mt-0.5">
                  {isPaused ? "Next-step nudges paused" : displayedGuidance.stageName}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {/* Pause / Resume Exploration Mode Button */}
              <button
                type="button"
                onClick={() => setIsPaused(prev => !prev)}
                className={`p-1.5 rounded-lg transition cursor-pointer ${
                  isPaused 
                    ? "bg-amber-400 text-slate-900 font-black shadow-xs ring-1 ring-amber-300" 
                    : "text-[#64748B] hover:text-[#0F172A] hover:bg-slate-100"
                }`}
                title={isPaused ? "Resume Smart Guidance" : "Pause Guidance (Free Exploration Mode)"}
              >
                {isPaused ? <Play className="w-3.5 h-3.5 fill-current" /> : <Pause className="w-3.5 h-3.5" />}
              </button>

              {/* Minimize Button */}
              <button
                type="button"
                onClick={() => setIsMinimized(true)}
                className="p-1.5 text-[#64748B] hover:text-[#0F172A] hover:bg-slate-100 rounded-lg transition cursor-pointer"
                title="Minimize Volvi Guide"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Multi-Task Queue (Up to 5 Paused Tasks) */}
          {parkedTasks.length > 0 && !isPaused && (
            <div className="mt-3 p-2.5 rounded-2xl bg-amber-50/80 border border-amber-200 shadow-xs animate-fade-in">
              {/* Header */}
              <div className="flex items-center justify-between pb-1.5 border-b border-amber-200/80">
                <button
                  type="button"
                  onClick={() => setIsParkedTrayOpen(prev => !prev)}
                  className="flex items-center gap-2 cursor-pointer group text-left"
                >
                  <div className="w-5 h-5 rounded-lg bg-amber-200/60 flex items-center justify-center text-amber-800 shrink-0">
                    <Pause className="w-3 h-3" />
                  </div>
                  <span className="text-[10px] uppercase font-black text-amber-800 tracking-wider flex items-center gap-1 group-hover:text-amber-900">
                    <span>Paused Tasks ({parkedTasks.length}/5)</span>
                    <ChevronDown className={`w-3 h-3 transition-transform ${isParkedTrayOpen ? "rotate-180" : ""}`} />
                  </span>
                </button>

                <button
                  type="button"
                  onClick={clearAllParkedTasks}
                  className="text-[9px] font-bold text-slate-500 hover:text-rose-600 transition cursor-pointer"
                  title="Clear all paused tasks"
                >
                  Clear All
                </button>
              </div>

              {/* Parked Tasks List */}
              <div className="mt-2 space-y-1.5 max-h-48 overflow-y-auto pr-0.5">
                {(isParkedTrayOpen ? parkedTasks : [parkedTasks[0]]).map((task) => (
                  <div key={task.id} className="p-2 rounded-xl bg-white border border-amber-100 flex items-center justify-between gap-2 text-xs">
                    <div className="min-w-0 pr-1">
                      <div className="text-[9px] font-bold text-amber-700 truncate">
                        Step {task.stepNumber} of 8
                      </div>
                      <div className="text-[11px] font-bold text-[#0F172A] truncate" title={task.title}>
                        {task.title}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => resumeParkedTask(task.id)}
                        className="px-2.5 py-1 rounded-xl bg-[var(--crm-primary)] hover:bg-[var(--crm-primary-hover)] text-white text-[10px] font-black shadow-xs flex items-center gap-1 cursor-pointer transition active:scale-95"
                        title="Resume this task where you left off"
                      >
                        <span>Resume</span>
                        <ArrowUpRight className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => clearParkedTask(task.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded-lg transition cursor-pointer"
                        title="Cancel / Dismiss this paused task"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {!isParkedTrayOpen && parkedTasks.length > 1 && (
                <button
                  type="button"
                  onClick={() => setIsParkedTrayOpen(true)}
                  className="w-full text-center text-[10px] text-amber-700 hover:text-amber-900 font-bold mt-1.5 pt-1 border-t border-amber-200 transition cursor-pointer"
                >
                  + {parkedTasks.length - 1} more paused task{parkedTasks.length > 2 ? "s" : ""} (Click to expand)
                </button>
              )}
            </div>
          )}

          {/* Body: Paused Free Exploration Mode */}
          {isPaused ? (
            <div className="mt-3 p-3 rounded-2xl bg-amber-50/60 border border-amber-200">
              <div className="flex items-center gap-2 text-amber-800 text-xs font-black">
                <Pause className="w-4 h-4 shrink-0" />
                <span>Guidance Paused • Free Exploration Mode</span>
              </div>
              <p className="text-[11px] text-[#334155] mt-1.5 leading-relaxed font-medium">
                You can test inbound leads, browse opportunities, or inspect reports freely. Volvi Guide won't interrupt you until you resume.
              </p>
              <button
                type="button"
                onClick={() => setIsPaused(false)}
                className="mt-3 w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center justify-center gap-1.5 transition cursor-pointer active:scale-95 shadow-xs"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Resume Smart Guidance</span>
              </button>
            </div>
          ) : (
            /* Body: Active Smart Guidance */
            <div className="mt-3">
              <div className="flex items-start gap-1.5 text-emerald-600 text-xs font-black">
                <span>✓</span>
                <span className="text-[#0F172A]">{displayedGuidance.message}</span>
              </div>

              <div className="mt-2 text-xs text-[#334155] leading-relaxed font-medium">
                <span className="text-[var(--crm-primary)] font-extrabold mr-1">Recommended Next Step:</span>
                {displayedGuidance.explanation}
              </div>

              {/* Technical RAG Callout Tip */}
              {displayedGuidance.technicalTip && (
                <div className="mt-3 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 flex items-start gap-2 shadow-2xs">
                  <Zap className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                  <span className="font-semibold leading-tight">{displayedGuidance.technicalTip}</span>
                </div>
              )}

              {/* Action Buttons Row with Dismiss / Cancel Task */}
              <div className="mt-4 pt-3 border-t border-[var(--crm-row-divider)] flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleActionClick}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-white font-black text-xs shadow-xs transition-all cursor-pointer active:scale-95 bg-[var(--crm-primary)] hover:bg-[var(--crm-primary-hover)]"
                >
                  <span>{displayedGuidance.actionLabel}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                {/* Dismiss / Cancel Active Task Button */}
                {isDismissable && (
                  <button
                    type="button"
                    onClick={dismissActiveTask}
                    className="px-3 py-2.5 rounded-xl bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-600 font-bold text-xs border border-slate-200 flex items-center gap-1 transition cursor-pointer active:scale-95 shrink-0"
                    title="Cancel or dismiss this recommendation"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Dismiss</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    const prompt = displayedGuidance.suggestedPrompt || `Explain next step for ${displayedGuidance.message}`;
                    openAssist(prompt, "copilot");
                  }}
                  className="px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#334155] font-bold text-xs border border-slate-200 flex items-center gap-1.5 transition cursor-pointer active:scale-95 shrink-0"
                  title="Open in Volvi Copilot"
                >
                  <Bot className="w-3.5 h-3.5 text-[var(--crm-primary)]" />
                  <span>Ask Copilot</span>
                </button>
              </div>

              {/* 8-Stage Lifecycle Progress Segment */}
              <div className="mt-3.5 pt-2 border-t border-[var(--crm-row-divider)] flex items-center justify-between text-[10px] text-[#64748B]">
                <span className="font-bold text-[var(--crm-text-heading)]">
                  Lifecycle Progress
                </span>
                <div className="flex items-center gap-1">
                  {LIFECYCLE_STEPS.map((step) => {
                    const isDone = step.num < currentStep;
                    const isCurrent = step.num === currentStep;
                    return (
                      <span
                        key={step.num}
                        title={`Step ${step.num}: ${step.name}`}
                        className={`h-1.5 rounded-full transition-all ${
                          isCurrent
                            ? "w-4 bg-[var(--crm-primary)] ring-2 ring-[var(--crm-primary)]/40 animate-pulse"
                            : isDone
                            ? "w-2 bg-emerald-500"
                            : "w-1.5 bg-slate-200"
                        }`}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </aside>
      ))}
    </VolviAssistContext.Provider>
  );
}

export function useVolviAssist() {
  const context = useContext(VolviAssistContext);
  if (!context) {
    throw new Error("useVolviAssist must be used within a VolviAssistProvider");
  }
  return context;
}
