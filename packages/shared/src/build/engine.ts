import type { DDChampion, DDItem } from "../ddragon";
import {
  ANTI_BURST_AD,
  ANTI_BURST_AP,
  CLEANSE_IDS,
  EXCLUSIVE_GROUPS,
  TANK_SHRED_IDS,
  findChampionById,
  isAntiHeal,
  isLegendary,
  isTier2Boots,
  planPurchase,
  type BuildData,
  type PurchasePlan,
} from "./items";

/**
 * Regelbasierte, deterministische Build-Engine.
 *
 * 1. Archetyp des eigenen Champions (Data-Dragon-Tags + info) → Grundgewichte pro Item-Tag
 * 2. Optionale Statistik-Basis (Core-Items aus High-Elo, Phase 4b) als Bonus
 * 3. Situative Regeln auf Basis des Gegnerteams und des Spielstands, jeweils mit Begründung
 * 4. Ausgabe: Reihenfolge, nächstes volles Item, nächster Kauf mit aktuellem Gold
 */

export type Style =
  | "marksman" | "mage" | "assassin" | "fighter" | "ap-fighter" | "tank" | "enchanter" | "support-tank";

export interface BuildPlayer {
  /** Data-Dragon-ID, z.B. "MonkeyKing" */
  champion: string;
  items: number[];
  kills: number;
  deaths: number;
  assists: number;
  level: number;
  position?: string;
}

export interface BuildInput {
  me: BuildPlayer;
  /** Verfügbares Gold des aktiven Spielers */
  gold: number;
  gameTime: number;
  enemies: BuildPlayer[];
  /** Positive Werte = eigenes Team vorne (z.B. Item-Gold-Differenz) */
  teamGoldDiff: number;
  /** Optional: Statistik-Basis – Item-IDs in empfohlener Reihenfolge */
  coreItems?: string[];
}

export interface ItemRecommendation {
  id: string;
  name: string;
  cost: number;
  score: number;
  reasons: string[];
}

export interface EnemyProfile {
  apShare: number;
  healers: string[];
  tanks: string[];
  threats: string[];
  suppressors: string[];
}

export interface BuildRecommendation {
  champion: string;
  style: Style;
  damage: "AD" | "AP";
  enemy: EnemyProfile;
  /** Empfohlene Reihenfolge der nächsten vollen Items */
  items: ItemRecommendation[];
  nextItem: ItemRecommendation | null;
  nextPurchase: PurchasePlan | null;
}

// ---- Archetypen ---------------------------------------------------------------------------------

type Weights = Partial<Record<string, number>>;

const STYLE_WEIGHTS: Record<Style, Weights> = {
  marksman: { CriticalStrike: 3, AttackSpeed: 2.5, Damage: 2.5, OnHit: 1.5, LifeSteal: 1, ArmorPenetration: 1, NonbootsMovement: 0.5, SpellDamage: -3, Mana: -1, ManaRegen: -2, Aura: -1, Health: -0.5, Armor: 0.3 },
  mage: { SpellDamage: 3, MagicPenetration: 1.8, AbilityHaste: 1.5, Mana: 1, Health: 0.3, Damage: -3, CriticalStrike: -3, AttackSpeed: -1.5, OnHit: -1, LifeSteal: -1 },
  assassin: { Damage: 3, ArmorPenetration: 3, AbilityHaste: 1.5, NonbootsMovement: 1, Active: 0.5, Health: 0.3, CriticalStrike: -1, AttackSpeed: -1, SpellDamage: -3, Mana: -1, ManaRegen: -2 },
  fighter: { Damage: 2.5, Health: 2, AbilityHaste: 1.5, LifeSteal: 0.8, SpellVamp: 0.6, ArmorPenetration: 0.8, Armor: 0.5, SpellBlock: 0.5, Tenacity: 0.5, OnHit: 0.4, SpellDamage: -3, CriticalStrike: -2, ManaRegen: -2, Mana: -0.5 },
  "ap-fighter": { SpellDamage: 3, Health: 2, AbilityHaste: 1, SpellVamp: 1, MagicPenetration: 1, Armor: 0.5, SpellBlock: 0.5, Damage: -2, CriticalStrike: -3, ManaRegen: -1 },
  tank: { Health: 3, Armor: 2, SpellBlock: 2, AbilityHaste: 1, Aura: 1, Slow: 0.5, HealthRegen: 0.5, Tenacity: 0.5, Damage: -2, SpellDamage: -1.5, CriticalStrike: -3, AttackSpeed: -1 },
  enchanter: { ManaRegen: 2.5, AbilityHaste: 1.5, SpellDamage: 1.2, Health: 1, Active: 1, Aura: 1, NonbootsMovement: 0.5, Damage: -3, CriticalStrike: -3, AttackSpeed: -1, ArmorPenetration: -2 },
  "support-tank": { Health: 2, Armor: 1.5, SpellBlock: 1.5, Aura: 2, Active: 1.5, AbilityHaste: 1, Damage: -2, SpellDamage: -1, CriticalStrike: -3, AttackSpeed: -1 },
};

