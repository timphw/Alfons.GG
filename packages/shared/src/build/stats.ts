/**
 * Build-Statistik aus High-Elo-Matches (Ergebnis des Crawlers, siehe scripts/crawl-builds.ts).
 * Pro Champion & Rolle: empfohlene Item-Reihenfolge, Pick-/Winrates, Stiefel, Start-Items, Spells.
 */

export interface CrawledBuild {
  champion: string; // DDragon-ID
  role: string; // TOP | JUNGLE | MIDDLE | BOTTOM | UTILITY
  win: boolean;
  /** Fertige Items (inkl. Stiefel Stufe 2) in Kaufreihenfolge */
  order: number[];
  start: number[];
  spells: number[];
}

export interface ItemStat {
  /** Anteil der Spiele, in denen das Item gebaut wurde */
  pick: number;
  /** Winrate mit diesem Item */
  win: number;
  /** Durchschnittliche Position in der Kaufreihenfolge (1 = erstes fertiges Item) */
  slot: number;
}

export interface ChampionRoleBuild {
  games: number;
  win: number;
  /** Empfohlene Reihenfolge der fertigen Items (ohne Stiefel) */
  core: string[];
  boots: string | null;
  items: Record<string, ItemStat>;
  start: string[];
  spells: number[];
}

export interface BuildStats {
  patch: string;
  matches: number;
  generatedAt: string;
  builds: Record<string, ChampionRoleBuild>; // Schlüssel "Jinx:BOTTOM"
}

export const MIN_GAMES = 8;
const BOOTS = new Set(["3006", "3008", "3009", "3020", "3047", "3111", "3158"]);

export function buildKey(champion: string, role: string) {
  return `${champion}:${role}`;
}

/** Bester Eintrag für Champion+Rolle; fällt auf die meistgespielte Rolle des Champions zurück. */
export function findBuildStats(stats: BuildStats | null | undefined, champion: string, role?: string): ChampionRoleBuild | null {
  if (!stats) return null;
  if (role) {
    const exact = stats.builds[buildKey(champion, role)];
    if (exact) return exact;
  }
  let best: ChampionRoleBuild | null = null;
  for (const [key, b] of Object.entries(stats.builds)) {
    if (key.startsWith(`${champion}:`) && (!best || b.games > best.games)) best = b;
  }
  return best;
}

function mode<T>(values: T[], key: (v: T) => string): string | null {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(key(v), (counts.get(key(v)) ?? 0) + 1);
  let best: string | null = null;
  let n = 0;
  for (const [k, c] of counts) if (c > n || (c === n && best !== null && k < best)) [best, n] = [k, c];
  return best;
}

export function aggregateBuilds(all: CrawledBuild[], meta: { patch: string; matches: number }): BuildStats {
  const groups = new Map<string, CrawledBuild[]>();
  for (const b of all) {
    const k = buildKey(b.champion, b.role);
    (groups.get(k) ?? groups.set(k, []).get(k)!).push(b);
  }

  const builds: Record<string, ChampionRoleBuild> = {};
  for (const [key, list] of [...groups].sort(([a], [b]) => a.localeCompare(b))) {
    if (list.length < MIN_GAMES) continue;
    const games = list.length;
    const wins = list.filter((b) => b.win).length;

    // Item-Statistiken (Stiefel getrennt)
    const acc = new Map<string, { n: number; w: number; slotSum: number }>();
    const slotCounts: Array<Map<string, number>> = [];
    for (const b of list) {
      const order = b.order.map(String).filter((id) => !BOOTS.has(id));
      order.forEach((id, i) => {
        const a = acc.get(id) ?? { n: 0, w: 0, slotSum: 0 };
        a.n++;
        if (b.win) a.w++;
        a.slotSum += i + 1;
        acc.set(id, a);
        (slotCounts[i] ??= new Map()).set(id, (slotCounts[i]!.get(id) ?? 0) + 1);
      });
    }
    const items: Record<string, ItemStat> = {};
    for (const [id, a] of acc) {
      if (a.n / games < 0.03) continue;
      items[id] = { pick: round(a.n / games), win: round(a.w / a.n), slot: round(a.slotSum / a.n, 1) };
    }

    // Core-Reihenfolge: je Slot das häufigste noch nicht gewählte Item (mind. 10 % der Spiele in diesem Slot)
    const core: string[] = [];
    for (let s = 0; s < 6; s++) {
      const counts = slotCounts[s];
      if (!counts) break;
      const total = [...counts.values()].reduce((x, y) => x + y, 0);
      const pick = [...counts]
        .filter(([id]) => !core.includes(id))
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
      if (!pick || pick[1] / total < 0.1) {
        // Fallback: insgesamt populärstes noch fehlendes Item
        const alt = Object.entries(items)
          .filter(([id]) => !core.includes(id))
          .sort((a, b) => b[1].pick - a[1].pick || a[0].localeCompare(b[0]))[0];
        if (!alt) break;
        core.push(alt[0]);
      } else core.push(pick[0]);
    }

    const bootsList = list.map((b) => b.order.map(String).find((id) => BOOTS.has(id))).filter((x): x is string => !!x);
    const boots = bootsList.length / games >= 0.3 ? mode(bootsList, (x) => x) : null;
    const start = mode(list.filter((b) => b.start.length), (b) => [...b.start].sort((x, y) => x - y).join(","));
    const spells = mode(list, (b) => b.spells.join(","));

    builds[key] = {
      games,
      win: round(wins / games),
      core,
      boots,
      items,
      start: start ? start.split(",") : [],
      spells: spells ? spells.split(",").map(Number) : [],
    };
  }
  return { patch: meta.patch, matches: meta.matches, generatedAt: new Date().toISOString(), builds };
}

const round = (x: number, d = 3) => Math.round(x * 10 ** d) / 10 ** d;
