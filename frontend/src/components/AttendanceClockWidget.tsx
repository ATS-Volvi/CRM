import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../lib/apiClient";
import { Clock, CheckCircle2, Play, Square, AlertCircle, Loader2 } from "lucide-react";

export function AttendanceClockWidget() {
  const queryClient = useQueryClient();
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const { data, isLoading } = useQuery<{
    record: {
      id: string;
      checkInTime: string;
      checkOutTime: string | null;
      durationMinutes: number | null;
      status: string;
    } | null;
    isClockedIn: boolean;
  }>({
    queryKey: ["myTodayAttendance"],
    queryFn: async () => {
      const res = await apiClient("/api/v1/attendance/today");
      if (!res.ok) return { record: null, isClockedIn: false };
      return res.json();
    },
    refetchInterval: 60000 // poll every minute
  });

  const record = data?.record;
  const isClockedIn = Boolean(data?.isClockedIn);

  // Live timer effect
  useEffect(() => {
    if (!isClockedIn || !record?.checkInTime) {
      setElapsedSeconds(0);
      return;
    }

    const checkInMs = new Date(record.checkInTime).getTime();
    const updateElapsed = () => {
      const now = Date.now();
      setElapsedSeconds(Math.max(0, Math.floor((now - checkInMs) / 1000)));
    };

    updateElapsed();
    const timer = setInterval(updateElapsed, 1000);
    return () => clearInterval(timer);
  }, [isClockedIn, record?.checkInTime]);

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
      queryClient.invalidateQueries({ queryKey: ["myTodayAttendance"] });
      queryClient.invalidateQueries({ queryKey: ["attendanceRoster"] });
      queryClient.invalidateQueries({ queryKey: ["orgChartEmployees"] });
    },
    onError: (err: any) => {
      alert("Clock-in error: " + err.message);
    }
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
      queryClient.invalidateQueries({ queryKey: ["myTodayAttendance"] });
      queryClient.invalidateQueries({ queryKey: ["attendanceRoster"] });
      queryClient.invalidateQueries({ queryKey: ["orgChartEmployees"] });
    },
    onError: (err: any) => {
      alert("Clock-out error: " + err.message);
    }
  });

  const formatTimer = (totalSec: number) => {
    const hours = Math.floor(totalSec / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;
    const pad = (n: number) => String(n).padStart(2, "0");
    if (hours > 0) return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    return `${pad(minutes)}:${pad(seconds)}`;
  };

  const formatTimeStr = (isoString?: string) => {
    if (!isoString) return "";
    return new Date(isoString).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-1 px-2.5 py-1 bg-surface-container-low rounded-lg border border-outline-variant text-[11px] text-on-surface-variant font-medium">
        <Loader2 className="w-3 h-3 animate-spin" />
        <span>Loading...</span>
      </div>
    );
  }

  // State 1: Clocked In (Active Duty)
  if (isClockedIn && record) {
    return (
      <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-2.5 py-1 shadow-2xs transition-all">
        <div className="flex items-center gap-1.5 text-emerald-800 dark:text-emerald-300">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-[11px] font-black tracking-tight font-mono">
            {formatTimer(elapsedSeconds)}
          </span>
          <span className="text-[10px] opacity-75 font-semibold hidden md:inline">
            (since {formatTimeStr(record.checkInTime)})
          </span>
        </div>

        <button
          type="button"
          disabled={clockOutMutation.isPending}
          onClick={() => {
            if (window.confirm("Are you sure you want to end your shift and clock out?")) {
              clockOutMutation.mutate();
            }
          }}
          className="flex items-center gap-1 px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white rounded-md text-[10px] font-extrabold tracking-wide uppercase transition-colors cursor-pointer"
          title="Clock Out of Today's Shift"
        >
          {clockOutMutation.isPending ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Square className="w-2.5 h-2.5 fill-current" />
          )}
          <span>Clock Out</span>
        </button>
      </div>
    );
  }

  // State 2: Already Clocked Out for today
  if (record && record.checkOutTime) {
    const totalMinutes = record.durationMinutes || 0;
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;

    return (
      <div className="flex items-center gap-2 bg-surface-container-low border border-outline-variant/80 rounded-xl px-2.5 py-1 text-on-surface-variant transition-all">
        <div className="flex items-center gap-1 text-[11px] font-semibold">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          <span className="text-[10px] text-on-surface font-bold">
            Shift Ended: {hours > 0 ? `${hours}h ` : ""}{mins}m
          </span>
          <span className="text-[9px] opacity-70 hidden lg:inline">
            ({formatTimeStr(record.checkInTime)} – {formatTimeStr(record.checkOutTime)})
          </span>
        </div>

        <button
          type="button"
          disabled={clockInMutation.isPending}
          onClick={() => clockInMutation.mutate()}
          className="px-2 py-0.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-md text-[10px] font-bold transition-colors cursor-pointer"
          title="Resume / Re-enter Clock-In for today"
        >
          Resume
        </button>
      </div>
    );
  }

  // State 3: Not Clocked In Yet Today
  return (
    <button
      type="button"
      disabled={clockInMutation.isPending}
      onClick={() => clockInMutation.mutate()}
      className="flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-black shadow-xs transition-all cursor-pointer hover:scale-102"
      title="Click to Clock In for today's shift"
    >
      {clockInMutation.isPending ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <Play className="w-3 h-3 fill-current" />
      )}
      <span>Clock In</span>
    </button>
  );
}

