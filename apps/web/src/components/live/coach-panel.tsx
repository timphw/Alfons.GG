"use client";

/* eslint-disable @next/next/no-img-element -- Data-Dragon-Icons */
import { ddragonUrl, type CoachResult, type CoachTip } from "@alfons/shared";
import {
  AlertTriangleIcon,
  CoinsIcon,
  CrosshairIcon,
  EyeIcon,
  FlagIcon,
  ShoppingBagIcon,
  SwordsIcon,
  TreesIcon,
  WheatIcon,
  SwordIcon,
} from "lucide-react";
import { formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";

const KIND_ICON: Record<CoachTip["kind"], React.ComponentType<{ className?: string }>> = {
  shop: ShoppingBagIcon,
  objective: FlagIcon,
  danger: AlertTriangleIcon,
  macro: SwordsIcon,
  farm: WheatIcon,
  vision: EyeIcon,
  lane: SwordIcon,
  jungle: TreesIcon,
};

const PRIORITY_STYLE: Record<CoachTip["priority"], string> = {
  high: "border-primary/60 bg-primary/10",
  medium: "border-border bg-background/40",
  info: "border-transparent bg-transparent text-muted-foreground",
};

export function CoachPanel({
  coach,
  gameTime,
  gold,
  version,
}: {
  coach: CoachResult | undefined;
  gameTime: number;
  gold: number | undefined;
  version: string;
}) {
  if (!coach) return null;
  const { build, tips, objectives } = coach;
  const plan = build?.nextPurchase;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      {/* Was jetzt? */}
      <section className="rounded-xl border bg-card p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="flex items-center gap-2 font-semibold">
            <CrosshairIcon className="size-4 text-primary" /> Was jetzt?
          </h2>
          <div className="ml-auto flex flex-wrap gap-1.5">
            {objectives.map((o) => {
              const inSec = o.spawnAt - gameTime;
              const up = inSec <= 0;
              return (
                <span
                  key={o.name}
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-xs tabular-nums",
                    up ? "border-primary/60 text-primary" : inSec <= 75 ? "border-loss/60 text-loss" : "text-muted-foreground",
                  )}
                  title={`Spawn ca. ${formatDuration(o.spawnAt)}`}
                >
                  {o.name} {up ? "verfügbar" : `in ${formatDuration(inSec)}`}
                </span>
              );
            })}
          </div>
        </div>
        {tips.length === 0 ? (
          <p className="text-sm text-muted-foreground">Alles im Griff – weiter farmen und auf Objectives achten.</p>
        ) : (
          <ul className="space-y-2">
            {tips.map((t) => {
              const Icon = KIND_ICON[t.kind];
              return (
                <li key={t.id} className={cn("flex gap-3 rounded-lg border px-3 py-2 text-sm", PRIORITY_STYLE[t.priority])}>
                  <Icon className={cn("mt-0.5 size-4 shrink-0", t.priority === "high" ? "text-primary" : "text-muted-foreground")} />
                  <div>
                    <p className={cn(t.priority === "high" && "font-medium")}>{t.text}</p>
                    {t.detail && <p className="text-xs text-muted-foreground">{t.detail}</p>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Nächster Kauf + Build */}
      <section className="rounded-xl border bg-card p-4">
        <h2 className="mb-3 flex items-center gap-2 font-semibold">
          <CoinsIcon className="size-4 text-primary" /> Nächster Kauf
          {gold !== undefined && <span className="ml-auto text-sm font-normal text-primary tabular-nums">{Math.floor(gold)} g</span>}
        </h2>
        {!build || !build.nextItem || !plan ? (
          <p className="text-sm text-muted-foreground">Keine Empfehlung verfügbar.</p>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <img src={ddragonUrl.itemIcon(version, build.nextItem.id)} alt="" width={44} height={44} className="rounded-md ring-1 ring-primary/50" />
              <div className="min-w-0">
                <p className="truncate font-medium">{build.nextItem.name}</p>
                <p className="text-xs text-muted-foreground">
                  {plan.completes ? (
                    <span className="text-primary">Jetzt kaufbar!</span>
                  ) : (
                    <>noch {plan.goldMissing} g von {plan.remainingCost} g</>
                  )}
                </p>
              </div>
            </div>
            {!plan.completes && (
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${Math.min(100, ((plan.remainingCost - plan.goldMissing) / Math.max(1, plan.remainingCost)) * 100)}%` }}
                />
              </div>
            )}
            {plan.buyNow.length > 0 && !plan.completes && (
              <div>
                <p className="mb-1 text-xs text-muted-foreground">Jetzt bezahlbar ({plan.buyNowCost} g):</p>
                <div className="flex flex-wrap gap-2">
                  {plan.buyNow.map((b, i) => (
                    <span key={`${b.id}-${i}`} className="flex items-center gap-1.5 rounded-md bg-background px-1.5 py-1 text-xs">
                      <img src={ddragonUrl.itemIcon(version, b.id)} alt="" width={22} height={22} className="rounded" />
                      {b.name} <span className="text-muted-foreground">{b.cost}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
            {build.nextItem.reasons.length > 0 && (
              <ul className="space-y-0.5 text-xs text-muted-foreground">
                {build.nextItem.reasons.map((r) => (
                  <li key={r}>• {r}</li>
                ))}
              </ul>
            )}

            <div>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">Danach</p>
              <ol className="space-y-1.5">
                {build.items.slice(1, 5).map((it, i) => (
                  <li key={it.id} className="flex items-center gap-2 text-xs" title={it.reasons.join(" · ")}>
                    <span className="w-3 text-muted-foreground">{i + 2}</span>
                    <img src={ddragonUrl.itemIcon(version, it.id)} alt="" width={24} height={24} className="rounded" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{it.name}</span>
                      <span className="block truncate text-muted-foreground">{it.reasons[0]}</span>
                    </span>
                    <span className="text-muted-foreground tabular-nums">{it.cost}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
