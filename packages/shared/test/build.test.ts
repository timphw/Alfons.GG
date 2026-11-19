import { describe, expect, it } from "vitest";
import { recommendBuild, classifyChampion, analyzeEnemies, type BuildInput, type BuildPlayer } from "../src/build/engine";
import { planPurchase, isLegendary, findChampionById, type BuildData } from "../src/build/items";
import dd from "./fixtures/ddragon-16.23.1.json";

const data = dd as unknown as BuildData;
const p = (champion: string, extra: Partial<BuildPlayer> = {}): BuildPlayer => ({
  champion, items: [], kills: 0, deaths: 0, assists: 0, level: 9, ...extra,
});
const input = (me: BuildPlayer, enemies: BuildPlayer[], extra: Partial<BuildInput> = {}): BuildInput => ({
  me, gold: 0, gameTime: 15 * 60, enemies, teamGoldDiff: 0, ...extra,
});
const ids = (r: ReturnType<typeof recommendBuild>) => r!.items.map((i) => i.id);
const champ = (id: string) => findChampionById(data.champions, id)!;

describe("classifyChampion", () => {
  it.each([
    ["Jinx", "BOTTOM", "marksman", "AD"],
    ["Ahri", "MIDDLE", "mage", "AP"],
    ["Zed", "MIDDLE", "assassin", "AD"],
    ["Darius", "TOP", "fighter", "AD"],
    ["Malphite", "TOP", "tank", undefined],
    ["Soraka", "UTILITY", "enchanter", "AP"],
    ["Thresh", "UTILITY", "support-tank", undefined],
  ])("%s → %s", (id, pos, style, damage) => {
    const c = classifyChampion(champ(id), pos);
    expect(c.style).toBe(style);
    if (damage) expect(c.damage).toBe(damage);
  });
});

describe("planPurchase", () => {
  const ie = "3031";
  const total = data.items[ie]!.gold.total;

  it("kauft das volle Item, wenn das Gold reicht", () => {
    const plan = planPurchase(ie, [], total, data.items);
    expect(plan.completes).toBe(true);
    expect(plan.buyNow.map((b) => b.id)).toEqual([ie]);
    expect(plan.goldMissing).toBe(0);
  });

  it("schlägt bezahlbare Komponenten vor und rechnet das fehlende Gold aus", () => {
    const plan = planPurchase(ie, [], 1400, data.items);
    expect(plan.completes).toBe(false);
    expect(plan.buyNow.length).toBeGreaterThan(0);
    expect(plan.buyNowCost).toBeLessThanOrEqual(1400);
    expect(plan.goldMissing).toBe(total - 1400);
  });

  it("verrechnet bereits gekaufte Komponenten", () => {
    const comp = data.items[ie]!.from![0]!;
    const plan = planPurchase(ie, [Number(comp)], 0, data.items);
    expect(plan.remainingCost).toBe(total - data.items[comp]!.gold.total);
  });

  it("schlägt nichts vor, wenn kein Gold da ist", () => {
    const plan = planPurchase(ie, [], 100, data.items);
    expect(plan.buyNow).toEqual([]);
  });
});

