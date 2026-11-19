# Plan: Public trip feed on the landing page

Spec: [spec.md](spec.md) · Status: approved 2026-11-19

## Approach
Make the three feed handlers public reads with an optional session (`getApiSession`). When a session exists they pass `excludeOrganizerId` to the data layer. The handlers also validate `city`, `cursor` and `since`, and return 400 when one is malformed. Rework `getFeed`, `getTripsSince` and `getActiveCities` in `server-app/src/data/trips.ts`:
- show trips with status `active` or `full` that depart today or later;
- order by `createdAt desc, id desc`, with a keyset cursor taken from the DB at microsecond precision;
- return pages of 20, and `getFeed` also returns `now`.

In server-admin, delete `/feed` (the route then 404s) and redesign `FeedTripCard`, keeping the same `action` slot contract. Rewrite `FeedClient` as an infinite-scroll client island: the city filter lives in client state, and Refresh stays. Mount it in a new `#trips` section on `(main)/page.tsx` between the hero and `#about`. Its first page comes from a server `apiGet`, which forwards cookies. Most of the logic sits in pure helpers so the tester has real targets.

## Options considered
- Cursor from JS `Date.toISOString()`: rejected. `trips.created_at` is a Postgres `timestamp` with microseconds and JS keeps only milliseconds, so trips would be skipped or duplicated. Instead select `to_char(created_at,'YYYY-MM-DD"T"HH24:MI:SS.US')` as a hidden cursor key and compare `(created_at,id) < ($ts::timestamp,$id::uuid)`. Chosen.
- City kept in the URL (`router.replace`) vs in client state: `router.replace` scrolls to the top (the hero) and re-renders the whole landing page. Chosen: client state. Changing the city fetches `/api/feed?city=` and resets the list, at the cost of losing shareable city URLs.
- Adding a `(created_at,id)` index migration: not needed at demo scale; `trips_created_at_idx` exists. Skipped, so there is no migration and no deploy-ordering risk.

## Risks and assumptions
- ADR 0005: allowed. server-app is public and the handler decides its own auth. The handlers stay GET-only, with an explicit column list (no email, phone or address). There is no rate limit on the public reads; I accept that for the demo, and it is unverified whether ADR 0002's free tier would need one.
- ADR 0002: pages of 20 rows, never all rows in one request. Up to about 1000 cards stay in the DOM with no virtualization; I assume that is acceptable.
- e2e runs with no DB, so `/api/feed` answers 500 there. The landing must wrap its feed fetch in try/catch and render an error state with Retry, otherwise "landing page renders" turns red.
- About/Contact menu links (`/#about`) jump instantly; no `scroll-behavior` is set in `globals.css`. The sentinel uses a bottom-only `rootMargin`, so it cannot fire while About is in view. The remaining case is a load still in flight after a jump to About or Contact. Then `FeedClient` measures the list height before appending and, if the list end was above the viewport, calls `window.scrollBy(0, delta)` in `useLayoutEffect`.
- After a load error, auto-load stops (the sentinel ignores intersections) and a Retry button shows, which avoids a retry loop.
- Status `full` is never set by code today. The "Full" label shows when `status === "full"` or seats taken (`joined + 1`) ≥ `maxTravelers`.
- Shared-file rule:
  - `FeedTrip` gains `status: "active" | "full"`, an additive change.
  - `FeedSort` is removed once nothing imports it; tell the Joiner developer, together with the feed's move to `/`.
  - The `FeedTripCard({ trip, isNew?, action? })` signature stays the same.
- PR #16: the only `organizer-nav.tsx` edits are dropping one item and the `Compass` import.
- Learnings:
  - (1) mock `@/db/client`: the new handler test mocks `@/db/client`, `@/lib/auth` and `@/data/trips`. `feed-params.ts` imports neither the DB nor `server-only`, so its test needs no mocks.
  - (2) `pnpm -r`: no script changes, but check that `pnpm lint` still covers the `e2e/` edits.
  - (3) same-origin check: does not apply, because there are no new mutating handlers.
  - (4) Vercel skip: both projects change in this PR, so both build.
- Unverified: whether `toFeedTrip`'s rest-destructure of the hidden `cursorKey` passes the ESLint unused-vars config. If it doesn't, map the fields explicitly.

