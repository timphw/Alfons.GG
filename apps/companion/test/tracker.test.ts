import { describe, expect, it } from "vitest";
import { GameSimulator } from "@alfons/shared";
import { GameTracker } from "../src/tracker";

describe("GameTracker", () => {
  it("erkennt Start, Snapshots, Ende und Rückkehr in den Wartezustand", () => {
    const sim = new GameSimulator({ durationSec: 120 });
    const t = new GameTracker();
    expect(t.update({ kind: "offline" }).type).toBe("idle");
    expect(t.update({ kind: "loading" }).type).toBe("idle");
    expect(t.update({ kind: "ok", data: sim.advance(5) }).type).toBe("game-start");
    expect(t.update({ kind: "ok", data: sim.advance(5) }).type).toBe("snapshot");
    const end = t.update({ kind: "ok", data: sim.fastForward(200) });
    expect(end.type).toBe("game-end");
    // Endscreen: kein weiteres Senden
    expect(t.update({ kind: "ok", data: sim.advance(1) }).type).toBe("idle");
    expect(t.update({ kind: "offline" }).type).toBe("idle");
    expect(t.current).toBe("waiting");
  });

  it("meldet game-lost nach mehreren Fehlversuchen ohne GameEnd", () => {
    const sim = new GameSimulator();
    const t = new GameTracker(3);
    t.update({ kind: "ok", data: sim.advance(10) });
    expect(t.update({ kind: "offline" }).type).toBe("idle");
    expect(t.update({ kind: "loading" }).type).toBe("idle");
    expect(t.update({ kind: "offline" }).type).toBe("game-lost");
    expect(t.current).toBe("waiting");
  });

  it("kurze Aussetzer beenden das Spiel nicht", () => {
    const sim = new GameSimulator();
    const t = new GameTracker(3);
    t.update({ kind: "ok", data: sim.advance(10) });
    t.update({ kind: "offline" });
    expect(t.update({ kind: "ok", data: sim.advance(1) }).type).toBe("snapshot");
  });
});