/** Ignorierte Doppel-Tags (CooldownReduction ≙ AbilityHaste, MagicResist ≙ SpellBlock) */
const IGNORED_TAGS = new Set(["CooldownReduction", "MagicResist", "Lane", "Jungle", "GoldPer", "Vision", "Stealth"]);

const OFFENSIVE_TAGS = new Set(["Damage", "SpellDamage", "CriticalStrike", "AttackSpeed", "ArmorPenetration", "MagicPenetration", "OnHit"]);
const DEFENSIVE_TAGS = new Set(["Health", "Armor", "SpellBlock", "HealthRegen", "Tenacity"]);

export function classifyChampion(champ: DDChampion, position?: string): { style: Style; damage: "AD" | "AP" } {
  const [primary, secondary] = champ.tags;
  const info = champ.info ?? { attack: 5, magic: 5, defense: 5, difficulty: 5 };
  const damage: "AD" | "AP" = info.magic > info.attack ? "AP" : "AD";
  const isSupport = position === "UTILITY" || primary === "Support";

  if (primary === "Marksman") return { style: "marksman", damage: "AD" };
  if (isSupport) {
    if (primary === "Tank" || secondary === "Tank" || (info.defense >= 6 && damage === "AD"))
      return { style: "support-tank", damage };
    if (primary === "Support" && (secondary === "Mage" || damage === "AP")) return { style: "enchanter", damage: "AP" };
    if (primary === "Mage") return { style: "mage", damage: "AP" };
    return { style: "support-tank", damage };
  }
  if (primary === "Tank") return { style: "tank", damage };
  if (primary === "Mage" || (primary === "Assassin" && damage === "AP")) return { style: "mage", damage: "AP" };
  if (primary === "Assassin") return { style: "assassin", damage: "AD" };
  if (primary === "Fighter") return damage === "AP" ? { style: "ap-fighter", damage } : { style: "fighter", damage };
  return damage === "AP" ? { style: "mage", damage } : { style: "fighter", damage };
}

// ---- Gegneranalyse ------------------------------------------------------------------------------

/** Champions mit starker Eigenheilung/Teamheilung */
const HEALER_CHAMPS = new Set([
  "Soraka", "Yuumi", "Sona", "Nami", "Milio", "Seraphine", "Senna", "Taric", "Renata", "Aatrox", "Warwick",
  "Vladimir", "Sylas", "DrMundo", "Swain", "Fiddlesticks", "Briar", "Olaf", "Illaoi", "Volibear", "Maokai",
  "Fiora", "Nidalee", "Ivern", "Zac", "Trundle", "Gwen", "Nasus", "Samira", "Belveth", "Briar",
]);
/** Point-and-click-Suppressions/Hard-CC → QSS */
const SUPPRESSORS = new Set(["Malzahar", "Skarner", "Warwick", "Urgot", "Mordekaiser"]);

