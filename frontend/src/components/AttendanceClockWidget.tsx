import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../lib/apiClient";
import {
  Clock, CheckCircle2, Play, Square, Coffee, ChevronDown, ChevronRight,
  AlertCircle, Loader2, Sparkles, Sliders, Shield, X
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

interface AttendanceRecord {
  id: string;
  checkInTime: string;
  checkOutTime: string | null;
  durationMinutes: number | null;
  currentBreakStart: string | null;
  totalBreakMinutes: number;
  netDurationMinutes: number | null;
  status: string;
}

interface AttendanceResponse {
  record: AttendanceRecord | null;
  isClockedIn: boolean;
  isOnBreak: boolean;
  currentBreakMinutes: number;
  totalBreakMinutes: number;
  maxBreakMinutes: number;
  userTeam: string;
}

export function AttendanceClockWidget({ variant = "header" }: { variant?: "header" | "sidebar" }) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [showConfirmClockOut, setShowConfirmClockOut] = useState(false);
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const [policyTeamName, setPolicyTeamName] = useState("All");
  const [policyMinutes, setPolicyMinutes] = useState(60);
  const popoverRef = useRef<HTMLDivElement>(null);

  const [elapsedWorkSec, setElapsedWorkSec] = useState(0);
  const [elapsedBreakSec, setElapsedBreakSec] = useState(0);

  // Close popover when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setShowConfirmClockOut(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const { data, isLoading } = useQuery<AttendanceResponse>({
    queryKey: ["myTodayAttendance"],
    queryFn: async () => {
      const res = await apiClient("/api/v1/attendance/today");
      if (!res.ok) {
        return {
          record: null,
          isClockedIn: false,
          isOnBreak: false,
          currentBreakMinutes: 0,
          totalBreakMinutes: 0,
          maxBreakMinutes: 60,
          userTeam: "All"
        };
      }
      return res.json();
    },
    refetchInterval: 30000 // poll every 30s
  });

  const record = data?.record;
  const isClockedIn = Boolean(data?.isClockedIn);
  const isOnBreak = Boolean(data?.isOnBreak);
  const maxBreakMinutes = data?.maxBreakMinutes || 60;

  // Live timer effect
  useEffect(() => {
    if (!isClockedIn || !record?.checkInTime) {
      setElapsedWorkSec(0);
      setElapsedBreakSec(0);
      return;
    }

    const checkInMs = new Date(record.checkInTime).getTime();
    const breakStartMs = record.currentBreakStart ? new Date(record.currentBreakStart).getTime() : null;

    const updateTimers = () => {
      const now = Date.now();
      setElapsedWorkSec(Math.max(0, Math.floor((now - checkInMs) / 1000)));

      if (breakStartMs) {
        setElapsedBreakSec(Math.max(0, Math.floor((now - breakStartMs) / 1000)));
      } else {
        setElapsedBreakSec(0);
      }
    };

    updateTimers();
    const timer = setInterval(updateTimers, 1000);
    return () => clearInterval(timer);
  }, [isClockedIn, record?.checkInTime, record?.currentBreakStart]);

  // Mutations
  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["myTodayAttendance"] });
    queryClient.invalidateQueries({ queryKey: ["attendanceRoster"] });
    queryClient.invalidateQueries({ queryKey: ["orgChartEmployees"] });
  };

  const clockInMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient("/api/v1/attendance/clock-in", { method: "POST" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to clock in");
      }
      return res.json();
    },
    onSuccess: () => {
      invalidateAll();
      setIsOpen(false);
    },
    onError: (err: any) => alert(err.message)
  });

  const startBreakMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient("/api/v1/attendance/break-start", { method: "POST" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to start break");
      }
      return res.json();
    },
    onSuccess: () => {
      invalidateAll();
    },
    onError: (err: any) => alert(err.message)
  });

  const endBreakMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient("/api/v1/attendance/break-end", { method: "POST" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to end break");
      }
      return res.json();
    },
    onSuccess: () => {
      invalidateAll();
    },
    onError: (err: any) => alert(err.message)
  });

  const clockOutMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient("/api/v1/attendance/clock-out", { method: "POST" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to clock out");
      }
      return res.json();
    },
    onSuccess: () => {
      invalidateAll();
      setShowConfirmClockOut(false);
      setIsOpen(false);
    },
    onError: (err: any) => alert(err.message)
  });

  const updatePolicyMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient("/api/v1/attendance/break-policy", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamName: policyTeamName, maxBreakMinutes: Number(policyMinutes) })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update policy");
      }
      return res.json();
    },
    onSuccess: () => {
      invalidateAll();
      setShowPolicyModal(false);
      alert(`Break policy updated for ${policyTeamName}: ${policyMinutes} minutes.`);
    },
    onError: (err: any) => alert(err.message)
  });

  const formatTimer = (totalSec: number) => {
    const hours = Math.floor(totalSec / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;
    const pad = (n: number) => String(n).padStart(2, "0");
    if (hours > 0) return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    return `${pad(minutes)}:${pad(seconds)}`;
  };

  const formatTimeStr = (isoString?: string | null) => {
    if (!isoString) return "";
    return new Date(isoString).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const isManagerOrAdmin = user && ["admin", "sales_manager", "manager", "ops_manager", "director"].includes(user.role);

  // Total break minutes taken so far
  const totalBreakUsedMinutes = (record?.totalBreakMinutes || 0) + (isOnBreak ? Math.floor(elapsedBreakSec / 60) : 0);
  const breakPercentage = Math.min(100, Math.round((totalBreakUsedMinutes / maxBreakMinutes) * 100));
  const isOverBreak = totalBreakUsedMinutes > maxBreakMinutes;

  if (isLoading) {
    return (
      <div className={`flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 rounded-xl border border-slate-200 text-[11px] text-slate-500 font-medium ${variant === "sidebar" ? "w-full justify-center" : ""}`}>
        <Loader2 className="w-3 h-3 animate-spin text-slate-400" />
        <span>Syncing...</span>
      </div>
    );
  }

  // Render Pill Trigger Button based on status
  const renderTrigger = () => {
    const isSidebar = variant === "sidebar";

    if (isOnBreak) {
      if (isSidebar) {
        return (
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="w-full flex items-center justify-between px-3 py-2 bg-amber-50 hover:bg-amber-100/90 text-amber-950 border border-amber-300 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer group"
            title="On Break — Click to open shift details"
          >
            <div className="flex items-center gap-2">
              <Coffee className="w-3.5 h-3.5 text-amber-700 shrink-0" />
              <span className="font-mono font-black">{formatTimer(elapsedBreakSec)}</span>
              <span className="text-[10px] uppercase font-extrabold text-amber-700 bg-amber-200/60 px-1.5 py-0.2 rounded">Break</span>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-amber-800 font-semibold">
              <span>{totalBreakUsedMinutes}m / {maxBreakMinutes}m</span>
              <ChevronRight className={`w-3.5 h-3.5 text-amber-600 transition-transform ${isOpen ? "rotate-90" : ""}`} />
            </div>
          </button>
        );
      }

      return (
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="group flex items-center gap-2 bg-amber-50 hover:bg-amber-100/80 text-amber-900 border border-amber-300/80 px-3 py-1.5 rounded-full text-xs font-bold transition-all shadow-2xs cursor-pointer"
          title="On Break — Click for Shift Controls"
        >
          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-amber-200 text-amber-900 text-xs shrink-0">
            <Coffee className="w-3 h-3" />
          </span>
          <div className="flex items-center gap-1">
            <span className="font-mono font-black">{formatTimer(elapsedBreakSec)}</span>
            <span className="text-[10px] uppercase font-extrabold text-amber-700 bg-amber-200/60 px-1.5 py-0.2 rounded">Break</span>
          </div>
          <ChevronDown className={`w-3.5 h-3.5 text-amber-600 transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </button>
      );
    }

    if (isClockedIn && record) {
      if (isSidebar) {
        return (
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="w-full flex items-center justify-between px-3 py-2 bg-emerald-50/90 hover:bg-emerald-100/90 text-emerald-950 border border-emerald-200/80 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer group"
            title="Active Shift — Click to open shift details"
          >
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="font-mono font-black">{formatTimer(elapsedWorkSec)}</span>
              <span className="text-[10px] text-emerald-700 font-bold bg-emerald-100 px-1.5 py-0.2 rounded">On Duty</span>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-emerald-800 font-medium">
              <span>☕ {totalBreakUsedMinutes}m</span>
              <ChevronRight className={`w-3.5 h-3.5 text-emerald-600 transition-transform ${isOpen ? "rotate-90" : ""}`} />
            </div>
          </button>
        );
      }

      return (
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="group flex items-center gap-2 bg-emerald-50 hover:bg-emerald-100/70 text-emerald-950 border border-emerald-300/80 px-3 py-1.5 rounded-full text-xs font-bold transition-all shadow-2xs cursor-pointer"
          title="Active Shift — Click for Break & Clock Out"
        >
          <span className="relative flex h-2.5 w-2.5 ml-0.5 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
          <div className="flex items-center gap-1.5">
            <span className="font-mono font-black">{formatTimer(elapsedWorkSec)}</span>
            <span className="text-[10px] text-emerald-700 font-semibold hidden md:inline">Active</span>
          </div>
          <ChevronDown className={`w-3.5 h-3.5 text-emerald-600 transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </button>
      );
    }

    if (record && record.checkOutTime) {
      const totalMin = record.durationMinutes || 0;
      const netMin = record.netDurationMinutes ?? totalMin;
      const hrs = Math.floor(netMin / 60);
      const mins = netMin % 60;

      if (isSidebar) {
        return (
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="w-full flex items-center justify-between px-3 py-2 bg-slate-100 hover:bg-slate-200/80 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold transition-all shadow-2xs cursor-pointer"
            title="Shift Completed — Click to view summary"
          >
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span className="text-[11px] font-bold text-slate-800">
                Shift Done: {hrs > 0 ? `${hrs}h ` : ""}{mins}m
              </span>
            </div>
            <ChevronRight className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isOpen ? "rotate-90" : ""}`} />
          </button>
        );
      }

      return (
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200/80 text-slate-700 border border-slate-200 px-3 py-1.5 rounded-full text-xs font-semibold transition-all shadow-2xs cursor-pointer"
          title="Shift Completed — Click to view summary"
        >
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span className="text-[11px] font-bold text-slate-800">
            Shift Done: {hrs > 0 ? `${hrs}h ` : ""}{mins}m
          </span>
          <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </button>
      );
    }

    // Not Clocked In Yet
    if (isSidebar) {
      return (
        <button
          type="button"
          disabled={clockInMutation.isPending}
          onClick={() => clockInMutation.mutate()}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-white hover:bg-emerald-50 border border-slate-300 hover:border-emerald-500 text-slate-700 hover:text-emerald-900 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer group"
          title="Start Today's Shift"
        >
          {clockInMutation.isPending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
          ) : (
            <Clock className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-600" />
          )}
          <span>Clock In for Today</span>
        </button>
      );
    }

    return (
      <button
        type="button"
        disabled={clockInMutation.isPending}
        onClick={() => clockInMutation.mutate()}
        className="flex items-center gap-2 px-3.5 py-1.5 bg-white hover:bg-emerald-50/70 border border-slate-300 hover:border-emerald-500 text-slate-700 hover:text-emerald-900 rounded-full text-xs font-bold transition-all shadow-2xs hover:scale-102 cursor-pointer group"
        title="Start Today's Shift"
      >
        {clockInMutation.isPending ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
        ) : (
          <Clock className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-600" />
        )}
        <span>Clock In</span>
      </button>
    );
  };

  return (
    <div className={`relative ${variant === "sidebar" ? "w-full" : "inline-block"}`} ref={popoverRef}>
      {renderTrigger()}

      {/* Floating Micro-Card Popover */}
      {isOpen && (
        <>
          {/* Invisible dismiss backdrop */}
          <div
            className="fixed inset-0 z-40 bg-transparent"
            onClick={() => { setIsOpen(false); setShowConfirmClockOut(false); }}
          />

          <div
            className={`absolute ${
              variant === "sidebar"
                ? "left-full bottom-0 ml-3"
                : "top-full right-0 mt-2"
            } w-80 bg-white border border-slate-200 rounded-2xl shadow-2xl p-4.5 z-50 animate-in fade-in zoom-in-95 space-y-3.5 select-none text-slate-900`}
          >
            {/* Header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-extrabold text-slate-900">{user?.name || "My Shift"}</h4>
                  <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-slate-100 text-slate-600">
                    {data?.userTeam || user?.team || "General"}
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 font-medium capitalize mt-0.5">
                  {user?.role?.replace("_", " ") || "Salesperson"} • {new Date().toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                </p>
              </div>
              <button
                onClick={() => { setIsOpen(false); setShowConfirmClockOut(false); }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Shift Timeline Stats */}
            {record && (
              <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-3 space-y-2.5">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Clocked In</span>
                    <span className="font-mono font-bold text-slate-800">{formatTimeStr(record.checkInTime)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      {record.checkOutTime ? "Shift Ended" : "Current Status"}
                    </span>
                    <span className={`font-bold inline-flex items-center gap-1 ${
                      isOnBreak ? "text-amber-700" : isClockedIn ? "text-emerald-700" : "text-slate-700"
                    }`}>
                      {isOnBreak ? "☕ On Break" : isClockedIn ? "🟢 On Duty" : "Completed"}
                    </span>
                  </div>
                </div>

                {/* Break Allowance Bar */}
                <div className="pt-2 border-t border-slate-200/60 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                      <Coffee className="w-3 h-3 text-amber-600" />
                      Daily Break Usage
                    </span>
                    <span className={`font-mono font-extrabold ${isOverBreak ? "text-rose-600" : "text-slate-700"}`}>
                      {totalBreakUsedMinutes}m / {maxBreakMinutes}m
                      {isOverBreak && <span className="text-[9px] text-rose-600 ml-1 font-bold">(Over +{totalBreakUsedMinutes - maxBreakMinutes}m)</span>}
                    </span>
                  </div>

                  <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 rounded-full ${
                        isOverBreak
                          ? "bg-rose-500"
                          : breakPercentage > 75
                          ? "bg-amber-500"
                          : "bg-emerald-500"
                      }`}
                      style={{ width: `${breakPercentage}%` }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-2 pt-1">
              {isOnBreak ? (
                <button
                  type="button"
                  disabled={endBreakMutation.isPending}
                  onClick={() => endBreakMutation.mutate()}
                  className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-all shadow-sm cursor-pointer"
                >
                  {endBreakMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                  <span>Resume Work (End Break)</span>
                </button>
              ) : isClockedIn ? (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={startBreakMutation.isPending}
                    onClick={() => startBreakMutation.mutate()}
                    className="flex items-center justify-center gap-1.5 py-2 px-3 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
                    title="Pause productive shift for meal or tea break"
                  >
                    {startBreakMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Coffee className="w-3.5 h-3.5 text-amber-700" />}
                    <span>Take Break</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowConfirmClockOut(true)}
                    className="flex items-center justify-center gap-1.5 py-2 px-3 bg-slate-100 hover:bg-rose-50 hover:text-rose-700 border border-slate-300 hover:border-rose-300 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                    title="End today's work shift"
                  >
                    <Square className="w-3 h-3 text-slate-500" />
                    <span>Clock Out</span>
                  </button>
                </div>
              ) : record?.checkOutTime ? (
                <button
                  type="button"
                  disabled={clockInMutation.isPending}
                  onClick={() => clockInMutation.mutate()}
                  className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  {clockInMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                  <span>Resume / Re-enter Shift</span>
                </button>
              ) : (
                <button
                  type="button"
                  disabled={clockInMutation.isPending}
                  onClick={() => clockInMutation.mutate()}
                  className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-all shadow-sm cursor-pointer"
                >
                  {clockInMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                  <span>Clock In for Today</span>
                </button>
              )}

              {/* Confirm Clock Out Dialog inside Popover */}
              {showConfirmClockOut && (
                <div className="bg-rose-50/80 border border-rose-200 rounded-xl p-3 space-y-2 animate-in fade-in">
                  <p className="text-[11px] font-bold text-rose-900 leading-tight">
                    Are you ready to end your shift for today?
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={clockOutMutation.isPending}
                      onClick={() => clockOutMutation.mutate()}
                      className="flex-1 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                    >
                      {clockOutMutation.isPending ? "Ending..." : "Yes, Clock Out"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowConfirmClockOut(false)}
                      className="py-1.5 px-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Team Lead / Admin Break Policy Quick Link */}
            {isManagerOrAdmin && (
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[10px] text-slate-400 font-medium">Team Policy: {maxBreakMinutes}m</span>
                <button
                  type="button"
                  onClick={() => setShowPolicyModal(true)}
                  className="flex items-center gap-1 text-[10px] font-bold text-primary hover:underline cursor-pointer"
                >
                  <Sliders className="w-3 h-3" />
                  <span>Adjust Policy</span>
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* Break Policy Modal */}
      {showPolicyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
                  <Coffee className="w-4 h-4 text-amber-600" />
                  Team Break Policy
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Set daily allotted break duration. Breaks exceeding this limit trigger a visual notice on the manager roster.
                </p>
              </div>
              <button
                onClick={() => setShowPolicyModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Team / Scope
                </label>
                <select
                  value={policyTeamName}
                  onChange={(e) => setPolicyTeamName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="All">All Teams (Company-Wide Default)</option>
                  <option value="Aces">Aces (Commercial Closers)</option>
                  <option value="Velocity">Velocity (Enterprise Sales)</option>
                  <option value="Global">Global Division</option>
                  <option value="Hawks">Hawks (Pre-Sales / SDR)</option>
                  <option value="Phoenix">Phoenix (Inside Sales)</option>
                  <option value="Field Service">Field Service (Technicians & Inspectors)</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Daily Break Allowance (Minutes)
                </label>
                <input
                  type="number"
                  min="0"
                  max="240"
                  value={policyMinutes}
                  onChange={(e) => setPolicyMinutes(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Quick Presets */}
              <div className="flex gap-1.5 pt-1">
                {[30, 45, 60, 75].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setPolicyMinutes(preset)}
                    className={`flex-1 py-1 rounded text-[10px] font-bold border transition-colors cursor-pointer ${
                      policyMinutes === preset
                        ? "bg-primary text-white border-primary"
                        : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {preset}m
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={updatePolicyMutation.isPending}
                onClick={() => updatePolicyMutation.mutate()}
                className="flex-1 py-2 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                {updatePolicyMutation.isPending ? "Saving..." : "Save Policy"}
              </button>
              <button
                type="button"
                onClick={() => setShowPolicyModal(false)}
                className="py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
