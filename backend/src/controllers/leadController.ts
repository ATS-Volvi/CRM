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

export const updateLead = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    const lead = await sequelize.models.Lead.findByPk(id);
    if (!lead) return res.status(404).json({ error: "Lead not found" });
    
    await lead.update(updateData);
    res.json(lead);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getDuplicateLeads = async (req: Request, res: Response) => {
  try {
    // A simple heuristic: Group leads by exact email OR exact company
    const leads = await sequelize.models.Lead.findAll();
    
    const groups: { [key: string]: any[] } = {};
    leads.forEach((l: any) => {
      const emailDomain = l.email ? l.email.split('@')[1] : null;
      // Key can be exact email or domain, here we just do exact email for simplicity if it exists
      const key = l.email ? l.email.toLowerCase() : l.company ? l.company.toLowerCase() : l.id;
      if (!groups[key]) groups[key] = [];
      groups[key].push(l);
    });

    // Return only groups that have > 1 lead
    const duplicateGroups = Object.values(groups).filter(g => g.length > 1);
    res.json(duplicateGroups);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const mergeLeads = async (req: Request, res: Response) => {
  try {
    const { masterId, duplicateIds } = req.body;
    
    // In a real app, we would re-assign Deals, Activities, etc to masterId.
    // For this prototype, we'll just delete the duplicates.
    await sequelize.models.Lead.destroy({
      where: { id: duplicateIds }
    });

    res.json({ success: true, message: `Merged ${duplicateIds.length} duplicates into master ${masterId}` });
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
