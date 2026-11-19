import type { LivePlayer, LiveSnapshot, TeamSide } from "../live/snapshot";
import { recommendBuild, type BuildPlayer, type BuildRecommendation } from "./engine";
import type { BuildData } from "./items";

/**
 * Coach: leitet aus dem Live-Snapshot konkrete Tipps ab („was als Nächstes tun?“).
 * Rein & deterministisch. Timer sind Näherungen und je Season anpassbar.
 */
export const OBJECTIVE_TIMERS = {
  dragonFirst: 5 * 60,
  dragonRespawn: 5 * 60,
  elderRespawn: 6 * 60,
  grubsFirst: 8 * 60,
  heraldFirst: 15 * 60,
  baronFirst: 25 * 60,
  baronRespawn: 6 * 60,
} as const;

export type TipPriority = "high" | "medium" | "info";
export type TipKind = "shop" | "objective" | "danger" | "macro" | "farm" | "vision";

export interface CoachTip {
  id: string;
  priority: TipPriority;
  kind: TipKind;
  text: string;
  detail?: string;
}

export interface ObjectiveTimer {
  name: "Drache" | "Elder-Drache" | "Baron" | "Herold" | "Voidgrubs";
  /** Spawn-Zeit in Spielsekunden; <= gameTime = verfügbar */
  spawnAt: number;
}

export interface CoachResult {
  build: BuildRecommendation | null;
  tips: CoachTip[];
  objectives: ObjectiveTimer[];
}

const CS_TARGET: Record<string, number> = { TOP: 6.5, JUNGLE: 5.5, MIDDLE: 7, BOTTOM: 7.5 };
const PRIORITY_ORDER: Record<TipPriority, number> = { high: 0, medium: 1, info: 2 };

