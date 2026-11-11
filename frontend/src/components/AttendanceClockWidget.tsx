import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../lib/apiClient";
import { Play, Square, Coffee, Loader2 } from "lucide-react";

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
}

export function AttendanceClockWidget({ variant = "header" }: { variant?: "header" | "sidebar" }) {
  const queryClient = useQueryClient();
  const [showConfirmClockOut, setShowConfirmClockOut] = useState(false);

  const { data, isLoading } = useQuery<AttendanceResponse>({
    queryKey: ["myTodayAttendance"],
    queryFn: async () => {
      const res = await apiClient("/api/v1/attendance/today");
      if (!res.ok) {
        return {
          record: null,
          isClockedIn: false,
          isOnBreak: false
        };
      }
      return res.json();
    },
    refetchInterval: 30000
  });

  const isClockedIn = Boolean(data?.isClockedIn);
  const isOnBreak = Boolean(data?.isOnBreak);

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
        throw new Error(err.error || "Failed to punch in");
      }
      return res.json();
    },
    onSuccess: () => invalidateAll(),
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
    onSuccess: () => invalidateAll(),
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
    onSuccess: () => invalidateAll(),
    onError: (err: any) => alert(err.message)
  });

  const clockOutMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient("/api/v1/attendance/clock-out", { method: "POST" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to punch out");
      }
      return res.json();
    },
    onSuccess: () => {
      invalidateAll();
      setShowConfirmClockOut(false);
    },
    onError: (err: any) => alert(err.message)
  });

  if (isLoading) {
    return (
      <div className={`flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-xl text-[11px] text-slate-400 font-medium ${variant === "sidebar" ? "w-full justify-center" : ""}`}>
        <Loader2 className="w-3 h-3 animate-spin" />
        <span>Syncing...</span>
      </div>
    );
  }

  // -------------------------------------------------------------
  // SIDEBAR VARIANT
  // -------------------------------------------------------------
  if (variant === "sidebar") {
    // If confirmation is requested for Punch Out
    if (showConfirmClockOut) {
      return (
        <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl p-2.5 space-y-2 select-none">
          <p className="text-[11px] font-bold text-rose-900 dark:text-rose-200 text-center">Confirm Punch Out?</p>
          <div className="flex gap-1.5">
            <button
              type="button"
              disabled={clockOutMutation.isPending}
              onClick={() => clockOutMutation.mutate()}
              className="flex-1 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
            >
              {clockOutMutation.isPending ? "Ending..." : "Yes, Punch Out"}
            </button>
            <button
              type="button"
              onClick={() => setShowConfirmClockOut(false)}
              className="py-1.5 px-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      );
    }

    // Active On Duty
    if (isClockedIn && !isOnBreak) {
      return (
        <div className="space-y-1.5 select-none">
          <div className="flex items-center justify-between px-1">
            <span className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              Punched In
            </span>
            <button
              type="button"
              disabled={startBreakMutation.isPending}
              onClick={() => startBreakMutation.mutate()}
              className="text-[10px] font-bold text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50 flex items-center gap-1 cursor-pointer bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 px-2 py-0.5 rounded-lg transition-colors"
              title="Take a break"
            >
              <Coffee className="w-3 h-3 text-amber-600" />
              <span>Break</span>
            </button>
          </div>
          <button
            type="button"
            onClick={() => setShowConfirmClockOut(true)}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 bg-rose-50 hover:bg-rose-100/90 border border-rose-200 text-rose-700 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs"
            title="Punch Out"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
            <span>Punch Out</span>
          </button>
        </div>
      );
    }

    // On Break
    if (isClockedIn && isOnBreak) {
      return (
        <div className="space-y-1.5 select-none">
          <div className="flex items-center justify-between px-1">
            <span className="flex items-center gap-1.5 text-[11px] font-bold text-amber-700 dark:text-amber-400">
              <Coffee className="w-3.5 h-3.5 text-amber-600" />
              On Break
            </span>
          </div>
          <div className="flex gap-1.5">
            <button
              type="button"
              disabled={endBreakMutation.isPending}
              onClick={() => endBreakMutation.mutate()}
              className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs"
              title="Resume duty"
            >
              {endBreakMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
              <span>Resume</span>
            </button>
            <button
              type="button"
              onClick={() => setShowConfirmClockOut(true)}
              className="flex items-center justify-center gap-1 py-1.5 px-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
              title="Punch Out"
            >
              <Square className="w-3 h-3 fill-current" />
              <span>Punch Out</span>
            </button>
          </div>
        </div>
      );
    }

    // Not Punched In (or already punched out)
    return (
      <button
        type="button"
        disabled={clockInMutation.isPending}
        onClick={() => clockInMutation.mutate()}
        className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer group select-none"
        title="Punch In for Today"
      >
        {clockInMutation.isPending ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Play className="w-3.5 h-3.5 fill-current" />
        )}
        <span>Punch In</span>
      </button>
    );
  }

  // -------------------------------------------------------------
  // HEADER VARIANT
  // -------------------------------------------------------------
  if (isClockedIn) {
    return (
      <div className="flex items-center gap-2 select-none">
        <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 px-2.5 py-1 rounded-full">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          Punched In
        </span>
        {isOnBreak ? (
          <button
            type="button"
            disabled={endBreakMutation.isPending}
            onClick={() => endBreakMutation.mutate()}
            className="flex items-center gap-1 px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-full transition-all cursor-pointer shadow-2xs"
            title="Resume duty"
          >
            {endBreakMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3 fill-current" />}
            <span>Resume</span>
          </button>
        ) : (
          <button
            type="button"
            disabled={startBreakMutation.isPending}
            onClick={() => startBreakMutation.mutate()}
            className="flex items-center gap-1 px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 text-xs font-bold rounded-full transition-all cursor-pointer"
            title="Take a break"
          >
            <Coffee className="w-3 h-3 text-amber-600" />
            <span>Break</span>
          </button>
        )}
        <button
          type="button"
          disabled={clockOutMutation.isPending}
          onClick={() => {
            if (window.confirm("Are you sure you want to Punch Out?")) {
              clockOutMutation.mutate();
            }
          }}
          className="flex items-center gap-1 px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 text-xs font-bold rounded-full transition-all cursor-pointer"
          title="Punch Out"
        >
          {clockOutMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Square className="w-3 h-3 fill-current" />}
          <span>Punch Out</span>
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={clockInMutation.isPending}
      onClick={() => clockInMutation.mutate()}
      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-full transition-all shadow-2xs cursor-pointer select-none"
      title="Punch In"
    >
      {clockInMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
      <span>Punch In</span>
    </button>
  );
}