## Tasks
- [x] T1 Remove `/feed` and its links.
  - Files:
    - delete `server-admin/src/app/feed/page.tsx`;
    - `server-admin/src/proxy.ts`: drop `"/feed/:path*"`;
    - `server-admin/src/components/organizer/organizer-nav.tsx`: drop the item and the `Compass` import;
    - `server-admin/src/app/(joiner)/joiner/page.tsx`: drop the feed sentence and "Open the community feed"; keep "Back to home";
    - `e2e/smoke.spec.ts`.
  - Tests: the redirect loop covers only `/admin` and `/organizer`; a new test checks that `/feed` returns 404 with no redirect to login.
  - Done when: `pnpm check` is green and no `/feed` href remains in server-admin.
- [x] T2 Pure feed param helpers.
  - File: new `server-app/src/lib/feed-params.ts` (no `server-only`, no DB) with:
    - `encodeFeedCursor(ts, id)`;
    - `parseFeedCursor(raw)`: regex `^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}$` plus a uuid, else null;
    - `parseFeedCity(raw)`: trimmed, at most 100 chars; empty means undefined, too long is invalid.
  - Tests, in `server-app/src/lib/feed-params.test.ts`:
    - the cursor round-trips;
    - it rejects the old `YYYY-MM-DD|id` format, ms-only timestamps, a bad uuid and SQL-ish strings;
    - city edge cases.
  - Done when: `pnpm test:file server-app/src/lib/feed-params.test.ts` passes.
- [x] T3 Public feed API.
  - Files:
    - `server-app/src/data/trips.ts`;
    - `server-app/src/app/api/feed/route.ts`, `server-app/src/app/api/feed/since/route.ts`, `server-app/src/app/api/feed/cities/route.ts`;
    - `server-app/src/shared/types.ts`: add `status` to `FeedTrip`;
    - new `server-app/src/test/api/feed.test.ts`, and `server-app/src/test/api/authz.test.ts`.
  - Data layer:
    - `FEED_PAGE_SIZE = 20`.
    - `getFeed({ city, cursor, excludeOrganizerId })` drops `sort`. It filters with `inArray(trips.status,["active","full"])` and `gte` on departure, plus `ne(trips.organizerId, id)` when an id is given.
    - `getTripsSince` and `getActiveCities` get the same status filter and the exclusion.
  - Handlers:
    - no `requireApiUser`; `getApiSession(req)` supplies the optional id;
    - return 400 on a bad cursor, city or since;
    - `/api/feed` returns `{ trips, nextCursor, now }`, with `now` taken before the query.
  - Tests:
    - with no session: 200, and `getFeed` is called with `excludeOrganizerId: undefined`;
    - with a user session, all three endpoints pass the user's id;
    - a bad cursor, a bad since and an over-long city give 400;
    - the response has no email;
    - in authz, the feed rows move out of `userEndpoints` (the 401 list).
  - Done when: `pnpm test` is green.
- [x] T4 Pure UI helpers.
  - Files: new `server-admin/src/lib/feed-card.ts`, new `server-admin/src/lib/feed-state.ts`, `server-admin/src/lib/format.ts` (`formatDay(iso)` in UTC).
  - `feed-card.ts`: `feedCardView(trip)` returns:
    - `seatsTaken`, `seatsTotal`, `fillPercent` (clamped 0-100), `isFull`, `spotsLeft` and labels;
    - a gradient class and an icon key from `transportKey`, with a fallback for an unknown transport.
  - `feed-state.ts`:
    - `feedQuery({city,cursor,since})`;
    - `mergeTrips(existing, incoming, "append"|"prepend")`, which dedupes by id;
    - `feedReducer` with the actions `reset(city)`, `pageLoaded(gen, page)`, `refreshed(trips, now)` and `failed(gen)`. Stale `gen` values are ignored, and `done` is true when `nextCursor` is null.
  - Tests: `feed-card.test.ts`, `feed-state.test.ts`, and an extended `format.test.ts`.
  - Seam (from the tester): export `FeedState` as `{ trips, cursor: string | null, done, gen: number, city: string | undefined, since: string, error: boolean }` (extra fields allowed).
  - Done when: `pnpm test` is green.
- [x] T5 Redesign `FeedTripCard`.
  - File: `server-admin/src/components/trips/feed-trip-card.tsx`.
  - Contents:
    - a gradient header with the transport icon (`Plane`, `Car`, `Bus`, `TrainFront`, `Ship`, `Compass`, all checked in the installed lucide-react);
    - city and country large, date chips, the budget;
    - a seats bar from `fillPercent`;
    - gender and transport;
    - the theme clamped with `line-clamp-2`;
    - `UserAvatar` with the short name;
    - "Full" and "New" badges.
  - The `<details>` element goes, and `action` is rendered in the footer. No external images. `min-w-0` and `break-words` keep it readable at phone width.
  - Tests: covered by the T4 helpers.
  - Done when: typecheck and lint pass and the props are unchanged.
