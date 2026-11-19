import "server-only";
import { EventEmitter } from "node:events";
import { createClient, type RedisClientType } from "redis";
import type { LiveState } from "@alfons/shared";

/**
 * Hält Live-Spielstände und Pairing-Codes.
 * - Lokal ohne REDIS_URL: In-Memory (eine Node-Instanz, z.B. `pnpm dev`)
 * - Mit REDIS_URL (Vercel): Redis, Updates per Pub/Sub – funktioniert über mehrere Instanzen.
 */
export interface LiveStore {
  put(state: LiveState): Promise<void>;
  get(puuid: string): Promise<LiveState | null>;
  subscribe(puuid: string, onUpdate: (state: LiveState) => void): Promise<() => void>;
  createPairing(code: string, data: PairingData, ttlSec: number): Promise<void>;
  consumePairing(code: string): Promise<PairingData | null>;
}

export interface PairingData {
  puuid: string;
  riotId: string;
  region: string;
}

/** Laufende Spiele ohne Update verschwinden nach 5 min, beendete nach 10 min. */
const IN_GAME_TTL_SEC = 5 * 60;
const ENDED_TTL_SEC = 10 * 60;
const ttlFor = (s: LiveState) => (s.snapshot.status === "ended" ? ENDED_TTL_SEC : IN_GAME_TTL_SEC);

class MemoryLiveStore implements LiveStore {
  private states = new Map<string, LiveState>();
  private pairings = new Map<string, { data: PairingData; expiresAt: number }>();
  private emitter = new EventEmitter().setMaxListeners(500);

  async put(state: LiveState) {
    this.states.set(state.puuid, state);
    this.emitter.emit(state.puuid, state);
  }

  async get(puuid: string) {
    const s = this.states.get(puuid);
    if (!s) return null;
    if (Date.now() - s.receivedAt > ttlFor(s) * 1000) {
      this.states.delete(puuid);
      return null;
    }
    return s;
  }

  async subscribe(puuid: string, onUpdate: (state: LiveState) => void) {
    this.emitter.on(puuid, onUpdate);
    return () => void this.emitter.off(puuid, onUpdate);
  }

  async createPairing(code: string, data: PairingData, ttlSec: number) {
    const now = Date.now();
    for (const [k, v] of this.pairings) if (v.expiresAt < now) this.pairings.delete(k);
    this.pairings.set(code, { data, expiresAt: now + ttlSec * 1000 });
  }

  async consumePairing(code: string) {
    const p = this.pairings.get(code);
    this.pairings.delete(code);
    if (!p || p.expiresAt < Date.now()) return null;
    return p.data;
  }
}

type Redis = RedisClientType;
const PREFIX = "alfons:";

class RedisLiveStore implements LiveStore {
  private client: Promise<Redis>;
  private subscriber: Promise<Redis> | null = null;
  /** Ein Subscriber-Socket pro Instanz, beliebig viele lokale Listener je Kanal */
  private listeners = new Map<string, Set<(s: LiveState) => void>>();

  constructor(private readonly url: string) {
    this.client = this.connect();
  }

  private async connect(): Promise<Redis> {
    const c: Redis = createClient({ url: this.url, socket: { reconnectStrategy: (n) => Math.min(n * 200, 3000) } });
    c.on("error", (err) => console.error("[redis]", err.message));
    await c.connect();
    return c;
  }

  async put(state: LiveState) {
    const c = await this.client;
    const json = JSON.stringify(state);
    await c.set(`${PREFIX}live:${state.puuid}`, json, { expiration: { type: "EX", value: ttlFor(state) } });
    await c.publish(`${PREFIX}live:${state.puuid}`, json);
  }

  async get(puuid: string) {
    const raw = await (await this.client).get(`${PREFIX}live:${puuid}`);
    return raw ? (JSON.parse(raw) as LiveState) : null;
  }

  async subscribe(puuid: string, onUpdate: (state: LiveState) => void) {
    const channel = `${PREFIX}live:${puuid}`;
    this.subscriber ??= (await this.client).duplicate().connect();
    const sub = await this.subscriber;
    let set = this.listeners.get(channel);
    if (!set) {
      set = new Set();
      this.listeners.set(channel, set);
      await sub.subscribe(channel, (message) => {
        const state = JSON.parse(message) as LiveState;
        for (const l of this.listeners.get(channel) ?? []) l(state);
      });
    }
    set.add(onUpdate);
    return () => {
      const s = this.listeners.get(channel);
      if (!s) return;
      s.delete(onUpdate);
      if (s.size === 0) {
        this.listeners.delete(channel);
        void sub.unsubscribe(channel).catch(() => {});
      }
    };
  }

  async createPairing(code: string, data: PairingData, ttlSec: number) {
    await (await this.client).set(`${PREFIX}pair:${code}`, JSON.stringify(data), {
      expiration: { type: "EX", value: ttlSec },
    });
  }

  async consumePairing(code: string) {
    const raw = await (await this.client).getDel(`${PREFIX}pair:${code}`);
    return raw ? (JSON.parse(raw) as PairingData) : null;
  }
}

const g = globalThis as unknown as { __liveStore?: LiveStore };
export function liveStore(): LiveStore {
  if (!g.__liveStore) {
    const url = process.env.REDIS_URL;
    g.__liveStore = url ? new RedisLiveStore(url) : new MemoryLiveStore();
  }
  return g.__liveStore;
}
