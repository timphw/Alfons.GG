import { describe, expect, it } from "vitest";
import { normalizeAllGameData, championKey, spellKey } from "../src/live/normalize";
import { LiveSnapshot } from "../src/live/snapshot";
import { GameSimulator } from "../src/live/simulator";
import type { AllGameData } from "../src/live/lcd-types";
import sim15 from "./fixtures/sim-allgamedata-15min.json";
import simEnded from "./fixtures/sim-allgamedata-ended.json";
import edge from "./fixtures/edge-spectator.json";

describe("normalizeAllGameData", () => {
  const snap = normalizeAllGameData(sim15 as AllGameData);

  it("erzeugt ein schema-valides Snapshot", () => {
    expect(LiveSnapshot.safeParse(snap).success).toBe(true);
    expect(JSON.stringify(snap).length).toBeLessThan(16_000);
  });

  it("übernimmt Spieler, Champions, Items und Scores", () => {
    expect(snap.players).toHaveLength(10);
    const jinx = snap.players.find((p) => p.champion === "Jinx")!;
    expect(jinx.riotId).toBe("Alfons#EUW");
    expect(jinx.team).toBe("ORDER");
    expect(jinx.spells).toEqual(["SummonerFlash", "SummonerHeal"]);
    expect(jinx.keystone).toBe(8008);
    expect(jinx.items.map((i) => i.id)).toContain(6672);
    expect(jinx.itemGold).toBe(450 + 1100 + 3100);
  });

  it("liefert Gold/Stats des aktiven Spielers", () => {
    expect(snap.activePlayer?.riotId).toBe("Alfons#EUW");
    expect(snap.activePlayer?.currentGold).toBeGreaterThan(0);
    expect(snap.activePlayer?.stats.attackDamage).toBeGreaterThan(50);
  });

  it("zählt Team-Kills und Objectives", () => {
    const sumKills = (team: "ORDER" | "CHAOS") =>
      snap.players.filter((p) => p.team === team).reduce((s, p) => s + p.kills, 0);
    expect(snap.teams.ORDER.kills).toBe(sumKills("ORDER"));
    expect(snap.teams.CHAOS.kills).toBe(sumKills("CHAOS"));
    const dragons = snap.teams.ORDER.dragons.length + snap.teams.CHAOS.dragons.length;
    expect(dragons).toBe(3);
    expect(snap.teams.ORDER.grubs + snap.teams.CHAOS.grubs).toBe(3);
    expect(snap.teams.ORDER.towers + snap.teams.CHAOS.towers).toBe(2);
    expect(snap.events.length).toBeLessThanOrEqual(20);
    expect(snap.status).toBe("in-game");
  });

  it("erkennt das Spielende", () => {
    const ended = normalizeAllGameData(simEnded as AllGameData);
    expect(ended.status).toBe("ended");
    expect(["Win", "Lose"]).toContain(ended.result);
  });

  it("verkraftet Spectator-Modus, fehlende Felder und NEUTRAL-Einträge", () => {
    const s = normalizeAllGameData(edge as AllGameData);
    expect(LiveSnapshot.safeParse(s).success).toBe(true);
    expect(s.activePlayer).toBeUndefined();
    expect(s.players).toHaveLength(2);
    expect(s.players[0]!.champion).toBe("MonkeyKing");
    expect(s.players[0]!.spells).toEqual(["SummonerFlash", "Ghost"]);
    expect(s.players[0]!.isDead).toBe(true);
    expect(s.players[1]!.champion).toBe("KaiSa");
    expect(s.gameTime).toBe(912.3);
    // Turret_T2 gehört CHAOS → Punkt für ORDER, Barracks_T1 gehört ORDER → Punkt für CHAOS
    expect(s.teams.ORDER.towers).toBe(1);
    expect(s.teams.CHAOS.inhibitors).toBe(1);
    expect(s.teams.CHAOS.dragons).toEqual(["Elder"]);
  });
});

describe("helpers", () => {
  it("championKey", () => {
    expect(championKey({ championName: "Wukong", rawChampionName: "game_character_displayname_MonkeyKing" })).toBe(
      "MonkeyKing",
    );
    expect(championKey({ championName: "Kai'Sa" })).toBe("KaiSa");
  });
  it("spellKey", () => {
    expect(spellKey({ displayName: "Blitz", rawDisplayName: "GeneratedTip_SummonerSpell_SummonerFlash_DisplayName" })).toBe(
      "SummonerFlash",
    );
    expect(spellKey(undefined)).toBe("");
  });
});

describe("GameSimulator", () => {
  it("ist deterministisch bei gleichem Seed", () => {
    const a = new GameSimulator({ seed: 1 }).fastForward(600);
    const b = new GameSimulator({ seed: 1 }).fastForward(600);
    expect(a).toEqual(b);
  });
  it("Zeit und Werte steigen monoton", () => {
    const sim = new GameSimulator();
    const f1 = normalizeAllGameData(sim.advance(300));
    const f2 = normalizeAllGameData(sim.advance(300));
    expect(f2.gameTime).toBeGreaterThan(f1.gameTime);
    expect(f2.players[0]!.cs).toBeGreaterThanOrEqual(f1.players[0]!.cs);
  });
});
