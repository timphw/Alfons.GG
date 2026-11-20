import http from "node:http";
import { spawn, type ChildProcess } from "node:child_process";
import { createHash } from "node:crypto";
import { createWriteStream, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { CONFIG_DIR } from "./config";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { CoachResult, LiveSnapshot } from "@alfons/shared";

export interface OverlayState {
  status: "waiting" | "in-game" | "ended";
  version?: string;
  snapshot?: LiveSnapshot;
  coach?: CoachResult | null;
}

/**
 * Lokaler Overlay-Server (nur 127.0.0.1): liefert eine kompakte Overlay-Seite und streamt den
 * Spielstand per SSE. Läuft komplett auf dem Spieler-PC – kein Internet/Redis nötig.
 * Kein Eingriff ins Spiel: eigenes Fenster, das nur bereits sichtbare Daten zeigt.
 */
export class OverlayServer {
  private clients = new Set<http.ServerResponse>();
  private pairHandler: ((q: URLSearchParams) => Promise<string>) | null = null;
  private state: OverlayState = { status: "waiting" };
  private server: http.Server;

  constructor(readonly port: number) {
    this.server = http.createServer((req, res) => {
      const url = new URL(req.url ?? "/", "http://127.0.0.1");
      if (url.pathname === "/events") {
        res.writeHead(200, {
          "content-type": "text/event-stream; charset=utf-8",
          "cache-control": "no-cache",
          connection: "keep-alive",
        });
        res.write(`retry: 1000\n\ndata: ${JSON.stringify(this.state)}\n\n`);
        this.clients.add(res);
        req.on("close", () => this.clients.delete(res));
        return;
      }
      if (url.pathname === "/pair") {
        if (!this.pairHandler) {
          res.writeHead(409, { "content-type": "text/plain; charset=utf-8" }).end("Kein Verbindungsvorgang aktiv.");
          return;
        }
        void this.pairHandler(url.searchParams).then((html) => {
          res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
          res.end(html);
        });
        return;
      }
      if (url.pathname === "/" || url.pathname === "/overlay") {
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        res.end(OVERLAY_HTML);
        return;
      }
      res.writeHead(404).end();
    });
    setInterval(() => {
      for (const c of this.clients) c.write(": ping\n\n");
    }, 15_000).unref();
  }

  listen(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.once("error", reject);
      this.server.listen(this.port, "127.0.0.1", () => resolve());
    });
  }

  /** Aktiviert den einmaligen /pair-Endpunkt fürs Koppeln per Browser */
  setPairHandler(fn: ((q: URLSearchParams) => Promise<string>) | null) {
    this.pairHandler = fn;
  }

  close() {
    this.server.close();
  }

  get url() {
    return `http://127.0.0.1:${this.port}/overlay`;
  }

  update(state: OverlayState) {
    this.state = state;
    const msg = `data: ${JSON.stringify(state)}\n\n`;
    for (const c of this.clients) c.write(msg);
  }
}

const ELECTRON_VERSION = "33.2.1";

/** Pfad zum Electron-Hauptprozess: neben dem Bundle (Download) oder im Quellordner (Entwicklung). */
function overlayMainPath(): string | null {
  const here = dirname(fileURLToPath(import.meta.url));
  for (const p of [join(here, "alfons-overlay.cjs"), join(here, "..", "overlay", "main.cjs")]) if (existsSync(p)) return p;
  return null;
}

/**
 * Stellt Electron unter ~/.alfons-gg/overlay-runtime/electron-v<version>/ bereit (einmalig ~110 MB).
 * Lädt das offizielle Release-ZIP von GitHub, prüft die SHA-256-Summe gegen Electrons SHASUMS256.txt
 * und entpackt mit dem in Windows eingebauten tar. Ohne npm (dessen Install-Skript-Sperre und der
 * Electron-Installer machen unter neueren Node-Versionen Probleme).
 */
