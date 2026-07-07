import { Request, Response } from "express";
import { sequelize } from "@nexus-crm/database";

export const getQuotes = async (req: Request, res: Response) => {
  try {
    const quotes = await sequelize.models.Quote.findAll({
      include: [
        { model: sequelize.models.Deal, as: "deal", include: [{ model: sequelize.models.Lead, as: "lead" }] }
      ],
      order: [['createdAt', 'DESC']]
    });
    res.json(quotes);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
