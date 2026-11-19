/** Platform routing values (für summoner-v4, league-v4, spectator-v5). */
export type Platform =
  | "euw1" | "eun1" | "na1" | "kr" | "jp1" | "br1" | "la1" | "la2"
  | "oc1" | "tr1" | "ru" | "me1" | "sg2" | "tw2" | "vn2";

/** Regional routing values (für account-v1, match-v5). */
export type RegionalRoute = "europe" | "americas" | "asia" | "sea";

export interface RegionInfo {
  /** URL-Slug, z.B. "euw" */
  slug: string;
  label: string;
  platform: Platform;
  /** Routing für match-v5 */
  matchRoute: RegionalRoute;
  /** Routing für account-v1 (kein "sea") */
  accountRoute: Exclude<RegionalRoute, "sea">;
}

export const REGIONS: readonly RegionInfo[] = [
  { slug: "euw", label: "EU West", platform: "euw1", matchRoute: "europe", accountRoute: "europe" },
  { slug: "eune", label: "EU Nordic & East", platform: "eun1", matchRoute: "europe", accountRoute: "europe" },
  { slug: "tr", label: "Türkiye", platform: "tr1", matchRoute: "europe", accountRoute: "europe" },
  { slug: "ru", label: "Russia", platform: "ru", matchRoute: "europe", accountRoute: "europe" },
  { slug: "me", label: "Middle East", platform: "me1", matchRoute: "europe", accountRoute: "europe" },
  { slug: "na", label: "North America", platform: "na1", matchRoute: "americas", accountRoute: "americas" },
  { slug: "br", label: "Brazil", platform: "br1", matchRoute: "americas", accountRoute: "americas" },
  { slug: "lan", label: "LAN", platform: "la1", matchRoute: "americas", accountRoute: "americas" },
  { slug: "las", label: "LAS", platform: "la2", matchRoute: "americas", accountRoute: "americas" },
  { slug: "kr", label: "Korea", platform: "kr", matchRoute: "asia", accountRoute: "asia" },
  { slug: "jp", label: "Japan", platform: "jp1", matchRoute: "asia", accountRoute: "asia" },
  { slug: "oce", label: "Oceania", platform: "oc1", matchRoute: "sea", accountRoute: "americas" },
  { slug: "sg", label: "Singapore", platform: "sg2", matchRoute: "sea", accountRoute: "asia" },
  { slug: "tw", label: "Taiwan", platform: "tw2", matchRoute: "sea", accountRoute: "asia" },
  { slug: "vn", label: "Vietnam", platform: "vn2", matchRoute: "sea", accountRoute: "asia" },
] as const;

export const DEFAULT_REGION = "euw";

export function getRegion(slug: string): RegionInfo | undefined {
  return REGIONS.find((r) => r.slug === slug.toLowerCase());
}

export function regionByPlatform(platform: string): RegionInfo | undefined {
  return REGIONS.find((r) => r.platform === platform.toLowerCase());
}
