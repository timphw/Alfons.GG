import "server-only";
import { verifyCompanionToken, type CompanionTokenPayload } from "@alfons/shared";

export function companionSecret(): string {
  const s = process.env.COMPANION_TOKEN_SECRET;
  if (!s || s === "change-me" || s.length < 16) {
    throw new Error("COMPANION_TOKEN_SECRET fehlt oder ist zu kurz (mind. 16 Zeichen, siehe .env.example)");
  }
  return s;
}

/** Liest und prüft `Authorization: Bearer <token>`. */
export async function authenticateCompanion(req: Request): Promise<CompanionTokenPayload | null> {
  const header = req.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(\S+)$/i);
  if (!match) return null;
  return verifyCompanionToken(match[1]!, companionSecret());
}
