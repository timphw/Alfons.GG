import type { Metadata } from "next";
import { Notice } from "@/components/notice";

export const metadata: Metadata = { title: "Companion" };

export default function CompanionPage() {
  return (
    <Notice title="Alfons.GG Companion – kommt in Phase 3">
      Der Companion läuft auf dem Spieler-PC, liest die lokale Live Client Data API des laufenden Spiels und
      überträgt Items, KDA, Gold und Objectives live an diese Website. Download &amp; Pairing folgen hier.
    </Notice>
  );
}
