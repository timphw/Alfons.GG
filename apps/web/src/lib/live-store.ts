import "server-only";
import { EventEmitter } from "node:events";
import type { LiveState } from "@alfons/shared";

/**
 * Hält Live-Spielstände und Pairing-Codes.
 *
 * Aktuell In-Memory (eine Node-Instanz, z.B. `pnpm dev`). Für Vercel mit mehreren Instanzen
 * wird hier ein Redis-Backend (Upstash, REDIS_URL) eingesetzt – das Interface bleibt gleich.
 */
export interface LiveStore {
  put(state: LiveState): Promise<void>;
  get(puuid: string): Promise<LiveState | null>;
  subscribe(puuid: string, onUpdate: (state: LiveState) => void): () => void;
  createPairing(code: string, data: PairingData, ttlSec: number): Promise<void>;
  consumePairing(code: string): Promise<PairingData | null>;
}

export interface PairingData {
  puuid: string;
  riotId: string;
  region: string;
}

/** Ohne Update gilt ein Spiel nach dieser Zeit als beendet/abgebrochen. */
export const LIVE_STALE_MS = 60_000;
/** Beendete Spiele bleiben so lange sichtbar. */
const ENDED_KEEP_MS = 10 * 60_000;

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
    const keep = s.snapshot.status === "ended" ? ENDED_KEEP_MS : LIVE_STALE_MS * 5;
    if (Date.now() - s.receivedAt > keep) {
      this.states.delete(puuid);
      return null;
    }
    return s;
  }

  subscribe(puuid: string, onUpdate: (state: LiveState) => void) {
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

const g = globalThis as unknown as { __liveStore?: LiveStore };
export function liveStore(): LiveStore {
  // TODO (Redis-Schritt): if (process.env.REDIS_URL) return redisLiveStore()
  g.__liveStore ??= new MemoryLiveStore();
  return g.__liveStore;
}
