import { BellRing, Compass } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { JoinerRequestCard } from "@/components/joiner/joiner-request-card";
import { apiGet } from "@/lib/api";
import type { JoinerTripsResponse } from "server-app/shared";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "My Requests" };

export default async function JoinerRequestsPage() {
  await requireUser();
  const { requests } = await apiGet<JoinerTripsResponse>("/api/joiner/trips");
  const pending = requests.filter((request) => request.status === "pending").length;

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-medium text-primary">Join requests</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">My Requests</h1>
        <p className="mt-2 text-sm text-muted-foreground">Follow each request from sent to approved or declined.</p>
      </header>
      {requests.length ? (
        <>
          <div className="flex items-center gap-3 rounded-[1.25rem] bg-primary/8 p-4 text-sm ring-1 ring-primary/15">
            <BellRing className="size-5 shrink-0 text-primary" />
            <p>{pending ? <><span className="font-semibold">{pending} {pending === 1 ? "request is" : "requests are"} awaiting a reply.</span> We&apos;ll show the latest status here.</> : "You are all caught up. Here are your request updates."}</p>
          </div>
          <div className="grid gap-3">{requests.map((request) => <JoinerRequestCard key={request.tripId} request={request} />)}</div>
        </>
      ) : (
        <div className="rounded-[1.75rem] border border-dashed bg-muted/40 px-6 py-12 text-center sm:px-10">
          <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Compass className="size-7" /></span>
          <h2 className="mt-4 text-xl font-semibold">No trip requests yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">Found a trip that feels right? Send a join request and come back here to follow its status.</p>
          <Link href="/#trips" className="mt-5 inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90">Discover trips</Link>
        </div>
      )}
    </div>
  );
}
