"use client";

import { useState, useTransition } from "react";
import { CheckIcon, CopyIcon, KeyRoundIcon } from "lucide-react";
import { REGIONS, DEFAULT_REGION } from "@alfons/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createPairingCode, type PairingResult } from "./actions";

export function PairingForm() {
  const [riotId, setRiotId] = useState("");
  const [region, setRegion] = useState(DEFAULT_REGION);
  const [result, setResult] = useState<(PairingResult & { origin: string }) | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const origin = window.location.origin;
    startTransition(async () => {
      setResult({ ...(await createPairingCode(region, riotId)), origin });
    });
  }

  return (
    <div className="space-y-4">
      <form onSubmit={onSubmit} className="flex flex-wrap gap-2">
        <select
          aria-label="Region"
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          className="h-9 rounded-lg border border-input bg-card px-2 text-sm"
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
          placeholder="Deine Riot ID, z.B. Alfons#EUW"
          className="h-9 max-w-xs flex-1 bg-card"
          aria-label="Riot ID"
        />
        <Button type="submit" disabled={pending} className="h-9">
          <KeyRoundIcon /> {pending ? "Erzeuge …" : "Pairing-Code erzeugen"}
        </Button>
      </form>

      {result && !result.ok && <p className="text-sm text-destructive">{result.error}</p>}
      {result?.ok && (
        <div className="space-y-3 rounded-xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">
            Code für <b className="text-foreground">{result.riotId}</b> (10 Minuten gültig, einmalig):
          </p>
          <p className="font-mono text-4xl font-bold tracking-[0.3em] text-primary">{result.code}</p>
          <p className="text-sm text-muted-foreground">Im Companion-Ordner auf dem Spieler-PC ausführen:</p>
          <CopyLine text={`pnpm companion pair ${result.code} --server ${result.origin}`} />
        </div>
      )}
    </div>
  );
}

export function CopyLine({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2 rounded-lg bg-background px-3 py-2 font-mono text-sm">
      <code className="flex-1 overflow-x-auto whitespace-nowrap">{text}</code>
      <button
        type="button"
        aria-label="Kopieren"
        className="text-muted-foreground hover:text-foreground"
        onClick={() => {
          void navigator.clipboard.writeText(text).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          });
        }}
      >
        {copied ? <CheckIcon className="size-4" /> : <CopyIcon className="size-4" />}
      </button>
    </div>
  );
}
