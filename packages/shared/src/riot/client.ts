import type { Cache } from "./cache";
import { MemoryCache } from "./cache";
import { RateLimiter, realClock, DEV_KEY_LIMITS, type Clock, type RateWindow } from "./rate-limiter";
import type {
  AccountDto,
  CurrentGameInfo,
  LeagueEntryDto,
  LeagueListDto,
  MatchDto,
  MatchTimelineDto,
  SummonerDto,
} from "./types";
import type { Platform, RegionalRoute } from "../regions";

export class RiotApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly path: string,
    message?: string,
  ) {
    super(message ? `Riot API ${status} for ${path}: ${message}` : `Riot API ${status} for ${path}`);
    this.name = "RiotApiError";
  }
}

export interface RiotClientOptions {
  apiKey: string;
  fetch?: typeof fetch;
  cache?: Cache;
  limits?: RateWindow[];
  clock?: Clock;
  maxRetries?: number;
}

/** Cache-TTLs in Sekunden */
export const TTL = {
  account: 60 * 60,
  summoner: 10 * 60,
  league: 5 * 60,
  matchIds: 2 * 60,
  match: 7 * 24 * 60 * 60,
  activeGame: 15,
  notFound: 60,
  apexLeague: 60 * 60,
  /** Ränge fremder Spieler (Live-Aufstellung) – ändern sich während eines Spiels nicht */
  leagueLive: 30 * 60,
} as const;

/**
 * Wie lange abgelaufene Einträge noch als Notfall-Fallback taugen (Sekunden).
 * Ist das Rate-Limit voll oder antwortet Riot mit 429/5xx, liefert der Client
 * diesen alten Stand, statt zu warten oder einen Fehler zu zeigen.
 */
export const STALE = {
  default: 6 * 60 * 60,
  activeGame: 2 * 60,
} as const;

type Host = Platform | RegionalRoute;
interface CacheEnvelope<T> {
  v: T | null;
  /** epoch ms, ab dann veraltet (fehlt bei alten Einträgen → gilt als frisch) */
  exp?: number;
}

/**
 * Riot-API-Client:
 * - ein Rate-Limiter je Routing-Host (App-Limits gelten pro Region)
 * - 429 → Retry-After respektieren (Host pausieren) und erneut versuchen
 * - 5xx/Netzwerkfehler → exponentielles Backoff
 * - Response-Caching (inkl. 404 als `null`) und In-Flight-Deduplizierung
 * - Stale-Fallback: abgelaufene Einträge werden bei vollem Limit oder 429/5xx weiter ausgeliefert
 */
export class RiotClient {
  private readonly fetchImpl: typeof fetch;
  private readonly cache: Cache;
  private readonly clock: Clock;
  private readonly limits: RateWindow[];
  private readonly maxRetries: number;
  private readonly limiters = new Map<Host, RateLimiter>();
  private readonly inflight = new Map<string, Promise<unknown>>();

  constructor(private readonly opts: RiotClientOptions) {
    if (!opts.apiKey) throw new Error("RIOT_API_KEY fehlt");
    this.fetchImpl = opts.fetch ?? ((...args) => fetch(...args));
    this.cache = opts.cache ?? new MemoryCache();
    this.clock = opts.clock ?? realClock;
    this.limits = opts.limits ?? DEV_KEY_LIMITS;
    this.maxRetries = opts.maxRetries ?? 3;
  }

  private limiter(host: Host): RateLimiter {
    let l = this.limiters.get(host);
    if (!l) {
      l = new RateLimiter(this.limits, this.clock);
      this.limiters.set(host, l);
    }
    return l;
  }

  /** GET mit Cache. Gibt `null` bei 404 zurück. */
  async get<T>(
    host: Host,
    path: string,
    ttlSeconds: number,
    staleSeconds: number = STALE.default,
  ): Promise<T | null> {
    const key = `riot:${host}:${path}`;
    const cached = await this.cache.get<CacheEnvelope<T>>(key);
    if (cached && (cached.exp === undefined || cached.exp > this.clock.now())) return cached.v;

    const existing = this.inflight.get(key);
    if (existing) return existing as Promise<T | null>;

    // Veralteter Stand vorhanden und Limit gerade voll → nicht anstellen, sofort alten Stand zeigen
    const stale = cached;
    if (stale && this.limiter(host).waitTime() > 0) return stale.v;

    const p = (async () => {
      try {
        const value = await this.fetchWithRetry<T>(host, path, stale ? 0 : this.maxRetries);
        const ttl = value === null ? Math.min(TTL.notFound, ttlSeconds) : ttlSeconds;
        const keep = value === null ? 0 : staleSeconds;
        await this.cache.set<CacheEnvelope<T>>(key, { v: value, exp: this.clock.now() + ttl * 1000 }, ttl + keep);
        return value;
      } catch (err) {
        if (stale && isTransient(err)) return stale.v;
        throw err;
      } finally {
        this.inflight.delete(key);
      }
    })();
    this.inflight.set(key, p);
    return p;
  }