- [x] T6 Infinite-scroll feed on the landing.
  - Files: `server-admin/src/components/trips/feed-client.tsx` (rewrite on `feedReducer`), `server-admin/src/app/(main)/page.tsx`, `server-app/src/shared/types.ts` (remove `FeedSort`), `e2e/smoke.spec.ts`.
  - `FeedClient` props: `initialTrips`, `initialCursor`, `cities`, `serverNow`, `initialError?`. No sort and no `useSearchParams`.
  - `FeedClient` behaviour:
    - an IntersectionObserver sentinel with `rootMargin "0px 0px 400px 0px"` and an in-flight ref guard;
    - an `aria-live` "Loading more trips…" message, an end-of-list message, an empty state, and Retry on error;
    - scroll compensation as described under Risks;
    - the city Select and the Refresh button keep the old toasts.
  - Landing:
    - a light section `id="trips"` (`scroll-mt-8`, centered `max-w-2xl`) between the hero and `#about`;
    - `Promise.all(apiGet("/api/feed"), apiGet("/api/feed/cities"))` wrapped in try/catch;
    - update the "Discover" copy, which mentions sort.
  - e2e:
    - `/` shows the trips section heading (the error state, since there is no DB);
    - on desktop, clicking the "About" link brings the About heading into the viewport (`toBeInViewport`).
  - Done when: `pnpm check` passes and `pnpm build && pnpm e2e` is green.
- [x] T7 Docs.
  - Files:
    - `README.md`: lines 11, 46 and any `/feed` mention;
    - `CLAUDE.md`: line 29 (zones) and line 48 ("landing feed");
    - `server-app/README.md:42-44`: auth "public, optional session; excludes own trips", no `sort`, the new `now`, the 400s.
  - Done when: grepping for `/feed` and `sort` in the docs finds nothing stale.

## Verification
- `pnpm check`; `pnpm build && pnpm e2e`.
- `pnpm dev` with `pnpm db:seed-demo`. Then, via Playwright MCP:
  - Logged out on `/`, cards appear under the role boxes. Scrolling auto-loads more with no duplicate ids, then the end message shows.
  - Changing the city restarts the list; Refresh works.
  - With the page scrolled to the hero, the About and Contact menu links land on their sections.
  - At 390px width there is no horizontal scroll.
  - `/feed` returns 404.
  - Logged in as an organizer, that user's trips and their cities are missing.
  - `curl localhost:3001/api/feed` with no cookie returns 200 and no `email`.
  - The 1000-trip scale was not exercised: no seed exists for it, and it is unverified.

## Open questions
- None blocking. Nice-to-have: should the hero get a "See trips" scroll cue or a "Trips" menu link? It is left out because the spec doesn't ask for it.

## Run notes
- IMPLEMENT T3/T6: the tester (`authz.test.ts`) and the coder (`(main)/page.tsx`) edited files with a Python script through Bash instead of Edit, and both reported it → diffs inspected by the orchestrator, both correct.
- VERIFY: the browser held an admin session, so the logged-out landing was not seen in the browser → orchestrator checked it with `curl` (no cookie): `#trips` rendered, trips incl. Mirissa, no emails. Playwright MCP refused to write screenshots to the scratchpad → they landed in the git-ignored `.playwright-mcp/` and were moved out.
- REVIEW: Verdict CHANGES, blocker: `feedReducer` `pageLoaded` advanced `since` on every page (`feed-state.ts:44`), so Refresh skipped trips posted between the first load and a later page → fix round 1: `since` only from a generation's first page, plus a `gen` guard on `refreshed`, the stale `heightBefore`, `overflow-anchor`, cities after Retry, `server-admin/README.md`, `Cache-Control`, and a `toFeedTrip` key-set test.
- APPROVE: the human disliked the hard light/dark edge under the hero → done directly as CSS: the trips, About and Contact sections now use the hero's dark palette (`dark` class + `slate-950`); then asked to fix the 2 remaining review warnings first → fix round 2 (native scroll anchoring double-compensation, `Promise.allSettled` for the cities list).
