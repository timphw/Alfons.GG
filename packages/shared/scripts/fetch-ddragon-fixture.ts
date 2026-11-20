// Lädt echte Data-Dragon-Daten (de_DE) und speichert eine schlanke Kopie als Test-Fixture.
// `pnpm --filter @alfons/shared fixture:ddragon [version]`
import { writeFileSync } from "node:fs";
import { fetchLatestVersion, fetchStaticData } from "../src/ddragon";

const version = process.argv[2] ?? (await fetchLatestVersion());
const data = await fetchStaticData(version, "de_DE");
const items = Object.fromEntries(
  Object.entries(data.items).map(([id, i]) => [
    id,
    {
      name: i.name,
      // Beschreibung nur behalten, soweit die Engine sie auswertet (Klaffende Wunden)
      description: /wunde|wound/i.test(i.description) ? "Klaffende Wunden" : "",
      from: i.from,
      into: i.into,
      gold: i.gold,
      tags: i.tags,
      maps: { "11": i.maps?.["11"] ?? false },
      inStore: i.inStore,
      requiredChampion: i.requiredChampion,
      requiredAlly: i.requiredAlly,
      consumed: i.consumed,
      image: { full: i.image.full },
    },
  ]),
);
const champions = Object.fromEntries(
  Object.entries(data.champions).map(([key, c]) => [
    key,
    { id: c.id, key: c.key, name: c.name, title: "", tags: c.tags, info: c.info, stats: { attackrange: c.stats?.attackrange ?? 0 }, image: { full: c.image.full } },
  ]),
);
const out = new URL(`../test/fixtures/ddragon-${version}.json`, import.meta.url);
writeFileSync(out, JSON.stringify({ version, items, champions }));
console.log(`ddragon fixture ${version}: ${Object.keys(items).length} items, ${Object.keys(champions).length} champions`);
