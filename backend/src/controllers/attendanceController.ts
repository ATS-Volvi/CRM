import { Request, Response } from "express";
import { sequelize, User, ServiceResource } from "@nexus-crm/database";
import crypto from "crypto";
import { Op } from "sequelize";

// Helper to resolve applicable break policy (Team specific, falling back to 'All' or 60 min default)
async function resolveMaxBreakMinutes(userTeam?: string | null): Promise<number> {
  const TeamBreakPolicy = (sequelize.models.TeamBreakPolicy as any);
  if (!TeamBreakPolicy) return 60;

  if (userTeam) {
    const teamPolicy = await TeamBreakPolicy.findOne({
      where: { teamName: userTeam }
    });
    if (teamPolicy && typeof teamPolicy.maxBreakMinutes === "number") {
      return teamPolicy.maxBreakMinutes;
    }
  }

  // Fallback to Global / 'All'
  const globalPolicy = await TeamBreakPolicy.findOne({
    where: { teamName: "All" }
  });
  if (globalPolicy && typeof globalPolicy.maxBreakMinutes === "number") {
    return globalPolicy.maxBreakMinutes;
  }

  return 60; // 60 minutes default
}

// Helper to auto-close unpunched stale shifts from previous days
async function autoCloseStaleShifts(userId: string, todayStr: string, UserAttendance: any) {
  try {
    const staleRecords = await UserAttendance.findAll({
      where: {
        userId,
        date: { [Op.lt]: todayStr },
        checkOutTime: null
      }
    });
    for (const rec of staleRecords) {
      const endOfDay = new Date(`${rec.date}T23:59:59.000Z`);
      const checkIn = new Date(rec.checkInTime);
      const rawDur = Math.max(0, Math.floor((endOfDay.getTime() - checkIn.getTime()) / 60000));
      const cappedDur = Math.min(rawDur, 720); // Cap at 12 hours
      const netDur = Math.max(0, cappedDur - (rec.totalBreakMinutes || 0));
      await rec.update({
        checkOutTime: endOfDay,
        durationMinutes: cappedDur,
        netDurationMinutes: netDur,
        currentBreakStart: null,
        notes: (rec.notes ? `${rec.notes} | ` : "") + "Auto-closed at day boundary"
      });
    }
  } catch (err) {
    console.error("[autoCloseStaleShifts] Error:", err);
  }
}

export const getMyTodayAttendance = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const today = new Date().toISOString().split("T")[0];
    const UserAttendance = (sequelize.models.UserAttendance as any);
    if (!UserAttendance) {
      return res.json({ record: null, isClockedIn: false, isOnBreak: false, maxBreakMinutes: 60 });
    }

    // Auto-close any lingering shift from previous days
    await autoCloseStaleShifts(user.id, today, UserAttendance);

    const record = await UserAttendance.findOne({
      where: { userId: user.id, date: today }
    });

    const isClockedIn = Boolean(record && record.checkInTime && !record.checkOutTime);
    const isOnBreak = Boolean(isClockedIn && record.currentBreakStart);

    // Calculate current break elapsed if currently on break
    let currentBreakMinutes = 0;
    if (isOnBreak && record.currentBreakStart) {
      currentBreakMinutes = Math.max(0, Math.floor((Date.now() - new Date(record.currentBreakStart).getTime()) / 60000));
    }

    const maxBreakMinutes = await resolveMaxBreakMinutes(user.team);

    res.json({
      record,
      isClockedIn,
      isOnBreak,
      currentBreakMinutes,
      totalBreakMinutes: (record?.totalBreakMinutes || 0) + (isOnBreak ? currentBreakMinutes : 0),
      maxBreakMinutes,
      userTeam: user.team || "All"
    });
  } catch (error: any) {
    console.error("[getMyTodayAttendance] Error:", error);
    res.status(500).json({ error: error.message });
  }
};

