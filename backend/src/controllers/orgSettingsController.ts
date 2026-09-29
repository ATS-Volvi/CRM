import { Request, Response } from "express";
import { sequelize } from "@nexus-crm/database";
import { ALLOWED_CURRENCIES, AllowedCurrency, invalidateOrgSettingsCache } from "../utils/orgSettings";

// GET /api/v1/settings/org
export const getOrgSettings = async (req: Request, res: Response) => {
  try {
    const { OrgSettings } = sequelize.models;
    let setting = await OrgSettings.findOne();
    if (!setting) {
      setting = await OrgSettings.create({
        defaultCurrency: "SAR",
      });
    }
    res.json(setting);
  } catch (err: any) {
    console.error("[getOrgSettings]", err);
    res.status(500).json({ error: err.message });
  }
};

// PUT /api/v1/settings/org (admin only)
export const updateOrgSettings = async (req: Request, res: Response) => {
  try {
    const { defaultCurrency } = req.body;
    if (!defaultCurrency || !ALLOWED_CURRENCIES.includes(defaultCurrency as AllowedCurrency)) {
      res.status(400).json({
        error: `Invalid currency. Allowed currencies are: ${ALLOWED_CURRENCIES.join(", ")}`,
      });
      return;
    }

    const { OrgSettings } = sequelize.models;
    let setting = await OrgSettings.findOne();
    if (!setting) {
      setting = await OrgSettings.create({
        defaultCurrency,
      });
    } else {
      await (setting as any).update({ defaultCurrency });
    }

    invalidateOrgSettingsCache();
    res.json(setting);
  } catch (err: any) {
    console.error("[updateOrgSettings]", err);
    res.status(500).json({ error: err.message });
  }
};
