import { Request, Response } from "express";
import { sequelize } from "@nexus-crm/database";
import { ALLOWED_CURRENCIES, getOrgCurrency } from "../utils/orgSettings";
import { invalidateExchangeRatesCache, getExchangeRate } from "../utils/exchangeRate";

export async function getExchangeRates(req: Request, res: Response) {
  try {
    const rates = await sequelize.models.ExchangeRate.findAll({
      order: [["fromCurrency", "ASC"], ["toCurrency", "ASC"]],
    });

    const orgCurrency = await getOrgCurrency();
    const missingRates: string[] = [];

    // Check all allowed currencies for a path to orgCurrency
    for (const curr of ALLOWED_CURRENCIES) {
      if (curr.toUpperCase() === orgCurrency.toUpperCase()) continue;
      const rate = await getExchangeRate(curr, orgCurrency);
      if (rate == null) {
        missingRates.push(curr);
      }
    }

    const placeholderRates = (rates as any[]).filter(r => r.needsReview || r.isPlaceholder).map(r => `${r.fromCurrency}/${r.toCurrency}`);

    return res.json({
      rates,
      allowedCurrencies: ALLOWED_CURRENCIES,
      orgCurrency,
      missingRates,
      placeholderRates
    });
  } catch (error: any) {
    console.error("[getExchangeRates] Error:", error);
    return res.status(500).json({ error: error.message || "Failed to fetch exchange rates" });
  }
}

export async function updateExchangeRate(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    if (!user || user.role !== "admin") {
      return res.status(403).json({ error: "Only administrators can configure exchange rates." });
    }

    const { fromCurrency, toCurrency, rate } = req.body;

    if (!fromCurrency || !toCurrency || rate == null || isNaN(rate) || Number(rate) <= 0) {
      return res.status(400).json({ error: "Invalid currency pair or rate." });
    }

    const from = String(fromCurrency).toUpperCase();
    const to = String(toCurrency).toUpperCase();
    const numRate = Number(rate);

    if (from === to) {
      return res.status(400).json({ error: "fromCurrency and toCurrency must be distinct." });
    }

    // Upsert direct rate and mark review/placeholder resolved
    let directRecord: any = await sequelize.models.ExchangeRate.findOne({
      where: { fromCurrency: from, toCurrency: to }
    });

    if (directRecord) {
      await directRecord.update({
        rate: numRate,
        updatedById: user.id,
        needsReview: false,
        isPlaceholder: false
      });
    } else {
      directRecord = await sequelize.models.ExchangeRate.create({
        fromCurrency: from,
        toCurrency: to,
        rate: numRate,
        updatedById: user.id,
        needsReview: false,
        isPlaceholder: false
      });
    }

    // Upsert reciprocal rate
    const reciprocalRate = Number((1.0 / numRate).toFixed(6));
    let inverseRecord: any = await sequelize.models.ExchangeRate.findOne({
      where: { fromCurrency: to, toCurrency: from }
    });

    if (inverseRecord) {
      await inverseRecord.update({
        rate: reciprocalRate,
        updatedById: user.id,
        needsReview: false,
        isPlaceholder: false
      });
    } else {
      await sequelize.models.ExchangeRate.create({
        fromCurrency: to,
        toCurrency: from,
        rate: reciprocalRate,
        updatedById: user.id,
        needsReview: false,
        isPlaceholder: false
      });
    }

    invalidateExchangeRatesCache();

    return res.json({
      message: "Exchange rate updated successfully.",
      direct: directRecord,
      reciprocalRate
    });
  } catch (error: any) {
    console.error("[updateExchangeRate] Error:", error);
    return res.status(500).json({ error: error.message || "Failed to update exchange rate" });
  }
}

