"use client";

import { useState, useTransition } from "react";
import { PlugZapIcon } from "lucide-react";
import { REGIONS, DEFAULT_REGION } from "@alfons/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createPairingCode } from "../actions";

const STORE_KEY = "alfons.companion.riotId";

function remembered(): { riotId: string; region: string } {
  try {
    const v = JSON.parse(localStorage.getItem(STORE_KEY) ?? "null") as { riotId: string; region: string } | null;
    if (v?.riotId) return v;
  } catch {}
  return { riotId: "", region: DEFAULT_REGION };
}

/** Riot ID eingeben → Pairing-Code erzeugen → direkt an den lokalen Companion übergeben. */
export function ConnectForm({ port, state }: { port: number; state: string }) {
  const [initial] = useState(() => (typeof window === "undefined" ? { riotId: "", region: DEFAULT_REGION } : remembered()));
  const [riotId, setRiotId] = useState(initial.riotId);
  const [region, setRegion] = useState(initial.region);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await createPairingCode(region, riotId);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      try {
        localStorage.setItem(STORE_KEY, JSON.stringify({ riotId, region }));
      } catch {}
      // Übergabe an den Companion auf diesem PC
      window.location.href = `http://127.0.0.1:${port}/pair?code=${encodeURIComponent(res.code)}&state=${state}`;
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-xl border bg-card p-5">
      <p className="text-sm text-muted-foreground">
        Mit welchem League-Account spielst du auf diesem PC? Der Companion schickt deine Live-Daten dann an diesen
        Account.
      </p>
      <div className="flex gap-2">
        <select
          aria-label="Region"
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          suppressHydrationWarning // Wert kommt aus localStorage
          className="h-10 rounded-lg border border-input bg-background px-2 text-sm"
        >
          {REGIONS.map((r) => (
            <option key={r.slug} value={r.slug}>
              {r.slug.toUpperCase()}
            </option>
          ))}
        </select>
        <Input
          value={riotId}
          onChange={(e) => setRiotId(e.target.value)}
          placeholder="Riot ID, z.B. Alfons#EUW"
          aria-label="Riot ID"
          autoFocus
          suppressHydrationWarning
          className="h-10 bg-background"
        />
      </div>
      <Button type="submit" disabled={pending || !riotId.trim()} className="h-10 w-full">
        <PlugZapIcon /> {pending ? "Verbinde …" : "Verbinden"}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </form>
  );
}
