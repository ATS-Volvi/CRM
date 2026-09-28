/**
 * formatMoney.ts
 * Currency formatting and multi-currency aggregation utilities.
 */

/**
 * Map of currency codes to preferred locales for standard formatting
 */
const CURRENCY_LOCALES: Record<string, string> = {
  INR: "en-IN",
  SAR: "en-US",
  USD: "en-US",
  EUR: "de-DE",
  GBP: "en-GB",
  AED: "en-AE"
};

/**
 * Format a single numeric amount with a specified currency code.
 * E.g. formatMoney(120000, "INR") -> "₹1,20,000"
 *      formatMoney(5000, "SAR") -> "SAR 5,000"
 */
export function formatMoney(
  amount: number | string | null | undefined,
  currency: string = "SAR",
  options: {
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
  } = {}
): string {
  if (amount === null || amount === undefined || amount === "") return "—";
  const num = Number(amount);
  if (isNaN(num)) return "—";

  const curr = (currency || "SAR").toUpperCase().trim();
  const locale = CURRENCY_LOCALES[curr] || "en-US";
  const minDigits = options.minimumFractionDigits ?? (num % 1 === 0 ? 0 : 2);
  const maxDigits = options.maximumFractionDigits ?? 2;

  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: curr,
      minimumFractionDigits: minDigits,
      maximumFractionDigits: maxDigits
    }).format(num);
  } catch {
    // Fallback if Intl doesn't support the currency code
    return `${curr} ${num.toLocaleString(locale, {
      minimumFractionDigits: minDigits,
      maximumFractionDigits: maxDigits
    })}`;
  }
}

/**
 * Formats a map of totals grouped by currency code into a multi-currency string.
 * Example: { INR: 120000, SAR: 5000 } -> "₹1,20,000 · SAR 5,000"
 * Returns "—" if empty, or formatted 0 if single currency with 0 value.
 */
export function formatMultiCurrencyTotals(
  currencyTotals: Record<string, number>,
  fallbackCurrency: string = "SAR"
): string {
  const currencies = Object.keys(currencyTotals).filter(
    (curr) => curr && typeof currencyTotals[curr] === "number"
  );

  if (currencies.length === 0) {
    return formatMoney(0, fallbackCurrency);
  }

  // Sort currencies for stable display
  currencies.sort();

  return currencies
    .map((curr) => formatMoney(currencyTotals[curr], curr))
    .join(" · ");
}

/**
 * Calculates overall ROAS across campaigns.
 * If all campaigns use the SAME single currency, returns `${roas}x`.
 * If multiple currencies exist, returns null (meaning multi-currency ROAS cannot be combined without FX rates).
 */
export function calculateSingleCurrencyRoas(
  spendByCurrency: Record<string, number>,
  revenueByCurrency: Record<string, number>
): string | null {
  const allCurrencies = new Set([
    ...Object.keys(spendByCurrency),
    ...Object.keys(revenueByCurrency)
  ]);

  if (allCurrencies.size === 0) {
    return null;
  }

  // More than one currency -> cannot sum without exchange rates
  if (allCurrencies.size > 1) {
    return null;
  }

  const [onlyCurrency] = Array.from(allCurrencies);
  const totalSpend = spendByCurrency[onlyCurrency] || 0;
  const totalRevenue = revenueByCurrency[onlyCurrency] || 0;

  if (totalSpend <= 0) {
    return null;
  }

  const roas = (totalRevenue / totalSpend).toFixed(2);
  return `${roas}x`;
}
