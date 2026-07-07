import { Request, Response } from "express";
import { sequelize } from "@nexus-crm/database";

export const getLeads = async (req: Request, res: Response) => {
  try {
    const { source, status, search } = req.query;
    const where: any = {};
    
    if (source && source !== "All Sources") {
      where.source = source.toString().toLowerCase();
    }
    
    if (status && status !== "All Statuses") {
      where.status = status;
    }

    const leads = await sequelize.models.Lead.findAll({
      where,
      order: [["createdAt", "DESC"]]
    });

    res.json(leads);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createLead = async (req: Request, res: Response) => {
  try {
    const { firstName, lastName, email, company, source, status } = req.body;
    
    const lead = await sequelize.models.Lead.create({
      id: require('crypto').randomUUID(),
      firstName,
      lastName,
      email,
      company,
      source: source || 'email',
      status: status || 'New Lead',
      leadScore: Math.floor(Math.random() * 100), // Mock score
    });

    res.status(201).json(lead);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteLead = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const deletedCount = await sequelize.models.Lead.destroy({ where: { id: String(id) } });
    if (deletedCount === 0) {
       return res.status(404).json({ error: "Lead not found" });
    }
    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