export function analyzeEnemies(enemies: BuildPlayer[], data: BuildData): EnemyProfile {
  let apWeighted = 0;
  let total = 0;
  const healers: string[] = [];
  const tanks: string[] = [];
  const threats: string[] = [];
  const suppressors: string[] = [];

  for (const e of enemies) {
    const champ = findChampionById(data.champions, e.champion);
    const name = champ?.name ?? e.champion;
    const info = champ?.info ?? { attack: 5, magic: 5, defense: 5, difficulty: 5 };
    const items = e.items.map((id) => data.items[String(id)]).filter((i): i is DDItem => !!i);

    // Schadensprofil: Grundwerte des Champions, verschoben durch gekaufte Items
    let ap = info.magic / Math.max(1, info.magic + info.attack);
    const apItems = items.filter((i) => i.tags.includes("SpellDamage")).length;
    const adItems = items.filter((i) => i.tags.includes("Damage") || i.tags.includes("CriticalStrike")).length;
    if (apItems + adItems > 0) ap = 0.5 * ap + 0.5 * (apItems / (apItems + adItems));
    const isTankChamp = champ?.tags[0] === "Tank";
    const threat = (isTankChamp ? 0.6 : 1) * (1 + e.kills * 0.3 + e.assists * 0.1) * (0.5 + e.level / 18);
    apWeighted += ap * threat;
    total += threat;

    // Nur fertige Items zählen (Doran's Klinge o.ä. hat zwar Lebensraub, ist aber keine relevante Heilung)
    const healsByItems = items.some((i) => i.gold.total >= 2000 && (i.tags.includes("LifeSteal") || i.tags.includes("SpellVamp")));
    if (HEALER_CHAMPS.has(e.champion) || healsByItems) healers.push(name);

    const tankyItems = items.filter((i) => i.tags.includes("Armor") || (i.tags.includes("Health") && i.tags.includes("SpellBlock"))).length;
    if (isTankChamp || (champ?.tags.includes("Tank") && tankyItems >= 1) || tankyItems >= 2) tanks.push(name);

    const assassin = champ?.tags[0] === "Assassin";
    if ((assassin && e.kills >= 3 && e.kills > e.deaths) || e.kills - e.deaths >= 4) threats.push(`${name} (${e.kills}/${e.deaths}/${e.assists})`);

    if (SUPPRESSORS.has(e.champion)) suppressors.push(name);
  }
  return { apShare: total > 0 ? apWeighted / total : 0.5, healers, tanks, threats, suppressors };
}

// ---- Scoring ------------------------------------------------------------------------------------

function baseScore(item: DDItem, weights: Weights): number {
  const tags = item.tags.filter((t) => !IGNORED_TAGS.has(t));
  if (tags.length === 0) return 0;
  const sum = tags.reduce((s, t) => s + (weights[t] ?? 0), 0);
  return sum / Math.sqrt(tags.length);
}

const fmtPct = (x: number) => `${Math.round(x * 100)} %`;
const fmtGold = (g: number) => (Math.abs(g) >= 1000 ? `${(Math.abs(g) / 1000).toFixed(1).replace(".", ",")}k` : String(Math.abs(Math.round(g))));
const list = (names: string[]) => names.slice(0, 3).join(", ") + (names.length > 3 ? " …" : "");

interface Candidate {
  id: string;
  item: DDItem;
  score: number;
  reasons: string[];
}

