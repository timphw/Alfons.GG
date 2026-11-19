"use client";

import { useEffect, useState } from "react";
import type { LiveState } from "@alfons/shared";

export type LiveConnection =
  | { status: "connecting" }
  | { status: "empty" }
  | { status: "live"; state: LiveState }
  | { status: "error" };

/** Abonniert /api/live/stream per Server-Sent Events. EventSource verbindet sich selbst neu. */
export function useLiveState(puuid: string): LiveConnection {
  const [conn, setConn] = useState<LiveConnection>({ status: "connecting" });

  useEffect(() => {
    const es = new EventSource(`/api/live/stream?puuid=${encodeURIComponent(puuid)}`);
    es.addEventListener("state", (e) => {
      try {
        setConn({ status: "live", state: JSON.parse((e as MessageEvent<string>).data) as LiveState });
      } catch {
        // ungültiges Event ignorieren
      }
    });
    es.addEventListener("empty", () => setConn((c) => (c.status === "live" ? c : { status: "empty" })));
    es.onerror = () => setConn((c) => (c.status === "live" ? c : { status: "error" }));
    return () => es.close();
  }, [puuid]);

  return conn;
}
