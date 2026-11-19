export interface RateWindow {
  /** max. Requests ... */
  limit: number;
  /** ... pro Zeitfenster in ms */
  windowMs: number;
}

export interface Clock {
  now(): number;
  sleep(ms: number): Promise<void>;
}

export const realClock: Clock = {
  now: () => Date.now(),
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
};

/** Riot Development-Key: 20 req / 1 s und 100 req / 2 min. */
export const DEV_KEY_LIMITS: RateWindow[] = [
  { limit: 20, windowMs: 1_000 },
  { limit: 100, windowMs: 120_000 },
];

/**
 * Sliding-Log-Rate-Limiter mit FIFO-Queue für mehrere Fenster gleichzeitig.
 * Unterstützt zusätzlich eine Pause (z.B. aus einem Retry-After-Header).
 */
export class RateLimiter {
  private log: number[] = [];
  private queue: Array<() => void> = [];
  private pausedUntil = 0;
  private pumping = false;
  private readonly maxWindow: number;

  constructor(
    private readonly windows: RateWindow[] = DEV_KEY_LIMITS,
    private readonly clock: Clock = realClock,
  ) {
    this.maxWindow = Math.max(...windows.map((w) => w.windowMs));
  }

  /** Wartet auf einen freien Slot und führt dann `fn` aus. */
  async schedule<T>(fn: () => Promise<T>): Promise<T> {
    await new Promise<void>((resolve) => {
      this.queue.push(resolve);
      void this.pump();
    });
    return fn();
  }

  /** Alle Requests bis `until` (epoch ms) anhalten. */
  pauseUntil(until: number): void {
    this.pausedUntil = Math.max(this.pausedUntil, until);
  }

  get pending(): number {
    return this.queue.length;
  }

  /** ms bis zum nächsten freien Slot (0 = sofort). */
  waitTime(): number {
    const now = this.clock.now();
    this.log = this.log.filter((t) => t > now - this.maxWindow);
    let wait = Math.max(0, this.pausedUntil - now);
    for (const w of this.windows) {
      const inWindow = this.log.filter((t) => t > now - w.windowMs);
      if (inWindow.length >= w.limit) {
        const blocking = inWindow[inWindow.length - w.limit]!;
        wait = Math.max(wait, blocking + w.windowMs - now);
      }
    }
    return wait;
  }

  private async pump(): Promise<void> {
    if (this.pumping) return;
    this.pumping = true;
    try {
      while (this.queue.length > 0) {
        const wait = this.waitTime();
        if (wait > 0) {
          await this.clock.sleep(wait + 1);
          continue;
        }
        this.log.push(this.clock.now());
        this.queue.shift()!();
      }
    } finally {
      this.pumping = false;
    }
  }
}
