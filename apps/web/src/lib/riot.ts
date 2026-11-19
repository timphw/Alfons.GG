import "server-only";
import { connection } from "next/server";
import {
  RiotClient,
  RiotApiError,
  MemoryCache,
  getRegion,
  parseRiotId,
  type RegionInfo,
  type AccountDto,
} from "@alfons/shared";

/**
 * Ein Client pro Server-Instanz (Fluid Compute verwendet Instanzen wieder),
 * damit Rate-Limiter und Cache über Requests hinweg geteilt werden.
 * TODO Phase 3: Redis-Cache, sobald REDIS_URL gesetzt ist.
 */
const globalForRiot = globalThis as unknown as { __riot?: RiotClient };

/** Liefert den Riot-Client. Rendert dynamisch (der API-Key bleibt serverseitig). */
export async function riot(): Promise<RiotClient> {
  await connection();
  if (!globalForRiot.__riot) {
    const apiKey = process.env.RIOT_API_KEY;
    if (!apiKey) throw new MissingApiKeyError();
    globalForRiot.__riot = new RiotClient({ apiKey, cache: new MemoryCache(10_000) });
  }
  return globalForRiot.__riot;
}

export class MissingApiKeyError extends Error {
  constructor() {
    super("RIOT_API_KEY ist nicht gesetzt (siehe .env.example)");
    this.name = "MissingApiKeyError";
  }
}

export type ResolvedPlayer =
  | { ok: true; region: RegionInfo; account: AccountDto }
  | { ok: false; reason: "bad-region" | "bad-riot-id" | "not-found" };

/** URL-Parameter → Riot-Account. */
export async function resolvePlayer(regionSlug: string, riotIdSlug: string): Promise<ResolvedPlayer> {
  const region = getRegion(regionSlug);
  if (!region) return { ok: false, reason: "bad-region" };
  const id = parseRiotId(riotIdSlug);
  if (!id) return { ok: false, reason: "bad-riot-id" };
  const client = await riot();
  const account = await client.getAccountByRiotId(region.accountRoute, id.gameName, id.tagLine);
  if (!account) return { ok: false, reason: "not-found" };
  return { ok: true, region, account };
}

export type Loaded<T> = { ok: true; value: T } | { ok: false; error: string };

/** Führt einen Loader aus und wandelt Fehler in eine anzeigbare Meldung um. */
export async function load<T>(fn: () => Promise<T>): Promise<Loaded<T>> {
  try {
    return { ok: true, value: await fn() };
  } catch (err) {
    console.error(err);
    return { ok: false, error: describeRiotError(err) };
  }
}

/** Nutzerfreundliche Fehlermeldung für Riot-API-Fehler. */
export function describeRiotError(err: unknown): string {
  if (err instanceof MissingApiKeyError) return err.message;
  if (err instanceof RiotApiError) {
    if (err.status === 401 || err.status === 403)
      return "Der Riot API Key ist ungültig oder abgelaufen (Development-Keys laufen nach 24 h ab).";
    if (err.status === 429) return "Riot-Rate-Limit erreicht – bitte kurz warten.";
    return `Riot API Fehler (${err.status}).`;
  }
  return "Unbekannter Fehler beim Laden der Daten.";
}
