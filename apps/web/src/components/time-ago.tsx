"use client";

import { useNow } from "@/hooks/use-now";

const rtf = new Intl.RelativeTimeFormat("de", { numeric: "auto" });

function format(ts: number, now: number): string {
  const diff = (ts - now) / 1000;
  const abs = Math.abs(diff);
  if (abs < 60) return rtf.format(Math.round(diff), "second");
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  return rtf.format(Math.round(diff / 86400), "day");
}

/** Relative Zeitangabe ("vor 3 Stunden"), clientseitig berechnet. */
export function TimeAgo({ ts }: { ts: number }) {
  const now = useNow(60_000);
  return (
    <time dateTime={new Date(ts).toISOString()} title={new Date(ts).toLocaleString("de-DE")}>
      {now === null ? " " : format(ts, now)}
    </time>
  );
}
