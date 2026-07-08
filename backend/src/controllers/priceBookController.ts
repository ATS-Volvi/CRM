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
    const { sku, name, category, description, unitPrice, minPrice, maxPrice, segmentPricing, startDate, endDate } = req.body;
    const entry = await sequelize.models.PriceBookEntry.create({
      id: require('crypto').randomUUID(),
      sku,
      name,
      category,
      description,
      unitPrice,
      minPrice: minPrice || null,
      maxPrice: maxPrice || null,
      segmentPricing: segmentPricing ? JSON.stringify(segmentPricing) : "{}",
      startDate: startDate || null,
      endDate: endDate || null
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

export const importPriceBookEntries = async (req: Request, res: Response) => {
  try {
    const { items } = req.body; // Array of items
    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ error: "An array of items is required under the 'items' key." });
    }

    const createdEntries = [];

    for (const item of items) {
      const { sku, name, category, description, unitPrice, minPrice, maxPrice, segmentPricing, startDate, endDate } = item;

      // Upsert based on unique SKU
      const existing = await sequelize.models.PriceBookEntry.findOne({ where: { sku } });

      if (existing) {
        await existing.update({
          name: name !== undefined ? name : (existing as any).name,
          category: category !== undefined ? category : (existing as any).category,
          description: description !== undefined ? description : (existing as any).description,
          unitPrice: unitPrice !== undefined ? unitPrice : (existing as any).unitPrice,
          minPrice: minPrice !== undefined ? minPrice : (existing as any).minPrice,
          maxPrice: maxPrice !== undefined ? maxPrice : (existing as any).maxPrice,
          segmentPricing: segmentPricing !== undefined ? JSON.stringify(segmentPricing) : (existing as any).segmentPricing,
          startDate: startDate !== undefined ? startDate : (existing as any).startDate,
          endDate: endDate !== undefined ? endDate : (existing as any).endDate
        });
        createdEntries.push(existing);
      } else {
        const created = await sequelize.models.PriceBookEntry.create({
          id: require('crypto').randomUUID(),
          sku,
          name,
          category,
          description: description || null,
          unitPrice: unitPrice || 0,
          minPrice: minPrice || null,
          maxPrice: maxPrice || null,
          segmentPricing: segmentPricing ? JSON.stringify(segmentPricing) : "{}",
          startDate: startDate || null,
          endDate: endDate || null
        });
        createdEntries.push(created);
      }
    }

    res.status(200).json({ message: "Import complete.", count: createdEntries.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
