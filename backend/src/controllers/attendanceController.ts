import { Request, Response } from "express";
import { sequelize, User, ServiceResource } from "@nexus-crm/database";
import crypto from "crypto";
import { Op } from "sequelize";

export const getMyTodayAttendance = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const today = new Date().toISOString().split("T")[0];
    const UserAttendance = (sequelize.models.UserAttendance as any);
    if (!UserAttendance) {
      return res.json({ record: null, isClockedIn: false });
    }

    const record = await UserAttendance.findOne({
      where: { userId: user.id, date: today }
    });

    const isClockedIn = Boolean(record && record.checkInTime && !record.checkOutTime);
    res.json({ record, isClockedIn });
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

    let record = await UserAttendance.findOne({
      where: { userId: user.id, date: today }
    });

    const now = new Date();
    const ipAddress = req.ip || req.headers["x-forwarded-for"] || null;
    const userAgent = req.headers["user-agent"] || null;

    if (record) {
      if (!record.checkOutTime) {
        // Already clocked in
        return res.json({ success: true, record, message: "Already clocked in" });
      }
      // Re-opening/Clocking back in
      await record.update({
        checkInTime: now,
        checkOutTime: null,
        durationMinutes: null,
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

    res.json({ success: true, record, isClockedIn: true });
  } catch (error: any) {
    console.error("[clockIn] Error:", error);
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
    const durationMinutes = Math.max(1, Math.round((now.getTime() - checkInMs) / 60000));

    await record.update({
      checkOutTime: now,
      durationMinutes,
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

    res.json({ success: true, record, isClockedIn: false });
  } catch (error: any) {
    console.error("[clockOut] Error:", error);
    res.status(500).json({ error: error.message });
  }
};

export const getDailyAttendanceRoster = async (req: Request, res: Response) => {
  try {
    const targetDate = (req.query.date as string) || new Date().toISOString().split("T")[0];
    const UserAttendance = (sequelize.models.UserAttendance as any);

    if (!UserAttendance) {
      return res.json({ date: targetDate, attendances: [] });
    }

    const attendances = await UserAttendance.findAll({
      where: { date: targetDate }
    });

    res.json({ date: targetDate, attendances });
  } catch (error: any) {
    console.error("[getDailyAttendanceRoster] Error:", error);
    res.status(500).json({ error: error.message });
  }
};

