import { coach, LiveSnapshot, MAX_INGEST_BYTES, type CoachResult } from "@alfons/shared";
import { getStaticData } from "@/lib/static-data";
import { authenticateCompanion } from "@/lib/companion-auth";
import { liveStore } from "@/lib/live-store";

/** Mindestabstand zwischen zwei Snapshots desselben Accounts. */
const MIN_INTERVAL_MS = 400;

/** Companion → Website: ein Snapshot alle 1–2 s. */
export async function POST(req: Request) {
  const auth = await authenticateCompanion(req);
  if (!auth) return Response.json({ error: "Nicht autorisiert – Companion neu koppeln" }, { status: 401 });

  const length = Number(req.headers.get("content-length") ?? 0);
  if (length > MAX_INGEST_BYTES) return Response.json({ error: "Payload zu groß" }, { status: 413 });
  const text = await req.text();
  if (text.length > MAX_INGEST_BYTES) return Response.json({ error: "Payload zu groß" }, { status: 413 });

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return Response.json({ error: "Ungültiges JSON" }, { status: 400 });
  }
  const parsed = LiveSnapshot.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: "Ungültiger Snapshot", issues: parsed.error.issues.slice(0, 5) }, { status: 422 });
  }

  const store = liveStore();
  const now = Date.now();
  const prev = await store.get(auth.sub);
  if (prev && now - prev.receivedAt < MIN_INTERVAL_MS && parsed.data.status === "in-game") {
    return Response.json({ error: "Zu viele Snapshots" }, { status: 429, headers: { "Retry-After": "1" } });
  }

  let coachResult: CoachResult | undefined;
  try {
    coachResult = coach(parsed.data, await getStaticData());
  } catch (err) {
    console.error("[coach]", err); // Live-Daten trotzdem speichern
  }

  await store.put({
    puuid: auth.sub,
    riotId: auth.rid,
    region: auth.reg,
    receivedAt: now,
    snapshot: parsed.data,
    coach: coachResult,
  });
  return Response.json({ ok: true });
}
