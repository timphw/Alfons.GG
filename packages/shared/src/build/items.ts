import type { DDChampion, DDItem } from "../ddragon";

/** Was die Build-Engine aus Data Dragon braucht (Teilmenge von StaticData). */
export interface BuildData {
  version?: string;
  items: Record<string, DDItem>;
  /** Schlüssel = numerische Champion-ID als String (wie in StaticData) */
  champions: Record<string, DDChampion>;
}

const SR = "11";

/** Klassisches Kluft-Item, im Shop kaufbar (keine Arena-/Sondermodus-Varianten mit 6-stelligen IDs). */
export function isSummonersRiftItem(id: string, item: DDItem): boolean {
  return (
    Number(id) < 10_000 &&
    item.maps?.[SR] !== false &&
    item.gold.purchasable &&
    item.inStore !== false &&
    !item.requiredChampion &&
    !item.requiredAlly &&
    !item.consumed &&
    !item.tags.includes("Consumable") &&
    !item.tags.includes("Trinket")
  );
}

/** Fertiges legendäres Item (kein weiteres Upgrade, ≥ 2000 Gold, keine Stiefel). */
export function isLegendary(id: string, item: DDItem): boolean {
  return (
    isSummonersRiftItem(id, item) &&
    (!item.into || item.into.length === 0) &&
    item.gold.total >= 2000 &&
    !item.tags.includes("Boots")
  );
}

/** Stufe-2-Stiefel (aus „Stiefel“ gebaut, z.B. Berserkerbeinschienen). */
export function isTier2Boots(id: string, item: DDItem): boolean {
  return isSummonersRiftItem(id, item) && item.tags.includes("Boots") && (item.from ?? []).includes("1001");
}

/** Stufe-3-Stiefel (Upgrade aus Stufe 2) */
export function isTier3Boots(id: string, item: DDItem, items: Record<string, DDItem>): boolean {
  const from = item.from ?? [];
  return isSummonersRiftItem(id, item) && from.length === 1 && !!items[from[0]!] && isTier2Boots(from[0]!, items[from[0]!]!);
}

/** Anti-Heilung (Klaffende Wunden) – feste IDs + Beschreibungstext (de/en) als Fallback. */
const ANTIHEAL_IDS = new Set(["3033", "6609", "3165", "3075", "3011", "3123", "3916", "3076"]);
export function isAntiHeal(id: string, item: DDItem): boolean {
  return ANTIHEAL_IDS.has(id) || /grievous|wound|klaffende wunde/i.test(item.description ?? "");
}

/** Items, von denen man nur eines sinnvoll (bzw. erlaubt) besitzt. */
export const EXCLUSIVE_GROUPS: string[][] = [
  ["3033", "6609", "3165", "3075", "3011"], // Anti-Heilung
  ["3036", "3033"], // Last Whisper
  ["3074", "3748", "6698"], // Hydra
  ["3157", "2420"], // Stasis
  ["3053", "3156", "6673"], // Lebensretter
  ["3078", "3100", "6662", "3508", "2510"], // Spellblade
  ["3003", "3004"], // Mana-Aufladung
  ["3140", "3139", "6035"], // QSS
];

/** Für Gegner mit viel HP/Rüstung: %-Schaden / Penetration */
export const TANK_SHRED_IDS = new Set(["3153", "3036", "6653", "3135", "3071", "6672", "3302", "4645", "3137", "8010"]);
/** Gegen Burst/Assassinen */
export const ANTI_BURST_AD = new Set(["3026", "3814", "6673", "6333", "3156", "3053"]);
export const ANTI_BURST_AP = new Set(["3157", "3102", "2420"]);
export const CLEANSE_IDS = new Set(["3140", "3139"]);

export interface PurchaseStep {
  id: string;
  name: string;
  cost: number;
}

export interface PurchasePlan {
  target: string;
  /** Restkosten des Ziel-Items unter Berücksichtigung bereits gekaufter Komponenten */
  remainingCost: number;
  /** Was mit dem aktuellen Gold jetzt gekauft werden sollte */
  buyNow: PurchaseStep[];
  buyNowCost: number;
  /** Wird das Ziel-Item mit diesem Kauf fertig? */
  completes: boolean;
  /** Gold, das bis zum fertigen Item noch fehlt */
  goldMissing: number;
}

