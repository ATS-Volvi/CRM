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
