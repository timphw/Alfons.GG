"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { submitAccessCode } from "./actions";

export function AccessForm({ next }: { next: string }) {
  const [error, action, pending] = useActionState(submitAccessCode, null);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="next" value={next} />
      <Input name="code" type="password" placeholder="Zugangscode" autoFocus className="h-10 bg-card text-center" />
      <Button type="submit" disabled={pending} className="h-10 w-full">
        {pending ? "Prüfe …" : "Weiter"}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </form>
  );
}
