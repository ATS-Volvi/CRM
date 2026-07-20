import { Request, Response } from "express";
import { sequelize } from "@nexus-crm/database";

export const getAssignmentRules = async (req: Request, res: Response) => {
  try {
    const rules = await sequelize.models.AssignmentRule.findAll({
      include: [{ model: sequelize.models.User, as: "assignTo" }],
      order: [['priority', 'ASC']]
    });
    res.json(rules);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};export const createAssignmentRule = async (req: Request, res: Response) => {
  try {
    const { criteria, assignToId, priority, isActive, ruleType } = req.body;
    const rule = await sequelize.models.AssignmentRule.create({
      id: require('crypto').randomUUID(),
      criteria,
      assignToId,
      priority: priority || 0,
      isActive: isActive !== undefined ? isActive : true,
      ruleType: ruleType || "Round-robin"
    });
    res.status(201).json(rule);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateAssignmentRule = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { criteria, assignToId, priority, isActive, ruleType } = req.body;
    const rule = await sequelize.models.AssignmentRule.findByPk(id as string);
    if (!rule) return res.status(404).json({ error: "Assignment rule not found" });

    await rule.update({
      criteria: criteria !== undefined ? criteria : (rule as any).criteria,
      assignToId: assignToId !== undefined ? assignToId : (rule as any).assignToId,
      priority: priority !== undefined ? priority : (rule as any).priority,
      isActive: isActive !== undefined ? isActive : (rule as any).isActive,
      ruleType: ruleType !== undefined ? ruleType : (rule as any).ruleType
    });
    res.json(rule);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteAssignmentRule = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const rule = await sequelize.models.AssignmentRule.findByPk(id as string);
    if (!rule) return res.status(404).json({ error: "Assignment rule not found" });

    await rule.destroy();
    res.json({ message: "Assignment rule deleted successfully" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getSalespersonsCapacities = async (req: Request, res: Response) => {
  try {
    const { Op } = require("sequelize");
    const reps = await sequelize.models.User.findAll({
      where: {
        role: { [Op.in]: ["sales_rep", "sales_manager", "admin"] }
      },
      order: [["name", "ASC"]]
    });

    const capacities = [];
    for (const rep of reps) {
      const openCount = await sequelize.models.Lead.count({
        where: {
          assignedToId: (rep as any).id,
          status: { [Op.notIn]: ["Won", "Lost"] }
        }
      });
      capacities.push({
        id: (rep as any).id,
        name: (rep as any).name,
        current: openCount,
        max: (rep as any).maxOpenLeads || 20,
        isAvailable: (rep as any).isAvailable !== false
      });
    }

    res.json(capacities);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const balanceSalespersonsCapacities = async (req: Request, res: Response) => {
  try {
    const { Op } = require("sequelize");
    // 1. Get all available reps
    const reps = await sequelize.models.User.findAll({
      where: {
        role: { [Op.in]: ["sales_rep", "sales_manager", "admin"] },
        isAvailable: true
      }
    });

    if (reps.length === 0) {
      return res.status(400).json({ error: "No available representatives to balance capacity." });
    }

    // 2. Fetch all open leads assigned to available reps
    const repIds = reps.map(r => (r as any).id);
    const openLeads = await sequelize.models.Lead.findAll({
      where: {
        assignedToId: { [Op.in]: repIds },
        status: { [Op.notIn]: ["Won", "Lost"] }
      },
      order: [["createdAt", "ASC"]]
    });

    // 3. Set a balanced capacity limit for all reps (e.g. 20)
    const targetCapacity = 20;
    for (const rep of reps) {
      await rep.update({ maxOpenLeads: targetCapacity });
    }

    // 4. Reassign leads to balance current load
    const avgLoad = Math.ceil(openLeads.length / reps.length);
    
    // Group leads by current rep
    const repLeadsMap: { [key: string]: any[] } = {};
    for (const id of repIds) {
      repLeadsMap[id] = [];
    }
    for (const lead of openLeads) {
      if ((lead as any).assignedToId) {
        repLeadsMap[(lead as any).assignedToId].push(lead);
      }
    }

    // Identify overloaded and underloaded reps
    const overloadedReps = reps.filter(r => repLeadsMap[(r as any).id].length > avgLoad);
    const underloadedReps = reps.filter(r => repLeadsMap[(r as any).id].length < avgLoad);

    let reassignmentsCount = 0;

    for (const overRep of overloadedReps) {
      const excessCount = repLeadsMap[(overRep as any).id].length - avgLoad;
      for (let i = 0; i < excessCount; i++) {
        // Find an underloaded rep
        const underRep = underloadedReps.find(u => repLeadsMap[(u as any).id].length < avgLoad);
        if (!underRep) break;

        const leadToMove = repLeadsMap[(overRep as any).id].pop();
        if (leadToMove) {
          await leadToMove.update({ assignedToId: (underRep as any).id });
          repLeadsMap[(underRep as any).id].push(leadToMove);
          reassignmentsCount++;
        }
      }
    }

    res.json({
      message: "Sales representative capacities balanced successfully!",
      reassignmentsCount,
      targetCapacity
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