async function ensureElectron(): Promise<string | null> {
  if (process.platform !== "win32") return null; // Overlay aktuell nur für Windows
  const arch = process.arch === "arm64" ? "arm64" : "x64";
  const name = `electron-v${ELECTRON_VERSION}-win32-${arch}`;
  const dir = join(CONFIG_DIR, "overlay-runtime", name);
  const exe = join(dir, "electron.exe");
  if (existsSync(exe)) return exe;

  const base = `https://github.com/electron/electron/releases/download/v${ELECTRON_VERSION}`;
  try {
    const sums = await (await fetch(`${base}/SHASUMS256.txt`)).text();
    const expected = sums.split(/\r?\n/).find((l) => l.endsWith(`*${name}.zip`) || l.endsWith(` ${name}.zip`))?.split(" ")[0];
    if (!expected) throw new Error("Prüfsumme nicht gefunden");

    mkdirSync(dir, { recursive: true });
    const zip = join(dir, "..", `${name}.zip`);
    const fileHash = () => createHash("sha256").update(readFileSync(zip)).digest("hex");

    // Bereits geladenes ZIP (z.B. nach abgebrochenem Entpacken) wiederverwenden
    if (!existsSync(zip) || fileHash() !== expected) {
      console.log(`  Lade Electron ${ELECTRON_VERSION} (einmalig, ~110 MB) …`);
      const res = await fetch(`${base}/${name}.zip`);
      if (!res.ok || !res.body) throw new Error(`Download fehlgeschlagen (${res.status})`);
      const total = Number(res.headers.get("content-length") ?? 0);
      const hash = createHash("sha256");
      const out = createWriteStream(zip);
      let done = 0;
      let lastPct = -10;
      for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
        hash.update(chunk);
        done += chunk.length;
        if (!out.write(chunk)) await new Promise<void>((r) => out.once("drain", () => r()));
        const pct = total ? Math.floor((done / total) * 100) : 0;
        if (pct >= lastPct + 10) {
          lastPct = pct;
          process.stdout.write(`  … ${pct} %\r`);
        }
      }
      await new Promise<void>((r, j) => out.end((err?: Error | null) => (err ? j(err) : r())));
      if (hash.digest("hex") !== expected) {
        rmSync(zip, { force: true });
        throw new Error("Prüfsumme stimmt nicht – Download verworfen");
      }
    }

    // Windows-eigenes tar (bsdtar, kann ZIP) – nicht ein evtl. vorhandenes GNU-tar aus Git Bash
    const sys32 = join(process.env.SystemRoot ?? "C:\\Windows", "System32");
    const exec = (cmd: string, args: string[]) =>
      new Promise<number>((resolve) => {
        const p = spawn(cmd, args, { stdio: "ignore", windowsHide: true });
        p.on("exit", (c) => resolve(c ?? 1));
        p.on("error", () => resolve(1));
      });
    let code = await exec(join(sys32, "tar.exe"), ["-xf", zip, "-C", dir]);
    if (code !== 0 || !existsSync(exe)) {
      code = await exec(join(sys32, "WindowsPowerShell", "v1.0", "powershell.exe"), [
        "-NoProfile",
        "-Command",
        `Expand-Archive -LiteralPath '${zip.replace(/'/g, "''")}' -DestinationPath '${dir.replace(/'/g, "''")}' -Force`,
      ]);
    }
    if (!existsSync(exe)) throw new Error("Entpacken fehlgeschlagen");
    rmSync(zip, { force: true });
    console.log("  Electron bereit.            ");
    return exe;
  } catch (err) {
    console.warn(`  ${(err as Error).message}`);
    return null;
  }
}

/**
 * Startet das echte Ingame-Overlay (Electron: transparent, immer im Vordergrund, klick-durchlässig).
 * Fallback: Edge-App-Fenster.
 */
export async function launchIngameOverlay(url: string): Promise<ChildProcess | null> {
  const main = overlayMainPath();
  if (!main) {
    console.warn("⚠ alfons-overlay.cjs nicht gefunden (muss neben alfons-companion.mjs liegen) – öffne Browser-Fenster.");
    openOverlayWindow(url);
    return null;
  }
  console.log("◆ Ingame-Overlay startet …");
  const exe = await ensureElectron();
  if (!exe) {
    console.warn("⚠ Electron konnte nicht installiert werden – öffne stattdessen ein Browser-Fenster.");
    openOverlayWindow(url);
    return null;
  }
  console.log("  Strg+Shift+O = verschieben/bearbeiten · Strg+Shift+H = ein/aus · Strg+Shift+Q = beenden");
  const env: NodeJS.ProcessEnv = { ...process.env, ALFONS_CONFIG_DIR: CONFIG_DIR };
  delete env.ELECTRON_RUN_AS_NODE;
  const child = spawn(exe, [main, url], { stdio: ["ignore", "ignore", "pipe"], env });
  let stderr = "";
  child.stderr?.on("data", (d: Buffer) => (stderr = (stderr + d.toString()).slice(-2000)));
  child.on("exit", (code) => {
    if (code && code !== 0) console.warn(`⚠ Overlay beendet (Code ${code}). ${stderr.trim().split(/\r?\n/).slice(-2).join(" ")}`);
  });
  process.once("exit", () => {
    try {
      child.kill();
    } catch {}
  });
  return child;
}

