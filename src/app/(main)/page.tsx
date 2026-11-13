import { ArrowRight, CalendarPlus, Compass, Mail, Users } from "lucide-react";
import Link from "next/link";
import { HeroBackdrop } from "@/components/hero-backdrop";
import { MainNav } from "@/components/main-nav";
import { cn } from "@/lib/utils";

export default async function HomePage({ searchParams }: PageProps<"/">) {
  const { forbidden } = await searchParams;

  return (
    <main>
      <section id="home" className="relative isolate min-h-screen overflow-hidden text-white">
        <HeroBackdrop />
        <MainNav />

        <div className="mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center px-5 pb-16 pt-28 text-center">
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
            { icon: <Compass className="size-6" />, title: "Discover", text: "Browse the community feed, filter by destination and sort by departure date." },
            { icon: <Users className="size-6" />, title: "Travel together", text: "Join a trip, chat with the group and turn new acquaintances into travel buddies." },
          ].map((f) => (
            <div key={f.title} className="rounded-2xl border bg-card p-6">
              <div className="mb-4 flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                {f.icon}
              </div>
              <h3 className="text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="contact" className="scroll-mt-8 border-t bg-muted/40">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-3 px-5 py-14">
          <h2 className="text-3xl font-bold tracking-tight">Contact</h2>
          <p className="text-muted-foreground">Questions about the project? We would love to hear from you.</p>
          <p className="flex items-center gap-2 font-medium">
            <Mail className="size-4 text-primary" /> contact@triptogether.example
          </p>
          <p className="mt-6 text-xs text-muted-foreground">
            Demo project (proof of concept). All trips and people shown are fictional.
          </p>
        </div>
      </section>
    </main>
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
