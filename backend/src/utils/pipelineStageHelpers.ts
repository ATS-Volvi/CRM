/**
 * Utility helpers for canonical PipelineStage name checking.
 * Canonical seeded stage names in DB are "Won" and "Lost", but some legacy or external code
 * uses "Closed Won" and "Closed Lost". These helpers handle both defensively.
 */

export const WON_STAGE_NAMES = ["Won", "Closed Won"];
export const LOST_STAGE_NAMES = ["Lost", "Closed Lost"];
export const CLOSED_STAGE_NAMES = ["Won", "Closed Won", "Lost", "Closed Lost"];

export function isWonStage(stageName?: string | null): boolean {
  if (!stageName) return false;
  const normalized = String(stageName).trim().toLowerCase();
  return normalized === "won" || normalized === "closed won";
}

export function isLostStage(stageName?: string | null): boolean {
  if (!stageName) return false;
  const normalized = String(stageName).trim().toLowerCase();
  return normalized === "lost" || normalized === "closed lost";
}

export function isClosedStage(stageName?: string | null): boolean {
  return isWonStage(stageName) || isLostStage(stageName);
}
