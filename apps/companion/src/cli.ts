import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { coach, type CoachResult, type LiveSnapshot } from "@alfons/shared";
import { loadConfig, saveConfig, DEFAULT_SERVER } from "./config";
import { LiveSource, ReplaySource, SimulatorSource, type DataSource } from "./sources";
import { GameTracker } from "./tracker";
import { Uploader } from "./uploader";
import { loadBuildData } from "./static-data";
import { TerminalCoach } from "./terminal-coach";
import { OverlayServer, launchIngameOverlay, openOverlayWindow } from "./overlay-server";

const HELP = `Alfons.GG Companion

Befehle:
  pair <CODE> [--server URL]   Mit der Website koppeln (Code von /companion)
  run [Optionen]               Live-Daten lesen und an die Website senden
  status                       Gespeicherte Konfiguration anzeigen
  overlay [--browser]          Ingame-Overlay öffnen (Companion muss laufen); --browser = Edge-Fenster

Optionen für run:
  --mock                Simuliertes Spiel statt echter Live-Daten
  --speed N             Simulations-/Replay-Geschwindigkeit (Standard 1)
  --start MIN           Simulation bei Minute MIN starten
  --replay DATEI        Aufnahme (JSONL) oder gespeichertes allgamedata-JSON abspielen
  --record ORDNER       Rohdaten jedes Polls als JSONL aufnehmen (für Fixtures)
  --interval MS         Poll-Intervall (Standard 1000, min. 500)
  --dry-run             Nichts senden, nur anzeigen
  --server URL          Website-URL überschreiben
  --open-overlay        Ingame-Overlay beim Start öffnen
  --no-overlay          Keinen lokalen Overlay-Server starten
  --overlay-port N      Port des Overlays (Standard 2998)
  --quiet               Keine Coach-Tipps im Terminal

Umgebungsvariablen: ALFONS_SERVER, ALFONS_TOKEN, ALFONS_CONFIG_DIR
`;

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      server: { type: "string" },
      mock: { type: "boolean", default: false },
      speed: { type: "string", default: "1" },
      start: { type: "string" },
      replay: { type: "string" },
      record: { type: "string" },
      interval: { type: "string", default: "1000" },
      "dry-run": { type: "boolean", default: false },
      "open-overlay": { type: "boolean", default: false },
      "no-overlay": { type: "boolean", default: false },
      "overlay-port": { type: "string", default: "2998" },
      quiet: { type: "boolean", default: false },
      browser: { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
  });
  const [command, ...rest] = positionals;

  if (values.help || !command || command === "help") {
    console.log(HELP);
    return;
  }
  if (command === "pair") return pair(rest[0], values.server);
  if (command === "status") return status();
  if (command === "overlay") {
    const url = `http://127.0.0.1:${Number(values["overlay-port"])}/overlay`;
    if (values.browser) return openOverlayWindow(url);
    await launchIngameOverlay(url);
    return;
  }
  if (command === "run") {
    return run({
      server: values.server,
      mock: values.mock,
      speed: Number(values.speed),
      startMin: values.start ? Number(values.start) : undefined,
      replay: values.replay,
      record: values.record,
      intervalMs: Math.max(500, Number(values.interval)),
      dryRun: values["dry-run"],
      overlay: !values["no-overlay"],
      openOverlay: values["open-overlay"],
      overlayPort: Number(values["overlay-port"]),
      quiet: values.quiet,
    });
  }
  console.error(`Unbekannter Befehl: ${command}\n\n${HELP}`);
  process.exitCode = 1;
}

async function pair(code: string | undefined, serverArg?: string) {
  if (!code) {
    console.error("Pairing-Code fehlt: companion pair <CODE>");
    process.exitCode = 1;
    return;
  }
  const server = serverArg ?? loadConfig().server ?? DEFAULT_SERVER;
  const res = await fetch(new URL("/api/companion/pair", server), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code }),
  }).catch((err: Error) => {
    console.error(`Server ${server} nicht erreichbar: ${err.message}`);
    return null;
  });
  if (!res) return void (process.exitCode = 1);
  const body = (await res.json().catch(() => ({}))) as { token?: string; riotId?: string; region?: string; error?: string };
  if (!res.ok || !body.token) {
    console.error(`Pairing fehlgeschlagen: ${body.error ?? res.status}`);
    process.exitCode = 1;
    return;
  }
  const file = saveConfig({ server, token: body.token, riotId: body.riotId, region: body.region });
  console.log(`✓ Gekoppelt mit ${body.riotId} (${body.region?.toUpperCase()}) auf ${server}`);
  console.log(`  Konfiguration: ${file}`);
  console.log(`  Starten mit:   Alfons-Companion-Starten.cmd (oder: node alfons-companion.mjs run)`);
}

function status() {
  const cfg = loadConfig();
  console.log(`Server:  ${cfg.server}`);
  console.log(`Account: ${cfg.riotId ?? "–"} ${cfg.region ? `(${cfg.region.toUpperCase()})` : ""}`);
  console.log(`Token:   ${cfg.token ? "vorhanden" : "fehlt – zuerst `pair` ausführen"}`);
}

interface RunOptions {
  server?: string;
  mock: boolean;
  speed: number;
  startMin?: number;
  replay?: string;
  record?: string;
  intervalMs: number;
  dryRun: boolean;
  overlay: boolean;
  openOverlay: boolean;
  overlayPort: number;
  quiet: boolean;
}

