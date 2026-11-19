import { z } from "zod";
import { signCompanionToken, verifyPairingCode } from "@alfons/shared";
import { companionSecret } from "@/lib/companion-auth";

const Body = z.object({ code: z.string().trim().min(10).max(1000) });

/** Companion tauscht den (signierten, kurzlebigen) Pairing-Code gegen ein dauerhaftes Token. */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Ungültiger Code – bitte den kompletten Befehl kopieren" }, { status: 400 });

  const pairing = await verifyPairingCode(parsed.data.code, companionSecret());
  if (!pairing) return Response.json({ error: "Code ungültig oder abgelaufen – auf /companion einen neuen erzeugen" }, { status: 404 });

  const token = await signCompanionToken(
    { sub: pairing.sub, rid: pairing.rid, reg: pairing.reg, iat: Math.floor(Date.now() / 1000), ver: 1 },
    companionSecret(),
  );
  return Response.json({ token, riotId: pairing.rid, region: pairing.reg });
}