/** Öffnet das Overlay als randloses Edge-App-Fenster (Windows) bzw. im Standardbrowser. */
export function openOverlayWindow(url: string) {
  if (process.platform === "win32") {
    spawn("cmd", ["/c", "start", "", "msedge", `--app=${url}`, "--window-size=380,560", "--window-position=20,120"], {
      detached: true,
      stdio: "ignore",
    }).unref();
  } else {
    spawn(process.platform === "darwin" ? "open" : "xdg-open", [url], { detached: true, stdio: "ignore" }).unref();
  }
}

const OVERLAY_HTML = /* html */ `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><title>Alfons.GG Overlay</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  :root{--bg:#0d1220;--card:#161d30;--fg:#eef1f7;--mut:#94a0b8;--gold:#e8c36a;--red:#ef6a6a;--blue:#6aa6ef;--green:#5fd08a}
  *{box-sizing:border-box;margin:0}
  body{background:var(--bg);color:var(--fg);font:13px/1.35 system-ui,Segoe UI,sans-serif;padding:10px;user-select:none}
  .row{display:flex;align-items:center;gap:8px}
  .top{justify-content:space-between;margin-bottom:6px}
  .brand{font-weight:800;letter-spacing:-.02em}.brand b{color:var(--gold)}
  .time{font:600 15px ui-monospace,Consolas,monospace}
  .gold{color:var(--gold);font-weight:700;font-size:20px}
  .card{background:var(--card);border-radius:10px;padding:8px 10px;margin-bottom:6px}
  .lbl{color:var(--mut);font-size:10.5px;text-transform:uppercase;letter-spacing:.06em;margin-bottom:5px;display:flex;justify-content:space-between;gap:6px}
  .now{border-left:3px solid var(--gold);font-weight:600}
  .now small{display:block;font-weight:400;color:var(--mut);font-size:11.5px;margin-top:2px}
  .item{width:38px;height:38px;border-radius:7px;outline:1px solid #e8c36a88}
  .sm{width:22px;height:22px;border-radius:4px}.xs{width:15px;height:15px;border-radius:3px}
  .ch{width:30px;height:30px;border-radius:6px}
  .name{font-weight:600}.mut{color:var(--mut);font-size:11.5px}
  .bar{height:4px;background:#26304a;border-radius:9px;overflow:hidden;margin-top:6px}.bar>i{display:block;height:100%;background:var(--gold)}
  .chips{display:flex;flex-wrap:wrap;gap:4px;margin-top:5px}
  .chip{display:flex;align-items:center;gap:4px;background:#0d1220;border-radius:6px;padding:2px 6px 2px 2px;font-size:11.5px}
  .tips{list-style:none;padding:0;display:grid;gap:4px}
  .tip{padding:5px 8px;border-radius:7px;background:#0d1220;border-left:3px solid #3a4560;font-size:12px}
  .tip.high{border-color:var(--gold)}.tip.info{color:var(--mut)}
  .obj{font-size:11.5px;padding:2px 7px;border-radius:99px;border:1px solid #3a4560;color:var(--mut)}
  .obj.soon{border-color:var(--red);color:var(--red)}.obj.up{border-color:var(--gold);color:var(--gold)}
  .wait{color:var(--mut);text-align:center;padding:24px 0}
  .ahead{color:var(--green)}.behind{color:var(--red)}.even{color:var(--mut)}
  .duel{display:grid;grid-template-columns:1fr auto 1fr;align-items:start;gap:6px}
  .duel .r,.duel .r .row{justify-content:flex-end;text-align:right}
  .who{font-size:10px;letter-spacing:.08em;color:var(--mut);margin-bottom:3px;font-weight:700}
  .side:not(.r) .who{color:var(--gold)}
  .vs{align-self:center}
  .pc{list-style:none;padding:0;margin-top:4px;font-size:11.5px;line-height:1.3}
  .verdict{font-weight:700;font-size:14px;margin-bottom:6px}
  .stat{font-size:11.5px;color:var(--mut);line-height:1.25}.stat b{color:var(--fg)}
  .vs{color:var(--mut);font-size:11px}
  .reasons{margin-top:5px;padding-left:14px;font-size:11.5px;color:var(--mut)}
  .dead{opacity:.45;filter:grayscale(1)}
  .hint{display:none;font-size:11px;color:var(--gold);margin-bottom:6px}
  /* Ingame-Overlay (Electron): transparent, halbtransparente Karten */
  body.overlay{background:transparent;padding:4px;text-shadow:0 1px 2px #000}
  body.overlay .top,body.overlay .card{background:rgba(13,18,32,.90)}
  body.overlay .top{padding:5px 8px;border-radius:9px}
  body.overlay .tip,body.overlay .obj,body.overlay .chip{background:rgba(13,18,32,.90)}
  body.overlay .wait{padding:6px;font-size:12px;background:rgba(13,18,32,.6);border-radius:8px}
  body.interactive{outline:2px dashed var(--gold);outline-offset:-2px;min-height:100vh}
  body.interactive .top{-webkit-app-region:drag;cursor:move}
  body.interactive .hint{display:block}
</style></head><body>
<div class="row top"><span class="brand">Alfons<b>.GG</b></span><span id="time" class="time"></span><span id="gold" class="gold"></span></div>
<div class="hint">Oben ziehen zum Verschieben, Rand für Größe · Strg+Shift+O = fertig</div>
<div id="app"><p class="wait">Warte auf Spiel …</p></div>
<script>
if (new URLSearchParams(location.search).get("mode") === "overlay") document.body.classList.add("overlay");
const DD = "https://ddragon.leagueoflegends.com/cdn/";
const fmt = s => { s = Math.max(0, Math.round(s)); return Math.floor(s/60)+":"+String(s%60).padStart(2,"0"); };
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const VERDICT = { ahead: "Du bist im Vorteil", even: "Ausgeglichen", behind: "Du bist im Nachteil" };
let st = null, recv = 0;
const champImg = (v, id, cls) => '<img class="'+(cls||"ch")+'" src="'+DD+v+'/img/champion/'+esc(id)+'.png">';
const spellImg = (v, key) => key ? '<img class="xs" title="'+esc(key.replace("Summoner",""))+'" src="'+DD+v+'/img/spell/'+esc(key)+'.png">' : "";
const itemImg = (v, id, cls) => '<img class="'+(cls||"sm")+'" src="'+DD+v+'/img/item/'+id+'.png">';
const fmtG = g => g >= 1000 ? (g/1000).toFixed(1)+"k" : String(Math.round(g));

function laneSide(v, p, right) {
  return '<div class="row'+(right?" r":"")+'">'+(right?"":champImg(v,p.champion,"ch"+(p.isDead?" dead":"")))+
    '<div class="stat"><b>Lvl '+p.level+'</b> · '+p.cs+' CS<br>'+fmtG(p.itemGold)+' g '+p.spells.map(k=>spellImg(v,k)).join("")+'</div>'+
    (right?champImg(v,p.champion,"ch"+(p.isDead?" dead":"")):"")+'</div>';
}

function render(){
  const app = document.getElementById("app");
  if (!st || st.status === "waiting" || !st.snapshot) { app.innerHTML = '<p class="wait">Warte auf Spiel …</p>'; document.getElementById("time").textContent=""; document.getElementById("gold").textContent=""; return; }
  const s = st.snapshot, c = st.coach || {}, v = st.version;
  const gt = s.status === "in-game" ? s.gameTime + (Date.now()-recv)/1000 : s.gameTime;
  document.getElementById("time").textContent = fmt(gt);
  document.getElementById("gold").textContent = s.activePlayer ? Math.floor(s.activePlayer.currentGold) + " g" : "";
  if (s.status === "ended") { app.innerHTML = '<p class="wait">Spiel beendet – ' + (s.result === "Win" ? "Sieg 🎉" : "Niederlage") + '</p>'; return; }
  let h = "";

  // Jetzt
  if (c.now) h += '<div class="card now">▶ '+esc(c.now.text)+(c.now.detail?'<small>'+esc(c.now.detail)+'</small>':'')+'</div>';

  // Rolle: Lane-Duell oder Jungle
  if (v && c.jungle) {
    const j = c.jungle;
    h += '<div class="card"><div class="lbl"><span>Jungle</span>'+(j.campsSpawnIn!=null?'<span>Camps in '+fmt(j.campsSpawnIn)+'</span>':j.scuttleSpawnIn!=null?'<span>Scuttle in '+fmt(j.scuttleSpawnIn)+'</span>':'')+'</div>';
    if (j.enemyJungler) {
      const e = j.enemyJungler, seen = e.lastSeen;
      h += '<div class="row">'+champImg(v,e.champion,"ch"+(e.isDead?" dead":""))+'<div class="stat"><b>'+esc(e.championName)+'</b> (Gegner)<br>'+
        (e.isDead ? '<span class="ahead">tot – '+Math.ceil(e.respawnTimer)+' s</span>' : seen ? 'zuletzt '+esc(seen.where)+' · vor '+fmt(gt-seen.time)+' ('+esc(seen.what)+')' : 'noch nicht gesehen')+'</div></div>';
    }
    if (j.gankTarget) h += '<div class="mut" style="margin-top:5px">🎯 Gank-Ziel: <b style="color:var(--fg)">'+esc(j.gankTarget.lane)+'</b> – '+esc(j.gankTarget.reason)+'</div>';
    if (j.clears && j.clears.length) h += '<div class="chips">'+j.clears.map(cl=>{const d=cl.respawnAt-gt;return '<span class="obj '+(d<=0?"up":d<=20?"soon":"")+'" title="geräumt '+fmt(cl.at)+'">Camp '+(d<=0?"wieder da":"~"+fmt(d))+'</span>'}).join("")+'</div>';
    h += '</div>';
  } else if (v && c.lane) {
    const l = c.lane;
    // Eigene Vorteile stehen unter DIR (links), die des Gegners unter IHM (rechts)
    const col = (who, players, list, right, cls, mark) => '<div class="side'+(right?" r":"")+'"><div class="who">'+who+'</div>'+
      players.map(p=>laneSide(v,p,right)).join("")+
      (list.length?'<ul class="pc '+cls+'">'+list.map(x=>'<li>'+mark+' '+esc(x)+'</li>').join("")+'</ul>':'')+'</div>';
    h += '<div class="card"><div class="lbl"><span>'+esc(l.role)+'</span></div>'+
      '<div class="verdict '+l.verdict+'">'+esc(l.verdictText || VERDICT[l.verdict])+'</div>'+
      '<div class="duel">'+col("DU", l.me, l.pros||[], false, "ahead", "✓")+'<span class="vs">vs</span>'+col("GEGNER", l.enemy, l.cons||[], true, "behind", "!")+'</div>'+
      '<div class="mut" style="margin-top:6px">→ '+esc(l.advice)+'</div></div>';
  }

  // Nächster Kauf
  const b = c.build, plan = b && b.nextPurchase;
  if (b && b.nextItem && plan && v) {
    const pct = Math.min(100, (plan.remainingCost - plan.goldMissing) / Math.max(1, plan.remainingCost) * 100);
    const src = c.buildSource && c.buildSource.kind === "stats" ? 'High-Elo · '+c.buildSource.games+' Spiele' : 'Schätzung – keine High-Elo-Daten';
    h += '<div class="card"><div class="lbl"><span>Nächster Kauf</span><span>'+esc(src)+'</span></div><div class="row">'+itemImg(v,b.nextItem.id,"item")+'<div><div class="name">'+esc(b.nextItem.name)+'</div><div class="mut">'+(plan.completes?'<span class="ahead">Jetzt kaufbar!</span>':'noch '+plan.goldMissing+' g')+'</div></div></div>';
    if (!plan.completes) h += '<div class="bar"><i style="width:'+pct+'%"></i></div>';
    if (!plan.completes && plan.buyNow.length) h += '<div class="chips">'+plan.buyNow.map(x=>'<span class="chip">'+itemImg(v,x.id)+esc(x.name)+' '+x.cost+'</span>').join("")+'</div>';
    if (b.nextItem.reasons[0]) h += '<div class="mut" style="margin-top:5px">'+esc(b.nextItem.reasons[0])+'</div>';
    const next = b.items.slice(1,5);
    if (next.length) h += '<div class="chips">'+next.map(x=>'<span title="'+esc(x.name+" – "+(x.reasons[0]||""))+'">'+itemImg(v,x.id)+'</span>').join("")+'</div>';
    h += '</div>';
  }

  if (c.objectives && c.objectives.length) h += '<div class="chips" style="margin:0 0 6px">'+c.objectives.map(o=>{const d=o.spawnAt-gt;return '<span class="obj '+(d<=0?"up":d<=75?"soon":"")+'">'+esc(o.name)+' '+(d<=0?"da":fmt(d))+'</span>'}).join("")+'</div>';
  const rest = (c.tips || []).filter(t => (!c.now || t.id !== c.now.id) && t.kind !== "lane" && t.kind !== "jungle").slice(0, 3);
  if (rest.length) h += '<ul class="tips">'+rest.map(t=>'<li class="tip '+t.priority+'">'+esc(t.text)+'</li>').join("")+'</ul>';
  app.innerHTML = h || '<p class="wait">Alles im Griff.</p>';
}
const es = new EventSource("/events");
es.onmessage = e => { st = JSON.parse(e.data); recv = Date.now(); render(); };
setInterval(render, 1000);
</script></body></html>`;