async function run(opts: RunOptions) {
  const cfg = loadConfig();
  const server = opts.server ?? cfg.server!;
  if (!cfg.token && !opts.dryRun) {
    console.error("Nicht gekoppelt. Öffne /companion auf der Website und führe den angezeigten pair-Befehl aus.");
    process.exitCode = 1;
    return;
  }

  const source: DataSource = opts.replay
    ? new ReplaySource(opts.replay, opts.speed)
    : opts.mock
      ? new SimulatorSource(opts.speed, { startAt: opts.startMin ? opts.startMin * 60 : undefined })
      : new LiveSource();
  const uploader = cfg.token ? new Uploader(server, cfg.token) : null;
  const tracker = new GameTracker();
  let recordFile: string | null = null;

  console.log(`Alfons.GG Companion → ${opts.dryRun ? "(dry-run)" : server}`);
  console.log(`Quelle: ${source.label}`);
  if (cfg.riotId) console.log(`Account: ${cfg.riotId}`);

  // Lokale Build-Engine + Overlay (funktionieren auch ohne Website/Redis)
  const buildData = await loadBuildData();
  if (!buildData) console.warn("⚠ Data Dragon nicht erreichbar – keine Build-Tipps.");
  const terminalCoach = opts.quiet ? null : new TerminalCoach();
  let overlay: OverlayServer | null = null;
  if (opts.overlay) {
    overlay = new OverlayServer(opts.overlayPort);
    try {
      await overlay.listen();
      console.log(`Overlay: ${overlay.url}   (Fenster öffnen: node alfons-companion.mjs overlay)`);
      if (opts.openOverlay) void launchIngameOverlay(overlay.url);
    } catch (err) {
      console.warn(`⚠ Overlay-Port ${opts.overlayPort} belegt (${(err as Error).message}) – Overlay aus.`);
      overlay = null;
    }
  }
  const analyze = (s: LiveSnapshot): CoachResult | null => {
    if (!buildData) return null;
    try {
      return coach(s, buildData);
    } catch {
      return null;
    }
  };
  const show = (s: LiveSnapshot) => {
    const c = analyze(s);
    overlay?.update({ status: s.status, version: buildData?.version, snapshot: s, coach: c });
    if (s.status === "in-game") terminalCoach?.print(s, c);
  };

  console.log("Warte auf Spiel ... (Strg+C zum Beenden)\n");

  let lastLog = 0;
  let stopped = false;
  const quit = () => {
    stopped = true;
    console.log("\nBeendet.");
    process.exit(0); // löst "exit" aus → Overlay wird mit beendet
  };
  process.on("SIGINT", quit);
  process.on("SIGTERM", quit);
  process.on("SIGHUP", quit); // Konsolenfenster geschlossen (Windows)

  while (!stopped) {
    const started = Date.now();
    const result = await source.poll();

    if (opts.record && result.kind === "ok") {
      if (!recordFile) {
        mkdirSync(opts.record, { recursive: true });
        recordFile = join(opts.record, `game-${new Date().toISOString().replace(/[:.]/g, "-")}.jsonl`);
        console.log(`● Aufnahme: ${recordFile}`);
      }
      appendFileSync(recordFile, JSON.stringify({ t: Date.now(), data: result.data }) + "\n");
    }

    const ev = tracker.update(result);
    switch (ev.type) {
      case "game-start":
        console.log(`▶ Spiel erkannt (${ev.snapshot.gameMode}, ${fmtTime(ev.snapshot.gameTime)})`);
        show(ev.snapshot);
        await upload(ev.snapshot, true);
        break;
      case "snapshot": {
        show(ev.snapshot);
        const r = await upload(ev.snapshot);
        if (Date.now() - lastLog > 15000) {
          lastLog = Date.now();
          console.log(statusLine(ev.snapshot, r));
        }
        break;
      }
      case "game-end":
        console.log(`■ Spielende: ${ev.snapshot.result === "Win" ? "Sieg 🎉" : "Niederlage"}`);
        show(ev.snapshot);
        await upload(ev.snapshot, true);
        recordFile = null;
        break;
      case "game-lost":
        console.log("■ Spiel nicht mehr erreichbar (beendet/abgestürzt). Warte auf nächstes Spiel ...");
        overlay?.update({ status: "waiting" });
        recordFile = null;
        break;
    }

    const wait = (tracker.current === "in-game" ? opts.intervalMs : Math.max(opts.intervalMs, 2000)) - (Date.now() - started);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  }

  async function upload(snapshot: LiveSnapshot, force = false) {
    if (opts.dryRun || !uploader) return "dry-run";
    const r = await uploader.send(snapshot, force);
    if (r === "unauthorized") {
      console.error("✗ Token ungültig – bitte auf /companion neu koppeln.");
      process.exit(1);
    }
    return r;
  }
}

function fmtTime(sec: number) {
  const s = Math.floor(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function statusLine(s: LiveSnapshot, upload: string) {
  const me = s.players.find((p) => p.riotId === s.activePlayer?.riotId);
  const kda = me ? `${me.kills}/${me.deaths}/${me.assists} · ${me.cs} CS` : "";
  const gold = s.activePlayer ? `${s.activePlayer.currentGold}g` : "";
  const score = `${s.teams.ORDER.kills}:${s.teams.CHAOS.kills}`;
  const mark = upload === "ok" ? "✓" : upload === "skipped" ? "·" : upload === "dry-run" ? "–" : `✗ ${upload}`;
  return `${fmtTime(s.gameTime).padStart(6)} │ ${me?.championName ?? "?"} ${kda} │ ${gold} │ Kills ${score} │ ${mark}`;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
