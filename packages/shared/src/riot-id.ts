export interface RiotId {
  gameName: string;
  tagLine: string;
}

/**
 * Parst Benutzereingaben wie "Alfons#EUW", "Alfons #EUW" oder den URL-Slug "Alfons-EUW".
 * Taglines bestehen aus 3–5 alphanumerischen Zeichen, daher wird am letzten Trenner gesplittet.
 */
export function parseRiotId(input: string): RiotId | null {
  const raw = safeDecode(input).trim();
  if (!raw) return null;
  let idx = raw.lastIndexOf("#");
  if (idx === -1) idx = raw.lastIndexOf("-");
  if (idx <= 0 || idx === raw.length - 1) return null;
  const gameName = raw.slice(0, idx).trim();
  const tagLine = raw.slice(idx + 1).trim();
  if (gameName.length < 3 || gameName.length > 16) return null;
  if (!/^[\p{L}\p{N}]{2,5}$/u.test(tagLine)) return null;
  return { gameName, tagLine };
}

/** URL-Slug im Stil "Name-Tag" (URL-encodiert). */
export function riotIdToSlug(id: RiotId): string {
  return encodeURIComponent(`${id.gameName}-${id.tagLine}`);
}

export function formatRiotId(id: RiotId): string {
  return `${id.gameName}#${id.tagLine}`;
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}