  private async fetchWithRetry<T>(host: Host, path: string, maxRetries: number): Promise<T | null> {
    const url = `https://${host}.api.riotgames.com${path}`;
    const limiter = this.limiter(host);
    for (let attempt = 0; ; attempt++) {
      let res: Response;
      try {
        res = await limiter.schedule(() =>
          this.fetchImpl(url, { headers: { "X-Riot-Token": this.opts.apiKey }, cache: "no-store" }),
        );
      } catch (err) {
        if (attempt >= maxRetries) throw err;
        await this.clock.sleep(500 * 2 ** attempt);
        continue;
      }

      if (res.ok) return (await res.json()) as T;
      if (res.status === 404) return null;

      if (res.status === 429) {
        // Pause immer setzen – auch ohne Retry, damit alle weiteren Requests sie respektieren
        const retryAfter = Number(res.headers.get("Retry-After") ?? "1");
        const ms = (Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 1) * 1000;
        limiter.pauseUntil(this.clock.now() + ms);
        if (attempt < maxRetries) continue;
      }
      if (res.status >= 500 && attempt < maxRetries) {
        await this.clock.sleep(500 * 2 ** attempt);
        continue;
      }
      const body = await res.text().catch(() => "");
      throw new RiotApiError(res.status, path, body.slice(0, 200));
    }
  }

  // ---- Endpoints ------------------------------------------------------------

  getAccountByRiotId(route: RegionalRoute, gameName: string, tagLine: string) {
    return this.get<AccountDto>(
      route,
      `/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`,
      TTL.account,
    );
  }

  getAccountByPuuid(route: RegionalRoute, puuid: string) {
    return this.get<AccountDto>(route, `/riot/account/v1/accounts/by-puuid/${puuid}`, TTL.account);
  }

  getSummonerByPuuid(platform: Platform, puuid: string) {
    return this.get<SummonerDto>(platform, `/lol/summoner/v4/summoners/by-puuid/${puuid}`, TTL.summoner);
  }

  getLeagueEntries(platform: Platform, puuid: string, ttlSeconds: number = TTL.league) {
    return this.get<LeagueEntryDto[]>(platform, `/lol/league/v4/entries/by-puuid/${puuid}`, ttlSeconds);
  }

  getMatchIds(
    route: RegionalRoute,
    puuid: string,
    opts: { start?: number; count?: number; queue?: number } = {},
  ) {
    const q = new URLSearchParams({ start: String(opts.start ?? 0), count: String(opts.count ?? 20) });
    if (opts.queue !== undefined) q.set("queue", String(opts.queue));
    return this.get<string[]>(route, `/lol/match/v5/matches/by-puuid/${puuid}/ids?${q}`, TTL.matchIds);
  }

  getMatch(route: RegionalRoute, matchId: string) {
    return this.get<MatchDto>(route, `/lol/match/v5/matches/${matchId}`, TTL.match);
  }

  getMatchTimeline(route: RegionalRoute, matchId: string) {
    return this.get<MatchTimelineDto>(route, `/lol/match/v5/matches/${matchId}/timeline`, TTL.match);
  }

  /** `null` = Spieler ist aktuell nicht in einem Spiel. */
  getActiveGame(platform: Platform, puuid: string) {
    return this.get<CurrentGameInfo>(
      platform,
      `/lol/spectator/v5/active-games/by-summoner/${puuid}`,
      TTL.activeGame,
      STALE.activeGame,
    );
  }

  getApexLeague(
    platform: Platform,
    tier: "challenger" | "grandmaster" | "master",
    queue = "RANKED_SOLO_5x5",
  ) {
    return this.get<LeagueListDto>(platform, `/lol/league/v4/${tier}leagues/by-queue/${queue}`, TTL.apexLeague);
  }
}

/** 429, 5xx und Netzwerkfehler – nicht aber 401/403 (Key ungültig) o.ä. */
function isTransient(err: unknown): boolean {
  if (err instanceof RiotApiError) return err.status === 429 || err.status >= 500;
  return true;
}
