import { Request, Response } from "express";
import { sequelize } from "@nexus-crm/database";

export const getLeadSources = async (req: Request, res: Response) => {
  try {
    const LeadSource = sequelize.models.LeadSource;
    const sources = await LeadSource.findAll({
      order: [["name", "ASC"]]
    });
    res.json(sources);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createLeadSource = async (req: Request, res: Response) => {
  try {
    const { name, isActive } = req.body;
    const LeadSource = sequelize.models.LeadSource;
    const source = await LeadSource.create({
      id: require('crypto').randomUUID(),
      name,
      isActive: isActive !== false
    });
    res.status(201).json(source);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateLeadSource = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const LeadSource = sequelize.models.LeadSource;
    const source = await LeadSource.findByPk(String(id));
    if (!source) {
      return res.status(404).json({ error: "Lead source not found" });
    }
    await source.update(req.body);
    res.json(source);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteLeadSource = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const LeadSource = sequelize.models.LeadSource;
    const source = await LeadSource.findByPk(String(id));
    if (!source) {
      return res.status(404).json({ error: "Lead source not found" });
    }
    await source.destroy();
    res.json({ message: "Lead source deleted successfully" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
