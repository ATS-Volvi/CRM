import { Request, Response } from "express";
import { sequelize } from "@nexus-crm/database";

export const getMessageTemplates = async (req: Request, res: Response) => {
  try {
    const templates = await sequelize.models.MessageTemplate.findAll({
      order: [['createdAt', 'DESC']]
    });
    res.json(templates);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getMessageTemplateById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const template = await sequelize.models.MessageTemplate.findByPk(String(id));
    if (!template) return res.status(404).json({ error: "Template not found" });
    res.json(template);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createMessageTemplate = async (req: Request, res: Response) => {
  try {
    const { name, channel, subject, body, triggerEvent } = req.body;
    const template = await sequelize.models.MessageTemplate.create({
      id: require('crypto').randomUUID(),
      name,
      channel,
      subject,
      body,
      triggerEvent
    });
    res.status(201).json(template);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateMessageTemplate = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const template = await sequelize.models.MessageTemplate.findByPk(String(id));
    if (!template) return res.status(404).json({ error: "Template not found" });

    await template.update(req.body);
    res.json(template);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteMessageTemplate = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const template = await sequelize.models.MessageTemplate.findByPk(String(id));
    if (!template) return res.status(404).json({ error: "Template not found" });

    await template.destroy();
    res.json({ message: "Template deleted" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
