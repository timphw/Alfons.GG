import { Suspense } from "react";
import type { Metadata } from "next";
import { getStaticData, liveAssets } from "@/lib/static-data";
import { LiveScoreboard } from "@/components/live/live-scoreboard";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Demo-Spiel" };

export default function DemoPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Demo-Spiel</h1>
        <p className="text-sm text-muted-foreground">
          Simuliertes Spiel (10× beschleunigt) – so sieht die Live-Ansicht mit laufendem Companion aus.
        </p>
      </div>
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Demo />
      </Suspense>
    </div>
  );
}

async function Demo() {
  const assets = liveAssets(await getStaticData());
  return (
    <LiveScoreboard
      puuid="demo"
      streamUrl="/api/live/demo?start=6"
      assets={assets}
      fallback={<p className="text-sm text-muted-foreground">Starte Simulation …</p>}
    />
  );
}
