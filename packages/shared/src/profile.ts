import type { MatchDto, MatchParticipantDto } from "./riot/types";

export interface MatchSummary {
  matchId: string;
  queueId: number;
  gameCreation: number;
  durationSec: number;
  remake: boolean;
  win: boolean;
  championId: number;
  championName: string;
  champLevel: number;
  position: string;
  kills: number;
  deaths: number;
  assists: number;
  cs: number;
  gold: number;
  damage: number;
  visionScore: number;
  killParticipation: number; // 0..1
  items: number[]; // item0..item6
  spells: [number, number];
  primaryRune?: number;
  secondaryStyle?: number;
  teams: Array<{
    teamId: number;
    players: Array<{ puuid: string; name: string; tag?: string; championName: string; championId: number }>;
  }>;
}

export interface ChampionStat {
  championId: number;
  championName: string;
  games: number;
  wins: number;
  kills: number;
  deaths: number;
  assists: number;
  cs: number;
  durationSec: number;
}

/** Fasst ein Match aus Sicht des Spielers zusammen. */
export function summarizeMatch(match: MatchDto, puuid: string): MatchSummary | null {
  const p = match.info.participants.find((x) => x.puuid === puuid);
  if (!p) return null;
  const teamKills = match.info.participants
    .filter((x) => x.teamId === p.teamId)
    .reduce((s, x) => s + x.kills, 0);
  const teams = [100, 200].map((teamId) => ({
    teamId,
    players: match.info.participants
      .filter((x) => x.teamId === teamId)
      .map((x: MatchParticipantDto) => ({
        puuid: x.puuid,
        name: x.riotIdGameName || x.summonerName || "?",
        tag: x.riotIdTagline,
        championName: x.championName,
        championId: x.championId,
      })),
  }));
  return {
    matchId: match.metadata.matchId,
    queueId: match.info.queueId,
    gameCreation: match.info.gameCreation,
    durationSec: match.info.gameDuration,
    remake: match.info.gameDuration < 300,
    win: p.win,
    championId: p.championId,
    championName: p.championName,
    champLevel: p.champLevel,
    position: p.teamPosition || p.individualPosition,
    kills: p.kills,
    deaths: p.deaths,
    assists: p.assists,
    cs: p.totalMinionsKilled + p.neutralMinionsKilled,
    gold: p.goldEarned,
    damage: p.totalDamageDealtToChampions,
    visionScore: p.visionScore,
    killParticipation: teamKills > 0 ? (p.kills + p.assists) / teamKills : 0,
    items: [p.item0, p.item1, p.item2, p.item3, p.item4, p.item5, p.item6],
    spells: [p.summoner1Id, p.summoner2Id],
    primaryRune: p.perks?.styles[0]?.selections[0]?.perk,
    secondaryStyle: p.perks?.styles[1]?.style,
    teams,
  };
}

/** Aggregiert Champion-Statistiken (Remakes werden ignoriert), sortiert nach Spielen. */
export function aggregateChampionStats(matches: MatchSummary[]): ChampionStat[] {
  const map = new Map<number, ChampionStat>();
  for (const m of matches) {
    if (m.remake) continue;
    const s = map.get(m.championId) ?? {
      championId: m.championId,
      championName: m.championName,
      games: 0, wins: 0, kills: 0, deaths: 0, assists: 0, cs: 0, durationSec: 0,
    };
    s.games++;
    if (m.win) s.wins++;
    s.kills += m.kills;
    s.deaths += m.deaths;
    s.assists += m.assists;
    s.cs += m.cs;
    s.durationSec += m.durationSec;
    map.set(m.championId, s);
  }
  return [...map.values()].sort((a, b) => b.games - a.games || b.wins - a.wins);
}

export function kda(k: number, d: number, a: number): number {
  return d === 0 ? k + a : (k + a) / d;
}
