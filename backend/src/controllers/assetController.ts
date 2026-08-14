import { Request, Response } from "express";
import { sequelize } from "@nexus-crm/database";
import { Op } from "sequelize";

/**
 * Seed sample assets if database table is empty
 */
async function seedSampleAssetsIfNeeded() {
  try {
    const Asset = sequelize.models.Asset;
    const count = await Asset.count();
    if (count === 0) {
      const sampleAccounts: any[] = await sequelize.models.Account.findAll({ limit: 3 });
      const customer1Id = sampleAccounts[0]?.id || null;
      const customer2Id = sampleAccounts[1]?.id || null;

      await Asset.bulkCreate([
        {
          name: "NexControl CP-5000 Panel",
          type: "Control Panel",
          serialNumber: "SN-CP5000-8842",
          status: "Deployed",
          condition: "Good",
          customerId: customer1Id,
          deployedAt: new Date(Date.now() - 30 * 86400000),
          expectedReturnDate: new Date(Date.now() + 180 * 86400000),
          notes: "Primary control unit deployed at manufacturing plant."
        },
        {
          name: "VibraSense Pro Sensor Array",
          type: "Industrial Sensor",
          serialNumber: "SN-[#VS-9912]",
          status: "In Storage",
          condition: "New",
          notes: "Demo kit ready for customer presentation."
        },
        {
          name: "ModuLogic PLC Processor X1",
          type: "PLC Unit",
          serialNumber: "SN-PLC-X1-4401",
          status: "Under Maintenance",
          condition: "Needs Service",
          notes: "Firmware update and calibration required."
        },
        {
          name: "PowerGen 75kW Mobile Generator",
          type: "Generator",
          serialNumber: "SN-PG75-1029",
          status: "In Transit",
          condition: "Good",
          customerId: customer2Id,
          deployedAt: new Date(Date.now() - 2 * 86400000),
          notes: "In transit to client site via express logistics."
        }
      ]);
    }
  } catch (error) {
    console.error("Error seeding sample assets:", error);
  }
}

/**
 * GET /api/v1/assets
 * Fetch all assets with customer & deal relations, search & filter options
 */