export const clockIn = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const today = new Date().toISOString().split("T")[0];
    const UserAttendance = (sequelize.models.UserAttendance as any);
    if (!UserAttendance) {
      return res.status(500).json({ error: "Attendance model unavailable" });
    }

    // Auto-close any unclosed shift from earlier dates before clocking in today
    await autoCloseStaleShifts(user.id, today, UserAttendance);

    let record = await UserAttendance.findOne({
      where: { userId: user.id, date: today }
    });

    const now = new Date();
    const ipAddress = req.ip || req.headers["x-forwarded-for"] || null;
    const userAgent = req.headers["user-agent"] || null;

    if (record) {
      if (!record.checkOutTime) {
        // Already clocked in
        return res.json({ success: true, record, message: "Already clocked in", isClockedIn: true });
      }
      // Re-opening/Clocking back in
      await record.update({
        checkInTime: now,
        checkOutTime: null,
        durationMinutes: null,
        netDurationMinutes: null,
        currentBreakStart: null,
        status: "Present",
        notes: req.body.notes || record.notes
      });
    } else {
      record = await UserAttendance.create({
        id: crypto.randomUUID(),
        userId: user.id,
        date: today,
        checkInTime: now,
        checkOutTime: null,
        durationMinutes: null,
        currentBreakStart: null,
        totalBreakMinutes: 0,
        netDurationMinutes: null,
        status: "Present",
        notes: req.body.notes || null,
        ipAddress: typeof ipAddress === "string" ? ipAddress : Array.isArray(ipAddress) ? ipAddress[0] : null,
        userAgent: typeof userAgent === "string" ? userAgent : null
      });
    }

    // Automatically set user as available in system
    await User.update({ isAvailable: true, onLeave: false }, { where: { id: user.id } }).catch(() => {});

    // If technician, update ServiceResource attendanceStatus
    if (sequelize.models.ServiceResource) {
      await sequelize.models.ServiceResource.update(
        { attendanceStatus: "On Duty", isActive: true },
        { where: { userId: user.id } }
      ).catch(() => {});
    }

    const maxBreakMinutes = await resolveMaxBreakMinutes(user.team);

    res.json({ success: true, record, isClockedIn: true, isOnBreak: false, maxBreakMinutes });
  } catch (error: any) {
    console.error("[clockIn] Error:", error);
    res.status(500).json({ error: error.message });
  }
};

export const startBreak = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const today = new Date().toISOString().split("T")[0];
    const UserAttendance = (sequelize.models.UserAttendance as any);
    if (!UserAttendance) {
      return res.status(500).json({ error: "Attendance model unavailable" });
    }

    const record = await UserAttendance.findOne({
      where: { userId: user.id, date: today }
    });

    if (!record || record.checkOutTime) {
      return res.status(400).json({ error: "You must be actively clocked in to take a break." });
    }

    if (record.currentBreakStart) {
      return res.json({ success: true, record, message: "Already on break", isOnBreak: true });
    }

    const now = new Date();
    await record.update({
      currentBreakStart: now,
      status: "On Break"
    });

    // Temporarily mark off-duty for active dispatches while on break
    await User.update({ isAvailable: false }, { where: { id: user.id } }).catch(() => {});
    if (sequelize.models.ServiceResource) {
      await sequelize.models.ServiceResource.update(
        { attendanceStatus: "On Break" },
        { where: { userId: user.id } }
      ).catch(() => {});
    }

    const maxBreakMinutes = await resolveMaxBreakMinutes(user.team);

    res.json({ success: true, record, isOnBreak: true, maxBreakMinutes });
  } catch (error: any) {
    console.error("[startBreak] Error:", error);
    res.status(500).json({ error: error.message });
  }
};

