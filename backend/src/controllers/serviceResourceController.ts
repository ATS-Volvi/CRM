import { Request, Response } from "express";
import { ServiceResource, User } from "@nexus-crm/database";
import crypto from "crypto";
import { Op } from "sequelize";

/**
 * Format a ServiceResource record to include friendly territory and parsed skills array
 */
function formatServiceResource(resRecord: any) {
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

  return {
    ...json,
    territory: json.location || null,
    skills
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

    return res.status(200).json(resources.map(formatServiceResource));
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
