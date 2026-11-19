import { Suspense } from "react";
import type { Metadata } from "next";
import { AccessForm } from "./access-form";

export const metadata: Metadata = { title: "Zugang" };

export default function AccessPage({ searchParams }: PageProps<"/zugang">) {
  return (
    <div className="mx-auto mt-16 max-w-sm space-y-4 text-center">
      <h1 className="text-2xl font-bold">
        Alfons<span className="text-primary">.GG</span>
      </h1>
      <p className="text-sm text-muted-foreground">Privater Bereich – bitte den Zugangscode eingeben.</p>
      <Suspense>
        <NextParam searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function NextParam({ searchParams }: { searchParams: PageProps<"/zugang">["searchParams"] }) {
  const { next } = await searchParams;
  return <AccessForm next={typeof next === "string" ? next : "/"} />;
}
