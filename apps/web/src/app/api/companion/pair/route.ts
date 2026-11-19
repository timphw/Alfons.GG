import { z } from "zod";
import { signCompanionToken } from "@alfons/shared";
import { liveStore } from "@/lib/live-store";
import { companionSecret } from "@/lib/companion-auth";

const Body = z.object({ code: z.string().trim().toUpperCase().length(6) });

/** Companion tauscht den Pairing-Code von der Website gegen ein dauerhaftes Token. */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Ungültiger Code" }, { status: 400 });

  const pairing = await liveStore().consumePairing(parsed.data.code);
  if (!pairing) return Response.json({ error: "Code unbekannt oder abgelaufen" }, { status: 404 });

  const token = await signCompanionToken(
    { sub: pairing.puuid, rid: pairing.riotId, reg: pairing.region, iat: Math.floor(Date.now() / 1000), ver: 1 },
    companionSecret(),
  );
  return Response.json({ token, riotId: pairing.riotId, region: pairing.region });
}
