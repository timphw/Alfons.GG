import "server-only";
import { cacheLife } from "next/cache";
import { fetchLatestVersion, fetchStaticData, type StaticData } from "@alfons/shared";

/** Aktueller Patch aus versions.json (stündlich aktualisiert). */
export async function getLatestVersion(): Promise<string> {
  "use cache";
  cacheLife("hours");
  return fetchLatestVersion();
}

/** Champions, Items, Spells und Runen für den aktuellen Patch. */
export async function getStaticData(): Promise<StaticData> {
  "use cache";
  cacheLife("hours");
  const version = await getLatestVersion();
  return fetchStaticData(version);
}

/** Schlanke Daten für Client-Komponenten (statt des kompletten StaticData-Objekts). */
export function liveAssets(data: StaticData): { version: string; runeIcons: Record<string, string> } {
  const runeIcons: Record<string, string> = {};
  for (const style of Object.values(data.runeStyles)) {
    runeIcons[String(style.id)] = style.icon;
    for (const r of style.slots[0]?.runes ?? []) runeIcons[String(r.id)] = r.icon; // Keystones
  }
  return { version: data.version, runeIcons };
}
