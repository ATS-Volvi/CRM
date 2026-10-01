/**
 * Converts a local datetime-local input string (e.g. '2026-10-15T14:30') into a UTC ISO 8601 string.
 */
export function localDateTimeToUtcIso(localDateTimeStr: string): string {
  if (!localDateTimeStr) return "";
  const date = new Date(localDateTimeStr);
  if (isNaN(date.getTime())) return "";
  return date.toISOString();
}

/**
 * Converts a UTC ISO string (or Date object) to a formatted local date & time display string.
 */
export function utcIsoToLocalDisplay(utcIsoStr: string | Date | null | undefined): string {
  if (!utcIsoStr) return "";
  const date = typeof utcIsoStr === "string" ? new Date(utcIsoStr) : utcIsoStr;
  if (isNaN(date.getTime())) return "";
  return date.toLocaleString();
}
