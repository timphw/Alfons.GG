"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SearchIcon } from "lucide-react";
import { REGIONS, DEFAULT_REGION, parseRiotId, riotIdToSlug } from "@alfons/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function SearchForm({ compact = false, className }: { compact?: boolean; className?: string }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState(DEFAULT_REGION);
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const id = parseRiotId(query);
    if (!id) {
      setError("Bitte Riot ID im Format Name#Tag eingeben.");
      return;
    }
    setError(null);
    router.push(`/player/${region}/${riotIdToSlug(id)}`);
  }

  return (
    <form onSubmit={onSubmit} className={cn("w-full", className)}>
      <div className={cn("flex gap-2", compact ? "h-9" : "h-12")}>
        <select
          aria-label="Region"
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          className="h-full rounded-lg border border-input bg-card px-2 text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {REGIONS.map((r) => (
            <option key={r.slug} value={r.slug}>
              {r.slug.toUpperCase()}
            </option>
          ))}
        </select>
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Riot ID, z.B. Alfons#EUW"
          aria-label="Riot ID"
          aria-invalid={!!error}
          className={cn("h-full bg-card", !compact && "text-base")}
        />
        <Button type="submit" className="h-full" aria-label="Suchen">
          <SearchIcon />
          {!compact && "Suchen"}
        </Button>
      </div>
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </form>
  );
}
