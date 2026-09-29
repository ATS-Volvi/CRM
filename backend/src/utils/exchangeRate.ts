import { sequelize } from "@nexus-crm/database";
import { getOrgCurrency } from "./orgSettings";
import { formatMoney } from "./formatMoney";

let ratesCache: Map<string, number> | null = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 60 * 1000; // 1 minute

export function invalidateExchangeRatesCache() {
  ratesCache = null;
  lastFetchTime = 0;
}

async function loadRatesMap(): Promise<Map<string, number>> {
  const now = Date.now();
  if (ratesCache && now - lastFetchTime < CACHE_TTL_MS) {
    return ratesCache;
  }

  const map = new Map<string, number>();
  try {
    if (sequelize.models.ExchangeRate) {
      const allRates = await sequelize.models.ExchangeRate.findAll({ raw: true });
      for (const r of allRates as any[]) {
        if (r.fromCurrency && r.toCurrency && r.rate != null) {
          const key = `${r.fromCurrency.toUpperCase()}_${r.toCurrency.toUpperCase()}`;
          map.set(key, Number(r.rate));
        }
      }
    }
  } catch (err) {
    console.warn("[exchangeRate] Failed to load exchange rates:", err);
  }

  ratesCache = map;
  lastFetchTime = now;
  return map;
}

/**
 * Returns exchange rate fromCurrency -> toCurrency, or null if unresolvable.
 */
export async function getExchangeRate(
  fromCurrency: string,
  toCurrency: string,
  visited = new Set<string>()
): Promise<number | null> {
  const from = (fromCurrency || "").toUpperCase();
  const to = (toCurrency || "").toUpperCase();

  if (!from || !to) return null;
  if (from === to) return 1.0;

  const pairKey = `${from}_${to}`;
  if (visited.has(pairKey)) return null;
  visited.add(pairKey);

  const map = await loadRatesMap();

  // 1. Direct rate
  if (map.has(pairKey)) {
    return map.get(pairKey)!;
  }

  // 2. Inverse rate
  const inverseKey = `${to}_${from}`;
  if (map.has(inverseKey)) {
    const inv = map.get(inverseKey)!;
    if (inv > 0) return 1.0 / inv;
  }

  // 3. Bridge through USD
  if (from !== "USD" && to !== "USD") {
    const fromToUsd = await getExchangeRate(from, "USD", new Set(visited));
    const usdToTarget = await getExchangeRate("USD", to, new Set(visited));
    if (fromToUsd != null && usdToTarget != null) {
      return fromToUsd * usdToTarget;
    }
  }

  // 4. Bridge through SAR
  if (from !== "SAR" && to !== "SAR") {
    const fromToSar = await getExchangeRate(from, "SAR", new Set(visited));
    const sarToTarget = await getExchangeRate("SAR", to, new Set(visited));
    if (fromToSar != null && sarToTarget != null) {
      return fromToSar * sarToTarget;
    }
  }

  return null;
}


/**
 * Converts an amount from a record's currency to the Organization's default currency.
 * Returns null if no exchange rate path exists.
 */
export async function convertToOrgCurrency(
  amount: number,
  fromCurrency?: string | null,
  targetOrgCurrency?: string | null
): Promise<number | null> {
  if (amount == null || isNaN(amount)) return 0;
  const orgCurr = targetOrgCurrency || (await getOrgCurrency());
  const from = fromCurrency || orgCurr;

  if (from.toUpperCase() === orgCurr.toUpperCase()) {
    return Number(Number(amount).toFixed(2));
  }

  const rate = await getExchangeRate(from, orgCurr);
  if (rate == null) {
    return null;
  }

  // All currency conversions are rounded to 2 decimal places using standard half-up arithmetic
  return Number((Number(amount) * rate).toFixed(2));
}

export interface ConvertedTotalResult {
  orgTotal: number;
  unconvertedSubtotals: Record<string, number>; // currencyCode -> amount
  allConverted: boolean;
}

/**
 * Aggregates a list of amounts into the organization currency.
 * If an item's currency cannot be converted to the org currency, it is grouped into unconvertedSubtotals.
 */
export async function aggregateAmountsInOrgCurrency(
  items: Array<{ amount: number; currency?: string | null }>,
  targetOrgCurrency?: string | null
): Promise<ConvertedTotalResult> {
  const orgCurr = targetOrgCurrency || (await getOrgCurrency());
  let orgTotal = 0;
  const unconvertedSubtotals: Record<string, number> = {};
  let allConverted = true;

  for (const item of items) {
    const val = Number(item.amount || 0);
    if (!val) continue;
    const itemCurr = (item.currency || orgCurr).toUpperCase();
    if (itemCurr === orgCurr.toUpperCase()) {
      orgTotal += val;
    } else {
      const converted = await convertToOrgCurrency(val, itemCurr, orgCurr);
      if (converted != null) {
        orgTotal += converted;
      } else {
        allConverted = false;
        unconvertedSubtotals[itemCurr] = (unconvertedSubtotals[itemCurr] || 0) + val;
      }
    }
  }

  return { orgTotal, unconvertedSubtotals, allConverted };
}

