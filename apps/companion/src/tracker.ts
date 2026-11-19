import { normalizeAllGameData, type LiveSnapshot } from "@alfons/shared";
import type { FetchResult } from "./lcd-client";

export type TrackerEvent =
  | { type: "game-start"; snapshot: LiveSnapshot }
  | { type: "snapshot"; snapshot: LiveSnapshot }
  | { type: "game-end"; snapshot: LiveSnapshot }
  | { type: "game-lost" } // Spiel ohne GameEnd-Event verschwunden (Crash, Alt+F4, Remake)
  | { type: "idle" };

type State = "waiting" | "in-game" | "ended";

/**
 * Zustandsautomat für Spielstart/-ende. Rein und ohne I/O → unit-testbar.
 * waiting --ok--> in-game --GameEnd--> ended --offline--> waiting
 *                 in-game --N× offline--> waiting (game-lost)
 */
export class GameTracker {
  private state: State = "waiting";
  private misses = 0;
  private lastGameTime = -1;

  constructor(private readonly lostAfterMisses = 8) {}

  get current(): State {
    return this.state;
  }

  update(result: FetchResult): TrackerEvent {
    if (result.kind !== "ok") {
      if (this.state === "in-game" && ++this.misses >= this.lostAfterMisses) {
        this.reset();
        return { type: "game-lost" };
      }
      if (this.state === "ended" && result.kind === "offline") this.reset();
      return { type: "idle" };
    }

    this.misses = 0;
    const snapshot = normalizeAllGameData(result.data);

    // Neues Spiel erkannt, obwohl wir noch "ended" sind (Spielzeit springt zurück)
    if (this.state === "ended" && snapshot.status === "in-game" && snapshot.gameTime < this.lastGameTime) {
      this.reset();
    }
    if (this.state === "ended") return { type: "idle" };

    this.lastGameTime = snapshot.gameTime;
    if (snapshot.status === "ended") {
      this.state = "ended";
      return { type: "game-end", snapshot };
    }
    if (this.state === "waiting") {
      this.state = "in-game";
      return { type: "game-start", snapshot };
    }
    return { type: "snapshot", snapshot };
  }

  private reset() {
    this.state = "waiting";
    this.misses = 0;
    this.lastGameTime = -1;
  }
}