export const endBreak = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const today = new Date().toISOString().split("T")[0];
    const UserAttendance = (sequelize.models.UserAttendance as any);
    if (!UserAttendance) {
      return res.status(500).json({ error: "Attendance model unavailable" });
    }

    const record = await UserAttendance.findOne({
      where: { userId: user.id, date: today }
    });

    if (!record || record.checkOutTime) {
      return res.status(400).json({ error: "No active shift found." });
    }

    if (!record.currentBreakStart) {
      return res.json({ success: true, record, message: "Not currently on break", isOnBreak: false });
    }

    const now = new Date();
    const breakMs = now.getTime() - new Date(record.currentBreakStart).getTime();
    const breakMinutesElapsed = Math.max(1, Math.round(breakMs / 60000));
    const newTotalBreakMinutes = (record.totalBreakMinutes || 0) + breakMinutesElapsed;

    await record.update({
      currentBreakStart: null,
      totalBreakMinutes: newTotalBreakMinutes,
      status: "Present"
    });

    // Re-enable availability
    await User.update({ isAvailable: true }, { where: { id: user.id } }).catch(() => {});
    if (sequelize.models.ServiceResource) {
      await sequelize.models.ServiceResource.update(
        { attendanceStatus: "On Duty" },
        { where: { userId: user.id } }
      ).catch(() => {});
    }

    const maxBreakMinutes = await resolveMaxBreakMinutes(user.team);

    res.json({ success: true, record, isOnBreak: false, maxBreakMinutes, totalBreakMinutes: newTotalBreakMinutes });
  } catch (error: any) {
    console.error("[endBreak] Error:", error);
    res.status(500).json({ error: error.message });
  }
};

export const clockOut = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const today = new Date().toISOString().split("T")[0];
    const UserAttendance = (sequelize.models.UserAttendance as any);
    if (!UserAttendance) {
      return res.status(500).json({ error: "Attendance model unavailable" });
    }

    const record = await UserAttendance.findOne({
      where: { userId: user.id, date: today }
    });

    if (!record) {
      return res.status(400).json({ error: "No clock-in record found for today. Please clock in first." });
    }

    const now = new Date();
    const checkInMs = new Date(record.checkInTime).getTime();
    const grossMinutes = Math.max(1, Math.round((now.getTime() - checkInMs) / 60000));

    // If clocking out while still on break, finalize that break period
    let totalBreaks = record.totalBreakMinutes || 0;
    if (record.currentBreakStart) {
      const pendingBreak = Math.max(1, Math.round((now.getTime() - new Date(record.currentBreakStart).getTime()) / 60000));
      totalBreaks += pendingBreak;
    }

    const netMinutes = Math.max(0, grossMinutes - totalBreaks);

    await record.update({
      checkOutTime: now,
      currentBreakStart: null,
      totalBreakMinutes: totalBreaks,
      durationMinutes: grossMinutes,
      netDurationMinutes: netMinutes,
      status: "Shift Ended",
      notes: req.body.notes || record.notes
    });

    // Mark off shift for routing
    await User.update({ isAvailable: false }, { where: { id: user.id } }).catch(() => {});
    if (sequelize.models.ServiceResource) {
      await sequelize.models.ServiceResource.update(
        { attendanceStatus: "Off Shift", isActive: false },
        { where: { userId: user.id } }
      ).catch(() => {});
    }

    res.json({ success: true, record, isClockedIn: false, isOnBreak: false });
  } catch (error: any) {
    console.error("[clockOut] Error:", error);
    res.status(500).json({ error: error.message });
  }
};

export const getDailyAttendanceRoster = async (req: Request, res: Response) => {
  try {
    const targetDate = (req.query.date as string) || new Date().toISOString().split("T")[0];
    const UserAttendance = (sequelize.models.UserAttendance as any);
    const TeamBreakPolicy = (sequelize.models.TeamBreakPolicy as any);

    if (!UserAttendance) {
      return res.json({ date: targetDate, attendances: [], policies: [] });
    }

    const attendances = await UserAttendance.findAll({
      where: { date: targetDate }
    });

    let policies = [];
    if (TeamBreakPolicy) {
      policies = await TeamBreakPolicy.findAll();
    }

    res.json({ date: targetDate, attendances, policies });
  } catch (error: any) {
    console.error("[getDailyAttendanceRoster] Error:", error);
    res.status(500).json({ error: error.message });
  }
};

export const getTeamBreakPolicies = async (_req: Request, res: Response) => {
  try {
    const TeamBreakPolicy = (sequelize.models.TeamBreakPolicy as any);
    if (!TeamBreakPolicy) {
      return res.json({ policies: [], defaultMaxBreakMinutes: 60 });
    }

    const policies = await TeamBreakPolicy.findAll();
    res.json({ policies, defaultMaxBreakMinutes: 60 });
  } catch (error: any) {
    console.error("[getTeamBreakPolicies] Error:", error);
    res.status(500).json({ error: error.message });
  }
};

