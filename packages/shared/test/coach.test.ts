import { describe, expect, it } from "vitest";
import { coach, objectiveTimers } from "../src/build/coach";
import { normalizeAllGameData } from "../src/live/normalize";
import type { AllGameData } from "../src/live/lcd-types";
import type { LiveSnapshot } from "../src/live/snapshot";
import type { BuildData } from "../src/build/items";
import dd from "./fixtures/ddragon-16.23.1.json";
import sim15 from "./fixtures/sim-allgamedata-15min.json";
import sim3 from "./fixtures/sim-allgamedata-3min.json";

const data = dd as unknown as BuildData;
const snap = (): LiveSnapshot => structuredClone(normalizeAllGameData(sim15 as AllGameData));

describe("coach", () => {
  it("liefert Build und Tipps für den aktiven Spieler", () => {
    const r = coach(snap(), data);
    expect(r.build?.champion).toBe("Jinx");
    expect(r.build?.items.length).toBeGreaterThan(2);
    expect(r.tips.length).toBeGreaterThan(0);
    expect(r.tips.length).toBeLessThanOrEqual(6);
  });

  it("Einkaufstipp, wenn das Gold für das nächste Item reicht", () => {
    const s = snap();
    s.activePlayer!.currentGold = 5000;
    const r = coach(s, data);
    const tip = r.tips.find((t) => t.id === "shop-complete");
    expect(tip?.priority).toBe("high");
    expect(tip?.text).toContain(r.build!.nextItem!.name);
  });

  it("zwei tote Gegner → Objective nehmen", () => {
    const s = snap();
    for (const e of s.players.filter((p) => p.team === "CHAOS").slice(0, 2)) {
      e.isDead = true;
      e.respawnTimer = 20;
    }
    const r = coach(s, data);
    expect(r.tips[0]!.id).toBe("enemies-dead");
    expect(r.tips[0]!.text).toMatch(/2 Gegner tot/);
  });

  it("kündigt den ersten Drachen an", () => {
    const s = normalizeAllGameData(sim3 as AllGameData);
    s.gameTime = 4 * 60 + 30;
    const r = coach(s, data);
    expect(r.tips.some((t) => t.id.startsWith("obj-") && /Drache/.test(t.text) && /0:30/.test(t.text))).toBe(true);
  });

  it("Seelenpunkt wird erkannt", () => {
    const s = snap();
    s.teams.ORDER.dragons = ["Fire", "Water", "Air"];
    expect(coach(s, data).tips.some((t) => t.id === "soul-ORDER" && /Seelenpunkt/.test(t.text))).toBe(true);
  });

  it("keine Tipps nach Spielende, kein Absturz ohne aktiven Spieler", () => {
    const s = snap();
    s.status = "ended";
    expect(coach(s, data).tips).toEqual([]);
    const spectator = snap();
    delete spectator.activePlayer;
    expect(coach(spectator, data)).toMatchObject({ build: null, tips: [] });
  });

  it("objectiveTimers: Drache respawnt 5 min nach dem letzten Kill", () => {
    const s = snap();
    const lastDragon = Math.max(...s.events.filter((e) => e.type === "DragonKill").map((e) => e.time));
    const dragon = objectiveTimers(s).find((o) => o.name === "Drache");
    expect(dragon?.spawnAt).toBeCloseTo(lastDragon + 300, 0);
  });
});
