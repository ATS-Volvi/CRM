import { Request, Response } from "express";
import { sequelize } from "@nexus-crm/database";
import { Op } from "sequelize";

export const DEFAULT_SAUDI_LOCATIONS = [
  {
    name: "Jubail Industrial City 1",
    code: "JUB-01",
    region: "Eastern Province",
    zoneType: "sabic_rcjy",
    zoneLabel: "SABIC / Royal Commission (Jubail 1)",
    baseDistanceKm: 10,
    travelTimeHours: 0.5,
    gateAccessProtocol: "RCJY / SABIC Contractor EHS Badge & PTW",
    securityRequirements: "Safety shoes, helmet, eye protection, contractor badge",
    mapLinkOrCoordinates: "27.0145,49.6583",
    isQuickChip: true,
    sortOrder: 1,
    isActive: true
  },
  {
    name: "Jubail Industrial City 2",
    code: "JUB-02",
    region: "Eastern Province",
    zoneType: "sabic_rcjy",
    zoneLabel: "SABIC / Royal Commission (Jubail 2)",
    baseDistanceKm: 25,
    travelTimeHours: 0.75,
    gateAccessProtocol: "RCJY Gate 2 Pass & Contractor Registration",
    securityRequirements: "Personal H2S detector, flame-resistant coveralls, Aramco/RCJY stickers",
    mapLinkOrCoordinates: "27.0872,49.5214",
    isQuickChip: true,
    sortOrder: 2,
    isActive: true
  },
  {
    name: "MODON Dammam 2nd Ind",
    code: "DMM-02",
    region: "Eastern Province",
    zoneType: "modon_industrial",
    zoneLabel: "MODON Industrial Zone (Dammam 2nd)",
    baseDistanceKm: 85,
    travelTimeHours: 1.2,
    gateAccessProtocol: "Standard Commercial Gate Clearance",
    securityRequirements: "Civil contractor registration, PPE",
    mapLinkOrCoordinates: "26.2415,49.9821",
    isQuickChip: true,
    sortOrder: 3,
    isActive: true
  },
  {
    name: "Ras Tanura Plant Gate",
    code: "RTN-01",
    region: "Eastern Province",
    zoneType: "aramco_restricted",
    zoneLabel: "Saudi Aramco Restricted Facility (Ras Tanura)",
    baseDistanceKm: 70,
    travelTimeHours: 1.1,
    gateAccessProtocol: "Aramco 48h Advance Gate Pass & Aramco PTW",
    securityRequirements: "Aramco plant sticker, valid H2S certificate, Aramco ID/Passport",
    mapLinkOrCoordinates: "26.6833,50.1500",
    isQuickChip: true,
    sortOrder: 4,
    isActive: true
  },
  {
    name: "Ras Al-Khair Industrial City",
    code: "RAK-01",
    region: "Eastern Province",
    zoneType: "sabic_rcjy",
    zoneLabel: "Royal Commission (Ras Al-Khair)",
    baseDistanceKm: 90,
    travelTimeHours: 1.3,
    gateAccessProtocol: "RCJY Mineral & Maritime Gate Pass",
    securityRequirements: "Safety passport, industrial vehicle spark arrestor",
    mapLinkOrCoordinates: "27.5256,49.1836",
    isQuickChip: true,
    sortOrder: 5,
    isActive: true
  },
  {
    name: "Yanbu Industrial Complex",
    code: "YNB-01",
    region: "Western Province",
    zoneType: "sabic_rcjy",
    zoneLabel: "Royal Commission (Yanbu)",
    baseDistanceKm: 1420,
    travelTimeHours: 14,
    gateAccessProtocol: "RCJY Yanbu Gate Pass & Work Clearance",
    securityRequirements: "EHS induction, site safety coordinator clearance",
    mapLinkOrCoordinates: "23.9877,38.2561",
    isQuickChip: true,
    sortOrder: 6,
    isActive: true
  },
  {
    name: "Jafurah Gas Basin",
    code: "JAF-01",
    region: "Eastern Province",
    zoneType: "aramco_restricted",
    zoneLabel: "Saudi Aramco Unconventional Gas (Jafurah)",
    baseDistanceKm: 190,
    travelTimeHours: 2.5,
    gateAccessProtocol: "Aramco Restricted Area Permit & Desert Vehicle Pass",
    securityRequirements: "4x4 Desert Spec, Roll-over protection, H2S certified team",
    mapLinkOrCoordinates: "25.2954,49.8921",
    isQuickChip: true,
    sortOrder: 7,
    isActive: true
  },
  {
    name: "Haradh Oil & Gas Field",
    code: "HRD-01",
    region: "Eastern Province",
    zoneType: "aramco_restricted",
    zoneLabel: "Saudi Aramco Remote Desert Operations (Haradh)",
    baseDistanceKm: 280,
    travelTimeHours: 3.5,
    gateAccessProtocol: "Aramco Remote Gate Clearance & Desert PTW",
    securityRequirements: "In-Vehicle Monitoring System (IVMS), H2S rescue packs",
    mapLinkOrCoordinates: "24.1432,49.0631",
    isQuickChip: true,
    sortOrder: 8,
    isActive: true
  },
  {
    name: "Riyadh Industrial Zone (MODON)",
    code: "RUH-02",
    region: "Central Province",
    zoneType: "modon_industrial",
    zoneLabel: "MODON Riyadh 2nd/3rd Industrial",
    baseDistanceKm: 460,
    travelTimeHours: 4.5,
    gateAccessProtocol: "MODON Industrial Gate Entry Pass",
    securityRequirements: "Standard PPE & commercial delivery registration",
    mapLinkOrCoordinates: "24.5823,46.8821",
    isQuickChip: true,
    sortOrder: 9,
    isActive: true
  },
  {
    name: "Turaif / Wa'ad Al Shamal",
    code: "TRF-01",
    region: "Northern Borders",
    zoneType: "sabic_rcjy",
    zoneLabel: "Ma'aden Phosphate City (Wa'ad Al Shamal)",
    baseDistanceKm: 1150,
    travelTimeHours: 12,
    gateAccessProtocol: "Ma'aden / RCJY Industrial Security Permit",
    securityRequirements: "Phosphate plant chemical safety induction, acid-proof gear",
    mapLinkOrCoordinates: "31.5721,38.6521",
    isQuickChip: true,
    sortOrder: 10,
    isActive: true
  },
  {
    name: "NEOM / Red Sea Project",
    code: "NOM-01",
    region: "Western Province",
    zoneType: "neom_remote",
    zoneLabel: "NEOM / Red Sea Remote Project Site",
    baseDistanceKm: 1650,
    travelTimeHours: 17,
    gateAccessProtocol: "NEOM Security Badge & Environmental Manifest",
    securityRequirements: "Strict sustainability compliance, zero-discharge certification",
    mapLinkOrCoordinates: "28.0051,35.2536",
    isQuickChip: true,
    sortOrder: 11,
    isActive: true
  }
];

