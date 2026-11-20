import type { LivePlayer, LiveSnapshot, TeamSide } from "../live/snapshot";
import { findChampionById, type BuildData } from "./items";

/**
 * Lane-Duell: eigener Spieler (bzw. Botlane-Duo) gegen den direkten Gegner.
 * Nutzt nur Informationen, die im Spiel ohnehin sichtbar sind (Scoreboard): Level, CS, Items,
 * Summoner Spells (welche, nicht deren Cooldowns), Kills, Tode.
 */

export type LaneVerdict = "ahead" | "even" | "behind";

export interface LaneSide {
  riotId: string;
  name: string;
  champion: string;
  championName: string;
  level: number;
  cs: number;
  itemGold: number;
  spells: [string, string];
  kills: number;
  deaths: number;
  isDead: boolean;
  respawnTimer: number;
  ranged: boolean;
}

export interface LaneInfo {
  role: string;
  me: LaneSide[];
  enemy: LaneSide[];
  verdict: LaneVerdict;
  /** > 0 = Vorteil für dich */
  score: number;
  reasons: string[];
  advice: string;
}

const ROLE_LABEL: Record<string, string> = { TOP: "Toplane", JUNGLE: "Jungle", MIDDLE: "Midlane", BOTTOM: "Botlane", UTILITY: "Botlane" };
const SPELL_NAME: Record<string, string> = {
  SummonerDot: "Entzünden", SummonerExhaust: "Erschöpfung", SummonerFlash: "Blitz", SummonerTeleport: "Teleport",
  SummonerHeal: "Heilen", SummonerBarrier: "Barriere", SummonerSmite: "Zerschmettern", SummonerBoost: "Läutern", SummonerHaste: "Geist",
};
const has = (s: LaneSide[], spell: string) => s.some((p) => p.spells.includes(spell));
const avg = (s: LaneSide[], f: (p: LaneSide) => number) => s.reduce((t, p) => t + f(p), 0) / Math.max(1, s.length);
const sum = (s: LaneSide[], f: (p: LaneSide) => number) => s.reduce((t, p) => t + f(p), 0);
const fmtGold = (g: number) => new Intl.NumberFormat("de-DE").format(Math.round(Math.abs(g)));

function side(p: LivePlayer, data: BuildData): LaneSide {
  const champ = findChampionById(data.champions, p.champion);
  return {
    riotId: p.riotId,
    name: p.gameName,
    champion: p.champion,
    championName: p.championName,
    level: p.level,
    cs: p.cs,
    itemGold: p.itemGold,
    spells: p.spells,
    kills: p.kills,
    deaths: p.deaths,
    isDead: p.isDead,
    respawnTimer: p.respawnTimer,
    ranged: (champ?.stats?.attackrange ?? 0) >= 300,
  };
}

/** Spieler einer Lane (Botlane = BOTTOM + UTILITY). */
function lanePlayers(players: LivePlayer[], team: TeamSide, role: string): LivePlayer[] {
  const roles = role === "BOTTOM" || role === "UTILITY" ? ["BOTTOM", "UTILITY"] : [role];
  return players.filter((p) => p.team === team && roles.includes(p.position));
}

