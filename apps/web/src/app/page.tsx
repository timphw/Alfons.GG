import Link from "next/link";
import { RadioIcon, SwordsIcon, UserIcon } from "lucide-react";
import { SearchForm } from "@/components/search-form";

const FEATURES = [
  { icon: UserIcon, title: "Profil", text: "Rang, letzte Matches und Champion-Stats." },
  { icon: RadioIcon, title: "Live-Spiel", text: "Teams, Champions, Runen und Ränge des laufenden Spiels." },
  {
    icon: SwordsIcon,
    title: "Build-Coach",
    text: "Mit dem Companion: Live-Scoreboard und Item-Empfehlungen je nach Spielstand.",
  },
];

export default function Home() {
  return (
    <div className="flex flex-col items-center pt-16 sm:pt-24">
      <h1 className="text-5xl font-black tracking-tight sm:text-6xl">
        Alfons<span className="text-primary">.GG</span>
      </h1>
      <p className="mt-3 text-center text-muted-foreground">
        Dein League-of-Legends-Companion – Profile, Live-Spiele und Builds, die mitdenken.
      </p>
      <SearchForm className="mt-8 max-w-2xl" />
      <div className="mt-16 grid w-full max-w-4xl gap-4 sm:grid-cols-3">
        {FEATURES.map((f) => (
          <div key={f.title} className="rounded-xl border bg-card p-5">
            <f.icon className="size-5 text-primary" />
            <h2 className="mt-3 font-semibold">{f.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{f.text}</p>
          </div>
        ))}
      </div>
      <p className="mt-8 text-sm text-muted-foreground">
        Live-Scores im Browser?{" "}
        <Link href="/companion" className="text-primary underline-offset-4 hover:underline">
          Companion einrichten
        </Link>
      </p>
    </div>
  );
}
