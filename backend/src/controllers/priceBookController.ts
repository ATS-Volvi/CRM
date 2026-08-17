import { Request, Response } from "express";
import { sequelize } from "@nexus-crm/database";
import { Op } from "sequelize";
import crypto from "crypto";

// Roles that can see internal cost and margin
const COST_VISIBLE_ROLES = ["team_lead", "sales_manager", "sales_director", "admin", "management"];

function stripCostFields(item: any, userRole: string) {
  if (!COST_VISIBLE_ROLES.includes(userRole)) {
    delete item.internalCost;
    delete item.targetMarginPct;
  }
  return item;
}

function computeMargin(item: any) {
  const cost = parseFloat(item.internalCost) || 0;
  const price = parseFloat(item.unitPrice) || 0;
  if (cost > 0 && price > 0) {
    item.currentMarginPct = parseFloat((((price - cost) / price) * 100).toFixed(2));
  } else {
    item.currentMarginPct = null;
  }
  return item;
}

// ──────────────────────────────────────────────────────────────
// GET /api/v1/price-book
// ──────────────────────────────────────────────────────────────
export const getPriceBookEntries = async (req: Request, res: Response) => {
  try {
    const { category, uom, isActive, search } = req.query;
    const userRole: string = (req as any).user?.role || "sales_rep";
    const where: any = {};

    if (category && category !== "All Categories" && category !== "all") {
      where.category = category;
    }
    if (uom && uom !== "all") {
      where.uom = uom;
    }
    if (isActive === "true") {
      where.isActive = true;
    } else if (isActive === "false") {
      where.isActive = false;
    }
    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { sku: { [Op.like]: `%${search}%` } },
        { category: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } },
      ];
    }

    const items = await sequelize.models.PriceBookEntry.findAll({
      where,
      order: [["category", "ASC"], ["name", "ASC"]],
    });

    const result = items.map((i: any) => {
      const json = i.toJSON();
      computeMargin(json);
      stripCostFields(json, userRole);
      return json;
    });

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// ──────────────────────────────────────────────────────────────
// GET /api/v1/price-book/categories — distinct category list
// ──────────────────────────────────────────────────────────────
export const getCatalogCategories = async (req: Request, res: Response) => {
  try {
    const results = await sequelize.models.PriceBookEntry.findAll({
      attributes: [[sequelize.fn("DISTINCT", sequelize.col("category")), "category"]],
      where: { isActive: true },
      raw: true,
    });
    const categories = (results as any[]).map((r: any) => r.category).filter(Boolean).sort();
    res.json(categories);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// ──────────────────────────────────────────────────────────────
// GET /api/v1/price-book/uoms — distinct UOM list
// ──────────────────────────────────────────────────────────────
export const getCatalogUoms = async (req: Request, res: Response) => {
  try {
    const results = await sequelize.models.PriceBookEntry.findAll({
      attributes: [[sequelize.fn("DISTINCT", sequelize.col("uom")), "uom"]],
      where: { isActive: true },
      raw: true,
    });
    const uoms = (results as any[]).map((r: any) => r.uom).filter(Boolean).sort();
    res.json(uoms);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// ──────────────────────────────────────────────────────────────
// POST /api/v1/price-book
// ──────────────────────────────────────────────────────────────
export const createPriceBookEntry = async (req: Request, res: Response) => {
  try {
    const userRole: string = (req as any).user?.role || "sales_rep";
    const userId: string = (req as any).user?.id;

    const {
      sku, name, category, description, uom,
      internalCost, unitPrice, minSellingPrice, targetMarginPct, tax,
      minPrice, maxPrice, segmentPricing, startDate, endDate, isActive
    } = req.body;

    // Only cost-visible roles can set internalCost / targetMarginPct
    const costFields = COST_VISIBLE_ROLES.includes(userRole)
      ? {
          internalCost: internalCost != null ? parseFloat(internalCost) : null,
          targetMarginPct: targetMarginPct != null ? parseFloat(targetMarginPct) : null,
        }
      : {};

    const entry = await sequelize.models.PriceBookEntry.create({
      id: crypto.randomUUID(),
      sku: sku || `SKU-${Date.now()}`,
      name,
      category: category || null,
      description: description || null,
      uom: uom || "nos",
      unitPrice: parseFloat(unitPrice) || 0,
      minSellingPrice: minSellingPrice != null ? parseFloat(minSellingPrice) : null,
      tax: tax != null ? parseFloat(tax) : 0,
      minPrice: minPrice || null,
      maxPrice: maxPrice || null,
      segmentPricing: segmentPricing ? JSON.stringify(segmentPricing) : "{}",
      startDate: startDate || null,
      endDate: endDate || null,
      isActive: isActive !== false,
      updatedById: userId || null,
      ...costFields,
    });

    const json = (entry as any).toJSON();
    computeMargin(json);
    stripCostFields(json, userRole);
    res.status(201).json(json);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// ──────────────────────────────────────────────────────────────
// PUT /api/v1/price-book/:id
// ──────────────────────────────────────────────────────────────
export const updatePriceBookEntry = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userRole: string = (req as any).user?.role || "sales_rep";
    const userId: string = (req as any).user?.id;

    const entry = await sequelize.models.PriceBookEntry.findByPk(String(id));
    if (!entry) return res.status(404).json({ error: "Item not found" });

    const updateData: any = { ...req.body, updatedById: userId };

    // Strip cost fields if not permitted
    if (!COST_VISIBLE_ROLES.includes(userRole)) {
      delete updateData.internalCost;
      delete updateData.targetMarginPct;
    }

    // Sanitize numeric fields
    if (updateData.unitPrice != null) updateData.unitPrice = parseFloat(updateData.unitPrice);
    if (updateData.internalCost != null) updateData.internalCost = parseFloat(updateData.internalCost);
    if (updateData.minSellingPrice != null) updateData.minSellingPrice = parseFloat(updateData.minSellingPrice);
    if (updateData.targetMarginPct != null) updateData.targetMarginPct = parseFloat(updateData.targetMarginPct);
    if (updateData.tax != null) updateData.tax = parseFloat(updateData.tax);

    await entry.update(updateData);
    const json = (entry as any).toJSON();
    computeMargin(json);
    stripCostFields(json, userRole);
    res.json(json);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// ──────────────────────────────────────────────────────────────
// DELETE /api/v1/price-book/:id  (soft delete if used in quotes)
// ──────────────────────────────────────────────────────────────
export const deletePriceBookEntry = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if used in any QuoteLineItem
    const usageCount = await sequelize.models.QuoteLineItem.count({
      where: { catalogItemId: String(id) },
    });

    const entry = await sequelize.models.PriceBookEntry.findByPk(String(id));
    if (!entry) return res.status(404).json({ error: "Item not found" });

    if (usageCount > 0) {
      // Soft delete — deactivate instead of destroy
      await entry.update({ isActive: false });
      return res.json({ message: "Item deactivated (used in existing quotes). Not permanently deleted.", softDeleted: true });
    }

    await entry.destroy();
    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// ──────────────────────────────────────────────────────────────
// POST /api/v1/price-book/import-preview
// ──────────────────────────────────────────────────────────────
export const importPriceBookEntriesPreview = async (req: Request, res: Response) => {
  try {
    const { items } = req.body;
    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ error: "An array of items is required under the 'items' key." });
    }

    const previewItems = [];
    for (const item of items) {
      const { sku, name, category, unitPrice, internalCost, minSellingPrice, uom } = item;
      const errors: string[] = [];

      if (!name) errors.push("Item name is required.");
      if (unitPrice === undefined || isNaN(Number(unitPrice))) errors.push("Valid unit price is required.");

      const numCost = internalCost != null ? Number(internalCost) : null;
      const numPrice = Number(unitPrice || 0);
      const numMin = minSellingPrice != null ? Number(minSellingPrice) : null;

      if (numMin !== null && numPrice < numMin) {
        errors.push(`Selling price (${numPrice}) is below minimum allowed price (${numMin}).`);
      }
      if (numCost !== null && numPrice < numCost) {
        errors.push(`Warning: Selling price (${numPrice}) is below internal cost (${numCost}).`);
      }

      const existing = sku ? await sequelize.models.PriceBookEntry.findOne({ where: { sku } }) : null;
      const action = existing ? "Update" : "Create";

      previewItems.push({ ...item, action, errors, isValid: errors.length === 0 });
    }

    const importCount = previewItems.filter(i => i.action === "Create").length;
    const updateCount = previewItems.filter(i => i.action === "Update").length;
    const errorCount = previewItems.filter(i => !i.isValid).length;

    res.json({
      items: previewItems,
      isValid: errorCount === 0,
      summary: { imported: importCount, updated: updateCount, skipped: 0, errors: errorCount }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// ──────────────────────────────────────────────────────────────
// POST /api/v1/price-book/import
// ──────────────────────────────────────────────────────────────
export const importPriceBookEntries = async (req: Request, res: Response) => {
  try {
    const { items } = req.body;
    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ error: "An array of items is required under the 'items' key." });
    }

    const userRole: string = (req as any).user?.role || "sales_rep";
    const userId: string = (req as any).user?.id;
    let importedCount = 0;
    let updatedCount = 0;
    const errors: string[] = [];

    for (const item of items) {
      try {
        const { sku, name, category, description, uom, unitPrice, internalCost, minSellingPrice, targetMarginPct, tax } = item;
        const generatedSku = sku || `SKU-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

        const costData = COST_VISIBLE_ROLES.includes(userRole)
          ? {
              internalCost: internalCost != null ? parseFloat(String(internalCost)) : null,
              targetMarginPct: targetMarginPct != null ? parseFloat(String(targetMarginPct)) : null,
            }
          : {};

        const existing = await sequelize.models.PriceBookEntry.findOne({ where: { sku: generatedSku } });

        if (existing) {
          await existing.update({
            name: name || (existing as any).name,
            category: category || (existing as any).category,
            description: description || (existing as any).description,
            uom: uom || (existing as any).uom,
            unitPrice: unitPrice != null ? parseFloat(String(unitPrice)) : (existing as any).unitPrice,
            minSellingPrice: minSellingPrice != null ? parseFloat(String(minSellingPrice)) : (existing as any).minSellingPrice,
            tax: tax != null ? parseFloat(String(tax)) : (existing as any).tax,
            updatedById: userId,
            ...costData,
          });
          updatedCount++;
        } else {
          await sequelize.models.PriceBookEntry.create({
            id: crypto.randomUUID(),
            sku: generatedSku,
            name: name || "Unnamed Item",
            category: category || null,
            description: description || null,
            uom: uom || "nos",
            unitPrice: unitPrice != null ? parseFloat(String(unitPrice)) : 0,
            minSellingPrice: minSellingPrice != null ? parseFloat(String(minSellingPrice)) : null,
            tax: tax != null ? parseFloat(String(tax)) : 0,
            isActive: true,
            updatedById: userId,
            ...costData,
          });
          importedCount++;
        }
      } catch (err: any) {
        errors.push(`Row error: ${err.message}`);
      }
    }

    res.json({
      message: "Import complete.",
      summary: { imported: importedCount, updated: updatedCount, skipped: 0, errors: errors.length },
      errors,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// ──────────────────────────────────────────────────────────────
// GET /api/v1/price-book/:id/suggest  (win-rate price suggestion)
// ──────────────────────────────────────────────────────────────
export const getPriceSuggestion = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { getPriceWinRateSuggestion } = require("../services/pricingEngine");
    const suggestion = await getPriceWinRateSuggestion(id);
    res.json(suggestion);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
