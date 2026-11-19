// Einfacher Zugangsschutz per gemeinsamem Code (ACCESS_CODE). Läuft im Proxy und in Server Actions.

export const ACCESS_COOKIE = "alfons_access";

/** Cookie-Wert: SHA-256 aus Code + Secret – der Code selbst steht nie im Cookie. */
export async function accessToken(code: string): Promise<string> {
  const secret = process.env.COMPANION_TOKEN_SECRET ?? "";
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${code}:${secret}`));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function accessEnabled(): boolean {
  return !!process.env.ACCESS_CODE;
}

export async function hasAccess(cookieValue: string | undefined): Promise<boolean> {
  const code = process.env.ACCESS_CODE;
  if (!code) return true;
  if (!cookieValue) return false;
  return timingSafeEqual(cookieValue, await accessToken(code));
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
