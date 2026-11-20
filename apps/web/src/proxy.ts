import { NextResponse, type NextRequest } from "next/server";
import { ACCESS_COOKIE, hasAccess } from "@/lib/access";

/** Leitet ohne gültigen Zugangscode auf /zugang um (nur wenn ACCESS_CODE gesetzt ist). */
export async function proxy(request: NextRequest) {
  if (await hasAccess(request.cookies.get(ACCESS_COOKIE)?.value)) return NextResponse.next();

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Zugangscode erforderlich" }, { status: 401 });
  }
  const url = request.nextUrl.clone();
  url.pathname = "/zugang";
  url.search = `?next=${encodeURIComponent(request.nextUrl.pathname + request.nextUrl.search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Ausgenommen: Assets, Zugangsseite, Companion-Download, Build-Statistik und die Companion-Endpunkte (eigenes Token)
  matcher: [
    "/((?!_next/|favicon\\.ico|zugang|downloads/|data/|api/live/ingest|api/companion/pair).*)",
  ],
};
