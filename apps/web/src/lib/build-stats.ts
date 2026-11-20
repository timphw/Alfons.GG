import "server-only";
import type { BuildStats } from "@alfons/shared";
import raw from "../../public/data/builds.json";

/** High-Elo-Build-Statistik (vom Crawler erzeugt, siehe packages/shared/scripts/crawl-builds.ts). */
export const buildStats: BuildStats | null = Object.keys((raw as BuildStats).builds ?? {}).length > 0 ? (raw as BuildStats) : null;
