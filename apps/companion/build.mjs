// Bündelt den Companion in eine einzelne Datei für den Download auf der Website.
import { build } from "esbuild";
import { mkdirSync, readFileSync } from "node:fs";

const host = process.env.ALFONS_PUBLIC_URL ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");
const outdir = new URL("../web/public/downloads/", import.meta.url);
mkdirSync(outdir, { recursive: true });
const { version } = JSON.parse(readFileSync(new URL("package.json", import.meta.url), "utf8"));

await build({
  entryPoints: [new URL("src/cli.ts", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")],
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  outfile: new URL("alfons-companion.mjs", outdir).pathname.replace(/^\/([A-Za-z]:)/, "$1"),
  define: { "process.env.ALFONS_DEFAULT_SERVER": JSON.stringify(host) },
  banner: { js: `// Alfons.GG Companion v${version} – Server: ${host}\n// Start: node alfons-companion.mjs run` },
  legalComments: "none",
});
console.log(`companion bundle → public/downloads/alfons-companion.mjs (Server ${host})`);
