export const REVENUE_KPI_NAMES = ["Revenue Closed", "Monthly Revenue Target"] as const;

/**
 * Checks if a given KPI name matches one of the designated revenue KPI names.
 */
export function isRevenueKpiName(name: string): boolean {
  return (REVENUE_KPI_NAMES as readonly string[]).includes(name);
}

/**
 * Finds the revenue KPI target from a list of targets using exact names
 * in a fixed priority order:
 * 1. "Revenue Closed"
 * 2. "Monthly Revenue Target"
 */
export function findRevenueKpiTarget<T = any>(targets: T[]): T | null {
  if (!Array.isArray(targets) || targets.length === 0) return null;
  for (const name of REVENUE_KPI_NAMES) {
    const found = targets.find((t: any) => t.kpiName === name || t.name === name);
    if (found) return found;
  }
  return null;
}