/** Analysiert die Lane eines beliebigen Spielers (für dich oder – im Jungle – für Gank-Ziele). */
export function analyzeLaneFor(s: LiveSnapshot, player: LivePlayer, data: BuildData): LaneInfo | null {
  const role = player.position;
  if (!role) return null;
  const enemyTeam: TeamSide = player.team === "ORDER" ? "CHAOS" : "ORDER";
  const meP = role === "JUNGLE" ? [player] : lanePlayers(s.players, player.team, role);
  const enP = lanePlayers(s.players, enemyTeam, role);
  if (meP.length === 0 || enP.length === 0) return null;
  const me = meP.map((p) => side(p, data));
  const enemy = enP.map((p) => side(p, data));
  const duo = me.length > 1 || enemy.length > 1;
  const minutes = s.gameTime / 60;

  let score = 0;
  const reasons: string[] = [];
  const add = (points: number, text: string) => {
    score += points;
    reasons.push(text);
  };

  // Level / Ultimate
  const myLvl = avg(me, (p) => p.level);
  const enLvl = avg(enemy, (p) => p.level);
  const myUlt = me.every((p) => p.level >= 6);
  const enUlt = enemy.every((p) => p.level >= 6);
  if (enUlt && !myUlt) add(-3, "Gegner hat Ult (Level 6), du noch nicht");
  else if (myUlt && !enUlt) add(3, "Du hast Ult (Level 6), der Gegner noch nicht");
  else if (minutes < 3.5 && enLvl >= 2 && myLvl < 2) add(-2, "Gegner ist zuerst Level 2");
  else if (minutes < 3.5 && myLvl >= 2 && enLvl < 2) add(2, "Du bist zuerst Level 2 – Trade-Fenster!");
  else if (Math.abs(myLvl - enLvl) >= 1) add(Math.sign(myLvl - enLvl) * Math.min(2, Math.abs(myLvl - enLvl)), myLvl > enLvl ? `Level-Vorteil (${Math.round(myLvl)} vs ${Math.round(enLvl)})` : `Level-Rückstand (${Math.round(myLvl)} vs ${Math.round(enLvl)})`);

  // Items
  const goldDiff = sum(me, (p) => p.itemGold) - sum(enemy, (p) => p.itemGold);
  if (Math.abs(goldDiff) >= 300) {
    add(Math.max(-3, Math.min(3, goldDiff / 400)), goldDiff > 0 ? `${fmtGold(goldDiff)} g mehr Items als ${duo ? "die Gegner" : "dein Gegner"}` : `Gegner hat ${fmtGold(goldDiff)} g mehr Items`);
  }

  // CS
  if (minutes >= 4 && role !== "UTILITY" && role !== "JUNGLE") {
    const csDiff = sum(me.filter((p) => p.cs > 20 || !duo), (p) => p.cs) - sum(enemy.filter((p) => p.cs > 20 || !duo), (p) => p.cs);
    if (Math.abs(csDiff) >= 10) add(Math.max(-1.5, Math.min(1.5, csDiff / 20)), csDiff > 0 ? `+${csDiff} CS` : `${csDiff} CS`);
  }

  // Summoner Spells (welche – nicht deren Cooldowns)
  for (const [spell, w] of [["SummonerDot", 1.5], ["SummonerExhaust", 1]] as const) {
    const mine = has(me, spell);
    const theirs = has(enemy, spell);
    if (theirs && !mine) add(-w, `Gegner hat ${SPELL_NAME[spell]}${spell === "SummonerDot" ? " (Kill-Druck)" : ""}, du nicht`);
    else if (mine && !theirs) add(w, `Du hast ${SPELL_NAME[spell]}, der Gegner nicht`);
  }
  if (!duo && me[0] && enemy[0]) {
    const flashMe = me[0].spells.includes("SummonerFlash");
    const flashEn = enemy[0].spells.includes("SummonerFlash");
    if (flashEn && !flashMe) add(-0.5, "Gegner hat Blitz, du nicht – weniger Fluchtmöglichkeit");
  }

  // Nah- vs. Fernkampf (Top/Mid)
  if (!duo && me[0] && enemy[0] && (role === "TOP" || role === "MIDDLE")) {
    if (enemy[0].ranged && !me[0].ranged) add(-1, `${enemy[0].championName} ist Fernkämpfer – er kann dich risikolos pieksen`);
    else if (me[0].ranged && !enemy[0].ranged) add(1, `Du bist Fernkämpfer gegen ${enemy[0].championName} (Nahkampf) – pieks ihn beim Farmen`);
  }

  // Kills in der Lane
  const killDiff = sum(me, (p) => p.kills - p.deaths) - sum(enemy, (p) => p.kills - p.deaths);
  if (Math.abs(killDiff) >= 2) add(Math.max(-2, Math.min(2, killDiff / 2)), killDiff > 0 ? "Mehr Kills als der Gegner" : "Gegner hat dich schon öfter getötet");

  score = Math.round(score * 10) / 10;
  const verdict: LaneVerdict = score >= 2 ? "ahead" : score <= -2 ? "behind" : "even";

  // Handlungsempfehlung
  const deadEnemies = enemy.filter((p) => p.isDead);
  const plates = minutes < 14;
  let advice: string;
  if (me.every((p) => p.isDead)) {
    advice = "Du bist tot – Gold ausgeben, danach Welle sicher zurückholen.";
  } else if (role !== "JUNGLE" && deadEnemies.length === enemy.length) {
    advice = `${duo ? "Beide Gegner" : "Gegner"} tot (${Math.ceil(Math.max(...deadEnemies.map((p) => p.respawnTimer)))} s) – Welle reinpushen${plates ? ", Turmplatten holen" : ", Turm schlagen"}, dann zurück zur Basis.`;
  } else if (role === "JUNGLE") {
    advice =
      verdict === "behind"
        ? "Gegner-Jungler ist stärker – keine Invades, nah an deinen Lanes farmen und auf Counter-Ganks spielen."
        : verdict === "ahead"
          ? "Du bist stärker als der Gegner-Jungler – Invade/Scuttle umkämpfen, Druck auf seine Seite."
          : "Ausgeglichen – auf der Seite spielen, wo deine Lanes Prio haben.";
  } else if (enUlt && !myUlt) {
    advice = "Bis du Level 6 hast Abstand halten – nur farmen, keine längeren Kämpfe.";
  } else if (verdict === "behind") {
    advice = `Passiv spielen: unter dem Turm farmen, Welle nicht pushen, Jungler um Hilfe pingen${has(enemy, "SummonerDot") ? " – bei < 50 % HP nicht in Entzünden-Reichweite" : ""}.`;
  } else if (verdict === "ahead") {
    advice = plates
      ? "Druck machen: Trades suchen, wenn seine Fähigkeiten auf Abklingzeit sind, Welle pushen und Platten holen."
      : "Vorteil nutzen: Welle pushen, dann roamen oder beim nächsten Objective helfen.";
  } else {
    advice = "Ausgeglichen – kurze Trades, wenn er farmt; Welle kontrollieren und auf Jungler-Hilfe achten.";
  }

  return { role: ROLE_LABEL[role] ?? role, me, enemy, verdict, score, reasons: reasons.slice(0, 4), advice };
}

export function analyzeLane(s: LiveSnapshot, data: BuildData): LaneInfo | null {
  const me = s.players.find((p) => p.riotId === s.activePlayer?.riotId);
  return me ? analyzeLaneFor(s, me, data) : null;
}
