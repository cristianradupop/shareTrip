"use client";

import { ArrowDownUp, Filter, RefreshCw } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { loadMoreFeedAction, refreshFeedAction } from "@/app/actions/trips";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FeedTripCard } from "@/components/trips/feed-trip-card";
import type { FeedSort, FeedTrip } from "@/data/trips";

const ALL = "__all__";
const SORT_ITEMS = [
  { value: "asc", label: "Most recent to farthest departure date" },
  { value: "desc", label: "Farthest to most recent departure date" },
];
const ERROR_MESSAGE = "Sorry, but for the moment we don't have information for you";

export function FeedClient({
  initialTrips,
  initialCursor,
  cities,
  city,
  sort,
  serverNow,
}: {
  initialTrips: FeedTrip[];
  initialCursor: string | null;
  cities: string[];
  city?: string;
  sort: FeedSort;
  serverNow: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [trips, setTrips] = useState(initialTrips);
  const [cursor, setCursor] = useState(initialCursor);
  const [since, setSince] = useState(serverNow); // everything published after this is "new"
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const [refreshing, startRefresh] = useTransition();
  const [loadingMore, startLoadMore] = useTransition();

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`${pathname}?${next.toString()}`);
  }

  function refresh() {
    startRefresh(async () => {
      try {
        const { trips: fresh, now } = await refreshFeedAction({ since, city });
        setSince(now);
        const known = new Set(trips.map((t) => t.id));
        const added = fresh.filter((t) => !known.has(t.id));
        if (added.length === 0) {
          toast.info("You are up to date");
          return;
        }
        // New trips first, followed by the old ones.
        setTrips([...added, ...trips]);
        setNewIds(new Set([...newIds, ...added.map((t) => t.id)]));
        toast.success(`${added.length} new ${added.length === 1 ? "trip" : "trips"}`);
      } catch {
        // Keep the old feed, tell the user (spec).
        toast.error(ERROR_MESSAGE);
      }
    });
  }

  function loadMore() {
    if (!cursor) return;
    startLoadMore(async () => {
      try {
        const page = await loadMoreFeedAction({ city, sort, cursor });
        const known = new Set(trips.map((t) => t.id));
        setTrips([...trips, ...page.trips.filter((t) => !known.has(t.id))]);
        setCursor(page.nextCursor);
      } catch {
        toast.error(ERROR_MESSAGE);
      }
    });
  }

  const cityItems = [{ value: ALL, label: "All cities" }, ...cities.map((c) => ({ value: c, label: c }))];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Select items={cityItems} value={city ?? ALL} onValueChange={(v) => setParam("city", v && v !== ALL ? v : null)}>
          <SelectTrigger className="w-48" aria-label="Filter by destination">
            <Filter className="size-4" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {cityItems.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select items={SORT_ITEMS} value={sort} onValueChange={(v) => setParam("sort", v === "desc" ? "desc" : null)}>
          <SelectTrigger className="w-80 max-w-full" aria-label="Sort by departure date">
            <ArrowDownUp className="size-4" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_ITEMS.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button variant="outline" onClick={refresh} disabled={refreshing} className="ml-auto">
          <RefreshCw className={refreshing ? "animate-spin" : ""} /> Refresh
        </Button>
      </div>

      {trips.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-card p-10 text-center text-muted-foreground">
          No active trips{city ? ` for ${city}` : ""} right now.
        </div>
      ) : (
        <div className="space-y-4">
          {trips.map((t) => (
            <FeedTripCard key={t.id} trip={t} isNew={newIds.has(t.id)} />
          ))}
        </div>
      )}

      {cursor && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? "Loading…" : "See more trips"}
          </Button>
        </div>
      )}
    </div>
  );
}
