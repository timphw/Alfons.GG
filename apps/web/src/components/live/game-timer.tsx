"use client";

import { useNow } from "@/hooks/use-now";
import { formatDuration } from "@/lib/format";

/** Tickende Spielzeit ab gameStartTime (epoch ms). 0 = Ladebildschirm. */
export function GameTimer({ gameStartTime }: { gameStartTime: number }) {
  const now = useNow(1000);
  if (!gameStartTime) return <span>Ladebildschirm</span>;
  if (now === null) return <span className="tabular-nums">–:––</span>;
  return <span className="tabular-nums">{formatDuration((now - gameStartTime) / 1000)}</span>;
}
