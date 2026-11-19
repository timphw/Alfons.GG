"use client";

/* eslint-disable @next/next/no-img-element -- Data-Dragon-Icons */
import { DDRAGON, ddragonUrl, type LiveEvent, type LivePlayer, type LiveSnapshot, type TeamSide } from "@alfons/shared";
import { RadioIcon, SkullIcon, WifiOffIcon } from "lucide-react";
import { useLiveState } from "@/hooks/use-live-state";
import { CoachPanel } from "@/components/live/coach-panel";
import { useNow } from "@/hooks/use-now";
import { formatDuration, POSITION_LABEL } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Nach dieser Zeit ohne Snapshot gilt der Companion als getrennt. */
const STALE_MS = 15_000;

export interface LiveAssets {
  version: string;
  /** Runen-/Stil-ID → Icon-Pfad */
  runeIcons: Record<string, string>;
}

export function LiveScoreboard({
  puuid,
  assets,
  fallback,
  streamUrl,
}: {
  puuid: string;
  assets: LiveAssets;
  fallback: React.ReactNode;
  /** Abweichende SSE-Quelle (z.B. Demo) */
  streamUrl?: string;
}) {
  const conn = useLiveState(puuid, streamUrl);
  const now = useNow(1000);

  if (conn.status !== "live") {
    return (
      <>
        {conn.status === "connecting" && (
          <p className="text-xs text-muted-foreground">Verbinde mit Live-Stream …</p>
        )}
        {fallback}
      </>
    );
  }

  const { snapshot: s, receivedAt } = conn.state;
  const age = now === null ? 0 : now - receivedAt;
  const stale = s.status === "in-game" && age > STALE_MS;
  const gameTime = s.status === "in-game" && !stale ? s.gameTime + Math.max(0, age) / 1000 : s.gameTime;

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-center gap-3 text-sm">
        {s.status === "ended" ? (
          <span className={cn("font-semibold", s.result === "Win" ? "text-win" : "text-loss")}>
            Spiel beendet · {s.result === "Win" ? "Sieg" : "Niederlage"}
          </span>
        ) : stale ? (
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <WifiOffIcon className="size-4" /> Companion getrennt
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-loss">
            <RadioIcon className="size-4 animate-pulse" /> Live via Companion
          </span>
        )}
        <span className="font-mono text-lg font-semibold tabular-nums">{formatDuration(gameTime)}</span>
        <span className="text-muted-foreground">{s.gameMode}</span>
        <span className="ml-auto text-xs text-muted-foreground">
          {now === null ? "" : `Update vor ${Math.max(0, Math.round(age / 1000))} s`}
        </span>
      </header>

      {s.status === "in-game" && (
        <CoachPanel coach={conn.state.coach} gameTime={gameTime} gold={s.activePlayer?.currentGold} version={assets.version} />
      )}

      <TeamSummary s={s} />

      <div className="grid gap-4 xl:grid-cols-[1fr_300px]">
        <div className="space-y-4">
          {(["ORDER", "CHAOS"] as const).map((team) => (
            <TeamBoard
              key={team}
              team={team}
              players={s.players.filter((p) => p.team === team)}
              activeRiotId={s.activePlayer?.riotId}
              assets={assets}
            />
          ))}
        </div>
        <aside className="space-y-4">
          <ActivePlayerCard s={s} />
          <EventFeed s={s} assets={assets} />
        </aside>
      </div>
    </section>
  );
}

const DRAGON_COLOR: Record<string, string> = {
  Fire: "bg-orange-500",
  Water: "bg-sky-500",
  Earth: "bg-amber-700",
  Air: "bg-slate-200",
  Hextech: "bg-cyan-300",
  Chemtech: "bg-lime-500",
  Elder: "bg-violet-400",
};

function TeamSummary({ s }: { s: LiveSnapshot }) {
  const o = s.teams.ORDER;
  const c = s.teams.CHAOS;
  const diff = o.itemGold - c.itemGold;
  const total = o.itemGold + c.itemGold || 1;
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
        <TeamStats side="ORDER" t={o} />
        <div className="text-center text-3xl font-black tabular-nums">
          <span className="text-blue-team">{o.kills}</span>
          <span className="mx-2 text-muted-foreground">:</span>
          <span className="text-red-team">{c.kills}</span>
        </div>
        <TeamStats side="CHAOS" t={c} />
      </div>
      <div className="mt-3">
        <div className="flex h-2 overflow-hidden rounded-full bg-red-team/70">
          <div className="bg-blue-team" style={{ width: `${(o.itemGold / total) * 100}%` }} />
        </div>
        <p className="mt-1 text-center text-xs text-muted-foreground">
          Item-Gold {fmtGold(o.itemGold)} vs {fmtGold(c.itemGold)} ·{" "}
          <span className={diff >= 0 ? "text-blue-team" : "text-red-team"}>
            {diff >= 0 ? "+" : "−"}
            {fmtGold(Math.abs(diff))}
          </span>
        </p>
      </div>
    </div>
  );
}

