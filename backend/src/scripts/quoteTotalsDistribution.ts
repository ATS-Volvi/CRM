import { sequelize } from "@nexus-crm/database";
import { Op } from "sequelize";
import { getOrgCurrency } from "../utils/orgSettings";
import { convertToOrgCurrency } from "../utils/exchangeRate";
import { formatMoney } from "../utils/formatMoney";

function percentile(sortedArr: number[], p: number): number {
  if (sortedArr.length === 0) return 0;
  if (sortedArr.length === 1) return sortedArr[0];
  const index = (sortedArr.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;
  return sortedArr[lower] * (1 - weight) + sortedArr[upper] * weight;
}

export async function computeQuoteTotalsDistribution() {
  console.log("================================================================================");
  console.log("QUOTE TOTALS DISTRIBUTION AUDIT (LAST 12 MONTHS)");
  console.log("================================================================================\n");

  const orgCurrency = await getOrgCurrency();
  console.log(`[Context] Organization Base Currency: ${orgCurrency}`);

  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);
  console.log(`[Filter] Quotes created on or after: ${twelveMonthsAgo.toISOString().split("T")[0]}\n`);

  const { Quote } = sequelize.models;
  if (!Quote) {
    console.error("Quote model not found in database.");
    process.exit(1);
  }

  const quotes = await Quote.findAll({
    where: {
      createdAt: {
        [Op.gte]: twelveMonthsAgo
      }
    },
    attributes: ["id", "quoteNumber", "totalAmount", "currency", "createdAt"],
    order: [["createdAt", "DESC"]],
    raw: true
  });

  console.log(`[Data] Total Quotes retrieved: ${quotes.length}`);

  const convertedTotals: number[] = [];
  const unconvertibleMap: Map<string, Array<{ id: string; quoteNumber?: string; amount: number }>> = new Map();

  for (const q of quotes as any[]) {
    const rawAmount = Number(q.totalAmount || 0);
    const quoteCurr = (q.currency || orgCurrency).toUpperCase();

    const converted = await convertToOrgCurrency(rawAmount, quoteCurr, orgCurrency);
    if (converted !== null) {
      convertedTotals.push(converted);
    } else {
      const list = unconvertibleMap.get(quoteCurr) || [];
      list.push({ id: q.id, quoteNumber: q.quoteNumber, amount: rawAmount });
      unconvertibleMap.set(quoteCurr, list);
    }
  }

  convertedTotals.sort((a, b) => a - b);

  const count = convertedTotals.length;
  console.log(`[Data] Successfully converted Quotes count: ${count}`);

  if (count > 0) {
    const min = convertedTotals[0];
    const max = convertedTotals[count - 1];
    const sum = convertedTotals.reduce((acc, val) => acc + val, 0);
    const mean = sum / count;
    const median = percentile(convertedTotals, 0.50);
    const p75 = percentile(convertedTotals, 0.75);
    const p95 = percentile(convertedTotals, 0.95);

    console.log("\n--------------------------------------------------------------------------------");
    console.log(`DISTRIBUTION METRICS (in ${orgCurrency})`);
    console.log("--------------------------------------------------------------------------------");
    console.log(`  Count:            ${count.toLocaleString()}`);
    console.log(`  Min:              ${formatMoney(Number(min.toFixed(2)), orgCurrency)}`);
    console.log(`  Mean (Average):   ${formatMoney(Number(mean.toFixed(2)), orgCurrency)}`);
    console.log(`  Median (50th %):  ${formatMoney(Number(median.toFixed(2)), orgCurrency)}`);
    console.log(`  75th Percentile:  ${formatMoney(Number(p75.toFixed(2)), orgCurrency)}`);
    console.log(`  95th Percentile:  ${formatMoney(Number(p95.toFixed(2)), orgCurrency)}`);
    console.log(`  Max:              ${formatMoney(Number(max.toFixed(2)), orgCurrency)}`);
    console.log("--------------------------------------------------------------------------------\n");
  } else {
    console.log("\n[Notice] No convertible quote records found in the specified 12-month period.\n");
  }

  if (unconvertibleMap.size > 0) {
    console.log("--------------------------------------------------------------------------------");
    console.log("UNCONVERTIBLE QUOTE CURRENCIES (Missing Exchange Rate to Org Currency)");
    console.log("--------------------------------------------------------------------------------");
    for (const [curr, items] of unconvertibleMap.entries()) {
      const subtotal = items.reduce((acc, i) => acc + i.amount, 0);
      console.log(`  • Currency: ${curr}`);
      console.log(`    - Count: ${items.length}`);
      console.log(`    - Subtotal: ${formatMoney(subtotal, curr)}`);
      console.log(`    - Quote IDs: ${items.map(i => i.quoteNumber || i.id.slice(0, 8)).join(", ")}`);
    }
    console.log("--------------------------------------------------------------------------------\n");
  } else {
    console.log("[Status] All quote currencies were successfully converted with active rates.\n");
  }

  return {
    count,
    median: count > 0 ? percentile(convertedTotals, 0.50) : 0,
    p75: count > 0 ? percentile(convertedTotals, 0.75) : 0,
    p95: count > 0 ? percentile(convertedTotals, 0.95) : 0,
    unconvertibleCount: Array.from(unconvertibleMap.values()).reduce((acc, arr) => acc + arr.length, 0)
  };
}

if (require.main === module) {
  computeQuoteTotalsDistribution()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("[computeQuoteTotalsDistribution] Failed:", err);
      process.exit(1);
    });
}
