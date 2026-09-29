export function getLocaleForCurrency(currency: string = "SAR"): string {
  const code = (currency || "SAR").toUpperCase();
  if (code === "INR") return "en-IN";
  if (code === "SAR") return "en-SA";
  return "en-US";
}

export function formatMoney(amount: number | string | null | undefined, currency?: string): string {
  const num = typeof amount === "string" ? parseFloat(amount) : (amount ?? 0);
  if (isNaN(num)) return "0.00";
  const curr = (currency || "SAR").toUpperCase();
  const locale = getLocaleForCurrency(curr);
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: curr,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  } catch {
    return `${curr} ${num.toFixed(2)}`;
  }
}

export function formatMoneyCompact(amount: number | string | null | undefined, currency?: string): string {
  const num = typeof amount === "string" ? parseFloat(amount) : (amount ?? 0);
  if (isNaN(num)) return "0";
  const curr = (currency || "SAR").toUpperCase();
  const locale = getLocaleForCurrency(curr);
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: curr,
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(num);
  } catch {
    return `${curr} ${num}`;
  }
}