describe("recommendBuild", () => {
  it("Jinx gegen viele Heiler → Klaffende Wunden mit Begründung", () => {
    const r = recommendBuild(
      input(p("Jinx", { items: [6672, 3006] }), [p("Soraka"), p("Warwick"), p("Samira"), p("Malphite"), p("Zed")]),
      data,
    )!;
    const antiheal = r.items.find((i) => i.id === "3033");
    expect(antiheal).toBeDefined();
    expect(antiheal!.reasons.join(" ")).toMatch(/3 Heiler|4 Heiler/);
    expect(r.enemy.healers).toEqual(expect.arrayContaining(["Soraka", "Warwick", "Samira"]));
  });

  it("Schütze bekommt keine reinen AP-Items", () => {
    const r = recommendBuild(input(p("Jinx", { items: [6672] }), [p("Darius")]), data)!;
    for (const id of ids(r)) {
      const tags = data.items[id]!.tags;
      expect(tags.includes("SpellDamage") && !tags.includes("Damage")).toBe(false);
    }
  });

  it("Ahri gegen gefütterten Zed → Zhonyas", () => {
    const r = recommendBuild(
      input(p("Ahri", { items: [6655, 3020] }), [p("Zed", { kills: 6, deaths: 1, level: 12 }), p("Darius"), p("Jinx"), p("LeeSin"), p("Thresh")]),
      data,
    )!;
    const zhonya = r.items.find((i) => i.id === "3157");
    expect(zhonya).toBeDefined();
    expect(zhonya!.reasons.join(" ")).toMatch(/Zed/);
  });

  it("AD gegen mehrere Tanks → Penetration/%-Schaden", () => {
    const r = recommendBuild(
      input(p("Jinx", { items: [6672, 3006, 3031] }), [p("Malphite", { items: [3068, 3075] }), p("Ornn", { items: [3068] }), p("Sion"), p("Zed"), p("Soraka")]),
      data,
    )!;
    const shred = r.items.find((i) => /Tanks/.test(i.reasons.join(" ")));
    expect(shred).toBeDefined();
    expect(["3036", "3153", "3302", "6672", "3071"]).toContain(shred!.id);
  });

  it("plant Stiefel nach dem ersten Item ein – Merkurs gegen viel AP", () => {
    const r = recommendBuild(
      input(p("Darius", { items: [6631] }), [p("Ahri"), p("Syndra"), p("Lux"), p("Brand"), p("Malzahar")]),
      data,
    )!;
    expect(r.items[0]!.id).toBe("3111");
    expect(r.enemy.apShare).toBeGreaterThan(0.6);
  });

  it("empfiehlt nichts Doppeltes oder aus derselben exklusiven Gruppe", () => {
    const r = recommendBuild(
      input(p("Jinx", { items: [3033, 3006] }), [p("Soraka"), p("Warwick"), p("Samira")]),
      data,
    )!;
    expect(ids(r)).not.toContain("3033");
    expect(ids(r)).not.toContain("3036");
    expect(ids(r)).not.toContain("6609");
    expect(new Set(ids(r)).size).toBe(ids(r).length);
    expect(ids(r).every((id) => isLegendary(id, data.items[id]!) || data.items[id]!.tags.includes("Boots"))).toBe(true);
  });

  it("nennt den nächsten Kauf passend zum Gold", () => {
    const r = recommendBuild(input(p("Jinx", { items: [3006] }), [p("Darius")], { gold: 1300 }), data)!;
    expect(r.nextPurchase).not.toBeNull();
    expect(r.nextPurchase!.buyNowCost).toBeLessThanOrEqual(1300);
    expect(r.nextPurchase!.target).toBe(r.nextItem!.id);
  });

  it("Rückstand → defensive Begründung", () => {
    const r = recommendBuild(input(p("Darius", { items: [6631, 3047] }), [p("Zed"), p("Jinx")], { teamGoldDiff: -5000 }), data)!;
    expect(r.items.some((i) => i.reasons.some((x) => /zurück/.test(x)))).toBe(true);
  });

  it("ist deterministisch", () => {
    const i = input(p("Ahri", { items: [6655] }), [p("Zed", { kills: 3 }), p("Soraka")], { gold: 1700 });
    expect(recommendBuild(i, data)).toEqual(recommendBuild(i, data));
  });

  it("analyzeEnemies: AD-lastiges Team", () => {
    const e = analyzeEnemies([p("Zed"), p("Darius"), p("Jinx"), p("LeeSin"), p("Thresh")], data);
    expect(e.apShare).toBeLessThan(0.4);
  });

  it("unbekannter Champion → null", () => {
    expect(recommendBuild(input(p("NotAChampion"), []), data)).toBeNull();
  });
});
