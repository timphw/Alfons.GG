import { kda, type ChampionStat, type StaticData } from "@alfons/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChampionIcon } from "@/components/game-icons";
import { pct } from "@/lib/format";
import { cn } from "@/lib/utils";

export function ChampionStatsCard({
  data,
  stats,
  sample,
}: {
  data: StaticData;
  stats: ChampionStat[];
  sample: number;
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="text-sm text-muted-foreground">Champions (letzte {sample} Spiele)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {stats.length === 0 && <p className="text-sm text-muted-foreground">Keine Daten.</p>}
        {stats.slice(0, 7).map((s) => {
          const ratio = kda(s.kills, s.deaths, s.assists);
          const wr = s.wins / s.games;
          const csMin = s.durationSec > 0 ? s.cs / (s.durationSec / 60) : 0;
          return (
            <div key={s.championId} className="flex items-center gap-3 text-sm">
              <ChampionIcon data={data} championId={s.championId} size={36} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{data.champions[s.championId]?.name ?? s.championName}</p>
                <p className="text-xs text-muted-foreground">{csMin.toFixed(1)} CS/min</p>
              </div>
              <div className="text-right">
                <p className={cn("font-medium", ratio >= 3 && "text-primary")}>{ratio.toFixed(2)} KDA</p>
                <p className="text-xs text-muted-foreground">
                  {(s.kills / s.games).toFixed(1)} / {(s.deaths / s.games).toFixed(1)} /{" "}
                  {(s.assists / s.games).toFixed(1)}
                </p>
              </div>
              <div className="w-14 text-right">
                <p className={cn("font-medium", wr >= 0.6 ? "text-win" : wr < 0.4 && "text-loss")}>{pct(wr)}</p>
                <p className="text-xs text-muted-foreground">{s.games} Sp.</p>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
