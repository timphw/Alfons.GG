import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { PlugZapIcon, RadioIcon } from "lucide-react";
import {
  formatRiotId,
  parseRiotId,
  queueName,
  riotIdToSlug,
  type CurrentGameInfo,
  type CurrentGameParticipant,
  type LeagueEntryDto,
  type RegionInfo,
  type StaticData,
} from "@alfons/shared";
import { load, resolvePlayer, riot } from "@/lib/riot";
import { getStaticData, liveAssets } from "@/lib/static-data";
import { LiveScoreboard } from "@/components/live/live-scoreboard";
import { ChampionIcon, RuneIcon, SpellIcon } from "@/components/game-icons";
import { Notice, PLAYER_ERRORS } from "@/components/notice";
import { GameTimer } from "@/components/live/game-timer";
import { AutoRefresh } from "@/components/auto-refresh";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatTier, pct } from "@/lib/format";
import { cn } from "@/lib/utils";

export async function generateMetadata({ params }: PageProps<"/live/[region]/[riotId]">): Promise<Metadata> {
  const { riotId } = await params;
  const id = parseRiotId(riotId);
  return { title: id ? `Live: ${formatRiotId(id)}` : "Live-Spiel" };
}

export default function LivePage({ params }: PageProps<"/live/[region]/[riotId]">) {
  return (
    <Suspense fallback={<LiveSkeleton />}>
      <Live params={params} />
    </Suspense>
  );
}

