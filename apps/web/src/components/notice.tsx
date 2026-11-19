import { Card, CardContent } from "@/components/ui/card";

export function Notice({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <Card className="mx-auto mt-10 max-w-xl">
      <CardContent className="space-y-2 py-2 text-center">
        <h2 className="text-lg font-semibold">{title}</h2>
        {children && <div className="text-sm text-muted-foreground">{children}</div>}
      </CardContent>
    </Card>
  );
}

export const PLAYER_ERRORS = {
  "bad-region": "Unbekannte Region.",
  "bad-riot-id": "Ungültige Riot ID. Format: Name#Tag",
  "not-found": "Spieler nicht gefunden. Stimmen Name, Tag und Region?",
} as const;
