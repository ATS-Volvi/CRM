import { Request, Response } from "express";
import { sequelize } from "@nexus-crm/database";

export const getPriceBookEntries = async (req: Request, res: Response) => {
  try {
    const { category, search } = req.query;
    const where: any = {};

    if (category && category !== "All Categories") {
      where.category = category;
    }

    const items = await sequelize.models.PriceBookEntry.findAll({ where });
    res.json(items);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createPriceBookEntry = async (req: Request, res: Response) => {
  try {
    const { itemCode, name, category, description, listPrice, currency, active } = req.body;
    const entry = await sequelize.models.PriceBookEntry.create({
      id: require('crypto').randomUUID(),
      itemCode,
      name,
      category,
      description,
      listPrice,
      currency: currency || "USD",
      active: active !== undefined ? active : true
    });
    res.status(201).json(entry);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updatePriceBookEntry = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    const entry = await sequelize.models.PriceBookEntry.findByPk(String(id));
    if (!entry) return res.status(404).json({ error: "Item not found" });

    await entry.update(updateData);
    res.json(entry);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const deletePriceBookEntry = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const deletedCount = await sequelize.models.PriceBookEntry.destroy({ where: { id: String(id) } });
    if (deletedCount === 0) return res.status(404).json({ error: "Item not found" });
    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
