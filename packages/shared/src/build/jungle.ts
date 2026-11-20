import type { LivePlayer, LiveSnapshot } from "../live/snapshot";
import type { BuildData } from "./items";
import { analyzeLaneFor } from "./lane";

/**
 * Jungle-Helfer für den EIGENEN Jungle.
 *
 * Die Live Client Data API meldet keine einzelnen Camps. Geräumte Camps werden deshalb aus
 * CS-Sprüngen des aktiven Spielers GESCHÄTZT (Monster-CS kommen in Schüben). Gegnerische Camps
 * werden bewusst nicht getrackt (Riot-Richtlinie für Drittanbieter-Tools).
 */
export const JUNGLE_TIMERS = {
  campsFirst: 90, // alle Camps 1:30
  scuttleFirst: 210, // Scuttle 3:30
  campRespawn: 135, // kleine Camps 2:15
  buffRespawn: 300, // Buffs 5:00
} as const;

const BURST_GAP = 8; // s ohne CS-Zuwachs = Camp fertig
const MIN_CAMP_CS = 2;

export interface JungleClear {
  /** Spielzeit (s), zu der das Camp fertig war */
  at: number;
  cs: number;
  /** geschätzter Respawn (kleines Camp) */
  respawnAt: number;
}

export interface JungleState {
  lastCs: number;
  lastTime: number;
  burstCs: number;
  burstLast: number;
  clears: JungleClear[];
}

export const initJungleState = (): JungleState => ({ lastCs: -1, lastTime: 0, burstCs: 0, burstLast: 0, clears: [] });

/** Reine Zustandsfunktion: verarbeitet einen Snapshot und gibt den neuen Zustand zurück. */
export function updateJungle(state: JungleState, s: LiveSnapshot): JungleState {
  const me = s.players.find((p) => p.riotId === s.activePlayer?.riotId);
  if (!me || me.position !== "JUNGLE") return state;
  // Neues Spiel / Zeitsprung zurück → zurücksetzen
  if (s.gameTime < state.lastTime - 5) state = initJungleState();
  const next: JungleState = { ...state, clears: [...state.clears] };
  const t = s.gameTime;

  // laufenden Schub abschließen, wenn eine Weile kein CS mehr kam
  if (next.burstCs > 0 && t - next.burstLast > BURST_GAP) {
    if (next.burstCs >= MIN_CAMP_CS) {
      next.clears.push({ at: next.burstLast, cs: next.burstCs, respawnAt: next.burstLast + JUNGLE_TIMERS.campRespawn });
      if (next.clears.length > 12) next.clears.shift();
    }
    next.burstCs = 0;
  }
  if (next.lastCs >= 0 && me.cs > next.lastCs && !me.isDead) {
    next.burstCs += me.cs - next.lastCs;
    next.burstLast = t;
  }
  next.lastCs = me.cs;
  next.lastTime = t;
  return next;
}

export interface JunglerSighting {
  time: number;
  where: string;
  what: string;
}

export interface JungleInfo {
  campsSpawnIn: number | null; // Sekunden bis 1:30, sonst null
  scuttleSpawnIn: number | null;
  clears: JungleClear[];
  enemyJungler: { name: string; championName: string; champion: string; isDead: boolean; respawnTimer: number; lastSeen: JunglerSighting | null } | null;
  gankTarget: { lane: string; reason: string } | null;
  advice: string;
}

const LANE_OF: Record<string, string> = { TOP: "Top", MIDDLE: "Mid", BOTTOM: "Bot", UTILITY: "Bot", JUNGLE: "Jungle" };
const fmt = (sec: number) => {
  const x = Math.max(0, Math.round(sec));
  return `${Math.floor(x / 60)}:${String(x % 60).padStart(2, "0")}`;
};