interface Node {
  id: string;
  owned: boolean;
  /** Kosten, um diesen Teilbaum zu vervollständigen */
  cost: number;
  children: Node[];
}

function buildTree(id: string, pool: string[], items: Record<string, DDItem>): Node {
  const idx = pool.indexOf(id);
  if (idx !== -1) {
    pool.splice(idx, 1); // jede Komponente nur einmal verrechnen
    return { id, owned: true, cost: 0, children: [] };
  }
  const item = items[id];
  if (!item) return { id, owned: false, cost: 0, children: [] };
  // Erst die teuersten Komponenten zuordnen (deterministisch)
  const from = [...(item.from ?? [])].sort(
    (a, b) => (items[b]?.gold.total ?? 0) - (items[a]?.gold.total ?? 0) || a.localeCompare(b),
  );
  const children = from.map((c) => buildTree(c, pool, items));
  return { id, owned: false, cost: item.gold.base + children.reduce((s, c) => s + c.cost, 0), children };
}

/**
 * Alle sinnvollen Kauf-Kombinationen eines Teilbaums: entweder den Knoten komplett kaufen
 * oder für jede Komponente rekursiv (inkl. „nichts“) entscheiden. Bäume sind flach (Tiefe ≤ 3),
 * daher ist vollständige Aufzählung günstig; zur Sicherheit begrenzt.
 */
function options(node: Node, gold: number, limit = 4000): Node[][] {
  if (node.owned || node.cost === 0) return [[]];
  const out: Node[][] = [[]];
  if (node.cost <= gold) out.push([node]);
  let combos: Node[][] = [[]];
  for (const child of node.children) {
    const childOpts = options(child, gold, limit);
    const next: Node[][] = [];
    for (const a of combos) {
      for (const b of childOpts) {
        const set = [...a, ...b];
        if (set.reduce((s, n) => s + n.cost, 0) <= gold) next.push(set);
        if (next.length >= limit) break;
      }
      if (next.length >= limit) break;
    }
    combos = next;
  }
  for (const c of combos) if (c.length > 0 && !(c.length === 1 && c[0] === node)) out.push(c);
  return out;
}

/** Bestes Paket: meistes ausgegebenes Gold, dann weniger (= größere) Komponenten, dann ID-Reihenfolge. */
function affordable(node: Node, gold: number): Node[] {
  const sum = (s: Node[]) => s.reduce((t, n) => t + n.cost, 0);
  const key = (s: Node[]) => s.map((n) => n.id).sort().join(",");
  let best: Node[] = [];
  for (const set of options(node, gold)) {
    const d = sum(set) - sum(best) || best.length - set.length || key(best).localeCompare(key(set));
    if (d > 0) best = set;
  }
  return [...best].sort((a, b) => b.cost - a.cost || a.id.localeCompare(b.id));
}

/** Plant den nächsten Einkauf in Richtung `target`. */
export function planPurchase(
  target: string,
  ownedItemIds: Array<string | number>,
  gold: number,
  items: Record<string, DDItem>,
): PurchasePlan {
  const pool = ownedItemIds.map(String);
  const tree = buildTree(target, pool, items);
  const picks = affordable(tree, Math.max(0, Math.floor(gold)));
  const buyNowCost = picks.reduce((s, p) => s + p.cost, 0);
  return {
    target,
    remainingCost: tree.cost,
    buyNow: picks.map((p) => ({ id: p.id, name: items[p.id]?.name ?? p.id, cost: p.cost })),
    buyNowCost,
    completes: picks.length === 1 && picks[0]!.id === target,
    goldMissing: Math.max(0, tree.cost - Math.floor(gold)),
  };
}

export function findChampionById(champions: Record<string, DDChampion>, ddId: string): DDChampion | undefined {
  const norm = ddId.toLowerCase();
  return Object.values(champions).find((c) => c.id.toLowerCase() === norm);
}
