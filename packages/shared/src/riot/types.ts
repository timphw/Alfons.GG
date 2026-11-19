// Ausgewählte DTOs der Riot Web-API (nur die Felder, die wir nutzen).

export interface AccountDto {
  puuid: string;
  gameName: string;
  tagLine: string;
}

export interface SummonerDto {
  puuid: string;
  profileIconId: number;
  revisionDate: number;
  summonerLevel: number;
}

export interface LeagueEntryDto {
  leagueId: string;
  queueType: "RANKED_SOLO_5x5" | "RANKED_FLEX_SR" | string;
  tier: string;
  rank: string;
  leaguePoints: number;
  wins: number;
  losses: number;
  hotStreak: boolean;
  puuid?: string;
}

export interface LeagueListDto {
  tier: string;
  leagueId: string;
  queue: string;
  name: string;
  entries: Array<{ puuid: string; leaguePoints: number; wins: number; losses: number; rank: string }>;
}

export interface MatchParticipantDto {
  puuid: string;
  riotIdGameName?: string;
  riotIdTagline?: string;
  summonerName?: string;
  championId: number;
  championName: string;
  champLevel: number;
  teamId: 100 | 200;
  teamPosition: string;
  individualPosition: string;
  kills: number;
  deaths: number;
  assists: number;
  totalMinionsKilled: number;
  neutralMinionsKilled: number;
  goldEarned: number;
  totalDamageDealtToChampions: number;
  visionScore: number;
  win: boolean;
  item0: number; item1: number; item2: number; item3: number;
  item4: number; item5: number; item6: number;
  summoner1Id: number;
  summoner2Id: number;
  perks?: {
    styles: Array<{ description: string; style: number; selections: Array<{ perk: number }> }>;
  };
}

export interface MatchDto {
  metadata: { matchId: string; participants: string[] };
  info: {
    gameCreation: number;
    gameDuration: number;
    gameEndTimestamp?: number;
    gameMode: string;
    gameVersion: string;
    queueId: number;
    mapId: number;
    participants: MatchParticipantDto[];
    teams: Array<{ teamId: number; win: boolean }>;
  };
}

export interface MatchTimelineDto {
  metadata: { matchId: string };
  info: {
    frameInterval: number;
    frames: Array<{
      timestamp: number;
      events: Array<{
        type: string;
        timestamp: number;
        participantId?: number;
        itemId?: number;
        [k: string]: unknown;
      }>;
    }>;
  };
}

export interface SpectatorPerks {
  perkIds: number[];
  perkStyle: number;
  perkSubStyle: number;
}

export interface CurrentGameParticipant {
  puuid: string | null;
  riotId?: string;
  championId: number;
  teamId: 100 | 200;
  spell1Id: number;
  spell2Id: number;
  profileIconId: number;
  bot: boolean;
  perks?: SpectatorPerks;
}

export interface CurrentGameInfo {
  gameId: number;
  gameType: string;
  gameStartTime: number;
  mapId: number;
  gameLength: number;
  platformId: string;
  gameMode: string;
  gameQueueConfigId?: number;
  bannedChampions: Array<{ pickTurn: number; championId: number; teamId: number }>;
  participants: CurrentGameParticipant[];
}