function TeamStats({ side, t }: { side: TeamSide; t: LiveSnapshot["teams"]["ORDER"] }) {
  const items: Array<[string, number | string]> = [
    ["Türme", t.towers],
    ["Inhibs", t.inhibitors],
    ["Barone", t.barons],
    ["Herolde", t.heralds],
    ["Grubs", t.grubs],
  ];
  return (
    <div className={cn("space-y-2", side === "CHAOS" && "text-right")}>
      <p className={cn("text-sm font-semibold", side === "ORDER" ? "text-blue-team" : "text-red-team")}>
        {side === "ORDER" ? "Blaues Team" : "Rotes Team"}
      </p>
      <div className={cn("flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground", side === "CHAOS" && "justify-end")}>
        {items.map(([label, v]) => (
          <span key={label}>
            {label} <b className="text-foreground">{v}</b>
          </span>
        ))}
      </div>
      <div className={cn("flex gap-1", side === "CHAOS" && "justify-end")}>
        {t.dragons.map((d, i) => (
          <span key={i} title={`${d}-Drache`} className={cn("size-3 rounded-full", DRAGON_COLOR[d] ?? "bg-muted")} />
        ))}
      </div>
    </div>
  );
}

function TeamBoard({
  team,
  players,
  activeRiotId,
  assets,
}: {
  team: TeamSide;
  players: LivePlayer[];
  activeRiotId?: string;
  assets: LiveAssets;
}) {
  const blue = team === "ORDER";
  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className={cn("text-xs", blue ? "bg-blue-team/10 text-blue-team" : "bg-red-team/10 text-red-team")}>
            <th className="px-3 py-1.5 text-left font-semibold">{blue ? "Blaues Team" : "Rotes Team"}</th>
            <th className="px-2 text-center font-medium">KDA</th>
            <th className="px-2 text-center font-medium">CS</th>
            <th className="px-2 text-left font-medium">Items</th>
            <th className="px-3 text-right font-medium">Gold*</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {players.map((p) => (
            <tr key={p.riotId} className={cn(p.riotId === activeRiotId && "bg-primary/10", p.isDead && "opacity-60")}>
              <td className="px-3 py-1.5">
                <div className="flex items-center gap-2">
                  <div className="relative shrink-0">
                    <img
                      src={ddragonUrl.championIcon(assets.version, p.champion)}
                      alt={p.championName}
                      title={p.championName}
                      width={36}
                      height={36}
                      className={cn("rounded-md", p.isDead && "grayscale")}
                    />
                    <span className="absolute -right-1 -bottom-1 rounded-full bg-background px-1 text-[10px] leading-4">
                      {p.level}
                    </span>
                    {p.isDead && (
                      <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white">
                        {Math.ceil(p.respawnTimer)}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col gap-0.5">
                    {p.spells.map((sp, i) => (
                      <img
                        key={i}
                        src={`${DDRAGON}/cdn/${assets.version}/img/spell/${sp}.png`}
                        alt={sp}
                        title={sp.replace(/^Summoner/, "")}
                        width={16}
                        height={16}
                        className="rounded-sm"
                      />
                    ))}
                  </div>
                  <RuneImg id={p.keystone} assets={assets} size={20} />
                  <div className="min-w-0">
                    <p className={cn("truncate", p.riotId === activeRiotId && "font-semibold")}>{p.gameName}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.championName}
                      {p.position && ` · ${POSITION_LABEL[p.position] ?? p.position}`}
                    </p>
                  </div>
                  {p.isDead && <SkullIcon className="size-3.5 text-loss" />}
                </div>
              </td>
              <td className="px-2 text-center tabular-nums whitespace-nowrap">
                {p.kills}/<span className="text-loss">{p.deaths}</span>/{p.assists}
              </td>
              <td className="px-2 text-center tabular-nums">{p.cs}</td>
              <td className="px-2">
                <div className="flex gap-0.5">
                  {Array.from({ length: 7 }, (_, slot) => {
                    const it = p.items.find((i) => i.slot === slot);
                    return it ? (
                      <img
                        key={slot}
                        src={ddragonUrl.itemIcon(assets.version, it.id)}
                        alt={it.name}
                        title={`${it.name}${it.price ? ` (${it.price}g)` : ""}${it.count > 1 ? ` ×${it.count}` : ""}`}
                        width={26}
                        height={26}
                        className={cn("rounded", slot === 6 && "ml-1 rounded-full")}
                      />
                    ) : (
                      <span key={slot} className={cn("size-[26px] rounded bg-muted", slot === 6 && "ml-1 rounded-full")} />
                    );
                  })}
                </div>
              </td>
              <td className="px-3 text-right text-xs text-muted-foreground tabular-nums">{fmtGold(p.itemGold)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="px-3 py-1 text-[10px] text-muted-foreground">* Gold = Wert der gekauften Items</p>
    </div>
  );
}

function RuneImg({ id, assets, size }: { id?: number; assets: LiveAssets; size: number }) {
  const icon = id ? assets.runeIcons[String(id)] : undefined;
  if (!icon) return null;
  return <img src={ddragonUrl.runeIcon(icon)} alt="" width={size} height={size} className="rounded-full bg-black/40" />;
}

function ActivePlayerCard({ s }: { s: LiveSnapshot }) {
  const ap = s.activePlayer;
  if (!ap) return null;
  const st = ap.stats;
  const rows: Array<[string, number | undefined, (v: number) => string]> = [
    ["AD", st.attackDamage, (v) => v.toFixed(0)],
    ["AP", st.abilityPower, (v) => v.toFixed(0)],
    ["Rüstung", st.armor, (v) => v.toFixed(0)],
    ["MR", st.magicResist, (v) => v.toFixed(0)],
    ["AS", st.attackSpeed, (v) => v.toFixed(2)],
    ["Haste", st.abilityHaste, (v) => v.toFixed(0)],
    ["Leben", st.maxHealth, (v) => v.toFixed(0)],
    ["MS", st.moveSpeed, (v) => v.toFixed(0)],
  ];
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs text-muted-foreground">{ap.riotId}</p>
      <p className="mt-1 text-3xl font-bold text-primary tabular-nums">{fmtGold(ap.currentGold)}</p>
      <p className="text-xs text-muted-foreground">verfügbares Gold · Level {ap.level}</p>
      <dl className="mt-3 grid grid-cols-4 gap-x-2 gap-y-1 text-xs">
        {rows
          .filter(([, v]) => v !== undefined)
          .map(([label, v, f]) => (
            <div key={label}>
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="font-medium tabular-nums">{f(v!)}</dd>
            </div>
          ))}
      </dl>
    </div>
  );
}

const EVENT_LABEL: Record<string, string> = {
  DragonKill: "Drache",
  BaronKill: "Baron",
  HeraldKill: "Herold",
  HordeKill: "Voidgrub",
  AtakhanKill: "Atakhan",
  TurretKilled: "Turm",
  InhibKilled: "Inhibitor",
  FirstBlood: "First Blood",
  FirstBrick: "Erster Turm",
  Ace: "Ace",
  GameEnd: "Spielende",
};

function EventFeed({ s, assets }: { s: LiveSnapshot; assets: LiveAssets }) {
  const byName = new Map<string, LivePlayer>();
  for (const p of s.players) {
    byName.set(p.gameName, p);
    byName.set(p.riotId, p);
  }
  const events = [...s.events].reverse().filter((e) => e.type !== "Multikill");
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="mb-2 text-sm font-semibold">Ereignisse</p>
      <ul className="space-y-1.5 text-xs">
        {events.length === 0 && <li className="text-muted-foreground">Noch nichts passiert.</li>}
        {events.slice(0, 14).map((e) => (
          <EventRow key={e.id} e={e} byName={byName} assets={assets} />
        ))}
      </ul>
    </div>
  );
}

function EventRow({ e, byName, assets }: { e: LiveEvent; byName: Map<string, LivePlayer>; assets: LiveAssets }) {
  const teamColor = e.team === "ORDER" ? "text-blue-team" : e.team === "CHAOS" ? "text-red-team" : "";
  const champ = (name?: string) => {
    const p = name ? byName.get(name) : undefined;
    if (!p) return <span className="text-muted-foreground">{name ? shortName(name) : "?"}</span>;
    return (
      <img
        src={ddragonUrl.championIcon(assets.version, p.champion)}
        alt={p.championName}
        title={`${p.gameName} (${p.championName})`}
        width={18}
        height={18}
        className={cn("inline rounded-sm ring-1", p.team === "ORDER" ? "ring-blue-team" : "ring-red-team")}
      />
    );
  };
  return (
    <li className="flex items-center gap-2">
      <span className="w-9 text-muted-foreground tabular-nums">{formatDuration(e.time)}</span>
      {e.type === "ChampionKill" ? (
        <span className="flex items-center gap-1.5">
          {champ(e.killer)} <span className="text-muted-foreground">⚔</span> {champ(e.victim)}
        </span>
      ) : (
        <span className={cn("flex items-center gap-1.5", teamColor)}>
          {e.killer && byName.has(e.killer) && champ(e.killer)}
          {EVENT_LABEL[e.type] ?? e.type}
          {e.type === "DragonKill" && e.detail && <span className="text-muted-foreground">({e.detail})</span>}
          {e.type === "GameEnd" && e.detail}
        </span>
      )}
    </li>
  );
}

function shortName(name: string) {
  if (/^Minion/.test(name)) return "Vasallen";
  if (/^Turret/.test(name)) return "Turm";
  return name.length > 14 ? `${name.slice(0, 13)}…` : name;
}

function fmtGold(g: number) {
  return g >= 1000 ? `${(g / 1000).toFixed(1)}k` : String(Math.round(g));
}
