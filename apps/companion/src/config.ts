import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface CompanionConfig {
  server?: string;
  token?: string;
  riotId?: string;
  region?: string;
}

export const CONFIG_DIR = process.env.ALFONS_CONFIG_DIR ?? join(homedir(), ".alfons-gg");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");
/** Beim Bundling für Vercel durch die Produktions-URL ersetzt (siehe build.mjs) */
export const DEFAULT_SERVER = process.env.ALFONS_DEFAULT_SERVER ?? "http://localhost:3000";

export function loadConfig(): CompanionConfig {
  let file: CompanionConfig = {};
  try {
    file = JSON.parse(readFileSync(CONFIG_FILE, "utf8")) as CompanionConfig;
  } catch {
    // noch nicht gekoppelt
  }
  return {
    ...file,
    server: process.env.ALFONS_SERVER ?? file.server ?? DEFAULT_SERVER,
    token: process.env.ALFONS_TOKEN ?? file.token,
  };
}

export function saveConfig(cfg: CompanionConfig): string {
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), { mode: 0o600 });
  return CONFIG_FILE;
}
