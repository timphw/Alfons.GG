import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { RadioIcon } from "lucide-react";
import {
  aggregateChampionStats,
  formatRiotId,
  parseRiotId,
  riotIdToSlug,
  summarizeMatch,
  type AccountDto,
  type RegionInfo,
} from "@alfons/shared";
import { load, resolvePlayer, riot } from "@/lib/riot";
import { getStaticData } from "@/lib/static-data";
import { ProfileIcon } from "@/components/game-icons";
import { Notice, PLAYER_ERRORS } from "@/components/notice";
import { RankCards } from "@/components/profile/rank-cards";
import { MatchList } from "@/components/profile/match-list";
import { ChampionStatsCard } from "@/components/profile/champion-stats";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

/** Erst wenige Matches laden (je Match 1 Riot-Request), weitere auf Wunsch per `?matches=` */
const MATCH_STEP = 5;
const MATCH_MAX = 20;

function matchCount(raw: string | string[] | undefined): number {
  const n = Number(Array.isArray(raw) ? raw[0] : raw);
  if (!Number.isFinite(n)) return MATCH_STEP;
  return Math.min(MATCH_MAX, Math.max(MATCH_STEP, Math.ceil(n / MATCH_STEP) * MATCH_STEP));
}

export async function generateMetadata({
  params,
}: PageProps<"/player/[region]/[riotId]">): Promise<Metadata> {
  const { riotId } = await params;
  const id = parseRiotId(riotId);
  return { title: id ? formatRiotId(id) : "Spieler" };
}

export default function PlayerPage({ params, searchParams }: PageProps<"/player/[region]/[riotId]">) {
  return (
    <Suspense fallback={<ProfileSkeleton />}>
      <Profile params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Profile({
  params,
  searchParams,
}: Pick<PageProps<"/player/[region]/[riotId]">, "params" | "searchParams">) {
  const [{ region: regionSlug, riotId }, query] = await Promise.all([params, searchParams]);
  const count = matchCount(query.matches);
  const res = await load(async () => {
    const player = await resolvePlayer(regionSlug, riotId);
    if (!player.ok) return player;
    const client = await riot();
    const [summoner, leagues, activeGame, data] = await Promise.all([
      client.getSummonerByPuuid(player.region.platform, player.account.puuid),
      client.getLeagueEntries(player.region.platform, player.account.puuid),
      client.getActiveGame(player.region.platform, player.account.puuid).catch(() => null),
      getStaticData(),
    ]);
    return { ...player, summoner, leagues, activeGame, data };
  });
  if (!res.ok) return <Notice title="Profil konnte nicht geladen werden">{res.error}</Notice>;
  if (!res.value.ok) return <Notice title={PLAYER_ERRORS[res.value.reason]} />;
  const { region, account, summoner, leagues, activeGame, data } = res.value;
  const liveHref = `/live/${region.slug}/${riotIdToSlug(account)}`;

  return (
      <div className="space-y-6">
        <section className="flex flex-wrap items-center gap-5">
          <div className="relative">
            {summoner && <ProfileIcon data={data} iconId={summoner.profileIconId} size={88} />}
            {summoner && (
              <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full border bg-background px-2 text-xs">
                {summoner.summonerLevel}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-3xl font-bold">
              {account.gameName}
              <span className="ml-1 font-normal text-muted-foreground">#{account.tagLine}</span>
            </h1>
            <p className="text-sm text-muted-foreground">{region.label}</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {activeGame && (
              <Badge className="animate-pulse bg-loss text-white">
                <RadioIcon /> Im Spiel
              </Badge>
            )}
            <Link href={liveHref} className={buttonVariants({ variant: activeGame ? "default" : "outline" })}>
              Live-Spiel ansehen
            </Link>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <aside className="space-y-6">
            <RankCards entries={leagues ?? []} />
            <Suspense fallback={<Skeleton className="h-64" />}>
              <MatchesSection region={region} account={account} count={count} part="champions" />
            </Suspense>
          </aside>
          <Suspense fallback={<MatchListSkeleton />}>
            <MatchesSection region={region} account={account} count={count} part="matches" />
          </Suspense>
        </div>
      </div>
  );
}

/** Lädt die letzten Matches (dedupliziert & gecached im RiotClient – beide Teile teilen sich die Requests). */
async function MatchesSection({
  region,
  account,
  count,
  part,
}: {
  region: RegionInfo;
  account: AccountDto;
  count: number;
  part: "matches" | "champions";
}) {
  const res = await load(async () => {
    const client = await riot();
    const [ids, data] = await Promise.all([
      client.getMatchIds(region.matchRoute, account.puuid, { count }),
      getStaticData(),
    ]);
    const matches = await Promise.all((ids ?? []).map((id) => client.getMatch(region.matchRoute, id)));
    const summaries = matches
      .map((m) => (m ? summarizeMatch(m, account.puuid) : null))
      .filter((s) => s !== null);
    return { data, summaries };
  });
  if (!res.ok) return <Notice title="Matches konnten nicht geladen werden">{res.error}</Notice>;
  const { data, summaries } = res.value;

  if (part === "champions")
    return <ChampionStatsCard data={data} stats={aggregateChampionStats(summaries)} sample={summaries.length} />;
  const more = summaries.length >= count && count < MATCH_MAX;
  return (
    <div className="space-y-3">
      <MatchList data={data} matches={summaries} region={region} puuid={account.puuid} />
      {more && (
        <Link
          href={`/player/${region.slug}/${riotIdToSlug(account)}?matches=${count + MATCH_STEP}`}
          scroll={false}
          className={buttonVariants({ variant: "outline", className: "w-full" })}
        >
          Weitere Matches laden
        </Link>
      )}
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-5">
        <Skeleton className="size-22 rounded-xl" />
        <div className="space-y-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <Skeleton className="h-48" />
        <MatchListSkeleton />
      </div>
    </div>
  );
}

function MatchListSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 6 }, (_, i) => (
        <Skeleton key={i} className="h-24" />
      ))}
    </div>
  );
}
