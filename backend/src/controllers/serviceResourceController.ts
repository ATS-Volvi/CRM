import { Request, Response } from "express";
import { ServiceResource, User, WorkOrderFeedback, sequelize } from "@nexus-crm/database";
import crypto from "crypto";
import { Op } from "sequelize";

/**
 * Format a ServiceResource record to include friendly territory and parsed skills array
 */
function formatServiceResource(resRecord: any, ratingStats?: { total: number; count: number }) {
  const json = resRecord.toJSON ? resRecord.toJSON() : { ...resRecord };
  let skills = json.skills || [];
  if (typeof skills === "string") {
    try {
      skills = JSON.parse(skills);
    } catch {
      skills = skills.split(",").map((s: string) => s.trim()).filter(Boolean);
    }
  }
  if (!Array.isArray(skills)) {
    skills = [];
  }

  let certifications = json.certifications || [];
  if (typeof certifications === "string") {
    try {
      certifications = JSON.parse(certifications);
    } catch {
      certifications = certifications.split(",").map((c: string) => c.trim()).filter(Boolean);
    }
  }
  if (!Array.isArray(certifications)) {
    certifications = [];
  }

  const count = ratingStats?.count || 0;
  const averageRating = count > 0 ? Number((ratingStats!.total / count).toFixed(1)) : null;

  return {
    ...json,
    territory: json.location || null,
    skills,
    certifications,
    experienceYearsWithCompany: Number(json.experienceYearsWithCompany || 0),
    previousExperience: json.previousExperience || null,
    attendanceStatus: json.attendanceStatus || "On Duty",
    averageRating,
    feedbackCount: count,
  };
}

/**
 * GET /api/v1/service-resources
 * List all service resources with linked user details
 */
