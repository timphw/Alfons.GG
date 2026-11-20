import { coach, GameSimulator, normalizeAllGameData, type LiveState } from "@alfons/shared";
import { getStaticData } from "@/lib/static-data";
import { buildStats } from "@/lib/build-stats";

const SPEED = 10; // Spielsekunden pro Echtzeitsekunde
const MAX_STREAM_MS = 240_000;

/** Demo-Stream: simuliertes Spiel inkl. Coach – ohne Companion und ohne Riot-Key. */
export async function GET(req: Request) {
  const startMin = Number(new URL(req.url).searchParams.get("start") ?? "6");
  const data = await getStaticData();
  const sim = new GameSimulator({ seed: Date.now() % 100_000 });
  sim.fastForward(Math.max(0, Math.min(30, startMin)) * 60);
  const encoder = new TextEncoder();
  let timer: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const started = Date.now();
      const tick = () => {
        const snapshot = normalizeAllGameData(sim.advance(SPEED));
        const state: LiveState = {
          puuid: "demo",
          riotId: snapshot.activePlayer?.riotId ?? "Demo",
          region: "euw",
          receivedAt: Date.now(),
          snapshot,
          coach: coach(snapshot, data, { stats: buildStats }),
        };
        try {
          controller.enqueue(encoder.encode(`event: state\ndata: ${JSON.stringify(state)}\n\n`));
        } catch {
          clearInterval(timer);
        }
        if (snapshot.status === "ended" || Date.now() - started > MAX_STREAM_MS) {
          clearInterval(timer);
          try {
            controller.close();
          } catch {}
        }
      };
      tick();
      timer = setInterval(tick, 1000);
      req.signal.addEventListener("abort", () => clearInterval(timer));
    },
    cancel() {
      clearInterval(timer);
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no" },
  });
}
