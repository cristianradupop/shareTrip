import { Mail } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { ArrowBadge } from "@/components/arrow-badge";
import { MainNav } from "@/components/main-nav";
import { FeedClient } from "@/components/trips/feed-client";
import { apiGet } from "@/lib/api";
import type { FeedTrip } from "server-app/shared";
import { cn } from "@/lib/utils";
import bridgePhoto from "../../../public/photos/bridge.jpg";
import alpsPhoto from "../../../public/photos/alps-clouds.jpg";
import boatLakePhoto from "../../../public/photos/boat-lake.jpg";
import heroPhoto from "../../../public/photos/hero.jpg";
import roadtripPhoto from "../../../public/photos/roadtrip.jpg";
import tentPhoto from "../../../public/photos/tent.jpg";

const QUOTES = [
  {
    text: "The world is a book, and those who do not travel read only one page.",
    author: "Saint Augustine",
    photo: boatLakePhoto,
    alt: "A wooden boat on a turquoise mountain lake",
  },
  {
    text: "It is not the mountain we conquer, but ourselves.",
    author: "Sir Edmund Hillary",
    photo: alpsPhoto,
    alt: "Snowy peaks above a sea of clouds at sunset",
  },
  {
    text: "Not all those who wander are lost.",
    author: "J.R.R. Tolkien",
    photo: tentPhoto,
    alt: "A forest and a lake seen from inside an open tent",
  },
];

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
    <main className="mx-auto w-full max-w-[1920px] space-y-3 px-3 pt-3 sm:space-y-4 sm:px-4 sm:pt-4">
      {/* HERO: one big rounded photo card, headline bottom-left, call to action bottom-right. */}
      <section
        id="home"
        className="relative isolate flex min-h-[min(94svh,820px)] scroll-mt-4 flex-col overflow-hidden rounded-[2rem] bg-ink text-white"
      >
        <Image
          src={heroPhoto}
          alt="Two hikers with backpacks on a mountain trail below snowy peaks"
          fill
          priority
          placeholder="blur"
          sizes="(max-width: 1920px) 100vw, 1920px"
          className="-z-20 object-cover object-[60%_50%]"
        />
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-gradient-to-t from-black/80 via-black/20 to-black/45"
        />
        <MainNav />

        <div className="mt-auto grid gap-10 px-5 pb-8 pt-24 sm:px-10 sm:pb-12 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:items-end">
          <div>
            {forbidden && (
              <p className="mb-6 inline-block rounded-full bg-primary px-4 py-2 text-sm font-medium">
                That page is for administrators only.
              </p>
            )}
            <p className="mb-5 flex flex-wrap gap-x-8 gap-y-1 text-sm text-white/75">
              <span>Community trips</span>
              <span>Small groups</span>
              <span>Organize or join</span>
            </p>
            <h1 className="max-w-[14ch] text-5xl font-semibold leading-[1.02] tracking-tight sm:text-6xl lg:text-7xl">
              Explore. Plan. Travel together.
            </h1>
          </div>

          <div className="max-w-md lg:justify-self-end">
            <h2 className="text-2xl font-semibold tracking-tight">Don&apos;t wait for someone to go with</h2>
            <p className="mt-3 text-white/80">
              Organize a trip and let travelers find you, or join one that is already planned and meet your crew on
              the road.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/organizer"
                className="group inline-flex h-12 items-center gap-3 rounded-full bg-white py-1 pl-6 pr-1.5 text-sm font-semibold text-ink transition-colors hover:bg-white/90"
              >
                Organize a trip <ArrowBadge direction="right" className="size-9" />
              </Link>
              <Link
                href="/joiner"
                className="group inline-flex h-12 items-center gap-3 rounded-full py-1 pl-6 pr-1.5 text-sm font-semibold text-white ring-1 ring-white/40 backdrop-blur-md transition-colors hover:bg-white/10"
              >
                Join a trip <ArrowBadge direction="right" tone="light" className="size-9" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* QUOTES: three travel photos, each with a famous line about travel. Decorative, not navigation. */}
      <section aria-label="Travel quotes" className="grid gap-3 sm:gap-4 md:grid-cols-3">
        {QUOTES.map((q) => (
          <figure
            key={q.author}
            className="group relative isolate flex min-h-[22rem] flex-col justify-end overflow-hidden rounded-[2rem] p-7 text-white sm:p-8 lg:min-h-[26rem]"
          >
            <Image
              src={q.photo}
              alt={q.alt}
              fill
              placeholder="blur"
              sizes="(max-width: 768px) 100vw, 33vw"
              className="-z-20 object-cover transition-transform duration-[1.2s] ease-out group-hover:scale-105"
            />
            <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-black/85 via-black/35 to-black/5" />
            <span aria-hidden className="font-serif text-8xl leading-none text-primary">&ldquo;</span>
            <blockquote className="-mt-6 font-serif text-[1.9rem] leading-[1.12] text-balance sm:text-[2.2rem]">
              {q.text}
            </blockquote>
            <figcaption className="mt-5 flex items-center gap-3 text-xs font-medium uppercase tracking-[0.2em] text-white/75">
              <span aria-hidden className="h-px w-8 bg-primary" />
              {q.author}
            </figcaption>
          </figure>
        ))}
      </section>

      {/* TRIPS: sticky photo panel on wide screens, the live feed beside it. */}
      <section id="trips" className="scroll-mt-4 rounded-[2rem] bg-card p-5 sm:p-8 lg:p-10">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] xl:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] xl:gap-12">
          <div className="lg:sticky lg:top-6 lg:self-start">
            <p className="text-sm font-medium text-primary">Upcoming</p>
            <h2 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">Trips looking for travelers</h2>
            <p className="mt-4 text-muted-foreground">
              Pick a destination, check the dates and the budget, and ask the organizer for a seat.
            </p>
            {cities.length > 0 && (
              <p className="mt-6 flex items-baseline gap-3">
                <span className="text-4xl font-semibold text-primary">{cities.length}</span>
                <span className="text-sm text-muted-foreground">
                  {cities.length === 1 ? "destination" : "destinations"} on the feed today
                </span>
              </p>
            )}
            <div className="relative mt-8 hidden aspect-[4/5] overflow-hidden rounded-[1.5rem] lg:block">
              <Image
                src={bridgePhoto}
                alt="A traveler crossing a suspension bridge in a forest at sunrise"
                fill
                placeholder="blur"
                sizes="24rem"
                className="object-cover"
              />
            </div>
          </div>
          <div className="min-w-0">
            <FeedClient
              initialTrips={feed?.trips ?? []}
              initialCursor={feed?.nextCursor ?? null}
              cities={cities}
              serverNow={feed?.now ?? new Date().toISOString()}
              initialError={feed === null}
              citiesError={citiesResult.status === "rejected"}
            />
          </div>
        </div>
      </section>

      {/* ABOUT */}
      <section id="about" className="scroll-mt-4 rounded-[2rem] bg-card p-5 sm:p-8 lg:p-10">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
          <div>
            <h2 className="text-sm font-medium text-primary">About TripTogether</h2>
            <p className="mt-4 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
              For people who want to travel but have nobody to do it with.
            </p>
            <p className="mt-5 max-w-lg text-muted-foreground">
              Create an account, then organize a trip or join one that another traveler already planned, and meet
              people who share your interests.
            </p>
          </div>
          <div className="relative min-h-64 overflow-hidden rounded-[1.5rem]">
            <Image
              src={roadtripPhoto}
              alt="A yellow camper van on a desert road between red rocks"
              fill
              placeholder="blur"
              sizes="(max-width: 1024px) 100vw, 55vw"
              className="object-cover"
            />
          </div>
        </div>

        <div className="mt-10 grid gap-3 sm:gap-4 md:grid-cols-3">
          {[
            { n: "01", title: "Organize", text: "Set the destination, dates, budget and group size, then share the trip with the whole community." },
            { n: "02", title: "Discover", text: "Browse the latest trips right here on the home page and filter them by destination." },
            { n: "03", title: "Travel together", text: "Join a trip, chat with the group and turn new acquaintances into travel buddies." },
          ].map((f, i) => (
            <div
              key={f.title}
              className={cn(
                "flex min-h-52 flex-col justify-between rounded-[1.5rem] p-6",
                i === 1 ? "bg-ink text-ink-foreground" : "bg-muted",
              )}
            >
              <span className={cn("text-sm font-medium", i === 1 ? "text-primary" : "text-primary")}>{f.n}</span>
              <div>
                <h3 className="text-xl font-semibold tracking-tight">{f.title}</h3>
                <p className={cn("mt-2 text-sm", i === 1 ? "text-ink-foreground/70" : "text-muted-foreground")}>
                  {f.text}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CONTACT */}
      <section
        id="contact"
        className="flex scroll-mt-4 flex-col gap-6 rounded-[2rem] bg-primary p-7 text-primary-foreground sm:p-10 md:flex-row md:items-end md:justify-between"
      >
        <div>
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Contact</h2>
          <p className="mt-3 max-w-md text-primary-foreground/85">
            Questions about the project? We would love to hear from you.
          </p>
          <p className="mt-6 text-xs text-primary-foreground/75">
            Demo project (proof of concept). All trips and people shown are fictional.
          </p>
        </div>
        <a
          href="mailto:contact@triptogether.example"
          className="group inline-flex h-12 items-center gap-3 self-start rounded-full bg-white py-1 pl-6 pr-1.5 text-sm font-semibold text-ink md:self-auto"
        >
          <Mail className="size-4 text-primary" /> contact@triptogether.example
          <ArrowBadge tone="dark" className="size-9" />
        </a>
      </section>
    </main>
  );
}