export const getServiceResources = async (req: Request, res: Response) => {
  try {
    const { isActive, territory, search } = req.query;
    const where: any = {};

    if (isActive !== undefined && isActive !== "ALL") {
      where.isActive = String(isActive) === "true";
    }

    if (territory && territory !== "ALL") {
      where.location = territory;
    }

    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
        { location: { [Op.like]: `%${search}%` } }
      ];
    }

    const resources = await ServiceResource.findAll({
      where,
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "name", "email", "role"]
        }
      ],
      order: [["createdAt", "DESC"]]
    });

    const feedbacks = await WorkOrderFeedback.findAll({
      where: { rating: { [Op.ne]: null } },
      attributes: ["serviceResourceId", "rating"]
    });

    const ratingMap: Record<string, { total: number; count: number }> = {};
    for (const fb of feedbacks) {
      const sId = (fb as any).serviceResourceId;
      const r = Number((fb as any).rating);
      if (sId && !isNaN(r)) {
        if (!ratingMap[sId]) {
          ratingMap[sId] = { total: 0, count: 0 };
        }
        ratingMap[sId].total += r;
        ratingMap[sId].count += 1;
      }
    }

    return res.status(200).json(resources.map((r) => formatServiceResource(r, ratingMap[r.id])));
  } catch (error: any) {
    console.error("Error fetching service resources:", error);
    return res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

/**
 * POST /api/v1/service-resources
 * Create a new service resource linked to a User
 */
export const createServiceResource = async (req: Request, res: Response) => {
  try {
    const {
      userId,
      name,
      territory,
      location,
      skills,
      certifications,
      experienceYearsWithCompany,
      previousExperience,
      attendanceStatus = "On Duty",
      resourceType = "Technician",
      isActive = true,
      description,
      email,
      phone
    } = req.body;

    let resourceName = name;
    let resourceEmail = email;
    let resourcePhone = phone;

    // If userId provided, pull user info
    if (userId) {
      const user = await User.findByPk(userId);
      if (!user) {
        return res.status(404).json({ message: "Selected user not found" });
      }

      // Check if user already linked to a service resource
      const existing = await ServiceResource.findOne({ where: { userId } });
      if (existing) {
        return res.status(400).json({
          message: "This user is already registered as a Service Resource"
        });
      }

      if (!resourceName) resourceName = (user as any).name;
      if (!resourceEmail) resourceEmail = (user as any).email;
      if (!resourcePhone) resourcePhone = (user as any).phone || null;
    }

    if (!resourceName || resourceName.trim() === "") {
      return res.status(400).json({ message: "Resource name is required" });
    }

    const resolvedLocation = territory || location || null;
    let resolvedSkills: string[] = [];
    if (Array.isArray(skills)) {
      resolvedSkills = skills.map((s) => String(s).trim()).filter(Boolean);
    } else if (typeof skills === "string" && skills.trim() !== "") {
      resolvedSkills = skills.split(",").map((s) => s.trim()).filter(Boolean);
    }

    let resolvedCertifications: string[] = [];
    if (Array.isArray(certifications)) {
      resolvedCertifications = certifications.map((c) => String(c).trim()).filter(Boolean);
    } else if (typeof certifications === "string" && certifications.trim() !== "") {
      resolvedCertifications = certifications.split(",").map((c) => c.trim()).filter(Boolean);
    }

    const id = crypto.randomUUID();
    const newResource = await ServiceResource.create({
      id,
      name: resourceName.trim(),
      resourceType,
      userId: userId || null,
      description: description || null,
      isActive: isActive !== false,
      location: resolvedLocation,
      skills: resolvedSkills,
      certifications: resolvedCertifications,
      experienceYearsWithCompany: experienceYearsWithCompany !== undefined ? Number(experienceYearsWithCompany) : 0,
      previousExperience: previousExperience || null,
      attendanceStatus: attendanceStatus || "On Duty",
      email: resourceEmail ? resourceEmail.trim() : null,
      phone: resourcePhone ? resourcePhone.trim() : null
    });

    const reloaded = await ServiceResource.findByPk(id, {
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "name", "email", "role"]
        }
      ]
    });

    return res.status(201).json(formatServiceResource(reloaded || newResource));
  } catch (error: any) {
    console.error("Error creating service resource:", error);
    return res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

/**
 * PUT /api/v1/service-resources/:id
 * Update territory, skills, active status, or details of a service resource
 */
export const updateServiceResource = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const resource = await ServiceResource.findByPk(id);

    if (!resource) {
      return res.status(404).json({ message: "Service resource not found" });
    }

    const {
      name,
      territory,
      location,
      skills,
      certifications,
      experienceYearsWithCompany,
      previousExperience,
      attendanceStatus,
      isActive,
      resourceType,
      description,
      email,
      phone
    } = req.body;

    if (name !== undefined) resource.name = name.trim();
    if (territory !== undefined) resource.location = territory ? territory.trim() : null;
    else if (location !== undefined) resource.location = location ? location.trim() : null;

    if (skills !== undefined) {
      if (Array.isArray(skills)) {
        resource.skills = skills.map((s) => String(s).trim()).filter(Boolean);
      } else if (typeof skills === "string") {
        resource.skills = skills.split(",").map((s) => s.trim()).filter(Boolean);
      } else {
        resource.skills = [];
      }
    }

    if (certifications !== undefined) {
      if (Array.isArray(certifications)) {
        (resource as any).certifications = certifications.map((c: any) => String(c).trim()).filter(Boolean);
      } else if (typeof certifications === "string") {
        (resource as any).certifications = certifications.split(",").map((c: any) => c.trim()).filter(Boolean);
      } else {
        (resource as any).certifications = [];
      }
    }

    if (experienceYearsWithCompany !== undefined) {
      (resource as any).experienceYearsWithCompany = Number(experienceYearsWithCompany);
    }
    if (previousExperience !== undefined) {
      (resource as any).previousExperience = previousExperience ? String(previousExperience).trim() : null;
    }
    if (attendanceStatus !== undefined) {
      (resource as any).attendanceStatus = attendanceStatus;
    }

    if (isActive !== undefined) resource.isActive = Boolean(isActive);
    if (resourceType !== undefined) resource.resourceType = resourceType;
    if (description !== undefined) resource.description = description;
    if (email !== undefined) resource.email = email ? email.trim() : null;
    if (phone !== undefined) resource.phone = phone ? phone.trim() : null;

    await resource.save();

    const reloaded = await ServiceResource.findByPk(id, {
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "name", "email", "role"]
        }
      ]
    });

    return res.status(200).json(formatServiceResource(reloaded || resource));
  } catch (error: any) {
    console.error("Error updating service resource:", error);
    return res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

/**
 * GET /api/v1/service-resources/available-users
 * List users not yet assigned as a ServiceResource
 */
export const getAvailableUsersForResource = async (_req: Request, res: Response) => {
  try {
    const existingResources = await ServiceResource.findAll({
      attributes: ["userId"],
      where: { userId: { [Op.ne]: null } }
    });

    const assignedUserIds = existingResources
      .map((r: any) => r.userId)
      .filter(Boolean);

    const where: any = {};
    if (assignedUserIds.length > 0) {
      where.id = { [Op.notIn]: assignedUserIds };
    }

    const availableUsers = await User.findAll({
      where,
      attributes: ["id", "name", "email", "role"],
      order: [["name", "ASC"]]
    });

    return res.status(200).json(availableUsers);
  } catch (error: any) {
    console.error("Error fetching available users for service resource:", error);
    return res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

/**
 * GET /api/v1/service-resources/:id/absences
 * List all scheduled absences / leaves for a technician
 */
export const getResourceAbsences = async (req: Request, res: Response) => {
  try {
    const serviceResourceId = String(req.params.id);
    const ResourceAbsence = sequelize.models.ResourceAbsence;
    if (!ResourceAbsence) {
      return res.status(200).json([]);
    }

    const absences = await ResourceAbsence.findAll({
      where: { serviceResourceId },
      order: [["startDate", "ASC"]],
    });

    return res.status(200).json(absences);
  } catch (error: any) {
    console.error("Error fetching resource absences:", error);
    return res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

/**
 * POST /api/v1/service-resources/:id/absences
 * Record an absence / holiday / leave for a technician
 */
export const createResourceAbsence = async (req: Request, res: Response) => {
  try {
    const serviceResourceId = String(req.params.id);
    const resource = await ServiceResource.findByPk(serviceResourceId);
    if (!resource) {
      return res.status(404).json({ message: "Service resource not found" });
    }

    const { type = "Vacation", startDate, endDate, reason, status = "Approved" } = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json({ message: "Start date and end date are required" });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (end < start) {
      return res.status(400).json({ message: "End date must be on or after start date" });
    }

    const ResourceAbsence = sequelize.models.ResourceAbsence;
    if (!ResourceAbsence) {
      return res.status(500).json({ message: "ResourceAbsence model not initialized" });
    }

    const absence = await ResourceAbsence.create({
      id: crypto.randomUUID(),
      serviceResourceId,
      type,
      startDate: start,
      endDate: end,
      reason: reason ? String(reason).trim() : null,
      status,
    });

    return res.status(201).json(absence);
  } catch (error: any) {
    console.error("Error creating resource absence:", error);
    return res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

/**
 * DELETE /api/v1/service-resources/:id/absences/:absenceId
 * Cancel / remove an absence record
 */
export const deleteResourceAbsence = async (req: Request, res: Response) => {
  try {
    const { id: serviceResourceId, absenceId } = req.params;
    const ResourceAbsence = sequelize.models.ResourceAbsence;
    if (!ResourceAbsence) {
      return res.status(204).send();
    }

    const absence = await ResourceAbsence.findOne({
      where: { id: absenceId, serviceResourceId },
    });

    if (!absence) {
      return res.status(404).json({ message: "Absence record not found" });
    }

    await absence.destroy();
    return res.status(204).send();
  } catch (error: any) {
    console.error("Error deleting resource absence:", error);
    return res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

/**
 * GET /api/v1/work-orders/:id/recommended-technicians?startTime=...&endTime=...
 * Smart skills, territory, attendance, and availability-aware technician recommendation
 */
export const getRecommendedTechnicians = async (req: Request, res: Response) => {
  try {
    const workOrderId = String(req.params.id);
    const { startTime, endTime } = req.query;

    const WorkOrder = sequelize.models.WorkOrder;
    const wo = await WorkOrder.findByPk(workOrderId);
    if (!wo) {
      return res.status(404).json({ message: "Work order not found" });
    }

    const start = startTime ? new Date(String(startTime)) : null;
    const end = endTime ? new Date(String(endTime)) : null;

    const resources = await ServiceResource.findAll({
      where: { isActive: true },
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "name", "email", "role"],
        },
      ],
    });

    const feedbacks = await WorkOrderFeedback.findAll({
      where: { rating: { [Op.ne]: null } },
      attributes: ["serviceResourceId", "rating"],
    });

    const ratingMap: Record<string, { total: number; count: number }> = {};
    for (const fb of feedbacks) {
      const sId = (fb as any).serviceResourceId;
      const r = Number((fb as any).rating);
      if (sId && !isNaN(r)) {
        if (!ratingMap[sId]) {
          ratingMap[sId] = { total: 0, count: 0 };
        }
        ratingMap[sId].total += r;
        ratingMap[sId].count += 1;
      }
    }

    const ResourceAbsence = sequelize.models.ResourceAbsence;
    const ServiceAppointment = sequelize.models.ServiceAppointment;

    // Collect Work Order context keywords for skill matching
    const woText = `${(wo as any).subject || ""} ${(wo as any).description || ""} ${(wo as any).workOrderType || ""}`.toLowerCase();
    const woCity = ((wo as any).city || "").toLowerCase().trim();
    const woState = ((wo as any).state || "").toLowerCase().trim();

    const recommendations = [];

    for (const r of resources) {
      const formatted = formatServiceResource(r, ratingMap[r.id]);
      const techSkills: string[] = formatted.skills || [];
      const techLocation = (formatted.territory || "").toLowerCase().trim();

      let isAvailable = true;
      let conflictReason: string | null = null;
      let matchScore = 50;
      const matchReasons: string[] = [];

      // 1. Attendance status check
      if (formatted.attendanceStatus === "On Leave") {
        isAvailable = false;
        conflictReason = "Marked as On Leave today";
      } else if (formatted.attendanceStatus === "Off Shift") {
        isAvailable = false;
        conflictReason = "Off Shift today";
      }

      // Check daily live digital attendance if available
      try {
        const UserAttendance = (sequelize.models.UserAttendance as any);
        if (UserAttendance && r.userId) {
          const todayStr = new Date().toISOString().split("T")[0];
          const att = await UserAttendance.findOne({
            where: { userId: r.userId, date: todayStr }
          });
          if (att) {
            if (att.checkOutTime) {
              isAvailable = false;
              conflictReason = "Clocked out / Shift ended for today";
            } else if (att.currentBreakStart) {
              matchReasons.push("Technician currently on break");
              matchScore = Math.max(0, matchScore - 15);
            } else if (att.checkInTime) {
              matchScore += 10;
              matchReasons.push("Actively clocked in on duty (+10 pts)");
            }
          }
        }
      } catch (attErr) {
        // Safe fallback
      }

      // 2. Scheduled Absence / Holiday check
      if (start && end && ResourceAbsence) {
        const absence = await ResourceAbsence.findOne({
          where: {
            serviceResourceId: r.id,
            status: "Approved",
            [Op.and]: [
              { startDate: { [Op.lt]: end } },
              { endDate: { [Op.gt]: start } },
            ],
          },
        });
        if (absence) {
          isAvailable = false;
          conflictReason = `Approved ${(absence as any).type || "Leave"} from ${new Date((absence as any).startDate).toLocaleDateString()} to ${new Date((absence as any).endDate).toLocaleDateString()}`;
        }
      }

      // 3. Overlapping appointment conflict check
      if (start && end && ServiceAppointment) {
        const appointmentConflict = await ServiceAppointment.findOne({
          where: {
            serviceResourceId: r.id,
            status: { [Op.notIn]: ["Canceled"] },
            scheduledStartTime: { [Op.ne]: null },
            scheduledEndTime: { [Op.ne]: null },
            [Op.and]: [
              { scheduledStartTime: { [Op.lt]: end } },
              { scheduledEndTime: { [Op.gt]: start } },
            ],
          },
        });
        if (appointmentConflict) {
          isAvailable = false;
          conflictReason = `Overlapping appointment ${(appointmentConflict as any).appointmentNumber || (appointmentConflict as any).id}`;
        }
      }

      // 4. Skill matching
      const matchedSkills = techSkills.filter((sk) => woText.includes(sk.toLowerCase()));
      if (matchedSkills.length > 0) {
        matchScore += matchedSkills.length * 25;
        matchReasons.push(`Skills match: ${matchedSkills.join(", ")}`);
      } else if (techSkills.length > 0) {
        matchScore += 10;
        matchReasons.push(`Certified skills: ${techSkills.slice(0, 2).join(", ")}`);
      }

      // 5. Territory / Proximity matching
      if (techLocation && (woCity.includes(techLocation) || woState.includes(techLocation) || techLocation.includes(woCity))) {
        matchScore += 20;
        matchReasons.push(`Operating territory matches job site (${formatted.territory})`);
      }

      // 6. Experience bonus
      const exp = Number(formatted.experienceYearsWithCompany || 0);
      if (exp > 0) {
        const expBonus = Math.min(Math.round(exp * 3), 15);
        matchScore += expBonus;
        matchReasons.push(`${exp} yr${exp === 1 ? "" : "s"} experience with company`);
      }

      // 7. Certifications bonus
      if (formatted.certifications && formatted.certifications.length > 0) {
        matchScore += 10;
        matchReasons.push(`Certifications on file (${formatted.certifications.length})`);
      }

      // 8. Rating bonus
      if (formatted.averageRating && formatted.averageRating >= 4.5) {
        matchScore += 10;
        matchReasons.push(`High CSAT Rating (${formatted.averageRating} ★)`);
      }

      if (isAvailable) {
        matchReasons.push("Available during visit window");
      } else {
        matchScore -= 100; // Deprioritize unavailable resources
      }

      recommendations.push({
        resource: formatted,
        isAvailable,
        conflictReason,
        matchScore: Math.max(matchScore, 0),
        matchReasons,
      });
    }

    // Sort: highest score first (available technicians naturally rank top)
    recommendations.sort((a, b) => b.matchScore - a.matchScore);

    return res.status(200).json(recommendations);
  } catch (error: any) {
    console.error("Error computing recommended technicians:", error);
    return res.status(500).json({ message: "Internal server error", error: error.message });
  }
};