export const seedDefaultLocations = async () => {
  try {
    const Model = sequelize.models.ProjectSiteLocation;
    if (!Model) return;
    const count = await Model.count();
    if (count === 0) {
      for (const loc of DEFAULT_SAUDI_LOCATIONS) {
        await Model.create(loc);
      }
      console.log(`[ProjectSiteLocation] Seeded ${DEFAULT_SAUDI_LOCATIONS.length} default Saudi project sites.`);
    }
  } catch (err) {
    console.warn("[ProjectSiteLocation] Seeding warning:", err);
  }
};

// ──────────────────────────────────────────────────────────────
// GET /api/v1/master-data/locations
// ──────────────────────────────────────────────────────────────
export const getProjectSiteLocations = async (req: Request, res: Response) => {
  try {
    const Model = sequelize.models.ProjectSiteLocation;
    if (!Model) {
      return res.status(500).json({ error: "ProjectSiteLocation model not initialized" });
    }

    // Auto-seed if empty
    const count = await Model.count();
    if (count === 0) {
      await seedDefaultLocations();
    }

    const { isActive, isQuickChip, region, zoneType, search } = req.query;
    const where: any = {};

    if (isActive !== undefined && isActive !== "all") {
      where.isActive = String(isActive) === "true";
    }
    if (isQuickChip !== undefined && isQuickChip !== "all") {
      where.isQuickChip = String(isQuickChip) === "true";
    }
    if (region && region !== "all") {
      where.region = region;
    }
    if (zoneType && zoneType !== "all") {
      where.zoneType = zoneType;
    }
    if (search && String(search).trim()) {
      const q = `%${String(search).trim()}%`;
      where[Op.or] = [
        { name: { [Op.iLike || Op.like]: q } },
        { code: { [Op.iLike || Op.like]: q } },
        { region: { [Op.iLike || Op.like]: q } },
        { zoneLabel: { [Op.iLike || Op.like]: q } }
      ];
    }

    const locations = await Model.findAll({
      where,
      order: [
        ["sortOrder", "ASC"],
        ["name", "ASC"]
      ]
    });

    return res.json(locations);
  } catch (err: any) {
    console.error("getProjectSiteLocations error:", err);
    return res.status(500).json({ error: err.message || "Failed to fetch project site locations" });
  }
};

// ──────────────────────────────────────────────────────────────
// GET /api/v1/master-data/locations/:id
// ──────────────────────────────────────────────────────────────
export const getProjectSiteLocationById = async (req: Request, res: Response) => {
  try {
    const Model = sequelize.models.ProjectSiteLocation;
    const id = String(req.params.id);
    const location = await Model.findByPk(id);
    if (!location) {
      return res.status(404).json({ error: "Location not found" });
    }
    return res.json(location);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to fetch location" });
  }
};