export function recommendBuild(input: BuildInput, data: BuildData): BuildRecommendation | null {
  const champ = findChampionById(data.champions, input.me.champion);
  if (!champ) return null;
  const { style, damage } = classifyChampion(champ, input.me.position);
  const weights = STYLE_WEIGHTS[style];
  const enemy = analyzeEnemies(input.enemies, data);
  const owned = new Set(input.me.items.map(String));
  const ownedLegendaries = [...owned].filter((id) => data.items[id] && isLegendary(id, data.items[id]!)).length;
  const hasBoots = [...owned].some((id) => {
    const it = data.items[id];
    return !!it && it.tags.includes("Boots") && id !== "1001";
  });
  const hasAntiHeal = [...owned].some((id) => data.items[id] && isAntiHeal(id, data.items[id]!) && (data.items[id]!.gold.total >= 2000));
  const blockedGroups = EXCLUSIVE_GROUPS.filter((g) => g.some((id) => owned.has(id)));
  const blocked = new Set(blockedGroups.flat());

  const adShare = 1 - enemy.apShare;
  const lead = input.teamGoldDiff + (input.me.kills - input.me.deaths) * 150;

  const candidates: Candidate[] = [];
  for (const [id, item] of Object.entries(data.items)) {
    if (owned.has(id) || blocked.has(id)) continue;
    if (!isLegendary(id, item)) continue;
    let score = baseScore(item, weights);
    const reasons: string[] = [];
    const tags = new Set(item.tags);
    const offensive = item.tags.some((t) => OFFENSIVE_TAGS.has(t) && (weights[t] ?? 0) > 0);
    // Nur Items, die grundsätzlich zum Archetyp passen, bekommen situative Boni
    if (score < 0.8) {
      candidates.push({ id, item, score, reasons });
      continue;
    }

    // Statistik-Basis (Phase 4b)
    const coreIdx = input.coreItems?.indexOf(id) ?? -1;
    if (coreIdx !== -1) {
      score += 3 - coreIdx * 0.4;
      reasons.push("Häufiges Core-Item in High-Elo");
    }

    // Schadensprofil → Resistenzen
    if (enemy.apShare >= 0.6 && tags.has("SpellBlock")) {
      score += 3 * (enemy.apShare - 0.45);
      reasons.push(`Gegner macht ~${fmtPct(enemy.apShare)} magischen Schaden`);
    }
    if (adShare >= 0.6 && tags.has("Armor")) {
      score += 3 * (adShare - 0.45);
      reasons.push(`Gegner macht ~${fmtPct(adShare)} physischen Schaden`);
    }

    // Heilung → Klaffende Wunden
    if (!hasAntiHeal && enemy.healers.length >= 2 && isAntiHeal(id, item)) {
      score += 1.2 + enemy.healers.length * 0.8;
      reasons.push(`Gegner hat ${enemy.healers.length} Heiler (${list(enemy.healers)}) → Klaffende Wunden`);
    }

    // Tanks → Penetration / %-Schaden
    if (enemy.tanks.length >= 2 && offensive) {
      const pen = damage === "AD" ? tags.has("ArmorPenetration") : tags.has("MagicPenetration");
      if (pen || TANK_SHRED_IDS.has(id)) {
        score += 1 + enemy.tanks.length * 0.5 + (TANK_SHRED_IDS.has(id) ? 0.8 : 0);
        reasons.push(`${enemy.tanks.length} Tanks im Gegnerteam (${list(enemy.tanks)}) → ${pen ? "Penetration" : "%-Schaden"}`);
      }
    }

    // Burst/Assassinen → Überleben
    const antiBurst = damage === "AP" ? ANTI_BURST_AP.has(id) : ANTI_BURST_AD.has(id);
    if (enemy.threats.length > 0 && antiBurst && style !== "tank" && style !== "support-tank") {
      score += 1.5 + enemy.threats.length * 0.7;
      reasons.push(`Gefährlich: ${list(enemy.threats)} → Schutz gegen Burst`);
    }
    if (enemy.suppressors.length > 0 && CLEANSE_IDS.has(id) && (style === "marksman" || style === "assassin")) {
      score += 2.5;
      reasons.push(`${list(enemy.suppressors)} hat Unterdrückung → QSS`);
    }

    // Vorsprung / Rückstand
    if (lead >= 2000 && offensive) {
      score += Math.min(1.5, lead / 3000);
      reasons.push(`Ihr seid ~${fmtGold(lead)} Gold vorne → Schaden ausbauen`);
    } else if (lead <= -2000 && item.tags.some((t) => DEFENSIVE_TAGS.has(t))) {
      score += Math.min(1.5, -lead / 3000);
      reasons.push(`Ihr liegt ~${fmtGold(lead)} Gold zurück → mehr Überleben`);
    }

    // Früh im Spiel günstigere Items leicht bevorzugen
    if (input.gameTime < 20 * 60) score -= (item.gold.total - 2500) / 2500;

    candidates.push({ id, item, score, reasons });
  }

  candidates.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));

  // Reihenfolge unter Beachtung exklusiver Gruppen
  const picked: Candidate[] = [];
  const pickedGroups = new Set<number>();
  for (const c of candidates) {
    if (picked.length >= 5) break;
    if (c.score <= 0) break;
    const g = EXCLUSIVE_GROUPS.findIndex((grp) => grp.includes(c.id));
    if (g !== -1 && pickedGroups.has(g)) continue;
    if (g !== -1) pickedGroups.add(g);
    if (c.reasons.length === 0) c.reasons.push(defaultReason(style));
    picked.push(c);
  }

  // Stiefel: nach dem ersten Item (oder spätestens ab Minute 12) einplanen
  if (!hasBoots && data.items["1001"]) {
    const boots = chooseBoots(style, damage, enemy, data);
    if (boots) {
      const pos = ownedLegendaries >= 1 || input.gameTime > 12 * 60 ? 0 : 1;
      picked.splice(Math.min(pos, picked.length), 0, boots);
    }
  }

  const items: ItemRecommendation[] = picked.slice(0, 6).map((c) => ({
    id: c.id,
    name: c.item.name,
    cost: c.item.gold.total,
    score: Math.round(c.score * 100) / 100,
    reasons: c.reasons,
  }));
  const nextItem = items[0] ?? null;
  const nextPurchase = nextItem ? planPurchase(nextItem.id, input.me.items, input.gold, data.items) : null;

  return { champion: champ.name, style, damage, enemy, items, nextItem, nextPurchase };
}

