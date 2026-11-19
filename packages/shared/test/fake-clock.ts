import type { Clock } from "../src/riot/rate-limiter";

/** Deterministische Uhr: sleep() wartet, bis advance() die Zeit vorstellt. */
export class FakeClock implements Clock {
  t = 0;
  private sleepers: Array<{ until: number; resolve: () => void }> = [];

  now = () => this.t;

  sleep = (ms: number) =>
    new Promise<void>((resolve) => {
      this.sleepers.push({ until: this.t + ms, resolve });
    });

  /** Zeit vorstellen und fällige Sleeper (in Reihenfolge) wecken. */
  async advance(ms: number) {
    const target = this.t + ms;
    for (;;) {
      await flush();
      this.sleepers.sort((a, b) => a.until - b.until);
      const next = this.sleepers[0];
      if (!next || next.until > target) break;
      this.sleepers.shift();
      this.t = Math.max(this.t, next.until);
      next.resolve();
    }
    this.t = target;
    await flush();
  }
}

export async function flush() {
  for (let i = 0; i < 20; i++) await Promise.resolve();
}