async function Live({ params }: { params: PageProps<"/live/[region]/[riotId]">["params"] }) {
  const { region: regionSlug, riotId } = await params;
  const res = await load(async () => {
    const player = await resolvePlayer(regionSlug, riotId);
    if (!player.ok) return player;
    const { region, account } = player;
    const client = await riot();
    const [game, data] = await Promise.all([client.getActiveGame(region.platform, account.puuid), getStaticData()]);
    if (!game) return { ...player, data, game: null, rankByPuuid: null };

    // Solo/Duo-Ränge aller Teilnehmer (gecached, Fehler pro Spieler tolerieren)
    const ranks = await Promise.all(
      game.participants.map((p) =>
        p.puuid ? client.getLeagueEntries(region.platform, p.puuid).catch(() => null) : Promise.resolve(null),
      ),
    );
    const rankByPuuid = new Map<string, LeagueEntryDto | undefined>();
    game.participants.forEach((p, i) => {
      if (p.puuid) rankByPuuid.set(p.puuid, ranks[i]?.find((e) => e.queueType === "RANKED_SOLO_5x5"));
    });
    return { ...player, data, game, rankByPuuid };
  });
  if (!res.ok) return <Notice title="Live-Spiel konnte nicht geladen werden">{res.error}</Notice>;
  if (!res.value.ok) return <Notice title={PLAYER_ERRORS[res.value.reason]} />;
  const { region, account, game, data, rankByPuuid } = res.value;

  const assets = liveAssets(data);
  const companionCta = (
    <div className="flex flex-wrap items-center gap-4 rounded-xl border border-dashed p-5">
      <PlugZapIcon className="size-6 text-primary" />
      <div className="flex-1">
        <p className="font-semibold">Live-Scores &amp; Build-Empfehlungen</p>
        <p className="text-sm text-muted-foreground">
          Items, KDA, Gold, Objectives und dynamische Builds gibt es, sobald der Alfons.GG Companion auf dem
          Spieler-PC läuft. Diese Seite aktualisiert sich dann automatisch.
        </p>
      </div>
      <Link href="/companion" className={buttonVariants({ variant: "outline" })}>
        Companion einrichten
      </Link>
    </div>
  );

  if (!game || !rankByPuuid) {
    // Spectator kennt das Spiel nicht (noch nicht gestartet, Custom/Practice Tool) – Companion-Daten trotzdem zeigen
    return (
      <div className="space-y-6">
        <AutoRefresh seconds={30} />
        <LiveScoreboard
          puuid={account.puuid}
          assets={assets}
          fallback={
            <Notice title={`${account.gameName}#${account.tagLine} ist gerade nicht im Spiel`}>
              Die Seite prüft alle 30 Sekunden erneut.{" "}
              <Link href={`/player/${region.slug}/${riotIdToSlug(account)}`} className="text-primary hover:underline">
                Zum Profil
              </Link>
            </Notice>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AutoRefresh seconds={60} />
      <section className="flex flex-wrap items-end gap-4">
        <div>
          <p className="flex items-center gap-2 text-sm text-loss">
            <RadioIcon className="size-4 animate-pulse" /> Live
          </p>
          <h1 className="text-2xl font-bold">
            {account.gameName}
            <span className="font-normal text-muted-foreground">#{account.tagLine}</span>
          </h1>
          <p className="text-sm text-muted-foreground">
            {queueName(game.gameQueueConfigId)} · {region.label} ·{" "}
            <GameTimer gameStartTime={game.gameStartTime} />
          </p>
        </div>
        <Bans game={game} data={data} />
      </section>

      <LiveScoreboard puuid={account.puuid} assets={assets} fallback={companionCta} />

      <h2 className="text-sm font-semibold text-muted-foreground">Aufstellung & Ränge</h2>
      <div className="grid gap-4 lg:grid-cols-2">
        {([100, 200] as const).map((teamId) => (
          <TeamTable
            key={teamId}
            teamId={teamId}
            players={game.participants.filter((p) => p.teamId === teamId)}
            data={data}
            region={region}
            focusPuuid={account.puuid}
            rankByPuuid={rankByPuuid}
          />
        ))}
      </div>
    </div>
  );
}

function Bans({ game, data }: { game: CurrentGameInfo; data: StaticData }) {
  if (!game.bannedChampions.length) return null;
  return (
    <div className="ml-auto flex items-center gap-4 text-xs text-muted-foreground">
      {[100, 200].map((teamId) => (
        <div key={teamId} className="flex items-center gap-1">
          <span className={teamId === 100 ? "text-blue-team" : "text-red-team"}>Bans</span>
          {game.bannedChampions
            .filter((b) => b.teamId === teamId)
            .map((b) =>
              b.championId > 0 ? (
                <ChampionIcon
                  key={b.pickTurn}
                  data={data}
                  championId={b.championId}
                  size={22}
                  className="opacity-60 grayscale"
                />
              ) : (
                <span key={b.pickTurn} className="inline-block size-[22px] rounded-md bg-muted" />
              ),
            )}
        </div>
      ))}
    </div>
  );
}

function TeamTable({
  teamId,
  players,
  data,
  region,
  focusPuuid,
  rankByPuuid,
}: {
  teamId: 100 | 200;
  players: CurrentGameParticipant[];
  data: StaticData;
  region: RegionInfo;
  focusPuuid: string;
  rankByPuuid: Map<string, LeagueEntryDto | undefined>;
}) {
  const blue = teamId === 100;
  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <h2
        className={cn(
          "border-b px-4 py-2 text-sm font-semibold",
          blue ? "bg-blue-team/10 text-blue-team" : "bg-red-team/10 text-red-team",
        )}
      >
        {blue ? "Blaues Team" : "Rotes Team"}
      </h2>
      <ul className="divide-y">
        {players.map((p, i) => {
          const rank = p.puuid ? rankByPuuid.get(p.puuid) : undefined;
          const [name, tag] = (p.riotId ?? "").split("#");
          const games = rank ? rank.wins + rank.losses : 0;
          return (
            <li
              key={p.puuid ?? i}
              className={cn("flex items-center gap-3 px-4 py-2", p.puuid === focusPuuid && "bg-primary/10")}
            >
              <ChampionIcon data={data} championId={p.championId} size={40} />
              <div className="grid grid-cols-2 gap-0.5">
                <SpellIcon data={data} spellId={p.spell1Id} size={18} />
                <RuneIcon data={data} runeId={p.perks?.perkIds[0]} size={18} className="bg-black/40" />
                <SpellIcon data={data} spellId={p.spell2Id} size={18} />
                <RuneIcon data={data} runeId={p.perks?.perkSubStyle} size={18} className="p-0.5" />
              </div>
              <div className="min-w-0 flex-1">
                {name && tag ? (
                  <Link
                    href={`/player/${region.slug}/${riotIdToSlug({ gameName: name, tagLine: tag })}`}
                    className={cn("block truncate text-sm hover:underline", p.puuid === focusPuuid && "font-semibold")}
                  >
                    {name}
                  </Link>
                ) : (
                  <span className="text-sm text-muted-foreground">{p.bot ? "Bot" : "Unbekannt"}</span>
                )}
                <p className="truncate text-xs text-muted-foreground">{data.champions[p.championId]?.name}</p>
              </div>
              <div className="text-right text-xs">
                {rank ? (
                  <>
                    <p className="font-medium">
                      {formatTier(rank.tier, rank.rank)} · {rank.leaguePoints} LP
                    </p>
                    <p className="text-muted-foreground">
                      {pct(rank.wins / games)} WR · {games} Sp.
                    </p>
                  </>
                ) : (
                  <p className="text-muted-foreground">Unranked</p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function LiveSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-16 w-72" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-80" />
        <Skeleton className="h-80" />
      </div>
    </div>
  );
}
