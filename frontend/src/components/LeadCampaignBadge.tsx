import React, { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Target, Calendar, Tag, ArrowUpRight, Layers, Clock } from "lucide-react";
import type { CampaignAttributionSummary, CampaignAttributionTouch } from "../types/marketing";

interface LeadCampaignBadgeProps {
  attribution?: CampaignAttributionSummary | null;
  className?: string;
  showIcon?: boolean;
}

export const LeadCampaignBadge: React.FC<LeadCampaignBadgeProps> = ({
  attribution,
  className = "",
  showIcon = true
}) => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [popoverPos, setPopoverPos] = useState<{ x: number; y: number; flipped: boolean }>({
    x: 0,
    y: 0,
    flipped: false
  });

  const badgeRef = useRef<HTMLDivElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  if (!attribution || !attribution.lastTouch) {
    return null;
  }

  const { lastTouch, firstTouch, touches = [] } = attribution;
  const campaignCode = lastTouch.campaignCode || lastTouch.campaignName || "NO-CODE";
  const campaignName = lastTouch.campaignName || "Untitled Campaign";

  const updatePosition = useCallback(() => {
    if (!badgeRef.current) return;
    const rect = badgeRef.current.getBoundingClientRect();
    const POPOVER_WIDTH = 340;
    const POPOVER_APPROX_HEIGHT = 280;

    const flipped = rect.top < POPOVER_APPROX_HEIGHT + 24;
    const x = Math.max(12, Math.min(rect.left, window.innerWidth - POPOVER_WIDTH - 12));
    const y = flipped ? rect.bottom + 8 : rect.top - 8;

    setPopoverPos({ x, y, flipped });
  }, []);

  const handleOpen = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    updatePosition();
    setIsOpen(true);
  };

  const handleScheduleClose = () => {
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    closeTimeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 160);
  };

  const handleBadgeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // On touch screens or click: navigate to campaign
    if (lastTouch.campaignId) {
      navigate(`/campaigns/${lastTouch.campaignId}`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      e.stopPropagation();
      if (lastTouch.campaignId) {
        navigate(`/campaigns/${lastTouch.campaignId}`);
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  // Close on outside click (especially on touch devices)
  useEffect(() => {
    if (!isOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        badgeRef.current &&
        !badgeRef.current.contains(e.target as Node) &&
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [isOpen]);

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return "—";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return "—";
      return d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric"
      });
    } catch {
      return "—";
    }
  };

  const formatDateTime = (dateStr?: string | null) => {
    if (!dateStr) return "—";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return "—";
      return d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric"
      });
    } catch {
      return "—";
    }
  };

  // Cap touches list at 4 items
  const MAX_TOUCHES = 4;
  const displayedTouches = touches.slice(0, MAX_TOUCHES);
  const remainingTouchesCount = Math.max(0, touches.length - MAX_TOUCHES);

  return (
    <>
      <div
        ref={badgeRef}
        onClick={handleBadgeClick}
        onMouseEnter={handleOpen}
        onMouseLeave={handleScheduleClose}
        onFocus={handleOpen}
        onBlur={handleScheduleClose}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="button"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        title={`Attributed Campaign: ${campaignCode} (${campaignName})`}
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold bg-purple-50 dark:bg-purple-950/70 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 hover:bg-purple-100 dark:hover:bg-purple-900/50 hover:border-purple-300 transition-all cursor-pointer select-none focus:outline-none focus:ring-2 focus:ring-purple-500/30 ${className}`}
      >
        {showIcon && <Target className="w-3 h-3 text-purple-600 dark:text-purple-400 shrink-0" />}
        <span className="max-w-[120px] truncate font-mono tracking-tight">{campaignCode}</span>
      </div>

      {/* Hover Card Popover using position: fixed to escape table clipping */}
      {isOpen && (
        <div
          ref={popoverRef}
          onMouseEnter={handleOpen}
          onMouseLeave={handleScheduleClose}
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "fixed",
            left: popoverPos.x,
            top: popoverPos.flipped ? popoverPos.y : undefined,
            bottom: !popoverPos.flipped ? window.innerHeight - popoverPos.y : undefined,
            width: 340,
            zIndex: 9999
          }}
          className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xl p-4 text-left animate-in fade-in zoom-in-95 duration-150 space-y-3"
        >
          {/* Header Row */}
          <div className="flex items-start justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2.5">
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-900/60 text-purple-800 dark:text-purple-200 border border-purple-200 dark:border-purple-800">
                  {campaignCode}
                </span>
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                  {lastTouch.channel || "Other"}
                </span>
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                  {lastTouch.status || "ACTIVE"}
                </span>
              </div>
              <h4 className="text-xs font-bold text-slate-900 dark:text-white break-words line-clamp-2">
                {campaignName}
              </h4>
            </div>

            <button
              onClick={() => {
                if (lastTouch.campaignId) {
                  navigate(`/campaigns/${lastTouch.campaignId}`);
                }
              }}
              title="View Campaign"
              className="p-1 rounded-lg text-slate-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950 transition-colors shrink-0"
            >
              <ArrowUpRight className="w-4 h-4" />
            </button>
          </div>

          {/* Campaign Metadata Details */}
          <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 dark:text-slate-400">
            <div>
              <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Calendar className="w-3 h-3" /> Schedule
              </div>
              <div className="font-medium text-slate-800 dark:text-slate-200 truncate mt-0.5">
                {lastTouch.startDate || lastTouch.endDate ? (
                  `${formatDate(lastTouch.startDate)} - ${formatDate(lastTouch.endDate)}`
                ) : (
                  "Ongoing"
                )}
              </div>
            </div>

            <div>
              <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Tag className="w-3 h-3" /> UTM Params
              </div>
              <div className="font-mono text-[10px] text-slate-700 dark:text-slate-300 truncate mt-0.5">
                {lastTouch.utmSource || lastTouch.utmMedium ? (
                  `${lastTouch.utmSource || "-"}/${lastTouch.utmMedium || "-"}`
                ) : (
                  "None"
                )}
              </div>
            </div>

            <div>
              <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Clock className="w-3 h-3" /> First Touch
              </div>
              <div className="font-medium text-slate-800 dark:text-slate-200 truncate mt-0.5">
                {formatDateTime(firstTouch?.touchDate || firstTouch?.firstTouchAt)}
              </div>
            </div>

            <div>
              <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Clock className="w-3 h-3" /> Last Touch
              </div>
              <div className="font-medium text-slate-800 dark:text-slate-200 truncate mt-0.5">
                {formatDateTime(lastTouch.touchDate || lastTouch.lastTouchAt)}
              </div>
            </div>
          </div>

          {/* Multi-touch Attributions Timeline */}
          {touches.length > 1 && (
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <span className="flex items-center gap-1">
                  <Layers className="w-3 h-3" /> Touchpoints ({touches.length})
                </span>
                <span>Chronological</span>
              </div>

              <div className="space-y-1 max-h-36 overflow-y-auto no-scrollbar pr-1">
                {displayedTouches.map((touch: CampaignAttributionTouch, idx: number) => (
                  <div
                    key={touch.id || idx}
                    className="flex items-center justify-between gap-1 text-[11px] p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/60"
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="font-mono font-semibold text-slate-800 dark:text-slate-200 truncate">
                        {touch.campaignCode}
                      </span>
                      <span className="text-[10px] text-slate-400">({touch.channel})</span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {touch.isFirstTouch && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
                          First
                        </span>
                      )}
                      {touch.isLastTouch && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300">
                          Last
                        </span>
                      )}
                      <span className="text-[10px] text-slate-400 font-mono">
                        {formatDate(touch.touchDate)}
                      </span>
                    </div>
                  </div>
                ))}

                {remainingTouchesCount > 0 && (
                  <div className="text-center text-[10px] font-semibold text-slate-400 py-0.5">
                    +{remainingTouchesCount} more {remainingTouchesCount === 1 ? "touch" : "touches"}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Action Footer */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={() => {
                if (lastTouch.campaignId) {
                  navigate(`/campaigns/${lastTouch.campaignId}`);
                }
              }}
              className="w-full text-center py-1.5 px-3 rounded-lg text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white transition-colors flex items-center justify-center gap-1.5 shadow-2xs"
            >
              <span>View Campaign Details</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </>
  );
};
