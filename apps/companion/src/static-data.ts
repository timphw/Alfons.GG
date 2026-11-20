import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { fetchLatestVersion, fetchStaticData, type BuildData, type BuildStats } from "@alfons/shared";
import { CONFIG_DIR } from "./config";

/**
 * Data-Dragon-Daten für die lokale Build-Engine. Wird pro Patch einmal geladen und unter
 * ~/.alfons-gg/ddragon-<version>.json zwischengespeichert (offline nutzbar).
 */
export async function loadBuildData(): Promise<BuildData | null> {
  mkdirSync(CONFIG_DIR, { recursive: true });
  try {
    const version = await fetchLatestVersion();
    const file = join(CONFIG_DIR, `ddragon-${version}.json`);
    try {
      return JSON.parse(readFileSync(file, "utf8")) as BuildData;
    } catch {
      const data = await fetchStaticData(version, "de_DE");
      const slim: BuildData = { version, items: data.items, champions: data.champions };
      writeFileSync(file, JSON.stringify(slim));
      return slim;
    }
  } catch {
    // offline: neuesten Cache nehmen
    const cached = readdirSync(CONFIG_DIR)
      .filter((f) => /^ddragon-.+\.json$/.test(f))
      .sort()
      .pop();
    return cached ? (JSON.parse(readFileSync(join(CONFIG_DIR, cached), "utf8")) as BuildData) : null;
  }
}

/**
 * High-Elo-Build-Statistik (vom Crawler erzeugt) – von der Website laden, lokal cachen.
 * Fällt bei fehlender Verbindung auf den Cache zurück; ohne Statistik nutzt die Engine Regeln.
 */
export async function loadBuildStats(server: string): Promise<BuildStats | null> {
  mkdirSync(CONFIG_DIR, { recursive: true });
  const file = join(CONFIG_DIR, "builds.json");
  try {
    const res = await fetch(new URL("/data/builds.json", server), { signal: AbortSignal.timeout(8000) });
    if (res.ok) {
      const stats = (await res.json()) as BuildStats;
      if (stats && stats.builds && Object.keys(stats.builds).length > 0) {
        writeFileSync(file, JSON.stringify(stats));
        return stats;
      }
    }
  } catch {
    // offline → Cache
  }
  try {
    return JSON.parse(readFileSync(file, "utf8")) as BuildStats;
  } catch {
    return null;
  }
}
