import { Request, Response } from "express";
import { DiscountPolicy } from "@nexus-crm/database";
import crypto from "crypto";

export const getDiscountPolicies = async (req: Request, res: Response) => {
  try {
    const policies = await DiscountPolicy.findAll({
      order: [["maxDiscountPercent", "ASC"]]
    });
    return res.json(policies);
  } catch (error: any) {
    console.error("Error fetching discount policies:", error);
    return res.status(500).json({ error: error.message });
  }
};

export const createDiscountPolicy = async (req: Request, res: Response) => {
  try {
    const { role, maxDiscountPercent, description, isActive } = req.body;
    if (!role || maxDiscountPercent === undefined) {
      return res.status(400).json({ error: "role and maxDiscountPercent are required." });
    }

    const policy = await DiscountPolicy.create({
      id: crypto.randomUUID(),
      role,
      maxDiscountPercent: Number(maxDiscountPercent),
      description: description || null,
      isActive: isActive !== false
    });

    return res.status(201).json(policy);
  } catch (error: any) {
    console.error("Error creating discount policy:", error);
    return res.status(500).json({ error: error.message });
  }
};

export const updateDiscountPolicy = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const policy = await DiscountPolicy.findByPk(String(id));
    if (!policy) {
      return res.status(404).json({ error: "Discount policy not found." });
    }

    const { role, maxDiscountPercent, description, isActive } = req.body;
    await policy.update({
      role: role !== undefined ? role : (policy as any).role,
      maxDiscountPercent: maxDiscountPercent !== undefined ? Number(maxDiscountPercent) : (policy as any).maxDiscountPercent,
      description: description !== undefined ? description : (policy as any).description,
      isActive: isActive !== undefined ? isActive : (policy as any).isActive
    });

    return res.json(policy);
  } catch (error: any) {
    console.error("Error updating discount policy:", error);
    return res.status(500).json({ error: error.message });
  }
};

export const deleteDiscountPolicy = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const policy = await DiscountPolicy.findByPk(String(id));
    if (!policy) {
      return res.status(404).json({ error: "Discount policy not found." });
    }

    await policy.destroy();
    return res.json({ message: "Discount policy deleted successfully." });
  } catch (error: any) {
    console.error("Error deleting discount policy:", error);
    return res.status(500).json({ error: error.message });
  }
};
