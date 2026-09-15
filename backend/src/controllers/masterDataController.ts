import { Request, Response } from "express";
import { Requirement, LineItem, ConstructionItem } from "@nexus-crm/database";
import { Op } from "sequelize";
import crypto from "crypto";

// ──────────────────────────────────────────────────────────────
// REQUIREMENTS
// ──────────────────────────────────────────────────────────────
export const getRequirements = async (req: Request, res: Response) => {
  try {
    const requirements = await Requirement.findAll({
      include: [
        {
          model: LineItem,
          as: "lineItems",
          include: [
            {
              model: ConstructionItem,
              as: "constructionItems"
            }
          ]
        }
      ],
      order: [["createdAt", "DESC"]]
    });

    const result = requirements.map(reqItem => {
      const reqJson = reqItem.toJSON() as any;
      let totalCost = 0;
      let totalPrice = 0;
      if (reqJson.lineItems) {
        reqJson.lineItems.forEach((li: any) => {
          let liCost = 0;
          let liPrice = 0;
          if (li.constructionItems) {
            li.constructionItems.forEach((ci: any) => {
              liCost += (parseFloat(ci.unitCost) || 0) * (parseFloat(ci.quantityPerLineItem) || 0);
              liPrice += (parseFloat(ci.unitPrice) || 0) * (parseFloat(ci.quantityPerLineItem) || 0);
            });
          }
          li.totalCost = liCost;
          li.totalPrice = liPrice;
          totalCost += liCost * (parseFloat(li.defaultQuantity) || 1);
          totalPrice += liPrice * (parseFloat(li.defaultQuantity) || 1);
        });
      }
      reqJson.totalCost = totalCost;
      reqJson.totalPrice = totalPrice;
      return reqJson;
    });

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createRequirement = async (req: Request, res: Response) => {
  try {
    const { name, description, category, isActive } = req.body;
    const item = await Requirement.create({
      id: crypto.randomUUID(),
      name,
      description,
      category,
      isActive: isActive !== false
    });
    res.status(201).json(item);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateRequirement = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const item = await Requirement.findByPk(String(id));
    if (!item) return res.status(404).json({ error: "Requirement not found" });
    await item.update(req.body);
    res.json(item);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteRequirement = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const item = await Requirement.findByPk(String(id));
    if (!item) return res.status(404).json({ error: "Requirement not found" });
    await item.destroy();
    res.json({ message: "Requirement deleted successfully" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// ──────────────────────────────────────────────────────────────
// LINE ITEMS
// ──────────────────────────────────────────────────────────────
export const getLineItems = async (req: Request, res: Response) => {
  try {
    const { requirementId } = req.query;
    const where: any = {};
    if (requirementId) {
      where.requirementId = requirementId;
    }

    const lineItems = await LineItem.findAll({
      where,
      include: [
        { model: Requirement, as: "requirement" },
        { model: ConstructionItem, as: "constructionItems" }
      ],
      order: [["createdAt", "DESC"]]
    });

    const result = lineItems.map(liItem => {
      const liJson = liItem.toJSON() as any;
      let totalCost = 0;
      let totalPrice = 0;
      if (liJson.constructionItems) {
        liJson.constructionItems.forEach((ci: any) => {
          totalCost += (parseFloat(ci.unitCost) || 0) * (parseFloat(ci.quantityPerLineItem) || 0);
          totalPrice += (parseFloat(ci.unitPrice) || 0) * (parseFloat(ci.quantityPerLineItem) || 0);
        });
      }
      liJson.totalCost = totalCost;
      liJson.totalPrice = totalPrice;
      return liJson;
    });

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createLineItem = async (req: Request, res: Response) => {
  try {
    const { requirementId, name, unit, description, defaultQuantity, price } = req.body;
    const parsedPrice = price !== undefined && price !== null && price !== "" ? Number(price) : null;

    const item = await LineItem.create({
      id: crypto.randomUUID(),
      requirementId,
      name,
      unit,
      description,
      defaultQuantity: defaultQuantity || 1,
      price: parsedPrice
    });

    // Auto-create a corresponding ConstructionItem so it appears immediately in the Pricing Grid
    await ConstructionItem.create({
      id: crypto.randomUUID(),
      lineItemId: item.id,
      name,
      category: "material",
      unit: unit || "nos",
      quantityPerLineItem: 1,
      unitCost: 0,
      unitPrice: parsedPrice || 0,
      isActive: true
    });

    res.status(201).json(item);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateLineItem = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const item = await LineItem.findByPk(String(id));
    if (!item) return res.status(404).json({ error: "Line Item not found" });

    const { price, name, unit } = req.body;
    const updateData = { ...req.body };
    if (price !== undefined) {
      updateData.price = price !== null && price !== "" ? Number(price) : null;
    }
    await item.update(updateData);

    // Sync to linked ConstructionItem
    const parsedPrice = price !== undefined ? (price !== null && price !== "" ? Number(price) : 0) : undefined;
    const ci = await ConstructionItem.findOne({ where: { lineItemId: item.id } });
    if (ci) {
      await ci.update({
        name: name || item.name,
        unit: unit || item.unit,
        ...(parsedPrice !== undefined ? { unitPrice: parsedPrice } : {})
      });
    } else {
      await ConstructionItem.create({
        id: crypto.randomUUID(),
        lineItemId: item.id,
        name: item.name,
        category: "material",
        unit: item.unit || "nos",
        quantityPerLineItem: 1,
        unitCost: 0,
        unitPrice: parsedPrice || 0,
        isActive: true
      });
    }

    res.json(item);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteLineItem = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const item = await LineItem.findByPk(String(id));
    if (!item) return res.status(404).json({ error: "Line Item not found" });
    await item.destroy();
    res.json({ message: "Line Item deleted successfully" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// ──────────────────────────────────────────────────────────────
// CONSTRUCTION ITEMS
// ──────────────────────────────────────────────────────────────
export const getConstructionItems = async (req: Request, res: Response) => {
  try {
    const { lineItemId } = req.query;
    const where: any = {};
    if (lineItemId) {
      where.lineItemId = lineItemId;
    }

    const constructionItems = await ConstructionItem.findAll({
      where,
      include: [
        {
          model: LineItem,
          as: "lineItem",
          include: [{ model: Requirement, as: "requirement" }]
        }
      ],
      order: [["createdAt", "DESC"]]
    });

    res.json(constructionItems);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createConstructionItem = async (req: Request, res: Response) => {
  try {
    const { lineItemId, name, category, unit, quantityPerLineItem, unitCost, unitPrice, isActive } = req.body;
    const item = await ConstructionItem.create({
      id: crypto.randomUUID(),
      lineItemId,
      name,
      category,
      unit,
      quantityPerLineItem: quantityPerLineItem || 1,
      unitCost: unitCost || 0,
      unitPrice: unitPrice || 0,
      isActive: isActive !== false
    });
    res.status(201).json(item);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateConstructionItem = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const item = await ConstructionItem.findByPk(String(id));
    if (!item) return res.status(404).json({ error: "Construction Item not found" });
    await item.update(req.body);
    res.json(item);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteConstructionItem = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const item = await ConstructionItem.findByPk(String(id));
    if (!item) return res.status(404).json({ error: "Construction Item not found" });
    await item.destroy();
    res.json({ message: "Construction Item deleted successfully" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// ──────────────────────────────────────────────────────────────
// ROLLUP AND PRICING GRID
// ──────────────────────────────────────────────────────────────
export const getRequirementRollup = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const reqItem = await Requirement.findByPk(String(id), {
      include: [
        {
          model: LineItem,
          as: "lineItems",
          include: [
            {
              model: ConstructionItem,
              as: "constructionItems"
            }
          ]
        }
      ]
    });

    if (!reqItem) return res.status(404).json({ error: "Requirement not found" });

    const reqJson = reqItem.toJSON() as any;
    let totalCost = 0;
    let totalPrice = 0;

    if (reqJson.lineItems) {
      reqJson.lineItems.forEach((li: any) => {
        let liCost = 0;
        let liPrice = 0;
        if (li.constructionItems) {
          li.constructionItems.forEach((ci: any) => {
            liCost += (parseFloat(ci.unitCost) || 0) * (parseFloat(ci.quantityPerLineItem) || 0);
            liPrice += (parseFloat(ci.unitPrice) || 0) * (parseFloat(ci.quantityPerLineItem) || 0);
          });
        }
        li.totalCost = liCost;
        li.totalPrice = liPrice;
        totalCost += liCost * (parseFloat(li.defaultQuantity) || 1);
        totalPrice += liPrice * (parseFloat(li.defaultQuantity) || 1);
      });
    }

    reqJson.totalCost = totalCost;
    reqJson.totalPrice = totalPrice;

    res.json(reqJson);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getPricingGrid = async (req: Request, res: Response) => {
  try {
    const { search, requirementId } = req.query;

    // Auto-create missing ConstructionItems for any LineItems that do not have one
    const allLineItems = await LineItem.findAll({
      include: [{ model: ConstructionItem, as: "constructionItems" }]
    });
    for (const li of allLineItems) {
      const json = li.toJSON() as any;
      if (!json.constructionItems || json.constructionItems.length === 0) {
        await ConstructionItem.create({
          id: crypto.randomUUID(),
          lineItemId: li.id,
          name: li.name,
          category: "material",
          unit: li.unit || "nos",
          quantityPerLineItem: 1,
          unitCost: 0,
          unitPrice: li.price ? Number(li.price) : 0,
          isActive: true
        });
      }
    }

    const where: any = {};

    if (search) {
      where.name = { [Op.like]: `%${search}%` };
    }

    const lineItemWhere: any = {};
    const hasRequirementFilter = !!requirementId && requirementId !== "All";
    if (hasRequirementFilter) {
      lineItemWhere.requirementId = requirementId;
    }

    const constructionItems = await ConstructionItem.findAll({
      where,
      include: [
        {
          model: LineItem,
          as: "lineItem",
          where: hasRequirementFilter ? lineItemWhere : undefined,
          required: hasRequirementFilter,
          include: [
            {
              model: Requirement,
              as: "requirement"
            }
          ]
        }
      ],
      order: [["createdAt", "DESC"]]
    });

    const result = constructionItems.map(ci => {
      const ciJson = ci.toJSON() as any;
      const cost = parseFloat(ciJson.unitCost) || 0;
      const price = parseFloat(ciJson.unitPrice) || 0;
      const margin = price > 0 ? ((price - cost) / price) * 100 : 0;
      ciJson.margin = parseFloat(margin.toFixed(2));
      return ciJson;
    });

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateConstructionItemPricing = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { unitCost, unitPrice } = req.body;

    const item = await ConstructionItem.findByPk(String(id));
    if (!item) return res.status(404).json({ error: "Construction Item not found" });

    const newCost = unitCost !== undefined ? parseFloat(unitCost) : item.unitCost;
    const newPrice = unitPrice !== undefined ? parseFloat(unitPrice) : item.unitPrice;

    await item.update({
      unitCost: newCost,
      unitPrice: newPrice
    });

    // Also update parent LineItem price
    if (unitPrice !== undefined) {
      const lineItem = await LineItem.findByPk(item.lineItemId);
      if (lineItem) {
        await lineItem.update({ price: newPrice });
      }
    }

    res.json(item);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
