import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { FeedClient } from "@/components/trips/feed-client";
import { UserAvatar } from "@/components/user-menu";
import { getActiveCities, getFeed, type FeedSort } from "@/data/trips";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Community feed" };

// Read-only for now. The Joiner part adds the "Join" button (see the `action` slot in FeedTripCard).
export default async function FeedPage({ searchParams }: PageProps<"/feed">) {
  const user = await requireUser();
  const sp = await searchParams;
  const city = typeof sp.city === "string" && sp.city ? sp.city : undefined;
  const sort: FeedSort = sp.sort === "desc" ? "desc" : "asc";

  const serverNow = new Date().toISOString();
  const [feed, cities] = await Promise.all([getFeed({ city, sort }), getActiveCities()]);

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-3">
          <Logo className="text-primary" />
          <div className="flex items-center gap-3 text-sm">
            <Link href="/organizer" className="font-medium text-muted-foreground hover:text-foreground">
              Organizer
            </Link>
            <ThemeToggle />
            <UserAvatar name={user.name} image={user.image} className="size-9" />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-8">
        <h1 className="mb-5 text-3xl font-bold tracking-tight">Available trips</h1>
        <FeedClient
          key={`${city ?? ""}|${sort}`}
          initialTrips={feed.trips}
          initialCursor={feed.nextCursor}
          cities={cities}
          city={city}
          sort={sort}
          serverNow={serverNow}
        />
      </main>
    </div>
  );
}