/**
 * Snapshots the exchange rate and converted amount when a deal is marked WON.
 */
export async function snapshotDealWonAmount(
  deal: { amount?: number | string | null; currency?: string | null; exchangeRateToOrg?: number | null; amountInOrgCurrency?: number | null },
  targetOrgCurrency?: string | null
): Promise<{ exchangeRateToOrg: number; amountInOrgCurrency: number }> {
  const orgCurr = targetOrgCurrency || (await getOrgCurrency());
  const dealCurr = (deal.currency || orgCurr).toUpperCase();
  const rawAmount = Number(deal.amount || 0);

  if (dealCurr === orgCurr.toUpperCase()) {
    return {
      exchangeRateToOrg: 1.0,
      amountInOrgCurrency: rawAmount
    };
  }

  const rate = await getExchangeRate(dealCurr, orgCurr);
  const finalRate = rate ?? 1.0;
  return {
    exchangeRateToOrg: Number(finalRate.toFixed(6)),
    amountInOrgCurrency: Number((rawAmount * finalRate).toFixed(2))
  };
}

/**
 * Backfills existing WON deals with exchangeRateToOrg and amountInOrgCurrency based on current exchange rates.
 * Returns the count of backfilled deals.
 */
export async function backfillWonDealsExchangeRates(targetOrgCurrency?: string | null): Promise<number> {
  const orgCurr = targetOrgCurrency || (await getOrgCurrency());
  let backfilledCount = 0;

  try {
    const deals = await sequelize.models.Deal.findAll({
      include: [{ model: sequelize.models.PipelineStage, as: "stage" }]
    });

    for (const d of deals as any[]) {
      const isWon = String(d.status || "").toUpperCase() === "WON" || 
        (d.stage?.name && (d.stage.name.toLowerCase().includes("won") || d.stage.name.toLowerCase() === "closed won"));

      if (isWon && (d.amountInOrgCurrency == null || d.exchangeRateToOrg == null)) {
        const snapshot = await snapshotDealWonAmount(d, orgCurr);
        await d.update({
          exchangeRateToOrg: snapshot.exchangeRateToOrg,
          amountInOrgCurrency: snapshot.amountInOrgCurrency
        });
        backfilledCount++;
      }
    }
  } catch (err) {
    console.error("[backfillWonDealsExchangeRates] Error:", err);
  }

  return backfilledCount;
}

export interface ResolvedLimitResult {
  orgAmount: number;
  originalAmount: number;
  originalCurrency: string;
  orgCurrency: string;
  display: string;
  missingRate: boolean;
}

/**
 * Resolves any stored threshold, limit, target, or cutoff into the Organization currency.
 * Returns the converted orgAmount (rounded to 2 decimals), original details, whether the rate was missing,
 * and a standardized user-facing display string:
 * - "SAR 44,944.00 (limit set as INR 1,000,000.00)" when currencies differ
 * - "SAR 50,000.00" when currencies match
 */
export async function resolveLimit(
  value: number | string | null | undefined,
  valueCurrency?: string | null,
  targetOrgCurrency?: string | null
): Promise<ResolvedLimitResult> {
  const orgCurr = (targetOrgCurrency || (await getOrgCurrency())).toUpperCase();
  const rawNum = value != null && value !== "" ? Number(value) : 0;
  // If no currency is stored on the policy/record, it is defined as being in the org currency
  const origCurr = (valueCurrency || orgCurr).toUpperCase();

  if (rawNum === 0 || isNaN(rawNum)) {
    return {
      orgAmount: 0,
      originalAmount: 0,
      originalCurrency: origCurr,
      orgCurrency: orgCurr,
      display: formatMoney(0, orgCurr),
      missingRate: false
    };
  }

  if (origCurr === orgCurr) {
    return {
      orgAmount: rawNum,
      originalAmount: rawNum,
      originalCurrency: origCurr,
      orgCurrency: orgCurr,
      display: formatMoney(rawNum, orgCurr),
      missingRate: false
    };
  }

  const converted = await convertToOrgCurrency(rawNum, origCurr, orgCurr);
  if (converted === null) {
    return {
      orgAmount: rawNum,
      originalAmount: rawNum,
      originalCurrency: origCurr,
      orgCurrency: orgCurr,
      display: `${formatMoney(rawNum, origCurr)} (Missing exchange rate to ${orgCurr})`,
      missingRate: true
    };
  }

  // All currency conversions are rounded to 2 decimal places using standard half-up arithmetic
  const roundedOrgAmount = Number(converted.toFixed(2));
  return {
    orgAmount: roundedOrgAmount,
    originalAmount: rawNum,
    originalCurrency: origCurr,
    orgCurrency: orgCurr,
    display: `${formatMoney(roundedOrgAmount, orgCurr)} (limit set as ${formatMoney(rawNum, origCurr)})`,
    missingRate: false
  };
}


