import Link from "next/link";
import { kda, queueName, riotIdToSlug, type MatchSummary, type RegionInfo, type StaticData } from "@alfons/shared";
import { ChampionIcon, ItemIcon, RuneIcon, SpellIcon } from "@/components/game-icons";
import { TimeAgo } from "@/components/time-ago";
import { formatDuration, pct, POSITION_LABEL } from "@/lib/format";
import { cn } from "@/lib/utils";

export function MatchList({
  data,
  matches,
  region,
  puuid,
}: {
  data: StaticData;
  matches: MatchSummary[];
  region: RegionInfo;
  puuid: string;
}) {
  if (matches.length === 0)
    return <p className="rounded-xl border bg-card p-6 text-center text-muted-foreground">Keine Matches gefunden.</p>;

  return (
    <ul className="space-y-2">
      {matches.map((m) => (
        <MatchRow key={m.matchId} m={m} data={data} region={region} puuid={puuid} />
      ))}
    </ul>
  );
}

function MatchRow({
  m,
  data,
  region,
  puuid,
}: {
  m: MatchSummary;
  data: StaticData;
  region: RegionInfo;
  puuid: string;
}) {
  const result = m.remake ? "Remake" : m.win ? "Sieg" : "Niederlage";
  const ratio = kda(m.kills, m.deaths, m.assists);
  const minutes = m.durationSec / 60;

  return (
    <li
      className={cn(
        "flex flex-wrap items-center gap-x-5 gap-y-3 rounded-xl border-l-4 bg-card p-3",
        m.remake ? "border-l-muted-foreground" : m.win ? "border-l-win bg-win/5" : "border-l-loss bg-loss/5",
      )}
    >
      <div className="w-28 text-xs">
        <p className="font-semibold text-foreground">{queueName(m.queueId)}</p>
        <p className="text-muted-foreground">
          <TimeAgo ts={m.gameCreation} />
        </p>
        <p className={cn("mt-1 font-semibold", m.remake ? "" : m.win ? "text-win" : "text-loss")}>{result}</p>
        <p className="text-muted-foreground">{formatDuration(m.durationSec)}</p>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative">
          <ChampionIcon data={data} championId={m.championId} size={48} />
          <span className="absolute -right-1 -bottom-1 rounded-full bg-background px-1 text-[10px]">{m.champLevel}</span>
        </div>
        <div className="grid grid-cols-2 gap-0.5">
          <SpellIcon data={data} spellId={m.spells[0]} size={22} />
          <RuneIcon data={data} runeId={m.primaryRune} size={22} className="bg-black/40" />
          <SpellIcon data={data} spellId={m.spells[1]} size={22} />
          <RuneIcon data={data} runeId={m.secondaryStyle} size={22} className="p-0.5" />
        </div>
      </div>

      <div className="w-28 text-center">
        <p className="font-semibold">
          {m.kills} / <span className="text-loss">{m.deaths}</span> / {m.assists}
        </p>
        <p className="text-xs text-muted-foreground">{ratio.toFixed(2)} KDA</p>
        <p className="text-xs text-muted-foreground">
          {m.position ? (POSITION_LABEL[m.position] ?? m.position) : ""}
        </p>
      </div>

      <div className="w-24 text-xs text-muted-foreground">
        <p>
          CS {m.cs} ({minutes > 0 ? (m.cs / minutes).toFixed(1) : 0})
        </p>
        <p>KP {pct(m.killParticipation)}</p>
        <p>Vision {m.visionScore}</p>
      </div>

      <div className="flex gap-0.5">
        {m.items.map((id, i) => (
          <ItemIcon key={i} data={data} itemId={id} size={28} className={i === 6 ? "ml-1 rounded-full" : ""} />
        ))}
      </div>

      <div className="ml-auto hidden grid-cols-2 gap-x-3 text-xs xl:grid">
        {m.teams.map((t) => (
          <ul key={t.teamId} className="space-y-0.5">
            {t.players.map((p) => (
              <li key={p.puuid} className="flex w-28 items-center gap-1">
                <ChampionIcon data={data} championId={p.championId} size={16} className="rounded-sm" />
                {p.tag ? (
                  <Link
                    href={`/player/${region.slug}/${riotIdToSlug({ gameName: p.name, tagLine: p.tag })}`}
                    className={cn(
                      "truncate hover:underline",
                      p.puuid === puuid ? "font-semibold text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {p.name}
                  </Link>
                ) : (
                  <span className="truncate text-muted-foreground">{p.name}</span>
                )}
              </li>
            ))}
          </ul>
        ))}
      </div>
    </li>
  );
}
