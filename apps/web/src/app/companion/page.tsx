import type { Metadata } from "next";
import { DownloadIcon, ShieldCheckIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { CopyLine, PairingForm } from "./pairing-form";

export const metadata: Metadata = { title: "Companion" };

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
        <Step n={1} title="Node.js installieren (einmalig)">
          <p>
            Lade die LTS-Version von{" "}
            <a href="https://nodejs.org" target="_blank" rel="noreferrer" className="text-primary hover:underline">
              nodejs.org
            </a>{" "}
            herunter und installiere sie mit den Standardeinstellungen.
          </p>
        </Step>

        <Step n={2} title="Companion herunterladen">
          <p>Alle drei Dateien in denselben Ordner speichern, z.B. <code>Dokumente\Alfons.GG</code>.</p>
          <div className="flex flex-wrap gap-2">
            <a href="/downloads/alfons-companion.mjs" download className={buttonVariants()}>
              <DownloadIcon /> alfons-companion.mjs
            </a>
            <a href="/downloads/alfons-overlay.cjs" download className={buttonVariants({ variant: "outline" })}>
              <DownloadIcon /> alfons-overlay.cjs
            </a>
            <a href="/downloads/Alfons-Companion-Starten.cmd" download className={buttonVariants({ variant: "outline" })}>
              <DownloadIcon /> Alfons-Companion-Starten.cmd
            </a>
          </div>
        </Step>

        <Step n={3} title="Mit deinem Account koppeln (einmalig)">
          <p>
            Code erzeugen, dann im Download-Ordner ein Terminal öffnen (im Explorer in die Adressleiste{" "}
            <code>cmd</code> tippen) und den angezeigten Befehl ausführen.
          </p>
          <PairingForm />
        </Step>

        <Step n={4} title="Vor jedem Spiel starten">
          <p>
            Doppelklick auf <b>Alfons-Companion-Starten.cmd</b>. Das Fenster einfach offen lassen: Spielstart und -ende
            werden automatisch erkannt. Im Fenster erscheinen Coach-Tipps, und das Ingame-Overlay öffnet sich.
          </p>
        </Step>

        <Step n={5} title="Ingame-Overlay (ein Bildschirm)">
          <p>
            Ein transparentes Fenster über dem Spiel zeigt Gold, nächsten Kauf, Objective-Timer und Tipps. Klicks gehen
            durch ins Spiel. Beim ersten Start wird die Overlay-Laufzeit (Electron, ~110 MB) einmalig geladen.
          </p>
          <ul className="list-inside list-disc space-y-1">
            <li>
              In League: <b>Einstellungen → Video → Fenstermodus: „Randlos“</b>. Bei echtem Vollbild ist kein Overlay
              sichtbar.
            </li>
            <li>
              <kbd>Strg</kbd>+<kbd>Shift</kbd>+<kbd>O</kbd>: Overlay verschieben und Größe ändern (nochmal drücken =
              fertig, die Position wird gespeichert)
            </li>
            <li>
              <kbd>Strg</kbd>+<kbd>Shift</kbd>+<kbd>H</kbd>: ein-/ausblenden · <kbd>Strg</kbd>+<kbd>Shift</kbd>+
              <kbd>Q</kbd>: Overlay beenden
            </li>
          </ul>
          <p>Overlay nachträglich öffnen (Companion muss laufen):</p>
          <CopyLine text="node alfons-companion.mjs overlay" />
        </Step>

        <Step n={6} title="Ohne Spiel testen">
          <p>Simuliert ein komplettes Spiel (5× beschleunigt) inklusive Overlay:</p>
          <CopyLine text="node alfons-companion.mjs run --mock --speed 5 --open-overlay" />
        </Step>
      </ol>

      <div className="flex gap-3 rounded-xl border bg-card p-4 text-sm text-muted-foreground">
        <ShieldCheckIcon className="size-5 shrink-0 text-win" />
        <p>
          Der Companion greift nicht in das Spiel ein. Er liest ausschließlich die offizielle lokale Schnittstelle
          <code className="mx-1">127.0.0.1:2999</code>, die Riot für genau solche Tools bereitstellt. Das sind nur Daten,
          die du im Spiel ohnehin siehst, und er verträgt sich mit Vanguard.
        </p>
      </div>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-4">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground">
        {n}
      </span>
      <div className="min-w-0 flex-1 space-y-2 text-sm text-muted-foreground">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {children}
      </div>
    </li>
  );
}
