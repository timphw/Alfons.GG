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
          Läuft auf deinem PC, liest die Live-Daten deines Spiels und zeigt im <b>Ingame-Overlay</b> den nächsten Kauf,
          dein Lane-Duell, Jungle-Infos, Objective-Timer und Tipps, was als Nächstes zu tun ist.
        </p>
      </div>

      <div className="rounded-xl border bg-card p-6 text-center">
        <a href="/downloads/Alfons-GG-Companion.zip" download className={buttonVariants({ size: "lg" })}>
          <DownloadIcon /> Companion herunterladen (ZIP, Windows)
        </a>
        <p className="mt-2 text-xs text-muted-foreground">ca. 0,9 MB · beim ersten Overlay-Start werden einmalig ~110 MB geladen</p>
      </div>

      <ol className="space-y-6">
        <Step n={1} title="Entpacken">
          <p>
            ZIP öffnen und den Ordner <b>Alfons.GG</b> z.B. nach <code>Dokumente</code> ziehen.
          </p>
        </Step>
        <Step n={2} title="Doppelklick auf „Alfons.GG starten“">
          <p>
            Fehlt Node.js, wird es automatisch installiert – danach den Starter einfach nochmal öffnen. Windows fragt beim
            ersten Mal evtl. nach, ob die Datei ausgeführt werden darf („Weitere Informationen → Trotzdem ausführen“).
          </p>
        </Step>
        <Step n={3} title="Im Browser auf „Verbinden“ klicken (nur beim ersten Mal)">
          <p>
            Der Browser öffnet sich automatisch. Riot ID eingeben, <b>Verbinden</b> klicken – fertig. Kein Code-Kopieren
            mehr.
          </p>
        </Step>
        <Step n={4} title="Spielen">
          <ul className="list-inside list-disc space-y-1">
            <li>
              In League: <b>Einstellungen → Video → Fenstermodus „Randlos“</b> – bei echtem Vollbild ist kein Overlay
              sichtbar.
            </li>
            <li>
              <kbd>Strg</kbd>+<kbd>Shift</kbd>+<kbd>O</kbd> Overlay verschieben/Größe ändern (nochmal = fertig, Position
              wird gespeichert) · <kbd>Strg</kbd>+<kbd>Shift</kbd>+<kbd>H</kbd> ein/aus · <kbd>Strg</kbd>+
              <kbd>Shift</kbd>+<kbd>Q</kbd> beenden
            </li>
          </ul>
        </Step>
      </ol>

      <section className="space-y-3 rounded-xl border bg-card p-5 text-sm text-muted-foreground">
        <h2 className="text-base font-semibold text-foreground">Wie entstehen die Empfehlungen?</h2>
        <p>
          <b className="text-foreground">High-Elo-Builds:</b> Wir werten Ranked-Spiele von Challenger- und
          Grandmaster-Spielern (EUW, KR, NA) des aktuellen Patches aus – welche Items sie für deinen Champion auf deiner
          Rolle in welcher Reihenfolge kaufen. Im Overlay steht dann z.B. „High-Elo · 40 Spiele“.
        </p>
        <p>
          <b className="text-foreground">Anpassung an dein Spiel:</b> Darauf reagieren Regeln auf das Gegnerteam – viel
          magischer/physischer Schaden → Resistenzen, mehrere Heiler → Klaffende Wunden, Tanks → Durchdringung,
          gefütterte Assassinen → Schutz-Items. Bei deinem ersten Item wirken sie nur abgeschwächt.
        </p>
        <p>
          <b className="text-foreground">„Schätzung – keine High-Elo-Daten“:</b> Für seltene Champions gibt es noch nicht
          genug Spiele. Dann schätzen wir nach Champion-Typ (z.B. Kämpfer → Schaden + Leben), nie Mana-Items für
          Champions ohne Mana und nie AP-Items für AD-Champions.
        </p>
      </section>

      <details className="rounded-xl border bg-card p-5 text-sm text-muted-foreground">
        <summary className="cursor-pointer font-semibold text-foreground">Für Fortgeschrittene</summary>
        <div className="mt-4 space-y-4">
          <p>Manuell mit Code verbinden (z.B. wenn sich der Browser nicht öffnet):</p>
          <PairingForm />
          <p>Ohne Spiel testen (simuliertes Spiel, 5× beschleunigt, als Jungler):</p>
          <CopyLine text="node alfons-companion.mjs run --mock --speed 5 --role JUNGLE --open-overlay" />
          <p>Neu verbinden (anderer Account):</p>
          <CopyLine text="node alfons-companion.mjs pair" />
        </div>
      </details>

      <div className="flex gap-3 rounded-xl border bg-card p-4 text-sm text-muted-foreground">
        <ShieldCheckIcon className="size-5 shrink-0 text-win" />
        <p>
          Der Companion greift nicht in das Spiel ein. Er liest ausschließlich die offizielle lokale Schnittstelle
          <code className="mx-1">127.0.0.1:2999</code>, die Riot für genau solche Tools bereitstellt. Das sind nur Daten,
          die du im Spiel ohnehin siehst, und er verträgt sich mit Vanguard. Gegnerische Jungle-Camps oder Abklingzeiten werden
          nicht getrackt.
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
