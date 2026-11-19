// Typen der lokalen Live Client Data API (https://127.0.0.1:2999/liveclientdata/allgamedata).
// Nur die Felder, die wir verwenden. Alle Felder sind defensiv optional, weil Riot sie je nach
// Modus (Spectator, Practice Tool, ARAM ...) weglässt.

export type LcdTeam = "ORDER" | "CHAOS" | "NEUTRAL";

export interface LcdItem {
  itemID: number;
  displayName: string;
  price: number;
  count: number;
  slot: number;
  canUse?: boolean;
  consumable?: boolean;
  rawDisplayName?: string;
}

export interface LcdSummonerSpell {
  displayName: string;
  rawDisplayName?: string;
}

export interface LcdPlayer {
  championName: string;
  rawChampionName?: string; // "game_character_displayname_MonkeyKing"
  isBot?: boolean;
  isDead?: boolean;
  items: LcdItem[];
  level: number;
  position?: string; // TOP | JUNGLE | MIDDLE | BOTTOM | UTILITY | ""
  respawnTimer?: number;
  riotId?: string; // "Name#Tag"
  riotIdGameName?: string;
  riotIdTagLine?: string;
  summonerName?: string;
  team: LcdTeam;
  scores: { kills: number; deaths: number; assists: number; creepScore: number; wardScore: number };
  summonerSpells?: { summonerSpellOne?: LcdSummonerSpell; summonerSpellTwo?: LcdSummonerSpell };
  runes?: {
    keystone?: { id: number; displayName: string };
    primaryRuneTree?: { id: number; displayName: string };
    secondaryRuneTree?: { id: number; displayName: string };
  };
  skinID?: number;
}

export interface LcdActivePlayer {
  riotId?: string;
  riotIdGameName?: string;
  riotIdTagLine?: string;
  summonerName?: string;
  level?: number;
  currentGold?: number;
  championStats?: Record<string, number>;
  error?: string;
}

export interface LcdEvent {
  EventID: number;
  EventName: string;
  EventTime: number;
  KillerName?: string;
  VictimName?: string;
  Assisters?: string[];
  DragonType?: string;
  Stolen?: string;
  TurretKilled?: string;
  InhibKilled?: string;
  Result?: "Win" | "Lose";
  Recipient?: string;
  Acer?: string;
  AcingTeam?: string;
  KillStreak?: number;
}

export interface AllGameData {
  activePlayer?: LcdActivePlayer;
  allPlayers: LcdPlayer[];
  events: { Events: LcdEvent[] };
  gameData: { gameMode: string; gameTime: number; mapName?: string; mapNumber?: number; mapTerrain?: string };
}
