import { ArrowRight, CalendarPlus, Compass, Mail, Users } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { HeroBackdrop } from "@/components/hero-backdrop";
import { MainNav } from "@/components/main-nav";
import { FeedClient } from "@/components/trips/feed-client";
import { apiGet } from "@/lib/api";
import type { FeedTrip } from "server-app/shared";
import { cn } from "@/lib/utils";

export default async function HomePage({ searchParams }: PageProps<"/">) {
  const { forbidden } = await searchParams;

  let feed: { trips: FeedTrip[]; nextCursor: string | null; now: string } | null = null;
  let cities: string[] = [];
  // The landing must render even when the feed is down; the island shows an error with Retry.
  const [pageResult, citiesResult] = await Promise.allSettled([
    apiGet<{ trips: FeedTrip[]; nextCursor: string | null; now: string }>("/api/feed"),
    apiGet<{ cities: string[] }>("/api/feed/cities"),
  ]);
  if (pageResult.status === "fulfilled") feed = pageResult.value;
  if (citiesResult.status === "fulfilled") cities = citiesResult.value.cities;

  return (
    <main className="bg-slate-950">
      <section id="home" className="relative isolate overflow-hidden text-white">
        <HeroBackdrop />
        {/* Fades the photo into the dark trips section below, so there is no hard edge. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-48 bg-gradient-to-b from-transparent to-slate-950"
        />
        <MainNav />

        {/* Content height only (not full screen), so the trip feed already peeks in below at the top of the page. */}
        <div className="mx-auto flex max-w-5xl flex-col items-center px-5 pb-14 pt-28 text-center md:pt-32">
          {forbidden && (
            <p className="mb-6 rounded-full bg-red-500/90 px-4 py-2 text-sm font-medium">
              That page is for administrators only.
            </p>
          )}

          <h1 className="text-4xl font-bold tracking-tight drop-shadow sm:text-5xl md:text-6xl">
            Explore. Plan. Travel{" "}
            <span className="font-serif italic text-orange-400">Together.</span>
          </h1>
          <p className="mt-5 text-lg text-white/90 sm:text-xl">Choose your role to get started:</p>

          <div className="mt-10 grid w-full gap-6 md:grid-cols-2">
            <RoleCard
              href="/organizer"
              title="Organizer"
              description="Plan and lead amazing trips, create your own adventures!"
              cta="Continue as Organizer"
              icon={<CalendarPlus className="size-10" />}
              tone="orange"
            />
            <RoleCard
              href="/joiner"
              title="Joiner"
              description="Discover upcoming trips, and join the adventure!"
              cta="Continue as Joiner"
              icon={<Users className="size-10" />}
              tone="teal"
            />
          </div>
        </div>
      </section>

      {/* Same dark palette as the hero; `dark` switches the theme tokens of everything inside. */}
      <section id="trips" className="dark relative isolate scroll-mt-8 overflow-x-clip bg-slate-950 text-slate-100">
        <div
          aria-hidden
          className="pointer-events-none absolute top-24 left-1/2 -z-10 h-80 w-[56rem] max-w-[200%] -translate-x-1/2 rounded-full bg-gradient-to-r from-orange-500/15 via-transparent to-teal-400/15 blur-3xl"
        />
        {/* On wide screens the feed sits between two illustrated panels that stay in view while scrolling. */}
        <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_minmax(0,56rem)_minmax(0,1fr)]">
          <DecorPanel src="/decor/tropic-sunset.svg" side="left" />
          <div className="mx-auto w-full max-w-4xl px-5 pb-16 pt-2">
            <div className="mb-8 text-center">
              <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl border border-orange-400/40 bg-orange-400/10 text-orange-400">
                <Compass className="size-6" />
              </div>
              <h2 className="text-3xl font-bold tracking-tight text-white">
                Upcoming <span className="font-serif italic text-orange-400">trips</span>
              </h2>
              <p className="mt-2 text-slate-300">Find a destination and a crew to share it with.</p>
            </div>
            <FeedClient
              initialTrips={feed?.trips ?? []}
              initialCursor={feed?.nextCursor ?? null}
              cities={cities}
              serverNow={feed?.now ?? new Date().toISOString()}
              initialError={feed === null}
              citiesError={citiesResult.status === "rejected"}
            />
          </div>
          <DecorPanel src="/decor/tropic-lagoon.svg" side="right" />
        </div>
      </section>
      {/* About and Contact keep the hero's dark palette too, so the page has no light/dark edge. */}
      <div className="dark bg-slate-950 text-slate-100">
        <section id="about" className="mx-auto max-w-6xl scroll-mt-8 px-5 py-20">
          <h2 className="text-3xl font-bold tracking-tight">About TripTogether</h2>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            TripTogether is for people who want to travel but have nobody to do it with. Create an account, then
            organize a trip or join one that another traveler already planned, and meet people who share your
            interests.
          </p>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {[
              { icon: <CalendarPlus className="size-6" />, title: "Organize", text: "Set the destination, dates, budget and group size, then share the trip with the whole community." },
              { icon: <Compass className="size-6" />, title: "Discover", text: "Browse the latest trips right here on the home page and filter them by destination." },
              { icon: <Users className="size-6" />, title: "Travel together", text: "Join a trip, chat with the group and turn new acquaintances into travel buddies." },
            ].map((f) => (
              <div key={f.title} className="rounded-2xl border border-white/10 bg-slate-900/70 p-6 backdrop-blur-md">
                <div className="mb-4 flex size-11 items-center justify-center rounded-xl bg-orange-400/10 text-orange-400">
                  {f.icon}
                </div>
                <h3 className="text-lg font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{f.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="contact" className="scroll-mt-8 border-t border-white/10 bg-slate-900/40">
          <div className="mx-auto flex max-w-6xl flex-col items-start gap-3 px-5 py-14">
            <h2 className="text-3xl font-bold tracking-tight">Contact</h2>
            <p className="text-muted-foreground">Questions about the project? We would love to hear from you.</p>
            <p className="flex items-center gap-2 font-medium">
              <Mail className="size-4 text-orange-400" /> contact@triptogether.example
            </p>
            <p className="mt-6 text-xs text-muted-foreground">
              Demo project (proof of concept). All trips and people shown are fictional.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

// Decorative illustration beside the feed (wide screens only); it fades out at the top and bottom edges.
function DecorPanel({ src, side }: { src: string; side: "left" | "right" }) {
  return (
    <div aria-hidden className="hidden xl:block">
      <div
        className={cn(
          "sticky top-10 mt-44 h-[min(78vh,46rem)] w-[min(calc(100%-3rem),18rem)] overflow-hidden rounded-[2rem] border border-white/10 shadow-2xl shadow-black/50",
          "[mask-image:linear-gradient(to_bottom,transparent,black_10%,black_90%,transparent)]",
          side === "left" ? "ml-auto mr-2" : "ml-2 mr-auto",
        )}
      >
        <div className="relative size-full">
          <Image src={src} alt="" fill unoptimized sizes="18rem" className="object-cover" />
        </div>
      </div>
    </div>
  );
}

function RoleCard(props: {
  href: string;
  title: string;
  description: string;
  cta: string;
  icon: React.ReactNode;
  tone: "orange" | "teal";
}) {
  const orange = props.tone === "orange";
  return (
    <div
      className={cn(
        "flex flex-col items-start rounded-3xl border-2 bg-slate-950/45 p-7 text-left shadow-2xl backdrop-blur-md",
        orange ? "border-orange-400/80" : "border-teal-300/80",
      )}
    >
      <div className={orange ? "text-orange-300" : "text-teal-200"}>{props.icon}</div>
      <h2 className="mt-4 text-3xl font-semibold">{props.title}</h2>
      <p className="mt-2 text-base text-white/85">{props.description}</p>
      <Link
        href={props.href}
        className={cn(
          "mt-6 inline-flex h-12 items-center gap-2 rounded-full px-7 text-base font-semibold text-white transition-transform hover:scale-[1.03]",
          orange ? "bg-orange-500 hover:bg-orange-400" : "bg-teal-500 hover:bg-teal-400",
        )}
      >
        {props.cta} <ArrowRight className="size-4" />
      </Link>
    </div>
  );
}
