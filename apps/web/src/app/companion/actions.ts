"use server";

import { formatRiotId, getRegion, parseRiotId, signPairingCode } from "@alfons/shared";
import { describeRiotError, riot } from "@/lib/riot";
import { companionSecret } from "@/lib/companion-auth";

const PAIRING_TTL_SEC = 10 * 60;

export type PairingResult =
  | { ok: true; code: string; riotId: string; expiresAt: number }
  | { ok: false; error: string };

/** Erzeugt einen signierten, 10 Minuten gültigen Pairing-Code für eine Riot ID. */
export async function createPairingCode(regionSlug: string, riotIdInput: string): Promise<PairingResult> {
  const region = getRegion(regionSlug);
  const id = parseRiotId(riotIdInput);
  if (!region) return { ok: false, error: "Unbekannte Region." };
  if (!id) return { ok: false, error: "Bitte Riot ID im Format Name#Tag eingeben." };
  try {
    const account = await (await riot()).getAccountByRiotId(region.accountRoute, id.gameName, id.tagLine);
    if (!account) return { ok: false, error: "Riot ID nicht gefunden." };
    const riotId = formatRiotId(account);
    const expiresAt = Date.now() + PAIRING_TTL_SEC * 1000;
    const code = await signPairingCode(
      { sub: account.puuid, rid: riotId, reg: region.slug, exp: Math.floor(expiresAt / 1000) },
      companionSecret(),
    );
    return { ok: true, code, riotId, expiresAt };
  } catch (err) {
    return { ok: false, error: describeRiotError(err) };
  }
}
