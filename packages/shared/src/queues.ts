/** Die gängigsten Queue-IDs (siehe static.developer.riotgames.com/docs/lol/queues.json). */
export const QUEUES: Record<number, string> = {
  0: "Custom",
  400: "Normal Draft",
  420: "Ranked Solo/Duo",
  430: "Normal Blind",
  440: "Ranked Flex",
  450: "ARAM",
  480: "Swiftplay",
  490: "Quickplay",
  700: "Clash",
  720: "ARAM Clash",
  830: "Co-op vs. AI",
  840: "Co-op vs. AI",
  850: "Co-op vs. AI",
  900: "ARURF",
  1700: "Arena",
  1900: "URF",
};

export function queueName(queueId: number | undefined): string {
  if (queueId === undefined) return "Unbekannt";
  return QUEUES[queueId] ?? `Queue ${queueId}`;
}

export const TIER_ORDER = [
  "IRON", "BRONZE", "SILVER", "GOLD", "PLATINUM", "EMERALD",
  "DIAMOND", "MASTER", "GRANDMASTER", "CHALLENGER",
] as const;
