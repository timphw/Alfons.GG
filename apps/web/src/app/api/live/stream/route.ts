import type { LiveState } from "@alfons/shared";
import { liveStore } from "@/lib/live-store";

const HEARTBEAT_MS = 15_000;
/** Verbindung nach dieser Zeit schließen – EventSource verbindet sich automatisch neu. */
const MAX_STREAM_MS = 240_000;

/**
 * Server-Sent Events: GET /api/live/stream?puuid=...
 * Events: `state` (LiveState als JSON) und `empty` (kein Companion-Snapshot vorhanden).
 */
export async function GET(req: Request) {
  const puuid = new URL(req.url).searchParams.get("puuid");
  if (!puuid || puuid.length > 100) return new Response("puuid fehlt", { status: 400 });

  const store = liveStore();
  const encoder = new TextEncoder();
  let cleanup = () => {};

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const send = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          cleanup();
        }
      };
      const sendState = (s: LiveState) => send(`event: state\ndata: ${JSON.stringify(s)}\n\n`);

      send("retry: 2000\n\n");
      const current = await store.get(puuid);
      if (current) sendState(current);
      else send("event: empty\ndata: {}\n\n");

      const unsubscribe = await store.subscribe(puuid, sendState);
      const heartbeat = setInterval(() => send(": ping\n\n"), HEARTBEAT_MS);
      const timeout = setTimeout(() => cleanup(), MAX_STREAM_MS);

      cleanup = () => {
        if (closed) return;
        closed = true;
        unsubscribe();
        clearInterval(heartbeat);
        clearTimeout(timeout);
        try {
          controller.close();
        } catch {}
      };
      req.signal.addEventListener("abort", () => cleanup());
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
