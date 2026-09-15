import { Request, Response } from "express";
import { sequelize } from "@nexus-crm/database";
import crypto from "crypto";
import { Op } from "sequelize";

// Roles that are treated as "manager-level" for team-scoped KPI operations.
// Confirmed against real DB: actual values are "admin", "manager", "sales_rep".
// "sales_manager" and "director" included defensively in case they appear later.
const ADMIN_ROLES = ["admin", "director"];
const MANAGER_ROLES = ["manager", "sales_manager"];

function isAdmin(role: string) { return ADMIN_ROLES.includes(role); }
function isManager(role: string) { return MANAGER_ROLES.includes(role); }

/**
 * GET /api/v1/master-data/kpis
 *
 * Query params:
 *   ?teamLeadId=<uuid>   – filter to a specific team (admin/director only)
 *   ?scope=mine          – filter to caller's own team KPIs (manager only)
 *
 * Default behaviour:
 *   admin/director       → all KPIs (global + all team-scoped)
 *   manager/sales_manager → global KPIs + own team KPIs
 *   other                → global KPIs only (teamLeadId IS NULL)
 */
export const getKpiMasters = async (req: Request, res: Response) => {
  try {
    const caller = (req as any).user;
    const role: string = caller?.role ?? "";
    const KpiMaster = sequelize.models.KpiMaster;
    const User = sequelize.models.User;

    let where: any = {};
    const { teamLeadId, scope } = req.query as { teamLeadId?: string; scope?: string };

    if (isAdmin(role)) {
      // Admin/director: apply optional filter
      if (teamLeadId) {
        where.teamLeadId = teamLeadId;
      } else if (scope === "global") {
        where.teamLeadId = null;
      }
      // else: no filter → return everything
    } else if (isManager(role)) {
      // Manager: always see global + own team KPIs
      where[Op.or] = [
        { teamLeadId: null },
        { teamLeadId: caller.id },
      ];
    } else {
      // sales_rep / senior_ae: global KPIs only
      where.teamLeadId = null;
    }

    const kpis = await KpiMaster.findAll({
      where,
      include: [
        {
          model: User,
          as: "teamLead",
          attributes: ["id", "name", "email"],
          required: false,
        },
      ],
      order: [["category", "ASC"], ["name", "ASC"]],
    });

    res.json(kpis);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * POST /api/v1/master-data/kpis
 *
 * admin/director → can create global (teamLeadId null) or team-scoped KPIs
 * manager        → can only create KPIs for their own team (teamLeadId forced to caller.id)
 * sales_rep      → 403
 */
export const createKpiMaster = async (req: Request, res: Response) => {
  try {
    const caller = (req as any).user;
    const role: string = caller?.role ?? "";

    if (!isAdmin(role) && !isManager(role)) {
      res.status(403).json({ error: "Forbidden: Only admins or managers can create KPI definitions" });
      return;
    }

    const { name, category, targetValue, frequency, weightage, isActive, teamLeadId: bodyTeamLeadId } = req.body;
    const KpiMaster = sequelize.models.KpiMaster;

    // Determine the effective teamLeadId
    let effectiveTeamLeadId: string | null;
    if (isAdmin(role)) {
      // Admins may pass any teamLeadId (including null for global)
      effectiveTeamLeadId = bodyTeamLeadId || null;
    } else {
      // Managers: always scoped to their own team, regardless of what body says
      effectiveTeamLeadId = caller.id;
    }

    // Uniqueness check: name must be unique within the same scope (global or team)
    const existing = await KpiMaster.findOne({
      where: {
        name,
        teamLeadId: effectiveTeamLeadId,
      },
    });
    if (existing) {
      res.status(400).json({ error: "A KPI with this name already exists in this scope" });
      return;
    }

    const kpi = await KpiMaster.create({
      id: crypto.randomUUID(),
      name,
      category,
      targetValue: Number(targetValue) || 0,
      frequency: frequency || "monthly",
      weightage: Number(weightage) || 10,
      isActive: isActive !== false,
      teamLeadId: effectiveTeamLeadId,
    });

    res.status(201).json(kpi);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * PUT /api/v1/master-data/kpis/:id
 *
 * admin/director → can update any KPI
 * manager        → can only update KPIs they own (teamLeadId === caller.id)
 */
export const updateKpiMaster = async (req: Request, res: Response) => {
  try {
    const caller = (req as any).user;
    const role: string = caller?.role ?? "";

    if (!isAdmin(role) && !isManager(role)) {
      res.status(403).json({ error: "Forbidden: Only admins or managers can update KPI definitions" });
      return;
    }

    const id = req.params.id as string;
    const KpiMaster = sequelize.models.KpiMaster;
    const kpi = await KpiMaster.findByPk(id);

    if (!kpi) {
      res.status(404).json({ error: "KPI definition not found" });
      return;
    }

    // Ownership check for managers
    if (isManager(role) && (kpi as any).teamLeadId !== caller.id) {
      res.status(403).json({ error: "Forbidden: You can only edit your own team's KPIs" });
      return;
    }

    // Strip teamLeadId from update body for managers (cannot re-scope)
    const updateData = { ...req.body };
    if (isManager(role)) {
      delete updateData.teamLeadId;
    }

    await kpi.update(updateData);
    res.json(kpi);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * DELETE /api/v1/master-data/kpis/:id
 *
 * admin/director → can delete any KPI
 * manager        → can only delete KPIs they own
 */
export const deleteKpiMaster = async (req: Request, res: Response) => {
  try {
    const caller = (req as any).user;
    const role: string = caller?.role ?? "";

    if (!isAdmin(role) && !isManager(role)) {
      res.status(403).json({ error: "Forbidden: Only admins or managers can delete KPI definitions" });
      return;
    }

    const id = req.params.id as string;
    const KpiMaster = sequelize.models.KpiMaster;
    const kpi = await KpiMaster.findByPk(id);

    if (!kpi) {
      res.status(404).json({ error: "KPI definition not found" });
      return;
    }

    // Ownership check for managers
    if (isManager(role) && (kpi as any).teamLeadId !== caller.id) {
      res.status(403).json({ error: "Forbidden: You can only delete your own team's KPIs" });
      return;
    }

    // Delete corresponding targets
    await sequelize.models.KpiTarget.destroy({
      where: { kpiName: (kpi as any).name },
    });

    await kpi.destroy();
    res.json({ message: "KPI definition and its targets deleted successfully" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