function chooseBoots(style: Style, damage: "AD" | "AP", enemy: EnemyProfile, data: BuildData): Candidate | null {
  const adShare = 1 - enemy.apShare;
  let id: string;
  let reason: string;
  if (enemy.apShare >= 0.62 || enemy.suppressors.length > 0) {
    id = "3111";
    reason = enemy.suppressors.length > 0 ? "Viel Crowd-Control beim Gegner → Zähigkeit" : `Gegner macht ~${fmtPct(enemy.apShare)} magischen Schaden`;
  } else if (adShare >= 0.62 && style !== "mage" && style !== "enchanter") {
    id = "3047";
    reason = `Gegner macht ~${fmtPct(adShare)} physischen Schaden`;
  } else if (style === "marksman") {
    id = "3006";
    reason = "Standard für Schützen (Angriffstempo)";
  } else if (style === "mage" || damage === "AP") {
    id = "3020";
    reason = "Standard für Magier (Magiedurchdringung)";
  } else if (style === "enchanter" || style === "assassin") {
    id = "3158";
    reason = "Fähigkeitstempo";
  } else {
    id = adShare >= 0.5 ? "3047" : "3111";
    reason = adShare >= 0.5 ? "Mehr physischer Schaden beim Gegner" : "Mehr magischer Schaden beim Gegner";
  }
  const item = data.items[id];
  if (!item || !isTier2Boots(id, item)) return null;
  return { id, item, score: 0, reasons: [reason] };
}

function defaultReason(style: Style): string {
  const label: Record<Style, string> = {
    marksman: "Schützen", mage: "Magier", assassin: "Assassinen", fighter: "Kämpfer",
    "ap-fighter": "AP-Kämpfer", tank: "Tanks", enchanter: "Verzauberer", "support-tank": "Tank-Supports",
  };
  return `Passt zu ${label[style]}`;
}
