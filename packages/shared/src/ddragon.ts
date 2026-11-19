// Data Dragon: statische Spieldaten (Champions, Items, Spells, Runen, Icons).

export const DDRAGON = "https://ddragon.leagueoflegends.com";

export interface DDImage {
  full: string;
}

export interface DDChampion {
  id: string; // "MonkeyKing"
  key: string; // "62"
  name: string; // "Wukong"
  title: string;
  tags: string[]; // ["Fighter", "Tank"]
  image: DDImage;
  info?: { attack: number; defense: number; magic: number; difficulty: number };
  partype?: string;
}

export interface DDItem {
  name: string;
  description: string;
  plaintext?: string;
  from?: string[];
  into?: string[];
  gold: { base: number; total: number; sell: number; purchasable: boolean };
  tags: string[];
  maps?: Record<string, boolean>;
  depth?: number;
  stats?: Record<string, number>;
  image: DDImage;
  inStore?: boolean;
  requiredChampion?: string;
  requiredAlly?: string;
  consumed?: boolean;
}

export interface DDSummonerSpell {
  id: string;
  key: string;
  name: string;
  image: DDImage;
}

export interface DDRuneStyle {
  id: number;
  key: string;
  name: string;
  icon: string;
  slots: Array<{ runes: Array<{ id: number; key: string; name: string; icon: string; shortDesc: string }> }>;
}

export interface StaticData {
  version: string;
  champions: Record<string, DDChampion>; // key = numerische championId als String
  items: Record<string, DDItem>; // key = itemId
  spells: Record<string, DDSummonerSpell>; // key = numerische Spell-ID
  runes: Record<string, { id: number; name: string; icon: string; styleId: number }>;
  runeStyles: Record<string, DDRuneStyle>;
}

export const ddragonUrl = {
  championIcon: (v: string, championId: string) => `${DDRAGON}/cdn/${v}/img/champion/${championId}.png`,
  championSplash: (championId: string, skin = 0) =>
    `${DDRAGON}/cdn/img/champion/splash/${championId}_${skin}.jpg`,
  itemIcon: (v: string, itemId: number | string) => `${DDRAGON}/cdn/${v}/img/item/${itemId}.png`,
  profileIcon: (v: string, iconId: number) => `${DDRAGON}/cdn/${v}/img/profileicon/${iconId}.png`,
  spellIcon: (v: string, imageFull: string) => `${DDRAGON}/cdn/${v}/img/spell/${imageFull}`,
  runeIcon: (iconPath: string) => `${DDRAGON}/cdn/img/${iconPath}`,
};

/** Rang-Embleme über CommunityDragon. */
export function rankEmblemUrl(tier: string): string {
  return `https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/images/ranked-mini-crests/${tier.toLowerCase()}.svg`;
}

export async function fetchLatestVersion(fetchImpl: typeof fetch = fetch): Promise<string> {
  const res = await fetchImpl(`${DDRAGON}/api/versions.json`);
  if (!res.ok) throw new Error(`versions.json: ${res.status}`);
  const versions = (await res.json()) as string[];
  return versions[0]!;
}

/** Lädt alle benötigten statischen Daten für einen Patch. */
export async function fetchStaticData(
  version: string,
  locale = "de_DE",
  fetchImpl: typeof fetch = fetch,
): Promise<StaticData> {
  const base = `${DDRAGON}/cdn/${version}/data/${locale}`;
  const get = async <T>(file: string): Promise<T> => {
    const res = await fetchImpl(`${base}/${file}`);
    if (!res.ok) throw new Error(`${file}: ${res.status}`);
    return (await res.json()) as T;
  };
  const [champs, items, spells, runes] = await Promise.all([
    get<{ data: Record<string, DDChampion> }>("champion.json"),
    get<{ data: Record<string, DDItem> }>("item.json"),
    get<{ data: Record<string, DDSummonerSpell> }>("summoner.json"),
    get<DDRuneStyle[]>("runesReforged.json"),
  ]);

  const champions: StaticData["champions"] = {};
  for (const c of Object.values(champs.data)) champions[c.key] = c;

  const spellMap: StaticData["spells"] = {};
  for (const s of Object.values(spells.data)) spellMap[s.key] = s;

  const runeMap: StaticData["runes"] = {};
  const runeStyles: StaticData["runeStyles"] = {};
  for (const style of runes) {
    runeStyles[String(style.id)] = style;
    for (const slot of style.slots)
      for (const r of slot.runes) runeMap[String(r.id)] = { id: r.id, name: r.name, icon: r.icon, styleId: style.id };
  }

  return { version, champions, items: items.data, spells: spellMap, runes: runeMap, runeStyles };
}

/** Champion per Name/ID-String finden ("MonkeyKing", "wukong", "Kai'Sa"). */
export function findChampion(data: StaticData, query: string): DDChampion | undefined {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const q = norm(query);
  return Object.values(data.champions).find((c) => norm(c.id) === q || norm(c.name) === q);
}
