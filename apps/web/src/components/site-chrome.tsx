import Link from "next/link";
import { SearchForm } from "@/components/search-form";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
        <Link href="/" className="shrink-0 text-lg font-bold tracking-tight">
          Alfons<span className="text-primary">.GG</span>
        </Link>
        <nav className="hidden items-center gap-4 text-sm text-muted-foreground sm:flex">
          <Link href="/demo" className="hover:text-foreground">
            Demo
          </Link>
          <Link href="/companion" className="hover:text-foreground">
            Companion
          </Link>
        </nav>
        <SearchForm compact className="ml-auto max-w-md" />
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t">
      <div className="mx-auto max-w-6xl px-4 py-6 text-xs leading-relaxed text-muted-foreground">
        Alfons.GG isn&apos;t endorsed by Riot Games and doesn&apos;t reflect the views or opinions of Riot
        Games or anyone officially involved in producing or managing Riot Games properties. Riot Games,
        and all associated properties are trademarks or registered trademarks of Riot Games, Inc.
      </div>
    </footer>
  );
}
