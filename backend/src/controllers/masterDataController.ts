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
    const { requirementId, name, unit, description, defaultQuantity } = req.body;
    const item = await LineItem.create({
      id: crypto.randomUUID(),
      requirementId,
      name,
      unit,
      description,
      defaultQuantity: defaultQuantity || 1
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
    await item.update(req.body);
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
    const where: any = {};

    if (search) {
      where.name = { [Op.like]: `%${search}%` };
    }

    const lineItemWhere: any = {};
    const hasRequirementFilter = !!requirementId;
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

    await item.update({
      unitCost: unitCost !== undefined ? parseFloat(unitCost) : item.unitCost,
      unitPrice: unitPrice !== undefined ? parseFloat(unitPrice) : item.unitPrice
    });

    res.json(item);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
