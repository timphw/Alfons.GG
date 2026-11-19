// Zustandslose, HMAC-signierte Companion-Tokens (WebCrypto → läuft in Node und im Browser).
// Format: base64url(JSON-Payload) + "." + base64url(HMAC-SHA256)

export interface CompanionTokenPayload {
  /** PUUID des gekoppelten Accounts */
  sub: string;
  /** Riot ID zum Anzeigen */
  rid: string;
  /** Region-Slug */
  reg: string;
  /** issued at (epoch s) */
  iat: number;
  /** Token-Version, erlaubt späteres Widerrufen per Versionssprung */
  ver: 1;
}

const enc = new TextEncoder();
const dec = new TextDecoder();

function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function key(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}

export async function signCompanionToken(payload: CompanionTokenPayload, secret: string): Promise<string> {
  const body = b64url(enc.encode(JSON.stringify(payload)));
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", await key(secret), enc.encode(body)));
  return `${body}.${b64url(sig)}`;
}

/** Gibt den Payload zurück oder `null`, wenn Signatur/Format ungültig sind. */
export async function verifyCompanionToken(token: string, secret: string): Promise<CompanionTokenPayload | null> {
  const [body, sig, extra] = token.split(".");
  if (!body || !sig || extra !== undefined) return null;
  try {
    const ok = await crypto.subtle.verify("HMAC", await key(secret), fromB64url(sig), enc.encode(body));
    if (!ok) return null;
    const payload = JSON.parse(dec.decode(fromB64url(body))) as CompanionTokenPayload;
    if (payload.ver !== 1 || typeof payload.sub !== "string") return null;
    return payload;
  } catch {
    return null;
  }
}

/** 6-stelliger, gut ablesbarer Pairing-Code (ohne 0/O/1/I). */
export function generatePairingCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}