/** Wo war der gegnerische Jungler zuletzt sichtbar (Kill-Feed / Objectives)? */
export function lastSeen(s: LiveSnapshot, jungler: LivePlayer): JunglerSighting | null {
  const names = new Set([jungler.gameName, jungler.riotId]);
  const byName = new Map<string, LivePlayer>();
  for (const p of s.players) {
    byName.set(p.gameName, p);
    byName.set(p.riotId, p);
  }
  for (const e of [...s.events].reverse()) {
    const involved = (e.killer && names.has(e.killer)) || (e.victim && names.has(e.victim)) || e.assisters?.some((a) => names.has(a));
    if (!involved) continue;
    switch (e.type) {
      case "ChampionKill": {
        const other = e.killer && names.has(e.killer) ? byName.get(e.victim ?? "") : byName.get(e.killer ?? "");
        const where = other ? LANE_OF[other.position] ?? "?" : "?";
        return { time: e.time, where, what: e.victim && names.has(e.victim) ? "gestorben" : "an einem Kill beteiligt" };
      }
      case "DragonKill":
        return { time: e.time, where: "Bot-Seite", what: "Drache" };
      case "BaronKill":
      case "HeraldKill":
      case "HordeKill":
        return { time: e.time, where: "Top-Seite", what: e.type === "BaronKill" ? "Baron" : e.type === "HeraldKill" ? "Herold" : "Voidgrubs" };
    }
  }
  return null;
}

export function analyzeJungle(s: LiveSnapshot, state: JungleState, data: BuildData): JungleInfo | null {
  const me = s.players.find((p) => p.riotId === s.activePlayer?.riotId);
  if (!me || me.position !== "JUNGLE") return null;
  const t = s.gameTime;
  const enemyTeam = me.team === "ORDER" ? "CHAOS" : "ORDER";
  const ej = s.players.find((p) => p.team === enemyTeam && p.position === "JUNGLE");
  const seen = ej ? lastSeen(s, ej) : null;

  // Gank-Ziel: Lane mit dem besten Verhältnis (eigener Laner im Vorteil = leichter Gank)
  let gankTarget: JungleInfo["gankTarget"] = null;
  if (t >= 150) {
    let best: { lane: string; score: number; reason: string } | null = null;
    for (const pos of ["TOP", "MIDDLE", "BOTTOM"]) {
      const ally = s.players.find((p) => p.team === me.team && p.position === pos);
      if (!ally || ally.isDead) continue;
      const lane = analyzeLaneFor(s, ally, data);
      if (!lane || lane.enemy.every((e) => e.isDead)) continue;
      const enemyDeaths = lane.enemy.reduce((x, e) => x + e.deaths, 0);
      const ultGap = lane.enemy.some((e) => e.level >= 6) && lane.me.every((m) => m.level < 6) ? -1 : 0;
      const score = lane.score + enemyDeaths * 0.3 + ultGap;
      if (!best || score > best.score) best = { lane: LANE_OF[pos]!, score, reason: lane.reasons[0] ?? lane.advice };
    }
    if (best && best.score > -2) gankTarget = { lane: best.lane, reason: best.reason };
  }

  let advice: string;
  if (t < JUNGLE_TIMERS.campsFirst) advice = `Camps spawnen in ${fmt(JUNGLE_TIMERS.campsFirst - t)} – Leash absprechen, Start-Buff wählen.`;
  else if (ej?.isDead) advice = `Gegner-Jungler tot (${Math.ceil(ej.respawnTimer)} s) – seine Camps/Scuttle nehmen oder Objective starten.`;
  else if (seen && t - seen.time <= 45 && seen.where !== "?")
    advice = `Gegner-Jungler war vor ${Math.round(t - seen.time)} s ${seen.where === "Top-Seite" || seen.where === "Top" ? "oben" : seen.where === "Bot-Seite" || seen.where === "Bot" ? "unten" : `auf ${seen.where}`} – die andere Seite ist gerade sicher.`;
  else if (gankTarget) advice = `Gank-Ziel: ${gankTarget.lane} (${gankTarget.reason}).`;
  else advice = "Farmen und Camps im Blick behalten – vor Objectives Vision setzen.";

  return {
    campsSpawnIn: t < JUNGLE_TIMERS.campsFirst ? JUNGLE_TIMERS.campsFirst - t : null,
    scuttleSpawnIn: t < JUNGLE_TIMERS.scuttleFirst ? JUNGLE_TIMERS.scuttleFirst - t : null,
    clears: state.clears.filter((c) => c.respawnAt > t - 30).slice(-4),
    enemyJungler: ej
      ? { name: ej.gameName, championName: ej.championName, champion: ej.champion, isDead: ej.isDead, respawnTimer: ej.respawnTimer, lastSeen: seen }
      : null,
    gankTarget,
    advice,
  };
}
