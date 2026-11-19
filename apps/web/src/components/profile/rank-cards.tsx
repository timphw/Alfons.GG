/* eslint-disable @next/next/no-img-element */
import { rankEmblemUrl, type LeagueEntryDto } from "@alfons/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatTier, pct } from "@/lib/format";

const QUEUE_LABEL: Record<string, string> = {
  RANKED_SOLO_5x5: "Ranked Solo/Duo",
  RANKED_FLEX_SR: "Ranked Flex",
};

export function RankCards({ entries }: { entries: LeagueEntryDto[] }) {
  return (
    <div className="space-y-3">
      {["RANKED_SOLO_5x5", "RANKED_FLEX_SR"].map((queue) => {
        const e = entries.find((x) => x.queueType === queue);
        return (
          <Card key={queue} size="sm">
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">{QUEUE_LABEL[queue]}</CardTitle>
            </CardHeader>
            <CardContent>
              {e ? <RankRow entry={e} /> : <p className="text-sm text-muted-foreground">Unranked</p>}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function RankRow({ entry }: { entry: LeagueEntryDto }) {
  const games = entry.wins + entry.losses;
  return (
    <div className="flex items-center gap-4">
      <img src={rankEmblemUrl(entry.tier)} alt={entry.tier} width={56} height={56} />
      <div className="flex-1">
        <p className="font-semibold">{formatTier(entry.tier, entry.rank)}</p>
        <p className="text-sm text-muted-foreground">{entry.leaguePoints} LP</p>
      </div>
      <div className="text-right text-sm">
        <p>
          <span className="text-win">{entry.wins}W</span> <span className="text-loss">{entry.losses}L</span>
        </p>
        <p className="text-muted-foreground">{games ? pct(entry.wins / games) : "–"} WR</p>
      </div>
    </div>
  );
}
