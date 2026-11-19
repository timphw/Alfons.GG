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
