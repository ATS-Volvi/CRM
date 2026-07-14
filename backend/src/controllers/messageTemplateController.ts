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

export const trackEmailOpen = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const variant = req.query.variant as string;

    const template = await sequelize.models.MessageTemplate.findByPk(String(id));
    if (template) {
      const t = template as any;
      if (t.isAbTest) {
        if (variant === 'B') {
          t.variantBOpens += 1;
        } else {
          t.variantAOpens += 1;
        }
        await t.save();
      }
    }

    // Return a 1x1 transparent GIF
    const img = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");
    res.writeHead(200, {
      "Content-Type": "image/gif",
      "Content-Length": img.length,
    });
    res.end(img);
  } catch (error: any) {
    // If tracking fails, don't break the client loading, just return a 200
    res.status(200).send();
  }
};

export const getAbTestStats = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const template = await sequelize.models.MessageTemplate.findByPk(String(id));
    if (!template) return res.status(404).json({ error: "Template not found" });

    const t = template as any;
    const stats = {
      isAbTest: t.isAbTest,
      winnerVariant: t.winnerVariant,
      variantA: {
        sends: t.variantASends,
        opens: t.variantAOpens,
        conversionRate: t.variantASends > 0 ? ((t.variantAOpens / t.variantASends) * 100).toFixed(2) + '%' : '0%'
      },
      variantB: {
        sends: t.variantBSends,
        opens: t.variantBOpens,
        conversionRate: t.variantBSends > 0 ? ((t.variantBOpens / t.variantBSends) * 100).toFixed(2) + '%' : '0%'
      }
    };
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const declareWinner = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { winnerVariant } = req.body; // 'A' or 'B'

    if (winnerVariant !== 'A' && winnerVariant !== 'B') {
      return res.status(400).json({ error: "winnerVariant must be 'A' or 'B'" });
    }

    const template = await sequelize.models.MessageTemplate.findByPk(String(id));
    if (!template) return res.status(404).json({ error: "Template not found" });

    const t = template as any;
    t.winnerVariant = winnerVariant;
    await t.save();

    res.json({ success: true, message: `Variant ${winnerVariant} declared as winner.` });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

