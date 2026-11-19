"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Aktuelle Zeit, auf `intervalMs` quantisiert. Gibt beim Server-Render/Hydration `null` zurück,
 * damit kein Hydration-Mismatch entsteht.
 */
export function useNow(intervalMs: number): number | null {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const id = setInterval(onChange, intervalMs);
      return () => clearInterval(id);
    },
    [intervalMs],
  );
  return useSyncExternalStore(
    subscribe,
    () => Math.floor(Date.now() / intervalMs) * intervalMs,
    () => null,
  );
}
