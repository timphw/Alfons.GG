import { Suspense } from "react";
import type { Metadata } from "next";
import { Notice } from "@/components/notice";
import { ConnectForm } from "./connect-form";

export const metadata: Metadata = { title: "Companion verbinden" };

export default function ConnectPage({ searchParams }: PageProps<"/companion/verbinden">) {
  return (
    <div className="mx-auto mt-10 max-w-md space-y-4">
      <h1 className="text-2xl font-bold">Companion verbinden</h1>
      <Suspense>
        <Connect searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Connect({ searchParams }: { searchParams: PageProps<"/companion/verbinden">["searchParams"] }) {
  const { port, state } = await searchParams;
  const p = Number(port);
  const valid = Number.isInteger(p) && p >= 1024 && p <= 65535 && typeof state === "string" && /^[0-9a-f]{32}$/.test(state);
  if (!valid) {
    return (
      <Notice title="Ungültiger Link">
        Diese Seite wird vom Companion geöffnet. Starte „Alfons.GG starten.cmd“ – der Browser öffnet sich dann automatisch.
      </Notice>
    );
  }
  return <ConnectForm port={p} state={state} />;
}
