"use server";

import { formatRiotId, generatePairingCode, getRegion, parseRiotId } from "@alfons/shared";
import { describeRiotError, riot } from "@/lib/riot";
import { liveStore } from "@/lib/live-store";

const PAIRING_TTL_SEC = 10 * 60;

export type PairingResult =
  | { ok: true; code: string; riotId: string; expiresAt: number }
  | { ok: false; error: string };

/** Erzeugt einen einmaligen Pairing-Code für eine Riot ID. */
export async function createPairingCode(regionSlug: string, riotIdInput: string): Promise<PairingResult> {
  const region = getRegion(regionSlug);
  const id = parseRiotId(riotIdInput);
  if (!region) return { ok: false, error: "Unbekannte Region." };
  if (!id) return { ok: false, error: "Bitte Riot ID im Format Name#Tag eingeben." };
  try {
    const account = await (await riot()).getAccountByRiotId(region.accountRoute, id.gameName, id.tagLine);
    if (!account) return { ok: false, error: "Riot ID nicht gefunden." };
    const code = generatePairingCode();
    const riotId = formatRiotId(account);
    await liveStore().createPairing(code, { puuid: account.puuid, riotId, region: region.slug }, PAIRING_TTL_SEC);
    return { ok: true, code, riotId, expiresAt: Date.now() + PAIRING_TTL_SEC * 1000 };
  } catch (err) {
    return { ok: false, error: describeRiotError(err) };
  }
}
