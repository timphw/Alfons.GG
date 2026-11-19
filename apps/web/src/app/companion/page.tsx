import type { Metadata } from "next";
import { ShieldCheckIcon } from "lucide-react";
import { CopyLine, PairingForm } from "./pairing-form";

export const metadata: Metadata = { title: "Companion" };

const STEPS = [
  {
    title: "Companion installieren",
    body: "Aktuell als Node-CLI aus dem Repo (ein Windows-Installer folgt mit dem Overlay). Voraussetzung: Node.js ≥ 22 und pnpm.",
    commands: ["git clone <repo-url> alfons-gg && cd alfons-gg", "pnpm install"],
  },
  {
    title: "Mit deinem Account koppeln",
    body: "Erzeuge unten einen Pairing-Code und führe den angezeigten Befehl aus. Das Token wird lokal unter ~/.alfons-gg/config.json gespeichert.",
  },
  {
    title: "Starten – am besten vor dem Spiel",
    body: "Der Companion wartet auf ein Spiel, erkennt Start und Ende automatisch und sendet jede Sekunde einen Snapshot.",
    commands: ["pnpm companion run"],
  },
  {
    title: "Ohne Spiel testen",
    body: "Simuliert ein komplettes Spiel (hier 30× beschleunigt). Mit --record ORDNER lassen sich echte Spiele für Tests aufnehmen.",
    commands: ["pnpm companion run --mock --speed 30"],
  },
];

export default function CompanionPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Alfons.GG Companion</h1>
        <p className="mt-2 text-muted-foreground">
          Der Companion läuft auf dem Spieler-PC, liest die lokale Live Client Data API des laufenden Spiels und
          überträgt Items, KDA, CS, Gold und Objectives live auf die Live-Seite.
        </p>
      </div>

      <ol className="space-y-6">
        {STEPS.map((s, i) => (
          <li key={s.title} className="flex gap-4">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1 space-y-2">
              <h2 className="font-semibold">{s.title}</h2>
              <p className="text-sm text-muted-foreground">{s.body}</p>
              {s.commands?.map((c) => <CopyLine key={c} text={c} />)}
              {i === 1 && <PairingForm />}
            </div>
          </li>
        ))}
      </ol>

      <div className="flex gap-3 rounded-xl border bg-card p-4 text-sm text-muted-foreground">
        <ShieldCheckIcon className="size-5 shrink-0 text-win" />
        <p>
          Der Companion greift nicht in das Spiel ein: Er liest ausschließlich die offizielle lokale Schnittstelle
          <code className="mx-1">127.0.0.1:2999</code>, die Riot für genau solche Tools bereitstellt – nur Daten, die
          du im Spiel ohnehin siehst. Vanguard-sicher.
        </p>
      </div>
    </div>
  );
}
