"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Lädt die Server-Daten der Seite periodisch neu (nur wenn der Tab sichtbar ist). */
export function AutoRefresh({ seconds }: { seconds: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, seconds * 1000);
    return () => clearInterval(id);
  }, [router, seconds]);
  return null;
}
