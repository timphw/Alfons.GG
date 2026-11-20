// Bündelt den Companion für den Download auf der Website:
//  - public/downloads/alfons-companion.mjs   (CLI, eine Datei)
//  - public/downloads/alfons-overlay.cjs     (Electron-Overlay)
//  - public/downloads/Alfons-GG-Companion.zip (alles in einem Paket inkl. Starter + Anleitung)
import { build } from "esbuild";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const host = process.env.ALFONS_PUBLIC_URL ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");
const outdir = new URL("../web/public/downloads/", import.meta.url);
const path = (u) => u.pathname.replace(/^\/([A-Za-z]:)/, "$1");
mkdirSync(outdir, { recursive: true });
const { version } = JSON.parse(readFileSync(new URL("package.json", import.meta.url), "utf8"));

await build({
  entryPoints: [path(new URL("src/cli.ts", import.meta.url))],
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  outfile: path(new URL("alfons-companion.mjs", outdir)),
  define: { "process.env.ALFONS_DEFAULT_SERVER": JSON.stringify(host) },
  banner: { js: `// Alfons.GG Companion v${version} – Server: ${host}\n// Start: node alfons-companion.mjs run` },
  legalComments: "none",
});
copyFileSync(new URL("overlay/main.cjs", import.meta.url), new URL("alfons-overlay.cjs", outdir));

// Windows-Starter (ASCII, CRLF): installiert Node.js bei Bedarf per winget, startet Companion + Overlay
const starter = [
  "@echo off",
  "title Alfons.GG Companion",
  'cd /d "%~dp0"',
  "where node >nul 2>nul",
  "if errorlevel 1 (",
  "  echo Node.js fehlt - wird jetzt einmalig installiert ...",
  "  winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements",
  "  echo.",
  '  echo Fertig. Bitte dieses Fenster schliessen und "Alfons.GG starten" nochmal doppelklicken.',
  "  pause",
  "  exit /b",
  ")",
  "node alfons-companion.mjs run --open-overlay",
  "pause",
  "",
].join("\r\n");
writeFileSync(new URL("Alfons-Companion-Starten.cmd", outdir), starter);

const readme = [
  "Alfons.GG Companion",
  "===================",
  "",
  "1. Diesen Ordner entpacken (z.B. nach Dokumente\\Alfons.GG).",
  '2. Doppelklick auf "Alfons.GG starten.cmd".',
  "   - Fehlt Node.js, wird es automatisch installiert. Danach den Starter nochmal oeffnen.",
  "   - Beim ersten Start oeffnet sich der Browser: Riot ID eingeben, auf \"Verbinden\" klicken.",
  "3. League im Fenstermodus \"Randlos\" spielen - das Overlay erscheint ueber dem Spiel.",
  "",
  "Overlay-Hotkeys:",
  "  Strg+Shift+O  verschieben / Groesse aendern (nochmal = fertig)",
  "  Strg+Shift+H  ein-/ausblenden",
  "  Strg+Shift+Q  Overlay beenden",
  "",
  `Website: ${host}`,
  "",
].join("\r\n");

// Minimaler ZIP-Writer (Methode „stored“, UTF-8-Dateinamen) – keine Abhängigkeiten nötig
const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
function zip(entries) {
  const local = [];
  const central = [];
  let offset = 0;
  for (const { name, data } of entries) {
    const n = Buffer.from(name, "utf8");
    const crc = crc32(data);
    const h = Buffer.alloc(30);
    h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0x0800, 6); h.writeUInt16LE(0, 8);
    h.writeUInt32LE(0, 10); h.writeUInt32LE(crc, 14); h.writeUInt32LE(data.length, 18); h.writeUInt32LE(data.length, 22);
    h.writeUInt16LE(n.length, 26); h.writeUInt16LE(0, 28);
    local.push(h, n, data);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x0800, 8);
    c.writeUInt16LE(0, 10); c.writeUInt32LE(0, 12); c.writeUInt32LE(crc, 16); c.writeUInt32LE(data.length, 20);
    c.writeUInt32LE(data.length, 24); c.writeUInt16LE(n.length, 28); c.writeUInt32LE(offset, 42);
    central.push(c, n);
    offset += h.length + n.length + data.length;
  }
  const cd = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, cd, end]);
}

const dir = "Alfons.GG/";
writeFileSync(
  new URL("Alfons-GG-Companion.zip", outdir),
  zip([
    { name: `${dir}Alfons.GG starten.cmd`, data: Buffer.from(starter) },
    { name: `${dir}alfons-companion.mjs`, data: readFileSync(new URL("alfons-companion.mjs", outdir)) },
    { name: `${dir}alfons-overlay.cjs`, data: readFileSync(new URL("alfons-overlay.cjs", outdir)) },
    { name: `${dir}LIESMICH.txt`, data: Buffer.from(readme) },
  ]),
);
console.log(`companion bundle + Alfons-GG-Companion.zip → public/downloads (Server ${host})`);
