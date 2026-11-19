import { Suspense } from "react";
import { findChampion, ddragonUrl } from "@alfons/shared";
import { getStaticData } from "@/lib/static-data";
import { Notice } from "@/components/notice";
import { Skeleton } from "@/components/ui/skeleton";

export default function ChampionPage({ params }: PageProps<"/champion/[name]">) {
  return (
    <Suspense fallback={<Skeleton className="h-40" />}>
      <Champion params={params} />
    </Suspense>
  );
}

async function Champion({ params }: { params: PageProps<"/champion/[name]">["params"] }) {
  const { name } = await params;
  const data = await getStaticData();
  const champ = findChampion(data, decodeURIComponent(name));
  if (!champ) return <Notice title="Champion nicht gefunden" />;
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={ddragonUrl.championIcon(data.version, champ.id)} alt={champ.name} width={72} height={72} className="rounded-xl" />
        <div>
          <h1 className="text-3xl font-bold">{champ.name}</h1>
          <p className="text-muted-foreground">
            {champ.title} · {champ.tags.join(", ")} · Patch {data.version}
          </p>
        </div>
      </div>
      <Notice title="Build-Statistiken folgen in Phase 4">
        Core-Items, Item-Reihenfolge, Win- und Pickrates aus High-Elo-Matches.
      </Notice>
    </div>
  );
}