const fmtTime = (sec: number) => {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
const fmtGold = (g: number) => new Intl.NumberFormat("de-DE").format(Math.round(g));

function toBuildPlayer(p: LivePlayer): BuildPlayer {
  return {
    champion: p.champion,
    items: p.items.map((i) => i.id),
    kills: p.kills,
    deaths: p.deaths,
    assists: p.assists,
    level: p.level,
    position: p.position,
  };
}

/** Berechnet Objective-Spawns aus den Events des Snapshots. */
export function objectiveTimers(s: LiveSnapshot): ObjectiveTimer[] {
  const t = OBJECTIVE_TIMERS;
  const kills = (type: string) => s.events.filter((e) => e.type === type).map((e) => e.time);
  const lastOf = (arr: number[]) => (arr.length ? Math.max(...arr) : undefined);
  const out: ObjectiveTimer[] = [];

  const soulTaken = s.teams.ORDER.dragons.filter((d) => d !== "Elder").length >= 4 || s.teams.CHAOS.dragons.filter((d) => d !== "Elder").length >= 4;
  const lastDragon = lastOf(kills("DragonKill"));
  const totalDragons = s.teams.ORDER.dragons.length + s.teams.CHAOS.dragons.length;
  if (soulTaken) {
    out.push({ name: "Elder-Drache", spawnAt: (lastDragon ?? s.gameTime) + t.elderRespawn });
  } else {
    // Snapshot-Events sind gekürzt – ohne Event, aber mit gezählten Drachen ist der Drache vermutlich bald wieder da
    out.push({
      name: "Drache",
      spawnAt: lastDragon !== undefined ? lastDragon + t.dragonRespawn : totalDragons === 0 ? t.dragonFirst : s.gameTime,
    });
  }

  const grubs = s.teams.ORDER.grubs + s.teams.CHAOS.grubs;
  if (grubs === 0 && s.gameTime < t.heraldFirst - 60) out.push({ name: "Voidgrubs", spawnAt: t.grubsFirst });

  const heralds = s.teams.ORDER.heralds + s.teams.CHAOS.heralds;
  if (heralds === 0 && s.gameTime < t.baronFirst - 60) out.push({ name: "Herold", spawnAt: t.heraldFirst });

  const lastBaron = lastOf(kills("BaronKill"));
  const barons = s.teams.ORDER.barons + s.teams.CHAOS.barons;
  if (s.gameTime >= t.baronFirst - 5 * 60) {
    out.push({
      name: "Baron",
      spawnAt: lastBaron !== undefined ? lastBaron + t.baronRespawn : barons === 0 ? t.baronFirst : s.gameTime,
    });
  }
  return out.sort((a, b) => a.spawnAt - b.spawnAt);
}

export function coach(s: LiveSnapshot, data: BuildData): CoachResult {
  const objectives = objectiveTimers(s);
  const me = s.players.find((p) => p.riotId === s.activePlayer?.riotId);
  if (!me || !s.activePlayer) return { build: null, tips: [], objectives };

  const myTeam: TeamSide = me.team;
  const enemyTeam: TeamSide = myTeam === "ORDER" ? "CHAOS" : "ORDER";
  const enemies = s.players.filter((p) => p.team === enemyTeam);
  const goldDiff = s.teams[myTeam].itemGold - s.teams[enemyTeam].itemGold;
  const gold = s.activePlayer.currentGold;
  const minutes = s.gameTime / 60;

  const build = recommendBuild(
    { me: toBuildPlayer(me), gold, gameTime: s.gameTime, enemies: enemies.map(toBuildPlayer), teamGoldDiff: goldDiff },
    data,
  );

  const tips: CoachTip[] = [];
  if (s.status === "ended") return { build, tips, objectives };

  // 1) Einkauf
  const plan = build?.nextPurchase;
  if (plan && build?.nextItem) {
    if (plan.completes) {
      tips.push({
        id: "shop-complete",
        priority: "high",
        kind: "shop",
        text: me.isDead
          ? `Du bist tot – kauf jetzt ${build.nextItem.name}!`
          : `Genug Gold für ${build.nextItem.name} – bei der nächsten sicheren Gelegenheit zurück zur Basis.`,
        detail: build.nextItem.reasons[0],
      });
    } else if (plan.buyNow.length > 0 && (plan.buyNowCost >= 800 || me.isDead)) {
      tips.push({
        id: "shop-components",
        priority: me.isDead ? "high" : "medium",
        kind: "shop",
        text: `${me.isDead ? "Jetzt kaufen" : "Beim nächsten Back"}: ${plan.buyNow.map((b) => b.name).join(" + ")} (${fmtGold(plan.buyNowCost)} g)`,
        detail: `Noch ${fmtGold(plan.goldMissing)} g bis ${build.nextItem.name}`,
      });
    }
  }

  // 2) Gegner tot → Objective nehmen
  const deadEnemies = enemies.filter((e) => e.isDead && e.respawnTimer >= 8);
  const available = objectives.filter((o) => o.spawnAt <= s.gameTime);
  if (deadEnemies.length >= 2 && !me.isDead) {
    const maxTimer = Math.max(...deadEnemies.map((e) => e.respawnTimer));
    const target = available.find((o) => o.name === "Baron" || o.name === "Elder-Drache") ?? available[0];
    tips.push({
      id: "enemies-dead",
      priority: "high",
      kind: "macro",
      text: `${deadEnemies.length} Gegner tot (bis zu ${Math.ceil(maxTimer)} s) – ${target ? `jetzt ${target.name} nehmen!` : "Türme pushen!"}`,
      detail: deadEnemies.map((e) => e.championName).join(", "),
    });
  } else {
    const jungler = enemies.find((e) => e.position === "JUNGLE");
    if (jungler?.isDead && jungler.respawnTimer >= 15 && !me.isDead) {
      const dragon = available.find((o) => o.name === "Drache");
      tips.push({
        id: "jungler-dead",
        priority: "medium",
        kind: "macro",
        text: `Gegner-Jungler (${jungler.championName}) ist ${Math.ceil(jungler.respawnTimer)} s tot – ${dragon ? "Drache ist frei!" : "sicher vorrücken & invaden"}`,
      });
    }
  }

  // 3) Objectives in Kürze
  const upcoming = objectives.filter((o) => o.spawnAt - s.gameTime > 0 && o.spawnAt - s.gameTime <= 75);
  if (upcoming.length > 0) {
    const first = upcoming[0]!;
    const together = upcoming.filter((o) => o.spawnAt - first.spawnAt <= 15);
    const big = together.some((o) => o.name === "Baron" || o.name === "Elder-Drache");
    const names = together.map((o) => o.name).join(" & ");
    tips.push({
      id: `obj-${together.map((o) => o.name).join("-")}`,
      priority: big ? "high" : "medium",
      kind: "objective",
      text:
        together.length > 1
          ? `${names} in ${fmtTime(first.spawnAt - s.gameTime)} – eins davon mit dem Team sichern, Wellen vorher pushen.`
          : `${names} in ${fmtTime(first.spawnAt - s.gameTime)} – Wellen pushen, Vision im Fluss setzen, gemeinsam hingehen.`,
    });
  }
  for (const team of [myTeam, enemyTeam] as const) {
    if (s.teams[team].dragons.filter((d) => d !== "Elder").length === 3) {
      tips.push({
        id: `soul-${team}`,
        priority: "high",
        kind: "objective",
        text: team === myTeam ? "Seelenpunkt! Der nächste Drache bringt euch die Seele." : "Gegner auf Seelenpunkt – den nächsten Drachen unbedingt verteidigen!",
      });
    }
  }

  // 4) Gefahren
  if (build && build.enemy.threats.length > 0) {
    tips.push({
      id: "threat",
      priority: "medium",
      kind: "danger",
      text: `Achtung: ${build.enemy.threats.slice(0, 2).join(", ")} – nicht allein splitten, mit Vision bewegen.`,
    });
  }

  // 5) Vorsprung / Rückstand
  if (goldDiff >= 3000) {
    tips.push({ id: "ahead", priority: "info", kind: "macro", text: `Ihr seid ${fmtGold(goldDiff)} g vorne – Objectives forcieren, Vision tief beim Gegner setzen.` });
  } else if (goldDiff <= -3000) {
    tips.push({ id: "behind", priority: "info", kind: "macro", text: `Ihr liegt ${fmtGold(-goldDiff)} g zurück – sicher farmen, nicht facechecken, auf Fehler des Gegners warten.` });
  }

  // 6) Farm
  const target = CS_TARGET[me.position];
  if (target && minutes >= 8) {
    const csMin = me.cs / minutes;
    if (csMin < target - 1) {
      tips.push({ id: "farm", priority: "info", kind: "farm", text: `${csMin.toFixed(1).replace(".", ",")} CS/min – Ziel ${String(target).replace(".", ",")}+: Wellen sauberer farmen, Side-Lanes mitnehmen.` });
    }
  }

  // 7) Vision
  if (minutes >= 10) {
    const perMin = me.wardScore / minutes;
    const low = me.position === "UTILITY" ? 1.1 : 0.35;
    if (perMin < low) {
      tips.push({ id: "vision", priority: "info", kind: "vision", text: "Vision-Score niedrig – Kontroll-Ward (75 g) kaufen und Trinket nutzen." });
    }
  }

  tips.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
  return { build, tips: tips.slice(0, 6), objectives };
}
