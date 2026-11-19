# Alfons.GG

League-of-Legends-Companion à la u.gg – für unsere kleine Freundesgruppe (Hauptnutzer: Alfons).

| Phase | Inhalt | Status |
| --- | --- | --- |
| 1 | Monorepo, Riot-API-Client (Rate-Limiter, Cache), Riot-ID-Suche, Profilseite | ✅ |
| 2 | Live-Ansicht über Spectator-v5 (Teams, Champions, Runen, Spells, Ränge, Bans) | ✅ |
| 3 | Companion (Live Client Data API) → Ingest → SSE → Live-Scores | ✅ |
| 4 | Build-Engine + Coach-Tipps (regelbasiert ✅), Statistik-Crawler ⏳ | 🟡 |
| 5 | Ingame-Overlay (Electron statt Tauri – transparent, always-on-top, klick-durchlässig) | ✅ |

## Struktur

```
apps/web          Next.js 16 (App Router, Cache Components, Tailwind 4, shadcn/ui)
apps/companion    Node/TS-CLI für den Spieler-PC (Phase 3)
packages/shared   Typen, Regionen, Riot-Client + Rate-Limiter, Data Dragon, Profil-Aggregation,
                  später die Build-Engine – rein & mit Vitest getestet
```

## Setup

Voraussetzungen: Node.js ≥ 22, pnpm (`npm i -g pnpm`).

```bash
pnpm install
cp .env.example .env      # dann RIOT_API_KEY eintragen
pnpm dev                  # http://localhost:3000
pnpm test                 # Unit-Tests (packages/shared)
pnpm typecheck
```

Die `.env` liegt im **Repo-Root** und wird von `apps/web/next.config.ts` geladen. Auf Vercel werden die
Variablen stattdessen im Projekt gesetzt (`vercel env add RIOT_API_KEY`).

### Umgebungsvariablen

| Variable | Wofür | Ab Phase |
| --- | --- | --- |
| `RIOT_API_KEY` | Riot Web-API (nur serverseitig!) | 1 |
| `REDIS_URL` | Live-State/Cache (Upstash). Leer = In-Memory | 3 |
| `DATABASE_URL` | Postgres (Neon) für Pairing & Build-Statistiken | 3/4 |
| `COMPANION_TOKEN_SECRET` | Signiert Companion-Pairing-Tokens | 3 |

## Riot API Key beantragen

1. Auf <https://developer.riotgames.com> mit dem Riot-Account einloggen.
2. **Development API Key**: steht direkt im Dashboard. Läuft nach **24 h** ab und muss dann über
   „Regenerate API Key“ erneuert werden. Limits: 20 Requests/s, 100 Requests/2 min.
3. **Personal API Key** (empfohlen für dieses Projekt): Dashboard → „Register Product“ → „Personal API Key“.
   Kurz beschreiben, was die App tut (privater Companion für eine Freundesgruppe, kein öffentlicher Dienst).
   Nach Freigabe läuft der Key nicht mehr ab; die Rate-Limits bleiben auf Dev-Niveau.
4. Für einen öffentlichen Betrieb wäre ein **Production API Key** nötig (eigene Produkt-Registrierung mit
   funktionierendem Prototyp, Review durch Riot).

Der Key wird ausschließlich in `apps/web/src/lib/riot.ts` (Server-only) verwendet und nie an den Browser
geschickt.

## Riot-API-Client (`packages/shared/src/riot`)

- **Rate-Limiter** pro Routing-Host (App-Limits gelten pro Region): Sliding-Log über mehrere Fenster
  (Standard 20/1 s + 100/120 s), FIFO-Queue.
- **429** → `Retry-After` lesen, Host pausieren, erneut versuchen. **5xx/Netzwerk** → exponentielles Backoff.
- **Caching** mit TTL je Endpoint (Matches 7 Tage, Ränge 5 min, Spectator 15 s, 404 → 60 s) und
  In-Flight-Deduplizierung paralleler Requests.
- Limiter & Cache leben pro Server-Instanz. Für mehrere Instanzen ist ein Redis-Cache (Phase 3) vorgesehen.

## Seiten

- `/` – Suche (Riot ID + Region)
- `/player/[region]/[Name-Tag]` – Rang, letzte 10 Matches, Champion-Stats
- `/live/[region]/[Name-Tag]` – laufendes Spiel (Spectator-v5), aktualisiert sich alle 60 s
- `/champion/[name]` – Platzhalter, Build-Statistik folgt in Phase 4
- `/companion` – Platzhalter, Setup & Pairing folgen in Phase 3

## Rechtliches

Alfons.GG isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone
officially involved in producing or managing Riot Games properties. Riot Games, and all associated properties
are trademarks or registered trademarks of Riot Games, Inc.

Der Companion/das Overlay greifen **nicht** in den Spielprozess ein, sondern nutzen nur die offizielle lokale
Live Client Data API (Daten, die der Spieler ohnehin sieht).
