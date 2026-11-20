import { readFileSync } from "node:fs";
import { GameSimulator, type AllGameData } from "@alfons/shared";
import { fetchAllGameData, type FetchResult } from "./lcd-client";

/** Liefert bei jedem Poll den aktuellen Zustand. */
export interface DataSource {
  readonly label: string;
  poll(): Promise<FetchResult>;
}

export class LiveSource implements DataSource {
  readonly label = "Live Client Data API (127.0.0.1:2999)";
  poll() {
    return fetchAllGameData();
  }
}

/** Simuliertes Spiel – `speed` Spielsekunden pro Echtzeitsekunde. */
export class SimulatorSource implements DataSource {
  readonly label: string;
  private sim: GameSimulator;
  private last = Date.now();
  private endedPolls = 0;

  constructor(
    private readonly speed = 1,
    opts: { seed?: number; startAt?: number; durationSec?: number; activeIndex?: number } = {},
  ) {
    this.sim = new GameSimulator({ seed: opts.seed, durationSec: opts.durationSec, activeIndex: opts.activeIndex });
    if (opts.startAt) this.sim.fastForward(opts.startAt);
    this.label = `Simulator (x${speed})`;
  }

  async poll(): Promise<FetchResult> {
    const now = Date.now();
    const dt = ((now - this.last) / 1000) * this.speed;
    this.last = now;
    const data = this.sim.advance(dt);
    const ended = data.events.Events.some((e) => e.EventName === "GameEnd");
    // Nach dem Spielende ein paar Polls "Endscreen", dann Client geschlossen
    if (ended && ++this.endedPolls > 5) return { kind: "offline" };
    return { kind: "ok", data };
  }
}

/** Spielt eine Aufnahme (`companion record`) ab: JSONL mit { t, data } je Zeile. */
export class ReplaySource implements DataSource {
  readonly label: string;
  private frames: Array<{ t: number; data: AllGameData }>;
  private start = Date.now();

  constructor(
    file: string,
    private readonly speed = 1,
  ) {
    const text = readFileSync(file, "utf8").trim();
    let whole: AllGameData | AllGameData[] | undefined;
    try {
      whole = JSON.parse(text); // einzelnes allgamedata-JSON (z.B. aus dem Browser gespeichert) oder Array
    } catch {
      // sonst JSONL-Aufnahme
    }
    this.frames = whole ? toFrames(whole) : text.split("\n").filter(Boolean).map((l) => JSON.parse(l));
    if (this.frames.length === 0) throw new Error(`Keine Frames in ${file}`);
    this.label = `Replay ${file} (${this.frames.length} Frames, x${speed})`;
  }

  async poll(): Promise<FetchResult> {
    const elapsed = (Date.now() - this.start) * this.speed;
    const t0 = this.frames[0]!.t;
    let frame = this.frames[0]!;
    for (const f of this.frames) {
      if (f.t - t0 <= elapsed) frame = f;
      else break;
    }
    const isLast = frame === this.frames[this.frames.length - 1];
    if (isLast && elapsed - (frame.t - t0) > 10_000) return { kind: "offline" };
    return { kind: "ok", data: frame.data };
  }
}

/** Einzelnes allgamedata-JSON oder Array davon → Frames im 1-s-Abstand. */
function toFrames(json: AllGameData | AllGameData[]): Array<{ t: number; data: AllGameData }> {
  const list = Array.isArray(json) ? json : [json];
  return list.map((data, i) => ({ t: i * 1000, data }));
}
