import { describe, expect, it } from "vitest";
import { RateLimiter } from "../src/riot/rate-limiter";
import { FakeClock, flush } from "./fake-clock";

describe("RateLimiter", () => {
  it("lässt bis zum Limit sofort durch und hält den Rest zurück", async () => {
    const clock = new FakeClock();
    const rl = new RateLimiter([{ limit: 3, windowMs: 1000 }], clock);
    const done: number[] = [];
    for (let i = 0; i < 5; i++) void rl.schedule(async () => done.push(clock.now()));
    await flush();
    expect(done).toEqual([0, 0, 0]);
    await clock.advance(1001);
    expect(done.length).toBe(5);
    expect(done[3]).toBeGreaterThanOrEqual(1000);
  });

  it("respektiert mehrere Fenster gleichzeitig (20/s und 100/2min)", async () => {
    const clock = new FakeClock();
    const rl = new RateLimiter(
      [{ limit: 20, windowMs: 1000 }, { limit: 100, windowMs: 120_000 }],
      clock,
    );
    let count = 0;
    for (let i = 0; i < 120; i++) void rl.schedule(async () => count++);
    await flush();
    expect(count).toBe(20);
    await clock.advance(5_000);
    expect(count).toBe(100); // langes Fenster voll
    await clock.advance(60_000);
    expect(count).toBe(100);
    await clock.advance(60_000);
    expect(count).toBe(120);
  });

  it("pausiert bei pauseUntil (Retry-After)", async () => {
    const clock = new FakeClock();
    const rl = new RateLimiter([{ limit: 10, windowMs: 1000 }], clock);
    rl.pauseUntil(5000);
    let ran = false;
    void rl.schedule(async () => (ran = true));
    await clock.advance(4000);
    expect(ran).toBe(false);
    await clock.advance(1100);
    expect(ran).toBe(true);
  });
});