export const getAssets = async (req: Request, res: Response) => {
  try {
    await seedSampleAssetsIfNeeded();

    const { search, status, type } = req.query;
    const where: any = {};

    if (status && status !== "all") {
      where.status = status;
    }

    if (type && type !== "all") {
      where.type = type;
    }

    if (search) {
      const q = String(search).trim();
      where[Op.or] = [
        { name: { [Op.iLike]: `%${q}%` } },
        { serialNumber: { [Op.iLike]: `%${q}%` } },
        { type: { [Op.iLike]: `%${q}%` } },
        { notes: { [Op.iLike]: `%${q}%` } }
      ];
    }

    const assets = await sequelize.models.Asset.findAll({
      where,
      include: [
        { model: sequelize.models.Account, as: "customer", attributes: ["id", "name", "email", "industry"] },
        { model: sequelize.models.Deal, as: "deal", attributes: ["id", "name", "amount"] }
      ],
      order: [["createdAt", "DESC"]]
    });

    res.json(assets);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * GET /api/v1/assets/:id
 * Fetch single asset by ID with full status history
 */
export const getAssetById = async (req: Request, res: Response) => {
  try {
    const assetId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const asset = await sequelize.models.Asset.findByPk(assetId, {
      include: [
        { model: sequelize.models.Account, as: "customer", attributes: ["id", "name", "email", "phone"] },
        { model: sequelize.models.Deal, as: "deal", attributes: ["id", "name", "amount"] },
        {
          model: sequelize.models.AssetStatusHistory,
          as: "statusHistory",
          include: [{ model: sequelize.models.User, as: "changedBy", attributes: ["id", "name", "role"] }],
          order: [["createdAt", "DESC"]]
        }
      ]
    });

    if (!asset) {
      return res.status(404).json({ error: "Asset not found" });
    }

    res.json(asset);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * POST /api/v1/assets
 * Create a new asset and log initial status history
 */
export const createAsset = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { name, type, serialNumber, status, condition, customerId, dealId, deployedAt, expectedReturnDate, notes } = req.body;

    if (!name || !type) {
      return res.status(400).json({ error: "Asset Name and Type are required" });
    }

    const newAsset: any = await sequelize.models.Asset.create({
      name,
      type,
      serialNumber: serialNumber || `SN-${Date.now()}`,
      status: status || "In Storage",
      condition: condition || "Good",
      customerId: customerId || null,
      dealId: dealId || null,
      deployedAt: deployedAt ? new Date(deployedAt) : null,
      expectedReturnDate: expectedReturnDate ? new Date(expectedReturnDate) : null,
      notes: notes || null
    });

    // Log initial status history
    await sequelize.models.AssetStatusHistory.create({
      assetId: newAsset.id,
      previousStatus: null,
      newStatus: newAsset.status,
      previousCondition: null,
      newCondition: newAsset.condition,
      changedById: user?.id || null,
      notes: "Initial asset registration"
    });

    const fullAsset = await sequelize.models.Asset.findByPk(newAsset.id, {
      include: [
        { model: sequelize.models.Account, as: "customer", attributes: ["id", "name"] },
        { model: sequelize.models.Deal, as: "deal", attributes: ["id", "name"] }
      ]
    });

    res.status(201).json(fullAsset);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * PUT /api/v1/assets/:id
 * Update asset fields and log status/condition changes automatically
 */
export const updateAsset = async (req: Request, res: Response) => {
  try {
    const assetId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const user = (req as any).user;
    const { name, type, serialNumber, status, condition, customerId, dealId, deployedAt, expectedReturnDate, notes, statusChangeNotes } = req.body;

    const asset: any = await sequelize.models.Asset.findByPk(assetId);
    if (!asset) {
      return res.status(404).json({ error: "Asset not found" });
    }

    const oldStatus = asset.status;
    const oldCondition = asset.condition;

    asset.name = name ?? asset.name;
    asset.type = type ?? asset.type;
    asset.serialNumber = serialNumber ?? asset.serialNumber;
    asset.status = status ?? asset.status;
    asset.condition = condition ?? asset.condition;
    asset.customerId = customerId !== undefined ? customerId : asset.customerId;
    asset.dealId = dealId !== undefined ? dealId : asset.dealId;
    asset.deployedAt = deployedAt ? new Date(deployedAt) : asset.deployedAt;
    asset.expectedReturnDate = expectedReturnDate ? new Date(expectedReturnDate) : asset.expectedReturnDate;
    asset.notes = notes !== undefined ? notes : asset.notes;

    await asset.save();

    // Create history entry if status or condition changed
    if (oldStatus !== asset.status || oldCondition !== asset.condition) {
      await sequelize.models.AssetStatusHistory.create({
        assetId: asset.id,
        previousStatus: oldStatus,
        newStatus: asset.status,
        previousCondition: oldCondition,
        newCondition: asset.condition,
        changedById: user?.id || null,
        notes: statusChangeNotes || `Updated status to ${asset.status}`
      });
    }

    const updatedAsset = await sequelize.models.Asset.findByPk(asset.id, {
      include: [
        { model: sequelize.models.Account, as: "customer", attributes: ["id", "name"] },
        { model: sequelize.models.Deal, as: "deal", attributes: ["id", "name"] }
      ]
    });

    res.json(updatedAsset);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * DELETE /api/v1/assets/:id
 * Delete an asset
 */
export const deleteAsset = async (req: Request, res: Response) => {
  try {
    const assetId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const asset = await sequelize.models.Asset.findByPk(assetId);
    if (!asset) {
      return res.status(404).json({ error: "Asset not found" });
    }

    await sequelize.models.AssetStatusHistory.destroy({ where: { assetId } });
    await asset.destroy();

    res.json({ message: "Asset deleted successfully", id: assetId });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
