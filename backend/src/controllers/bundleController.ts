import { Request, Response } from "express";
import { sequelize } from "@nexus-crm/database";

export const getBundleTemplates = async (req: Request, res: Response) => {
  try {
    const templates = await sequelize.models.BundleTemplate.findAll({
      include: [{
        model: sequelize.models.BundleItem,
        as: "items",
        include: [{ model: sequelize.models.PriceBookEntry, as: "product" }]
      }]
    });
    res.json(templates);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createBundleTemplate = async (req: Request, res: Response) => {
  try {
    const { name, description, items } = req.body; // items: [{ productId, quantity }]

    if (!name) return res.status(400).json({ error: "Bundle name is required." });

    const template = await sequelize.models.BundleTemplate.create({
      id: require('crypto').randomUUID(),
      name,
      description: description || null
    });

    if (items && Array.isArray(items)) {
      const bundleItems = items.map((item: any) => ({
        id: require('crypto').randomUUID(),
        bundleTemplateId: (template as any).id,
        productId: item.productId,
        quantity: item.quantity || 1,
        isOptional: item.isOptional || false
      }));
      await sequelize.models.BundleItem.bulkCreate(bundleItems);
    }

    res.status(201).json(template);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteBundleTemplate = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const template = await sequelize.models.BundleTemplate.findByPk(id as string);
    if (!template) return res.status(404).json({ error: "Bundle template not found." });

    // Cascade delete items manually
    await sequelize.models.BundleItem.destroy({ where: { bundleTemplateId: id } });
    await template.destroy();

    res.json({ message: "Bundle template deleted successfully." });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
