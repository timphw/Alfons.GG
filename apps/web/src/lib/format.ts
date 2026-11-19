export function formatDuration(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

export function pct(n: number, digits = 0): string {
  return `${(n * 100).toFixed(digits)}%`;
}

export function formatTier(tier: string, rank?: string): string {
  const t = tier.charAt(0) + tier.slice(1).toLowerCase();
  return ["MASTER", "GRANDMASTER", "CHALLENGER"].includes(tier) ? t : `${t} ${rank ?? ""}`.trim();
}

export const POSITION_LABEL: Record<string, string> = {
  TOP: "Top",
  JUNGLE: "Jungle",
  MIDDLE: "Mid",
  BOTTOM: "ADC",
  UTILITY: "Support",
};
