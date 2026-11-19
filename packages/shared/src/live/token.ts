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

async function verifySigned(token: string, secret: string): Promise<unknown> {
  const [body, sig, extra] = token.trim().split(".");
  if (!body || !sig || extra !== undefined) return null;
  try {
    const ok = await crypto.subtle.verify("HMAC", await key(secret), fromB64url(sig), enc.encode(body));
    if (!ok) return null;
    return JSON.parse(dec.decode(fromB64url(body)));
  } catch {
    return null;
  }
}

/** Gibt den Payload zurück oder `null`, wenn Signatur/Format ungültig sind. */
export async function verifyCompanionToken(token: string, secret: string): Promise<CompanionTokenPayload | null> {
  const payload = (await verifySigned(token, secret)) as CompanionTokenPayload | null;
  if (!payload || payload.ver !== 1 || typeof payload.sub !== "string") return null;
  return payload;
}

/**
 * Pairing-Code: kurzlebiges, signiertes Token (zustandslos – braucht keinen gemeinsamen Speicher,
 * funktioniert also auch, wenn Website und Pairing-Endpunkt auf verschiedenen Instanzen laufen).
 */
export interface PairingPayload {
  typ: "pair";
  sub: string;
  rid: string;
  reg: string;
  /** Ablauf (epoch s) */
  exp: number;
}

export async function signPairingCode(payload: Omit<PairingPayload, "typ">, secret: string): Promise<string> {
  const body = b64url(enc.encode(JSON.stringify({ typ: "pair", ...payload })));
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", await key(secret), enc.encode(body)));
  return `${body}.${b64url(sig)}`;
}

/** `null` bei ungültiger Signatur, falschem Typ oder abgelaufenem Code. */
export async function verifyPairingCode(code: string, secret: string, nowSec = Date.now() / 1000): Promise<PairingPayload | null> {
  const payload = (await verifySigned(code, secret)) as PairingPayload | null;
  if (!payload || payload.typ !== "pair" || typeof payload.sub !== "string") return null;
  if (typeof payload.exp !== "number" || payload.exp < nowSec) return null;
  return payload;
}
