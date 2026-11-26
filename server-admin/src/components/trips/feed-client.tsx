"use client";

import { Filter, Loader2, MapPinned, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FeedTripCard } from "@/components/trips/feed-trip-card";
import { JoinAction } from "@/components/trips/join-action";
import type { FeedTrip } from "server-app/shared";
import { clientFetch } from "@/lib/client-api";
import { feedQuery, feedReducer, type FeedState } from "@/lib/feed-state";

const ALL = "__all__";
const ERROR_MESSAGE = "Sorry, but for the moment we don't have information for you";

export function FeedClient({
  initialTrips,
  initialCursor,
  cities,
  serverNow,
  initialError = false,
  citiesError = false,
}: {
  initialTrips: FeedTrip[];
  initialCursor: string | null;
  cities: string[];
  serverNow: string;
  initialError?: boolean;
  citiesError?: boolean;
}) {
  const [state, dispatch] = useReducer(
    feedReducer,
    undefined,
    (): FeedState => ({
      trips: initialTrips,
      cursor: initialCursor,
      done: !initialError && initialCursor === null,
      gen: 0,
      city: undefined,
      since: serverNow,
      error: initialError,
    }),
  );
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const sentinelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inFlight = useRef<number | null>(null); // generation of the request in flight
  const heightBefore = useRef<number | null>(null);
  const currentGen = useRef(0);
  const citiesPending = useRef(initialError || citiesError); // the city list is empty when its first load failed
  const [cityList, setCityList] = useState(cities);

  const { gen, city, cursor, done, error } = state;

  const loadCities = useCallback(async () => {
    if (!citiesPending.current) return;
    citiesPending.current = false;
    const citiesRes = await clientFetch<{ cities: string[] }>("/api/feed/cities");
    if (citiesRes.ok) setCityList(citiesRes.cities);
    else citiesPending.current = true;
  }, []);

  const loadPage = useCallback(async () => {
    if (inFlight.current === gen) return;
    inFlight.current = gen;
    setLoading(true);
    const res = await clientFetch<{ trips: FeedTrip[]; nextCursor: string | null; now: string }>(
      `/api/feed?${feedQuery({ city, cursor: cursor ?? undefined })}`,
    );
    if (inFlight.current === gen) {
      inFlight.current = null;
      setLoading(false);
    }
    if (!res.ok) {
      dispatch({ type: "failed", gen });
      return;
    }
    // A reply for a replaced generation is ignored by the reducer, so it must not leave a height behind.
    if (currentGen.current === gen) {
      // If the end of the list is above the viewport (the visitor jumped to About or Contact), remember its height.
      const list = listRef.current;
      heightBefore.current = list && list.getBoundingClientRect().bottom < 0 ? list.offsetHeight : null;
    }
    dispatch({ type: "pageLoaded", gen, page: { trips: res.trips, nextCursor: res.nextCursor, now: res.now } });
    await loadCities();
  }, [gen, city, cursor, loadCities]);

  useEffect(() => {
    currentGen.current = gen;
  }, [gen]);

  useEffect(() => {
    if (!citiesError || initialError) return;
    citiesPending.current = false;
    void clientFetch<{ cities: string[] }>("/api/feed/cities").then((res) => {
      if (res.ok) setCityList(res.cities);
      else citiesPending.current = true;
    });
  }, [citiesError, initialError]);

  useLayoutEffect(() => {
    const list = listRef.current;
    // Browsers with native scroll anchoring (not Safari) already keep the page in place.
    const nativeAnchoring = typeof CSS !== "undefined" && CSS.supports("overflow-anchor", "auto");
    if (heightBefore.current !== null && list && !nativeAnchoring) {
      const delta = list.offsetHeight - heightBefore.current;
      if (delta !== 0) window.scrollBy(0, delta);
    }
    heightBefore.current = null;
  }, [state.trips]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || done || error) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) void loadPage();
      },
      { rootMargin: "0px 0px 400px 0px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [done, error, loadPage]);

  async function refresh() {
    const startGen = state.gen;
    setRefreshing(true);
    try {
      const res = await clientFetch<{ trips: FeedTrip[]; now: string }>(
        `/api/feed/since?${feedQuery({ since: state.since, city })}`,
      );
      if (!res.ok) throw new Error(res.error);
      if (startGen !== currentGen.current) return; // the filter changed while refreshing
      const known = new Set(state.trips.map((t) => t.id));
      const added = res.trips.filter((t) => !known.has(t.id));
      dispatch({ type: "refreshed", gen: startGen, trips: res.trips, now: res.now });
      if (added.length === 0) {
        toast.info("You are up to date");
        return;
      }
      setNewIds((prev) => new Set([...prev, ...added.map((t) => t.id)]));
      toast.success(`${added.length} new ${added.length === 1 ? "trip" : "trips"}`);
    } catch {
      toast.error(ERROR_MESSAGE);
    } finally {
      setRefreshing(false);
    }
  }

  function changeCity(value: string | null) {
    setNewIds(new Set());
    dispatch({ type: "reset", city: value && value !== ALL ? value : undefined });
  }

  const cityItems = [{ value: ALL, label: "All cities" }, ...cityList.map((c) => ({ value: c, label: c }))];
  const empty = state.trips.length === 0 && done && !error;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Select items={cityItems} value={city ?? ALL} onValueChange={changeCity}>
          <SelectTrigger
            className="h-11 w-52 max-w-full rounded-full bg-muted px-4"
            aria-label="Filter by destination"
          >
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

        <Button variant="outline" onClick={refresh} disabled={refreshing} className="ml-auto h-11 rounded-full px-5">
          <RefreshCw className={refreshing ? "animate-spin" : ""} /> Refresh
        </Button>
      </div>

      {empty && (
        <div className="rounded-[1.5rem] border border-dashed bg-muted/60 p-10 text-center text-muted-foreground">
          <MapPinned className="mx-auto mb-3 size-8 text-primary" />
          No active trips{city ? ` for ${city}` : ""} right now.
        </div>
      )}

      {state.trips.length > 0 && (
        <div ref={listRef} className="space-y-4">
          {state.trips.map((t) => (
            <FeedTripCard
              key={t.id}
              trip={t}
              isNew={newIds.has(t.id)}
              action={<JoinAction trip={t} onPatched={(patch) => dispatch({ type: "tripPatched", id: t.id, patch })} />}
            />
          ))}
        </div>
      )}

      {/* Never let the browser anchor on the loader or the sentinel: it would push new cards above the viewport. */}
      <div aria-live="polite" className="min-h-6 text-center text-sm text-muted-foreground [overflow-anchor:none]">
        {loading && (
          <span className="inline-flex items-center gap-2">
            <Loader2 className="size-4 animate-spin text-primary" /> Loading more trips…
          </span>
        )}
        {done && state.trips.length > 0 && !loading && "You have seen all the trips. Check back soon for new ones!"}
      </div>

      {error && (
        <div role="alert" className="flex flex-col items-center gap-3 rounded-[1.5rem] bg-muted p-8 text-center">
          <p className="text-sm text-muted-foreground">{ERROR_MESSAGE}</p>
          <Button onClick={() => void loadPage()} disabled={loading}>
            Retry
          </Button>
        </div>
      )}

      <div ref={done ? undefined : sentinelRef} aria-hidden className="h-px [overflow-anchor:none]" />
    </div>
  );
}
