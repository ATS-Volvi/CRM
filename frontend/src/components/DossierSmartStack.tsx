import React, { useState } from "react";
import {
  Layers,
  Maximize2,
  Minimize2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

export interface StackItem {
  id: string;
  label: string;
  shortLabel?: string;
  badge?: string | number | null;
  badgeColor?: string;
  icon: React.ReactNode;
  content: React.ReactNode;
}

export interface DossierSmartStackProps {
  items: StackItem[];
  defaultTab?: string;
  title?: string;
  className?: string;
}

export const DossierSmartStack: React.FC<DossierSmartStackProps> = ({
  items,
  defaultTab,
  title = "Dossier Smart Stack",
  className = ""
}) => {
  const [activeIndex, setActiveIndex] = useState(() => {
    if (defaultTab) {
      const idx = items.findIndex((it) => it.id === defaultTab);
      return idx >= 0 ? idx : 0;
    }
    return 0;
  });

  const [isExpanded, setIsExpanded] = useState(false);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  if (items.length === 0) return null;

  const currentItem = items[activeIndex] || items[0];

  const handlePrev = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setActiveIndex((prev) => (prev > 0 ? prev - 1 : items.length - 1));
  };

  const handleNext = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setActiveIndex((prev) => (prev < items.length - 1 ? prev + 1 : 0));
  };

  // Touch swipe support (left = next, right = prev)
  const onTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.touches[0].clientX);
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX - touchEndX;
    if (diff > 45) {
      handleNext();
    } else if (diff < -45) {
      handlePrev();
    }
    setTouchStartX(null);
  };

  return (
    <div className={`relative transition-all duration-300 ${className}`}>
      {/* Visual iOS Stack 3D Layered Cards (visible when collapsed) */}
      {!isExpanded && (
        <>
          <div className="absolute -bottom-1.5 left-4 right-4 h-3 bg-slate-200/70 dark:bg-slate-800/60 rounded-b-2xl -z-10 border-b border-x border-slate-300/40 dark:border-slate-700/40 shadow-xs pointer-events-none transition-all duration-200" />
          <div className="absolute -bottom-3 left-8 right-8 h-3 bg-slate-100/80 dark:bg-slate-800/30 rounded-b-xl -z-20 border-b border-x border-slate-200/50 dark:border-slate-800/40 shadow-xs pointer-events-none transition-all duration-200" />
        </>
      )}

      {/* Main Bundle Card Surface */}
      <div 
        onTouchStart={!isExpanded ? onTouchStart : undefined}
        onTouchEnd={!isExpanded ? onTouchEnd : undefined}
        className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05),0_1px_3px_rgba(0,0,0,0.03)] p-4 sm:p-5 relative overflow-hidden transition-all duration-200 select-text"
      >
        {/* Top Header: Bundle Title & Expand/Collapse Toggle */}
        <div className="flex items-center justify-between gap-3 pb-3.5 mb-3.5 border-b border-slate-100 dark:border-slate-800/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#17614A] to-emerald-600 text-white flex items-center justify-center shadow-2xs shrink-0">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-wider font-extrabold text-emerald-800/80 dark:text-emerald-400/80 block leading-tight">
                Smart Stack Card
              </span>
              <h3 className="text-sm font-black text-slate-900 dark:text-white leading-tight">
                {title}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-emerald-700 dark:hover:text-emerald-400 bg-slate-50 dark:bg-slate-800/80 hover:bg-emerald-50/70 dark:hover:bg-emerald-950/30 transition-all cursor-pointer border border-slate-200/80 dark:border-slate-700 hover:border-emerald-300 dark:hover:border-emerald-700 shadow-2xs active:scale-95"
              title={isExpanded ? "Collapse to single card bundle" : "Expand all cards in full"}
            >
              {isExpanded ? (
                <>
                  <Minimize2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Collapse Stack</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Expand All ({items.length})</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* ── BUNDLED VIEW: Single Active Card with Segmented Switcher & Stack Pager ── */}
        {!isExpanded ? (
          <div className="space-y-4">
            {/* Segmented Pill Switcher */}
            <div className="bg-slate-100/80 dark:bg-slate-800/70 p-1 rounded-xl flex items-center gap-1 border border-slate-200/70 dark:border-slate-700/70 overflow-x-auto no-scrollbar">
              {items.map((item, idx) => {
                const isActive = idx === activeIndex;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveIndex(idx)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg text-xs transition-all cursor-pointer font-bold whitespace-nowrap ${
                      isActive
                        ? "bg-[#17614A] text-white shadow-xs"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/80 dark:hover:bg-slate-700/60"
                    }`}
                  >
                    <span className={isActive ? "text-white" : "text-slate-500 dark:text-slate-400"}>
                      {item.icon}
                    </span>
                    <span>{item.shortLabel || item.label}</span>
                    {item.badge !== undefined && item.badge !== null && (
                      <span
                        className={`text-[9px] font-black px-1.5 py-0.2 rounded-full shrink-0 transition-colors ${
                          isActive
                            ? "bg-white/20 text-white"
                            : item.badgeColor || "bg-slate-200/70 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Active Widget Content Body */}
            <div className="min-h-[220px] transition-all duration-200 py-1">
              {currentItem.content}
            </div>

            {/* Stack Pagination Dots & Swipe Arrows Footer */}
            <div className="pt-3.5 mt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <button
                onClick={(e) => handlePrev(e)}
                className="px-2.5 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 font-semibold text-xs transition cursor-pointer flex items-center gap-1 active:scale-95"
                title="Previous card in stack"
              >
                <ChevronLeft className="w-4 h-4" />
                <span className="text-[11px] font-medium hidden sm:inline">Prev</span>
              </button>

              <div className="flex items-center gap-1.5">
                {items.map((item, idx) => (
                  <button
                    key={item.id}
                    onClick={() => setActiveIndex(idx)}
                    className={`transition-all rounded-full cursor-pointer ${
                      idx === activeIndex
                        ? "w-5 h-1.5 bg-[#17614A] dark:bg-emerald-500"
                        : "w-1.5 h-1.5 bg-slate-300 dark:bg-slate-700 hover:bg-slate-400"
                    }`}
                    title={`Switch to ${item.label}`}
                  />
                ))}
                <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 ml-1.5 tabular-nums">
                  {activeIndex + 1} of {items.length}
                </span>
                <span className="text-[11px] text-slate-400 hidden md:inline ml-1 font-medium">
                  • Swipe or click to flip
                </span>
              </div>

              <button
                onClick={(e) => handleNext(e)}
                className="px-2.5 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 font-semibold text-xs transition cursor-pointer flex items-center gap-1 active:scale-95"
                title="Next card in stack"
              >
                <span className="text-[11px] font-medium hidden sm:inline">Next</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          /* ── EXPANDED VIEW: All Widgets Rendered In Full Depth ── */
          <div className="space-y-6 pt-1 animate-fade-in">
            {items.map((item, idx) => (
              <div
                key={item.id}
                className={`space-y-3.5 ${
                  idx > 0 ? "pt-5 border-t border-slate-200/80 dark:border-slate-800" : ""
                }`}
              >
                {/* Section Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-200/70 dark:border-emerald-800 shadow-2xs">
                      {item.icon}
                    </div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                      {item.label}
                    </h4>
                  </div>
                  {item.badge !== undefined && item.badge !== null && (
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shadow-2xs">
                      {item.badge}
                    </span>
                  )}
                </div>

                {/* Section Content */}
                <div className="text-xs">
                  {item.content}
                </div>
              </div>
            ))}

            {/* Bottom Collapse Button */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 text-center">
              <button
                onClick={() => setIsExpanded(false)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition cursor-pointer border border-emerald-200/80 dark:border-emerald-800 shadow-2xs active:scale-95"
              >
                <Minimize2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Collapse back to Smart Stack</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
