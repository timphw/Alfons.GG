// Statistik-Crawler: High-Elo-Matches (Challenger/Grandmaster) → Item-Builds je Champion & Rolle.
//
//   pnpm --filter @alfons/shared crawl [--minutes 50] [--out ../../apps/web/public/data/builds.json]
//
// - Liest RIOT_API_KEY aus der Root-.env
// - Crawlt EUW, KR und NA parallel (eigene Rate-Limits je Region), nur Ranked Solo/Duo (Queue 420)
// - Speichert jedes ausgewertete Match in .crawl/<patch>.jsonl (Fortsetzen nach Abbruch möglich)
// - Aggregiert am Ende zu builds.json (wird von Website & Companion genutzt)
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { RiotClient, fetchLatestVersion, fetchStaticData, isLegendary, isTier2Boots, type MatchDto, type MatchTimelineDto, type Platform, type RegionalRoute, type StaticData } from "../src";
import { aggregateBuilds, type CrawledBuild } from "../src/build/stats";

const { values } = parseArgs({
  options: {
    minutes: { type: "string", default: "50" },
    out: { type: "string", default: "../../apps/web/public/data/builds.json" },
    "aggregate-only": { type: "boolean", default: false },
  },
});

const env = readFileSync(new URL("../../../.env", import.meta.url), "utf8");
const apiKey = env.match(/^RIOT_API_KEY=(.+)$/m)?.[1]?.trim();
if (!apiKey) throw new Error("RIOT_API_KEY fehlt in .env");

const REGIONS: Array<{ platform: Platform; route: RegionalRoute }> = [
  { platform: "euw1", route: "europe" },
  { platform: "kr", route: "asia" },
  { platform: "na1", route: "americas" },
];

const version = await fetchLatestVersion();
const patch = version.split(".").slice(0, 2).join("."); // "16.23"
const [maj, min] = patch.split(".").map(Number) as [number, number];
const prevPatch = `${maj}.${min - 1}`; // vorigen Patch mitnehmen – Builds ändern sich selten stark
const patchRank = (p: string) => {
  const [a, b] = p.split(".").map(Number) as [number, number];
  return a * 100 + b;
};
const data: StaticData = await fetchStaticData(version, "de_DE");
const crawlDir = new URL("../.crawl/", import.meta.url);
mkdirSync(crawlDir, { recursive: true });
const logFile = new URL(`${patch}.jsonl`, crawlDir);
const seen = new Set<string>();
if (existsSync(logFile)) {
  for (const line of readFileSync(logFile, "utf8").split("\n")) {
    if (line) seen.add((JSON.parse(line) as { matchId: string }).matchId);
  }
}
console.log(`Patch ${patch} (+${prevPatch}) · bereits ausgewertet: ${seen.size} Matches`);

/** Patch aus gameVersion "16.23.645.1234" → "16.23" */
const matchPatch = (m: MatchDto) => m.info.gameVersion.split(".").slice(0, 2).join(".");

function extract(match: MatchDto, timeline: MatchTimelineDto): CrawledBuild[] {
  const builds: CrawledBuild[] = [];
  const byPid = new Map<number, number[]>(); // participantId → Kaufreihenfolge (fertige Items)
  const starts = new Map<number, number[]>();
  for (const frame of timeline.info.frames) {
    for (const e of frame.events) {
      const pid = e.participantId;
      if (!pid) continue;
      if (e.type === "ITEM_PURCHASED" && typeof e.itemId === "number") {
        const id = String(e.itemId);
        const item = data.items[id];
        if (e.timestamp < 90_000) (starts.get(pid) ?? starts.set(pid, []).get(pid)!).push(e.itemId);
        if (item && (isLegendary(id, item) || isTier2Boots(id, item))) {
          const list = byPid.get(pid) ?? byPid.set(pid, []).get(pid)!;
          if (!list.includes(e.itemId)) list.push(e.itemId);
        }
      } else if (e.type === "ITEM_UNDO") {
        const before = Number(e.beforeId ?? 0);
        const list = byPid.get(pid);
        if (list && list[list.length - 1] === before) list.pop();
      }
    }
  }
  match.info.participants.forEach((p, idx) => {
    const champ = data.champions[String(p.championId)];
    if (!champ || !p.teamPosition) return;
    const pid = idx + 1;
    const finalItems = [p.item0, p.item1, p.item2, p.item3, p.item4, p.item5].filter(Boolean);
    // Nur Items zählen, die am Ende noch im Inventar waren (verkaufte/abgebrochene raus)
    const order = (byPid.get(pid) ?? []).filter((id) => finalItems.includes(id));
    builds.push({
      champion: champ.id,
      role: p.teamPosition,
      win: p.win,
      order,
      start: starts.get(pid) ?? [],
      spells: [p.summoner1Id, p.summoner2Id].sort((a, b) => a - b),
    });
  });
  return builds;
}

async function crawlRegion(client: RiotClient, platform: Platform, route: RegionalRoute, until: number) {
  const players: string[] = [];
  for (const tier of ["challenger", "grandmaster"] as const) {
    const league = await client.getApexLeague(platform, tier).catch(() => null);
    for (const e of league?.entries ?? []) if (e.puuid) players.push(e.puuid);
  }
  console.log(`[${platform}] ${players.length} Spieler`);
  let done = 0;
  for (const puuid of players) {
    if (Date.now() > until) break;
    const ids = (await client.getMatchIds(route, puuid, { count: 20, queue: 420 }).catch(() => null)) ?? [];
    for (const id of ids) {
      if (Date.now() > until) break;
      if (seen.has(id)) continue;
      seen.add(id);
      const match = await client.getMatch(route, id).catch(() => null);
      if (!match) continue;
      const mp = matchPatch(match);
      // Match-IDs sind neueste zuerst: ab hier nur noch ältere Patches → nächster Spieler
      if (patchRank(mp) < patchRank(prevPatch)) break;
      if (match.info.gameDuration < 15 * 60) continue;
      const timeline = await client.getMatchTimeline(route, id).catch(() => null);
      if (!timeline) continue;
      appendFileSync(logFile, JSON.stringify({ matchId: id, platform, builds: extract(match, timeline) }) + "\n");
      if (++done % 25 === 0) console.log(`[${platform}] ${done} Matches`);
    }
  }
  console.log(`[${platform}] fertig: ${done} neue Matches`);
}

if (!values["aggregate-only"]) {
  const until = Date.now() + Number(values.minutes) * 60_000;
  const client = new RiotClient({ apiKey });
  await Promise.all(REGIONS.map((r) => crawlRegion(client, r.platform, r.route, until)));
}

// Aggregieren
const all: CrawledBuild[] = [];
let matches = 0;
for (const line of readFileSync(logFile, "utf8").split("\n")) {
  if (!line) continue;
  matches++;
  all.push(...(JSON.parse(line) as { builds: CrawledBuild[] }).builds);
}
const result = aggregateBuilds(all, { patch, matches });
const out = new URL(values.out, import.meta.url);
mkdirSync(new URL(".", out), { recursive: true });
writeFileSync(out, JSON.stringify(result));
console.log(`builds.json: ${matches} Matches, ${Object.keys(result.builds).length} Champion/Rollen → ${out.pathname}`);
