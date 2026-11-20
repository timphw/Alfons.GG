import { describe, expect, it } from "vitest";
import { analyzeLane } from "../src/build/lane";
import { initJungleState, updateJungle, analyzeJungle, lastSeen } from "../src/build/jungle";
import { coach } from "../src/build/coach";
import { recommendBuild } from "../src/build/engine";
import { aggregateBuilds, findBuildStats, type CrawledBuild } from "../src/build/stats";
import { normalizeAllGameData } from "../src/live/normalize";
import type { AllGameData } from "../src/live/lcd-types";
import type { LiveSnapshot, LivePlayer } from "../src/live/snapshot";
import type { BuildData } from "../src/build/items";
import dd from "./fixtures/ddragon-16.23.1.json";
import sim15 from "./fixtures/sim-allgamedata-15min.json";
import sim3 from "./fixtures/sim-allgamedata-3min.json";

const data = dd as unknown as BuildData;
const snap = (fixture: unknown = sim15): LiveSnapshot => structuredClone(normalizeAllGameData(fixture as AllGameData));
const find = (s: LiveSnapshot, champ: string) => s.players.find((p) => p.champion === champ)!;
/** Aktiven Spieler auf einen anderen Champion umsetzen */
const playAs = (s: LiveSnapshot, champ: string) => {
  s.activePlayer!.riotId = find(s, champ).riotId;
  return s;
};

describe("Lane-Duell", () => {
  it("Toplane: Gegner hat Entzünden und Ult, du nicht → Nachteil mit Begründung", () => {
    const s = playAs(snap(), "Darius");
    const me = find(s, "Darius");
    const enemy = find(s, "Malphite");
    me.spells = ["SummonerFlash", "SummonerTeleport"];
    enemy.spells = ["SummonerFlash", "SummonerDot"];
    me.level = 5;
    enemy.level = 6;
    for (const p of [me, enemy]) Object.assign(p, { kills: 0, deaths: 0, cs: 100, itemGold: 2000 });
    const lane = analyzeLane(s, data)!;
    expect(lane.role).toBe("Toplane");
    expect(lane.verdict).toBe("behind");
    expect(lane.reasons.join(" ")).toMatch(/Ult/);
    expect(lane.reasons.join(" ")).toMatch(/Entzünden/);
    expect(lane.advice).toMatch(/Level 6/);
  });

  it("Gegner tot → Welle pushen / Platten", () => {
    const s = playAs(snap(), "Darius");
    const enemy = find(s, "Malphite");
    enemy.isDead = true;
    enemy.respawnTimer = 14;
    expect(analyzeLane(s, data)!.advice).toMatch(/tot.*Turm schlagen/); // nach 14:00 keine Platten mehr
    s.gameTime = 10 * 60;
    expect(analyzeLane(s, data)!.advice).toMatch(/platten/i);
  });

  it("Botlane wird 2 gegen 2 verglichen", () => {
    const lane = analyzeLane(snap(), data)!; // aktiv: Jinx
    expect(lane.me.map((p) => p.champion).sort()).toEqual(["Jinx", "Thresh"]);
    expect(lane.enemy.map((p) => p.champion).sort()).toEqual(["Samira", "Soraka"]);
  });

  it("Fernkampf vs. Nahkampf auf der Midlane", () => {
    const s = playAs(snap(), "Zed"); // Zed (Nahkampf) gegen Ahri (Fernkampf)
    expect(analyzeLane(s, data)!.reasons.join(" ")).toMatch(/Fernkämpfer/);
  });
});