// ──────────────────────────────────────────────────────────────
// POST /api/v1/master-data/locations
// ──────────────────────────────────────────────────────────────
export const createProjectSiteLocation = async (req: Request, res: Response) => {
  try {
    const Model = sequelize.models.ProjectSiteLocation;
    const {
      name,
      code,
      region,
      zoneType,
      zoneLabel,
      baseDistanceKm,
      travelTimeHours,
      gateAccessProtocol,
      securityRequirements,
      mapLinkOrCoordinates,
      isQuickChip,
      sortOrder,
      isActive
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Location name is required" });
    }

    const existing = await Model.findOne({ where: { name: name.trim() } });
    if (existing) {
      return res.status(400).json({ error: "A location with this name already exists" });
    }

    const newLoc = await Model.create({
      name: name.trim(),
      code: code ? code.trim() : null,
      region: region || "Eastern Province",
      zoneType: zoneType || "modon_industrial",
      zoneLabel: zoneLabel || null,
      baseDistanceKm: parseFloat(baseDistanceKm) || 0,
      travelTimeHours: travelTimeHours ? parseFloat(travelTimeHours) : null,
      gateAccessProtocol: gateAccessProtocol || null,
      securityRequirements: securityRequirements || null,
      mapLinkOrCoordinates: mapLinkOrCoordinates || null,
      isQuickChip: isQuickChip !== undefined ? isQuickChip : true,
      sortOrder: parseInt(sortOrder, 10) || 0,
      isActive: isActive !== undefined ? isActive : true
    });

    return res.status(201).json(newLoc);
  } catch (err: any) {
    console.error("createProjectSiteLocation error:", err);
    return res.status(500).json({ error: err.message || "Failed to create location" });
  }
};

// ──────────────────────────────────────────────────────────────
// PUT /api/v1/master-data/locations/:id
// ──────────────────────────────────────────────────────────────
export const updateProjectSiteLocation = async (req: Request, res: Response) => {
  try {
    const Model = sequelize.models.ProjectSiteLocation;
    const id = String(req.params.id);
    const location = await Model.findByPk(id);
    if (!location) {
      return res.status(404).json({ error: "Location not found" });
    }

    const {
      name,
      code,
      region,
      zoneType,
      zoneLabel,
      baseDistanceKm,
      travelTimeHours,
      gateAccessProtocol,
      securityRequirements,
      mapLinkOrCoordinates,
      isQuickChip,
      sortOrder,
      isActive
    } = req.body;

    if (name && name.trim() !== location.get("name")) {
      const existing = await Model.findOne({ where: { name: name.trim() } });
      if (existing && existing.get("id") !== id) {
        return res.status(400).json({ error: "Another location with this name already exists" });
      }
    }

    await location.update({
      name: name !== undefined ? name.trim() : location.get("name"),
      code: code !== undefined ? (code ? code.trim() : null) : location.get("code"),
      region: region !== undefined ? region : location.get("region"),
      zoneType: zoneType !== undefined ? zoneType : location.get("zoneType"),
      zoneLabel: zoneLabel !== undefined ? zoneLabel : location.get("zoneLabel"),
      baseDistanceKm: baseDistanceKm !== undefined ? parseFloat(baseDistanceKm) || 0 : location.get("baseDistanceKm"),
      travelTimeHours: travelTimeHours !== undefined ? (travelTimeHours ? parseFloat(travelTimeHours) : null) : location.get("travelTimeHours"),
      gateAccessProtocol: gateAccessProtocol !== undefined ? gateAccessProtocol : location.get("gateAccessProtocol"),
      securityRequirements: securityRequirements !== undefined ? securityRequirements : location.get("securityRequirements"),
      mapLinkOrCoordinates: mapLinkOrCoordinates !== undefined ? mapLinkOrCoordinates : location.get("mapLinkOrCoordinates"),
      isQuickChip: isQuickChip !== undefined ? isQuickChip : location.get("isQuickChip"),
      sortOrder: sortOrder !== undefined ? parseInt(sortOrder, 10) || 0 : location.get("sortOrder"),
      isActive: isActive !== undefined ? isActive : location.get("isActive")
    });

    return res.json(location);
  } catch (err: any) {
    console.error("updateProjectSiteLocation error:", err);
    return res.status(500).json({ error: err.message || "Failed to update location" });
  }
};

// ──────────────────────────────────────────────────────────────
// DELETE /api/v1/master-data/locations/:id
// ──────────────────────────────────────────────────────────────
export const deleteProjectSiteLocation = async (req: Request, res: Response) => {
  try {
    const Model = sequelize.models.ProjectSiteLocation;
    const id = String(req.params.id);
    const location = await Model.findByPk(id);
    if (!location) {
      return res.status(404).json({ error: "Location not found" });
    }

    await location.destroy();
    return res.json({ success: true, message: "Location deleted successfully" });
  } catch (err: any) {
    console.error("deleteProjectSiteLocation error:", err);
    return res.status(500).json({ error: err.message || "Failed to delete location" });
  }
};
