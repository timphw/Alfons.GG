// Alfons.GG Ingame-Overlay (Electron-Hauptprozess)
//
// Transparentes, randloses Fenster, immer im Vordergrund und klick-durchlässig. Zeigt die lokale
// Overlay-Seite des Companions (http://127.0.0.1:2998/overlay). Kein Eingriff in den Spielprozess –
// es ist ein ganz normales eigenes Fenster. League muss dafür im Fenstermodus „Randlos“ laufen.
//
// Hotkeys:  Strg+Shift+O  Bearbeiten an/aus (verschieben, Größe ändern, anklicken)
//           Strg+Shift+H  Overlay ein-/ausblenden
//           Strg+Shift+Q  Overlay beenden
"use strict";
const { app, BrowserWindow, globalShortcut, screen } = require("electron");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const url = process.argv.find((a) => /^http:\/\/(127\.0\.0\.1|localhost):\d+/.test(a)) || "http://127.0.0.1:2998/overlay";
const configDir = process.env.ALFONS_CONFIG_DIR || path.join(os.homedir(), ".alfons-gg");
const boundsFile = path.join(configDir, "overlay-window.json");

if (!app.requestSingleInstanceLock()) app.quit();

function loadBounds() {
  try {
    const b = JSON.parse(fs.readFileSync(boundsFile, "utf8"));
    // nur übernehmen, wenn noch auf einem vorhandenen Bildschirm
    const visible = screen.getAllDisplays().some((d) => {
      const a = d.workArea;
      return b.x >= a.x - 50 && b.y >= a.y - 50 && b.x < a.x + a.width && b.y < a.y + a.height;
    });
    if (visible) return b;
  } catch {}
  const a = screen.getPrimaryDisplay().workArea;
  return { width: 330, height: 500, x: a.x + 16, y: a.y + Math.round(a.height * 0.2) };
}

function saveBounds(win) {
  try {
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(boundsFile, JSON.stringify(win.getBounds()));
  } catch {}
}

app.whenReady().then(() => {
  const win = new BrowserWindow({
    ...loadBounds(),
    minWidth: 240,
    minHeight: 160,
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    hasShadow: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    focusable: false,
    show: false,
    title: "Alfons.GG Overlay",
    webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false },
  });

  let interactive = false;
  const apply = () => {
    win.setIgnoreMouseEvents(!interactive, { forward: true });
    win.setFocusable(interactive);
    win.webContents
      .executeJavaScript(`document.body.classList.toggle("interactive", ${interactive})`)
      .catch(() => {});
  };
  const pageUrl = url + (url.includes("?") ? "&" : "?") + "mode=overlay";
  const load = () => win.loadURL(pageUrl).catch(() => {});

  win.setAlwaysOnTop(true, "screen-saver");
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.webContents.on("did-finish-load", () => {
    apply();
    if (!win.isVisible()) win.showInactive();
  });
  // Companion noch nicht gestartet → erneut versuchen
  win.webContents.on("did-fail-load", () => setTimeout(load, 2000));
  win.on("moved", () => saveBounds(win));
  win.on("resized", () => saveBounds(win));
  load();

  // Manche Spiele/Fenster drängen sich nach vorne – Vordergrund regelmäßig bestätigen
  setInterval(() => {
    if (win.isVisible()) win.setAlwaysOnTop(true, "screen-saver");
  }, 3000);

  globalShortcut.register("CommandOrControl+Shift+O", () => {
    interactive = !interactive;
    apply();
    if (interactive) win.focus();
  });
  globalShortcut.register("CommandOrControl+Shift+H", () => (win.isVisible() ? win.hide() : win.showInactive()));
  globalShortcut.register("CommandOrControl+Shift+Q", () => app.quit());
});

app.on("will-quit", () => globalShortcut.unregisterAll());
app.on("window-all-closed", () => app.quit());
