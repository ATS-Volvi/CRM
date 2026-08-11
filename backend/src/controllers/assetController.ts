import { Request, Response } from "express";
import { sequelize } from "@nexus-crm/database";
import { Op } from "sequelize";
import crypto from "crypto";

// ─── Get Assets ──────────────────────────────────────────────────────────────

export const getAssets = async (req: Request, res: Response) => {
  try {
    const { status, condition, customerId, overdue } = req.query;

    const where: any = {};

    if (status) {
      where.status = String(status);
    }
    if (condition) {
      where.condition = String(condition);
    }
    if (customerId) {
      where.customerId = String(customerId);
    }
    if (overdue === "true") {
      where.status = "Deployed";
      where.expectedReturnDate = {
        [Op.lt]: new Date(),
      };
    }

    const assets = await sequelize.models.Asset.findAll({
      where,
      include: [
        { model: sequelize.models.Customer, as: "customer", required: false },
        { model: sequelize.models.Deal, as: "deal", required: false },
      ],
      order: [["name", "ASC"]],
    });

    return res.json(assets);
  } catch (error: any) {
    console.error("Error in getAssets:", error);
    return res.status(500).json({ error: error.message });
  }
};

// ─── Get Asset By Id ──────────────────────────────────────────────────────────

export const getAssetById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const asset = await sequelize.models.Asset.findByPk(String(id), {
      include: [
        { model: sequelize.models.Customer, as: "customer", required: false },
        { model: sequelize.models.Deal, as: "deal", required: false },
        { 
          model: sequelize.models.AssetStatusHistory, 
          as: "statusHistory", 
          required: false,
          include: [
            { model: sequelize.models.User, as: "changedBy", attributes: ["id", "name", "email"], required: false }
          ]
        },
      ],
      order: [[{ model: sequelize.models.AssetStatusHistory, as: "statusHistory" }, "createdAt", "DESC"]],
    });

    if (!asset) {
      return res.status(404).json({ error: "Asset not found" });
    }

    return res.json(asset);
  } catch (error: any) {
    console.error("Error in getAssetById:", error);
    return res.status(500).json({ error: error.message });
  }
};

// ─── Create Asset ─────────────────────────────────────────────────────────────

export const createAsset = async (req: Request, res: Response) => {
  try {
    const {
      name,
      type,
      serialNumber,
      status,
      condition,
      customerId,
      dealId,
      expectedReturnDate,
      notes,
    } = req.body;

    if (!name || !type) {
      return res.status(400).json({ error: "Name and Type are required fields" });
    }

    const newAsset = await sequelize.models.Asset.create({
      id: crypto.randomUUID(),
      name,
      type,
      serialNumber: serialNumber || null,
      status: status || "In Storage",
      condition: condition || "Good",
      customerId: customerId || null,
      dealId: dealId || null,
      deployedAt: status === "Deployed" ? new Date() : null,
      expectedReturnDate: expectedReturnDate ? new Date(expectedReturnDate) : null,
      notes: notes || null,
    } as any);

    // Create initial history log
    await sequelize.models.AssetStatusHistory.create({
      id: crypto.randomUUID(),
      assetId: (newAsset as any).id,
      previousStatus: null,
      newStatus: (newAsset as any).status,
      previousCondition: null,
      newCondition: (newAsset as any).condition,
      changedById: (req as any).user?.id || null,
      notes: "Asset registered in system",
    } as any);

    return res.status(201).json(newAsset);
  } catch (error: any) {
    console.error("Error in createAsset:", error);
    return res.status(500).json({ error: error.message });
  }
};

// ─── Update Asset ─────────────────────────────────────────────────────────────

export const updateAsset = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, type, serialNumber, notes } = req.body;

    const asset = await sequelize.models.Asset.findByPk(String(id));
    if (!asset) {
      return res.status(404).json({ error: "Asset not found" });
    }

    await asset.update({
      name: name !== undefined ? name : (asset as any).name,
      type: type !== undefined ? type : (asset as any).type,
      serialNumber: serialNumber !== undefined ? (serialNumber || null) : (asset as any).serialNumber,
      notes: notes !== undefined ? (notes || null) : (asset as any).notes,
    });

    return res.json(asset);
  } catch (error: any) {
    console.error("Error in updateAsset:", error);
    return res.status(500).json({ error: error.message });
  }
};

// ─── Update Asset Status & Condition (Transaction-based) ─────────────────────

export const updateAssetStatus = async (req: Request, res: Response) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { newStatus, newCondition, expectedReturnDate, notes, customerId, dealId } = req.body;

    const asset = await sequelize.models.Asset.findByPk(String(id), { transaction });
    if (!asset) {
      await transaction.rollback();
      return res.status(404).json({ error: "Asset not found" });
    }

    const previousStatus = (asset as any).status;
    const previousCondition = (asset as any).condition;

    const nextStatus = newStatus !== undefined ? newStatus : previousStatus;
    const nextCondition = newCondition !== undefined ? newCondition : previousCondition;

    // Detect changes
    const statusChanged = nextStatus !== previousStatus;
    const conditionChanged = nextCondition !== previousCondition;

    if (!statusChanged && !conditionChanged && expectedReturnDate === undefined && customerId === undefined && dealId === undefined) {
      await transaction.rollback();
      return res.json(asset);
    }

    const updateFields: any = {
      status: nextStatus,
      condition: nextCondition,
    };

    if (expectedReturnDate !== undefined) {
      updateFields.expectedReturnDate = expectedReturnDate ? new Date(expectedReturnDate) : null;
    }
    if (customerId !== undefined) {
      updateFields.customerId = customerId || null;
    }
    if (dealId !== undefined) {
      updateFields.dealId = dealId || null;
    }

    // Handlers for specific status transitions
    if (nextStatus === "Deployed") {
      if (!(asset as any).deployedAt) {
        updateFields.deployedAt = new Date();
      }
    } else {
      // Clear deployed fields when not deployed
      if (nextStatus === "In Storage" || nextStatus === "Retired" || nextStatus === "Under Maintenance") {
        updateFields.deployedAt = null;
        updateFields.customerId = null;
        updateFields.expectedReturnDate = null;
      }
    }

    await asset.update(updateFields, { transaction });

    // Insert history log
    await sequelize.models.AssetStatusHistory.create({
      id: crypto.randomUUID(),
      assetId: (asset as any).id,
      previousStatus,
      newStatus: nextStatus,
      previousCondition,
      newCondition: nextCondition,
      changedById: (req as any).user?.id || null,
      notes: notes || "Asset status/condition updated",
    } as any, { transaction });

    await transaction.commit();
    return res.json(asset);
  } catch (error: any) {
    await transaction.rollback();
    console.error("Error in updateAssetStatus:", error);
    return res.status(500).json({ error: error.message });
  }
};

// ─── Get Asset History ────────────────────────────────────────────────────────

export const getAssetHistory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const history = await sequelize.models.AssetStatusHistory.findAll({
      where: { assetId: String(id) },
      include: [
        { model: sequelize.models.User, as: "changedBy", attributes: ["id", "name", "email"], required: false }
      ],
      order: [["createdAt", "DESC"]],
    });

    return res.json(history);
  } catch (error: any) {
    console.error("Error in getAssetHistory:", error);
    return res.status(500).json({ error: error.message });
  }
};