export const updateTeamBreakPolicy = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    // Authorization: Admin, Sales Manager, Manager, Ops Manager
    const allowedRoles = ["admin", "sales_manager", "manager", "ops_manager", "director"];
    if (!allowedRoles.includes(user.role)) {
      return res.status(403).json({ error: "Only Admins and Team Leads/Managers can update break policies." });
    }

    const { teamName, maxBreakMinutes } = req.body;
    if (!teamName || typeof maxBreakMinutes !== "number" || maxBreakMinutes < 0 || maxBreakMinutes > 300) {
      return res.status(400).json({ error: "Valid teamName and maxBreakMinutes (0 to 300) are required." });
    }

    const TeamBreakPolicy = (sequelize.models.TeamBreakPolicy as any);
    if (!TeamBreakPolicy) {
      return res.status(500).json({ error: "TeamBreakPolicy model unavailable." });
    }

    let policy = await TeamBreakPolicy.findOne({
      where: { teamName }
    });

    if (policy) {
      await policy.update({
        maxBreakMinutes,
        updatedByUserId: user.id
      });
    } else {
      policy = await TeamBreakPolicy.create({
        id: crypto.randomUUID(),
        teamName,
        maxBreakMinutes,
        updatedByUserId: user.id
      });
    }

    res.json({ success: true, policy });
  } catch (error: any) {
    console.error("[updateTeamBreakPolicy] Error:", error);
    res.status(500).json({ error: error.message });
  }
};

export const regularizeAttendance = async (req: Request, res: Response) => {
  try {
    const caller = (req as any).user;
    if (!caller) return res.status(401).json({ error: "Unauthorized" });

    const isPrivileged = ["admin", "manager", "team_lead"].includes(caller.role);
    if (!isPrivileged) {
      return res.status(403).json({ error: "Only admins, managers, or team leads can regularize attendance records." });
    }

    const { attendanceId, userId, date, checkInTime, checkOutTime, totalBreakMinutes, notes } = req.body;
    const UserAttendance = (sequelize.models.UserAttendance as any);
    if (!UserAttendance) {
      return res.status(500).json({ error: "Attendance model unavailable" });
    }

    let record: any = null;
    if (attendanceId) {
      record = await UserAttendance.findByPk(attendanceId);
    } else if (userId && date) {
      record = await UserAttendance.findOne({ where: { userId, date } });
    }

    if (!record) {
      if (!userId || !date) {
        return res.status(400).json({ error: "Either attendanceId or both userId and date are required" });
      }
      record = await UserAttendance.create({
        id: crypto.randomUUID(),
        userId,
        date,
        status: "Present",
        totalBreakMinutes: 0
      });
    }

    const updates: any = {};
    if (checkInTime !== undefined) updates.checkInTime = checkInTime ? new Date(checkInTime) : null;
    if (checkOutTime !== undefined) updates.checkOutTime = checkOutTime ? new Date(checkOutTime) : null;
    if (totalBreakMinutes !== undefined) updates.totalBreakMinutes = Math.max(0, Number(totalBreakMinutes));

    const finalIn = updates.checkInTime !== undefined ? updates.checkInTime : record.checkInTime;
    const finalOut = updates.checkOutTime !== undefined ? updates.checkOutTime : record.checkOutTime;
    const finalBreak = updates.totalBreakMinutes !== undefined ? updates.totalBreakMinutes : (record.totalBreakMinutes || 0);

    if (finalIn && finalOut) {
      const dur = Math.max(0, Math.floor((new Date(finalOut).getTime() - new Date(finalIn).getTime()) / 60000));
      updates.durationMinutes = dur;
      updates.netDurationMinutes = Math.max(0, dur - finalBreak);
      updates.currentBreakStart = null;
    }

    const auditNote = `[Regularized by ${caller.name || caller.role} on ${new Date().toISOString().split("T")[0]}: ${notes || "Adjusted shift times"}]`;
    updates.notes = record.notes ? `${record.notes} | ${auditNote}` : auditNote;
    updates.status = "Present";

    await record.update(updates);

    res.json({ success: true, record, message: "Attendance record regularized successfully" });
  } catch (error: any) {
    console.error("[regularizeAttendance] Error:", error);
    res.status(500).json({ error: error.message });
  }
};
