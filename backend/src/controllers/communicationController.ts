import { Request, Response } from "express";
import { sequelize } from "@nexus-crm/database";

export const getMessageTemplates = async (req: Request, res: Response) => {
  try {
    const templates = await sequelize.models.MessageTemplate.findAll({
      order: [["name", "ASC"]]
    });
    res.json(templates);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateMessageTemplate = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { bodyTemplate, isActive } = req.body;
    const template = await sequelize.models.MessageTemplate.findByPk(id as string);
    if (!template) {
      return res.status(404).json({ error: "Template not found" });
    }
    await template.update({
      bodyTemplate: bodyTemplate !== undefined ? bodyTemplate : (template as any).bodyTemplate,
      isActive: isActive !== undefined ? isActive : (template as any).isActive
    });
    res.json(template);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
