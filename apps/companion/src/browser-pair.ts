import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { saveConfig } from "./config";
import type { OverlayServer } from "./overlay-server";

export interface PairResult {
  ok: boolean;
  riotId?: string;
  region?: string;
  error?: string;
}

/** Tauscht einen (signierten) Pairing-Code beim Server gegen ein Token und speichert es. */
export async function exchangePairingCode(server: string, code: string): Promise<PairResult> {
  const res = await fetch(new URL("/api/companion/pair", server), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code }),
  }).catch((err: Error) => ({ ok: false, status: 0, json: async () => ({ error: `Server nicht erreichbar: ${err.message}` }) }) as const);
  const body = (await res.json().catch(() => ({}))) as { token?: string; riotId?: string; region?: string; error?: string };
  if (!res.ok || !body.token) return { ok: false, error: body.error ?? `Fehler ${res.status}` };
  saveConfig({ server, token: body.token, riotId: body.riotId, region: body.region });
  return { ok: true, riotId: body.riotId, region: body.region };
}

export function openUrl(url: string) {
  if (process.env.ALFONS_NO_BROWSER) return; // für Tests
  if (process.platform === "win32") spawn("cmd", ["/c", "start", "", url.replace(/&/g, "^&")], { detached: true, stdio: "ignore" }).unref();
  else spawn(process.platform === "darwin" ? "open" : "xdg-open", [url], { detached: true, stdio: "ignore" }).unref();
}

const page = (title: string, text: string, ok: boolean) => `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Alfons.GG</title>
<style>body{background:#0d1220;color:#eef1f7;font:16px system-ui,Segoe UI,sans-serif;display:grid;place-items:center;height:100vh;margin:0}
div{text-align:center;max-width:420px}h1{color:${ok ? "#5fd08a" : "#ef6a6a"};font-size:26px}p{color:#94a0b8}b{color:#e8c36a}</style></head>
<body><div><h1>${title}</h1><p>${text}</p></div></body></html>`;

/**
 * Koppeln per Browser: öffnet /companion/verbinden auf der Website. Nach Klick auf „Verbinden“ leitet
 * die Website zu http://127.0.0.1:<port>/pair?code=…&state=… – der Companion prüft `state`
 * (nur die von ihm selbst geöffnete Seite wird akzeptiert), tauscht den Code und speichert das Token.
 */
export function browserPair(server: string, local: OverlayServer, timeoutMs = 10 * 60_000): Promise<PairResult> {
  const state = randomBytes(16).toString("hex");
  const url = new URL("/companion/verbinden", server);
  url.searchParams.set("port", String(local.port));
  url.searchParams.set("state", state);

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      local.setPairHandler(null);
      resolve({ ok: false, error: "Zeit abgelaufen" });
    }, timeoutMs);

    local.setPairHandler(async (q) => {
      if (q.get("state") !== state) {
        return page("Ungültige Anfrage", "Bitte das Verbinden aus dem Companion-Fenster neu starten.", false);
      }
      const result = await exchangePairingCode(server, q.get("code") ?? "");
      if (!result.ok) return page("Verbinden fehlgeschlagen", `${result.error ?? ""}<br>Lade die Seite neu und versuch es nochmal.`, false);
      clearTimeout(timer);
      local.setPairHandler(null);
      resolve(result);
      return page("✓ Verbunden!", `Der Companion ist jetzt mit <b>${result.riotId}</b> gekoppelt.<br>Du kannst dieses Fenster schließen – viel Erfolg im Spiel!`, true);
    });

    console.log("\n🔗 Verbinden: Dein Browser öffnet sich – Riot ID eingeben und auf „Verbinden“ klicken.");
    console.log(`   Falls nicht: ${url}\n`);
    openUrl(url.toString());
  });
}
