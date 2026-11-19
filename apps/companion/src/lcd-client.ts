import https from "node:https";
import type { AllGameData } from "@alfons/shared";

export type FetchResult =
  | { kind: "ok"; data: AllGameData }
  /** API erreichbar, aber noch keine Daten (Ladebildschirm) */
  | { kind: "loading" }
  /** Kein Spiel offen (Port 2999 nicht erreichbar) */
  | { kind: "offline" };

const LCD_HOST = "127.0.0.1";
const LCD_PORT = 2999;

/**
 * Der League-Client nutzt ein selbstsigniertes Zertifikat (Riot Root CA).
 * Die TLS-Prüfung wird NUR für diesen Agenten (→ 127.0.0.1:2999) deaktiviert,
 * niemals global (kein NODE_TLS_REJECT_UNAUTHORIZED).
 */
const localAgent = new https.Agent({ rejectUnauthorized: false, keepAlive: true, maxSockets: 1 });

export function fetchAllGameData(timeoutMs = 1500): Promise<FetchResult> {
  return new Promise((resolve) => {
    const req = https.request(
      {
        host: LCD_HOST,
        port: LCD_PORT,
        path: "/liveclientdata/allgamedata",
        method: "GET",
        agent: localAgent,
        timeout: timeoutMs,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => {
          if (res.statusCode !== 200) return resolve({ kind: "loading" });
          try {
            const data = JSON.parse(Buffer.concat(chunks).toString("utf8")) as AllGameData;
            if (!Array.isArray(data.allPlayers) || !data.gameData) return resolve({ kind: "loading" });
            resolve({ kind: "ok", data });
          } catch {
            resolve({ kind: "loading" });
          }
        });
      },
    );
    req.on("timeout", () => req.destroy());
    req.on("error", () => resolve({ kind: "offline" }));
    req.end();
  });
}
