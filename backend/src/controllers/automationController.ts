import { Request, Response } from "express";
import { AutomationRule } from "@nexus-crm/database";

export const getAutomationRules = async (req: Request, res: Response) => {
  try {
    const rules = await AutomationRule.findAll({ order: [["createdAt", "DESC"]] });
    res.json(rules);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createAutomationRule = async (req: Request, res: Response) => {
  try {
    const { name, triggerType, triggerCondition, actionType, actionConfig, isActive } = req.body;
    if (!name || !triggerType || !actionType) {
      return res.status(400).json({ error: "Missing required fields: name, triggerType, actionType" });
    }

    const rule = await AutomationRule.create({
      name,
      triggerType: triggerType || "stage_change",
      triggerCondition: triggerCondition || {},
      actionType,
      actionConfig: actionConfig || {},
      isActive: isActive !== undefined ? isActive : true
    });

    res.status(201).json(rule);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateAutomationRule = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const rule: any = await AutomationRule.findByPk(id as string);
    if (!rule) return res.status(404).json({ error: "Automation Rule not found" });

    const { name, triggerType, triggerCondition, actionType, actionConfig, isActive } = req.body;
    if (name !== undefined) rule.name = name;
    if (triggerType !== undefined) rule.triggerType = triggerType;
    if (triggerCondition !== undefined) rule.triggerCondition = triggerCondition;
    if (actionType !== undefined) rule.actionType = actionType;
    if (actionConfig !== undefined) rule.actionConfig = actionConfig;
    if (isActive !== undefined) rule.isActive = isActive;

    await rule.save();
    res.json(rule);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteAutomationRule = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const rule = await AutomationRule.findByPk(id as string);
    if (!rule) return res.status(404).json({ error: "Automation Rule not found" });

    await rule.destroy();
    res.json({ message: "Automation Rule deleted successfully" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
