// Erzeugt synthetische allgamedata-Fixtures aus dem Simulator: `pnpm --filter @alfons/shared gen:fixtures`
// Echte Aufnahmen (companion record) bitte zusätzlich unter test/fixtures/real/ ablegen.
import { writeFileSync } from "node:fs";
import { GameSimulator } from "../src/live/simulator";

const out = new URL("../test/fixtures/", import.meta.url);
for (const min of [3, 15, 28]) {
  const sim = new GameSimulator({ seed: 42 });
  const frame = sim.fastForward(min * 60);
  writeFileSync(new URL(`sim-allgamedata-${min}min.json`, out), JSON.stringify(frame, null, 2));
}
const end = new GameSimulator({ seed: 7, durationSec: 20 * 60 }).fastForward(21 * 60);
writeFileSync(new URL("sim-allgamedata-ended.json", out), JSON.stringify(end, null, 2));
console.log("fixtures written");