describe("Jungle", () => {
  const jgSnap = (time: number, cs: number) => {
    const s = playAs(snap(sim3), "LeeSin");
    s.gameTime = time;
    find(s, "LeeSin").cs = cs;
    return s;
  };

  it("erkennt geräumte Camps aus CS-Schüben und schätzt den Respawn", () => {
    let st = initJungleState();
    for (const [t, cs] of [[90, 0], [100, 2], [102, 4], [104, 4], [120, 4], [130, 7], [132, 8], [150, 8]] as const) {
      st = updateJungle(st, jgSnap(t, cs));
    }
    expect(st.clears.map((c) => c.at)).toEqual([102, 132]);
    expect(st.clears[0]!.respawnAt).toBe(102 + 135);
  });

  it("findet den Gegner-Jungler im Kill-Feed", () => {
    const s = playAs(snap(), "LeeSin");
    const ww = find(s, "Warwick");
    const victim = find(s, "Jinx");
    s.events.push({ id: 999, time: s.gameTime - 20, type: "ChampionKill", killer: ww.gameName, victim: victim.gameName, assisters: [] });
    const seen = lastSeen(s, ww)!;
    expect(seen.where).toBe("Bot");
    const info = analyzeJungle(s, initJungleState(), data)!;
    expect(info.advice).toMatch(/vor 20 s unten/);
  });

  it("schlägt ein Gank-Ziel vor", () => {
    const s = playAs(snap(), "LeeSin");
    const info = analyzeJungle(s, initJungleState(), data)!;
    expect(["Top", "Mid", "Bot"]).toContain(info.gankTarget?.lane);
  });
});

describe("Start-Items", () => {
  it("warnt, wenn nichts gekauft wurde", () => {
    const s = snap(sim3);
    s.gameTime = 40;
    const me = find(s, "Jinx");
    me.items = me.items.filter((i) => i.id === 3340);
    s.activePlayer!.currentGold = 500;
    const r = coach(s, data);
    expect(r.now?.id).toBe("start-items");
    expect(r.now?.text).toMatch(/Dorans Klinge|Klinge/);
  });

  it("keine Warnung, wenn schon gekauft", () => {
    const s = snap(sim3);
    s.gameTime = 40;
    expect(coach(s, data).tips.some((t) => t.id === "start-items")).toBe(false);
  });
});

describe("Statistik-Basis", () => {
  const crawled: CrawledBuild[] = Array.from({ length: 20 }, (_, i) => ({
    champion: "Jinx",
    role: "BOTTOM",
    win: i % 2 === 0,
    order: i < 15 ? [3032, 3006, 3031, 3094] : [6672, 3006, 3031, 3036],
    start: [1055, 2003, 3340],
    spells: [4, 7],
  }));
  const stats = aggregateBuilds(crawled, { patch: "16.23", matches: 20 });

  it("aggregiert Core-Reihenfolge, Stiefel und Start-Items", () => {
    const b = findBuildStats(stats, "Jinx", "BOTTOM")!;
    expect(b.games).toBe(20);
    expect(b.core.slice(0, 2)).toEqual(["3032", "3031"]);
    expect(b.boots).toBe("3006");
    expect(b.start).toEqual(["1055", "2003", "3340"]);
    expect(findBuildStats(stats, "Jinx", "MIDDLE")).toBe(b); // Fallback auf Hauptrolle
  });

  it("Engine folgt dem High-Elo-Build statt den Regeln – auch gegen Heiler beim ersten Item", () => {
    const r = recommendBuild(
      {
        me: { champion: "Jinx", items: [], kills: 0, deaths: 0, assists: 0, level: 6, position: "BOTTOM" },
        gold: 0,
        gameTime: 8 * 60,
        enemies: ["Soraka", "Warwick", "Samira"].map((c) => ({ champion: c, items: [], kills: 0, deaths: 0, assists: 0, level: 6 })),
        teamGoldDiff: 0,
        stats: findBuildStats(stats, "Jinx", "BOTTOM"),
      },
      data,
    )!;
    expect(r.items[0]!.id).toBe("3032");
    expect(r.items[0]!.reasons[0]).toMatch(/High-Elo-Build #1/);
    expect(r.items.find((i) => i.id === "3006")).toBeDefined();
  });
});
