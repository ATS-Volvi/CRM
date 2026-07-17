import { Request, Response } from "express";
import { sequelize } from "@nexus-crm/database";
import crypto from "crypto";

export const getKpiMasters = async (req: Request, res: Response) => {
  try {
    const KpiMaster = sequelize.models.KpiMaster;
    const kpis = await KpiMaster.findAll({
      order: [["category", "ASC"], ["name", "ASC"]]
    });
    res.json(kpis);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createKpiMaster = async (req: Request, res: Response) => {
  try {
    const { name, category, targetValue, frequency, weightage, isActive } = req.body;
    const KpiMaster = sequelize.models.KpiMaster;
    
    // Check if unique name exists
    const existing = await KpiMaster.findOne({ where: { name } });
    if (existing) {
      res.status(400).json({ error: "KPI with this name already exists" });
      return;
    }

    const kpi = await KpiMaster.create({
      id: crypto.randomUUID(),
      name,
      category,
      targetValue: Number(targetValue) || 0,
      frequency: frequency || "monthly",
      weightage: Number(weightage) || 10,
      isActive: isActive !== false
    });
    res.status(201).json(kpi);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateKpiMaster = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const KpiMaster = sequelize.models.KpiMaster;
    const kpi = await KpiMaster.findByPk(id);
    if (!kpi) {
      res.status(404).json({ error: "KPI definition not found" });
      return;
    }

    await kpi.update(req.body);
    res.json(kpi);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteKpiMaster = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const KpiMaster = sequelize.models.KpiMaster;
    const kpi = await KpiMaster.findByPk(id);
    if (!kpi) {
      res.status(404).json({ error: "KPI definition not found" });
      return;
    }

    // Delete corresponding targets
    await sequelize.models.KpiTarget.destroy({
      where: { kpiName: (kpi as any).name }
    });

    await kpi.destroy();
    res.json({ message: "KPI definition and its targets deleted successfully" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
