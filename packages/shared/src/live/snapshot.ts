import { z } from "zod";

/**
 * Kompaktes, normalisiertes Abbild eines laufenden Spiels. Der Companion erzeugt es aus
 * allgamedata und schickt es an /api/live/ingest. Der Server validiert mit diesem Schema.
 */

export const TeamSide = z.enum(["ORDER", "CHAOS"]);
export type TeamSide = z.infer<typeof TeamSide>;

export const LiveItem = z.object({
  id: z.number().int(),
  slot: z.number().int(),
  count: z.number().int(),
  price: z.number(),
  name: z.string().max(80),
});

export const LivePlayer = z.object({
  riotId: z.string().max(40),
  gameName: z.string().max(40),
  tagLine: z.string().max(10).optional(),
  champion: z.string().max(40), // Data-Dragon-ID, z.B. "MonkeyKing"
  championName: z.string().max(40), // lokalisierter Anzeigename
  team: TeamSide,
  position: z.string().max(10),
  level: z.number().int(),
  isDead: z.boolean(),
  respawnTimer: z.number(),
  isBot: z.boolean(),
  kills: z.number().int(),
  deaths: z.number().int(),
  assists: z.number().int(),
  cs: z.number().int(),
  wardScore: z.number(),
  items: z.array(LiveItem).max(10),
  /** Summe der Itempreise – Schätzung für Gold-Differenzen (echtes Gold sieht nur der aktive Spieler) */
  itemGold: z.number(),
  spells: z.tuple([z.string().max(40), z.string().max(40)]),
  keystone: z.number().int().optional(),
  secondaryTree: z.number().int().optional(),
});
export type LivePlayer = z.infer<typeof LivePlayer>;

export const TeamObjectives = z.object({
  kills: z.number().int(),
  towers: z.number().int(),
  inhibitors: z.number().int(),
  dragons: z.array(z.string().max(20)).max(10),
  barons: z.number().int(),
  heralds: z.number().int(),
  grubs: z.number().int(),
  atakhan: z.number().int(),
  itemGold: z.number(),
});
export type TeamObjectives = z.infer<typeof TeamObjectives>;

export const LiveEvent = z.object({
  id: z.number().int(),
  time: z.number(),
  type: z.string().max(30),
  killer: z.string().max(60).optional(),
  victim: z.string().max(60).optional(),
  assisters: z.array(z.string().max(60)).max(5).optional(),
  team: TeamSide.optional(),
  detail: z.string().max(60).optional(),
});
export type LiveEvent = z.infer<typeof LiveEvent>;

export const LiveSnapshot = z.object({
  v: z.literal(1),
  gameTime: z.number(),
  gameMode: z.string().max(30),
  mapNumber: z.number().int().optional(),
  status: z.enum(["in-game", "ended"]),
  result: z.enum(["Win", "Lose"]).optional(),
  activePlayer: z
    .object({
      riotId: z.string().max(40),
      level: z.number().int(),
      currentGold: z.number(),
      stats: z.record(z.string(), z.number()),
    })
    .optional(),
  players: z.array(LivePlayer).max(12),
  teams: z.object({ ORDER: TeamObjectives, CHAOS: TeamObjectives }),
  events: z.array(LiveEvent).max(30),
});
export type LiveSnapshot = z.infer<typeof LiveSnapshot>;

/** Was der Server speichert/streamt: Snapshot + Metadaten. */
export interface LiveState {
  puuid: string;
  riotId: string;
  region: string;
  receivedAt: number;
  snapshot: LiveSnapshot;
}

/** Max. Größe eines Ingest-Bodys in Bytes. */
export const MAX_INGEST_BYTES = 64 * 1024;
