# Plan: First-party analytics with cookie consent and a privacy page

Spec: [spec.md](spec.md) · Status: approved 2026-11-24

## Approach
Everything is first-party. A client consent layer in the server-admin root layout (banner, settings dialog, footer) writes the `tt_consent` cookie. Only when that cookie grants analytics does an `AnalyticsTracker` client component queue events and send them in batches with `fetch(..., { keepalive: true })` and an `application/json` body to a public `POST /api/analytics` in server-app. That handler checks the origin, JSON and consent, applies a DB rate limit, validates with zod, hashes the IP with a daily salt row, derives device and browser, inserts the events, then deletes old rows in small batches. A new admin endpoint `GET /api/admin/analytics?range=today|7d|30d` feeds the new `/admin/analytics` tab, whose charts use recharts through the shadcn `chart` component.

## Options considered
- **Transport, `navigator.sendBeacon`:** a string body goes out as `text/plain`, so `requireJson` answers 415, and Chrome restricts non-safelisted Blob types. Not chosen. **fetch with `keepalive`** sends `Origin`, so `checkSameOrigin` passes, and it keeps JSON. Chosen; one batch stays under the 64 KB keepalive limit.
- **"Signed in yes/no", `getApiSession`:** costs a DB query per batch. Not chosen. **`getSessionCookie(req)` from `better-auth/cookies`** (already used in `proxy.ts`, exists in server-app's better-auth) checks only that the cookie is there. Chosen. Gap: an expired cookie still counts as signed in.
- **Page views, `instrumentation-client.ts`:** global, but it has no React context and is harder to keep off `/admin`. Not chosen. **`usePathname()` in an effect plus `useReportWebVitals` (`next/web-vitals`, confirmed in `node_modules/next/dist/docs/01-app/02-guides/analytics.md`)** in one client component. Chosen.
- **Charts, hand-made SVG/CSS bars:** no dependency, but more custom code. Not chosen. **recharts via `pnpm dlx shadcn add chart`:** the shadcn standard, no Radix, React 19 supported. Chosen. Unverified: that the `base-nova` registry has `chart`; if it doesn't, copy the stock `chart.tsx`, which only needs recharts.
- **Rate limit, refactor `signup-limit.ts` into something generic:** an unrelated refactor. Not chosen. A new `lib/analytics-limit.ts` copies its upsert, with key `${ip}|/analytics`, 60 per 60 s. Chosen.

## Risks and assumptions
- **ADR 0002:** no cron. The salt row is created on the first ingest of each UTC day, and older salts plus events older than 30 days (500 at a time) are deleted inside the ingest call, awaited.
- **ADR 0003:** additive migration 0003 with two new tables, created by `pnpm db:generate` only (no hand-written SQL).
- **ADR 0005:** the ingest endpoint is public by design (like `/api/feed`) and access-checks only the consent cookie. `shared/` gets only zod, types and pure functions. Write ADR 0006.
- **Shared files touched:** root layout (footer + 2 providers), `components/ui/chart.tsx`, `db/schema`, `shared`, `clientFetch`. Tell the Joiner developer that their zone is tracked through the root layout.
- **Assumption:** clicks on buttons without `data-track` record a visible label of at most 40 characters, which could contain a name. Mitigation: `data-track` goes on the user-menu trigger and on the named CTAs.
- **Assumption:** calls made through Better Auth's client (login) are not timed, because only `clientFetch` is hooked. The login interaction is still emitted.
- **Assumption:** existing e2e clicks may be blocked by the banner. The banner is a non-modal bottom bar, and the e2e setup adds a `tt_consent=1.denied` cookie where needed.
- **Assumption (privacy page):** it must also mention that the Better Auth `session` table stores `ip_address` and `user_agent`, that `rate_limit` keys hold the raw IP for the length of the window, and the audit log. Legal basis: legitimate interest (security). This goes beyond the spec's "contract/consent", so tell the human.
- **Learnings:**
  - Mock `@/db/client` with the helpers fakes in every new test.
  - `checkSameOrigin` is the first check on the ingest endpoint.
  - No exact `state.inserts` counts: filter by the `analyticsEvents` table and assert the payload.
  - Rate-limit rows live in the DB (`rate_limit`). Locally all traffic shares the IPv6 zero key; after local tests delete `…|/analytics`.

## Tasks
Shared identifiers, `server-app/src/shared/analytics.ts`, re-exported from `shared/index.ts`:
- Cookies and timing: `CONSENT_COOKIE="tt_consent"`, `CONSENT_VERSION=1`, `VISITOR_COOKIE="tt_vid"`, `SESSION_COOKIE="tt_sid"`, `CONSENT_MAX_AGE_SECONDS=15552000`, `SESSION_IDLE_SECONDS=1800`
- Consent helpers: `formatConsent(analytics: boolean)` returns `"1.granted"` or `"1.denied"`; `parseConsent(raw?: string)` returns `{ analytics: boolean } | null` (null when the version is wrong); `readCookie(header: string | null, name)`
- Path helpers: `normalizePath(path)` drops `?`/`#` and replaces uuid, numeric and 16+ character alphanumeric segments that contain a digit with `:id`; `isTrackedPath(path)` is false for `/admin` and `/admin/*`
- Value lists: `ANALYTICS_EVENT_TYPES=["pageview","leave","click","interaction","api","vital"]`, `INTERACTIONS=["signup","login","trip_created","trip_edited","join_request_sent"]`, `WEB_VITALS=["LCP","INP","CLS","TTFB","FCP"]`
- Thresholds: `WEB_VITAL_THRESHOLDS` = LCP 2500/4000, INP 200/500, CLS 0.1/0.25, TTFB 800/1800, FCP 1800/3000; `vitalRating(name, value)` returns `"good" | "needs-improvement" | "poor"`
- Batch and ranges: `ANALYTICS_MAX_BATCH=50`, `analyticsBatchSchema` = `{ visitorId: uuid, sessionId: uuid, events[]: discriminated union on type }`. The event payloads are pageview `{path, referrer?, language?, screen?}`, leave `{path, durationMs}`, click `{path, target}`, interaction `{path, name}`, api `{path, method, apiPath, status, durationMs}`, vital `{path, name, value}`. `ANALYTICS_RANGES=["today","7d","30d"]`, type `AnalyticsReport`.

Names fixed by the tests (from the tester, 2026-11-24): `@/lib/analytics-limit` exports `consumeAnalyticsAttempt(req)` → `{allowed:true} | {allowed:false, retryAfterSeconds}`; `server-app/src/db/schema/index.ts` exports `analyticsEvents` and `analyticsSalts` (camelCase columns `visitorId`, `sessionId`, `ipHash`, `signedIn`, `path`, `device`, `browser`); `getDailySalt(now: Date)` returns the salt string read from a row `{salt}`; `pruneAnalytics(now: Date)`; `toEventRows(batch, {ipHash, signedIn, ua})` takes the raw UA string and returns rows with `visitorId`/`sessionId`; `consentView({stored, gpc, dnt})` takes the raw cookie string or undefined (a wrong version plus GPC/DNT hides the banner); client `track(event)` takes the shared batch event shape and `flush({keepalive})` POSTs `{visitorId, sessionId, events}` to `/api/analytics`, reading `location.pathname` and `document.cookie`; `describeClickTarget` returns a string (`data-track` value as is, else tag + href path or label). e2e (`e2e/smoke.spec.ts`): the footer is a `<footer>` (role contentinfo) with a "Privacy" link to `/privacy` and a "Cookie settings" button; `/privacy` has an h1 matching /privacy/i; the banner has "Accept" and "Reject" buttons, and Reject sets `tt_consent=1.denied` with no `tt_vid`/`tt_sid`.

- [x] **T1 Shared contract and pure server helpers**
  - files: `server-app/src/shared/analytics.ts`, `shared/index.ts`, `server-app/src/lib/analytics.ts` (`hashIp(ip, salt)` = sha256 hex via `node:crypto`; `parseUserAgent(ua)` returns `{device: "mobile"|"tablet"|"desktop", browser: "Chrome"|"Edge"|"Firefox"|"Safari"|"Opera"|"Samsung"|"Other", bot: boolean}`; `toEventRows(batch, {ipHash, signedIn, ua})`)
  - tests: `server-app/src/lib/analytics.test.ts`: normalizePath cases; parse/format round trip and a wrong version gives null; readCookie; batch over 50 rejected; hashIp is stable per salt, changes with the salt and never contains the IP; UA families; rows have no `ip`/`userAgent` keys and `/admin` events are dropped
  - done when: that file passes and `pnpm typecheck` is green
- [x] **T2 Schema and migration**
  - files: `server-app/src/db/schema/analytics.ts`, `schema/index.ts`, generated `server-app/drizzle/0003_*` via `pnpm db:generate`
  - `analytics_events`: id uuid, created_at, type, visitor_id, session_id, ip_hash, signed_in bool, path, referrer, language, screen, device, browser, name, status int, value double precision; indexes `(created_at)` and `(type, created_at)`
  - `analytics_salts`: day text PK `YYYY-MM-DD`, salt text
  - tests: none
  - done when: `pnpm db:check` is clean; do NOT migrate without the human's OK
- [x] **T3 Ingest endpoint**
  - files: `server-app/src/lib/analytics-limit.ts`; `server-app/src/data/analytics.ts` (`getDailySalt(now)` as insert on conflict do nothing then select; `insertAnalyticsEvents(rows)`; `pruneAnalytics(now)` deletes salts with day < today and events older than 30 days, `LIMIT 500` through an `id in (subselect)`); `server-app/src/app/api/analytics/route.ts`
  - order in POST: checkSameOrigin → requireJson → content-length over 65536 gives 413 → consent not granted gives 204 with no DB access → limit gives 429 → readJson + zod gives 400 → bot gives 204 → salt, insert, prune → 204
  - tests: `server-app/src/test/api/analytics.test.ts`: 403, 415, 413; no cookie and denied cookie each give 204 with no insert; invalid or 51 events give 400; granted inserts into `analyticsEvents` with `signedIn` taken from the session cookie and no raw IP in the payload; 429 when the limit module is mocked to deny
  - done when: `pnpm test` is green
- [x] **T4 Admin report endpoint**
  - files: `getAnalyticsReport(range, now)` in `data/analytics.ts` (count distinct, `percentile_cont`, UTC day buckets); `server-app/src/app/api/admin/analytics/route.ts` (requireApiAdmin, 400 on a bad range, `private, no-store`); `server-app/README.md` endpoint table
  - tests: add it to `adminEndpoints` in `authz.test.ts` (401/403); bad range gives 400
  - done when: `pnpm test` is green
- [x] **T5 Consent UI, footer, privacy page**
  - files:
    - `server-admin/src/lib/consent.ts`: pure `consentView({stored, gpc, dnt})` returns `{showBanner, analytics, signalRespected}`; cookie read/write; `revokeAnalytics()` deletes `tt_vid`/`tt_sid`
    - `server-admin/src/components/consent/consent-provider.tsx`: context `useConsent()` gives `{analytics, openSettings}`; banner with Accept/Reject in the same variant and Settings; Dialog with a native checkbox `role="switch"`; renders only after mount
    - `server-admin/src/components/site-footer.tsx`: Privacy link and a Cookie settings button
    - `server-admin/src/app/layout.tsx`
    - `server-admin/src/app/(main)/privacy/page.tsx`: content from the spec, the fields in `schema/auth.ts`, a cookie table (session token, plus the `__Secure-` name in production, `tt_consent`, `tt_vid`, `tt_sid`, theme in localStorage), Vercel fra1, Supabase "EU"
  - tests: `server-admin/src/lib/consent.test.ts`: GPC/DNT with nothing stored hides the banner and turns analytics off; an explicit choice wins; a wrong version shows the banner
  - done when: the test passes and the banner, footer and `/privacy` render in `pnpm dev`
- [x] **T6 Client tracker**
  - files:
    - `server-admin/src/lib/analytics.ts`: safe to import in node; `track(event)`, `trackInteraction(name)`, `recordApiTiming(method, path, status, ms)`, `flush({keepalive})`, `setAnalyticsEnabled(bool)`; flushes every 5 s, at 20 events or on pagehide/hidden; no-op unless enabled and `isTrackedPath(location.pathname)`; sliding `tt_sid`; pure `describeClickTarget({tag, dataTrack, href, text})`
    - `server-admin/src/components/analytics/analytics-tracker.tsx`: pageview and leave on pathname change; document click listener in capture phase on `closest("a,button,[data-track]")`; `useReportWebVitals`
    - `client-api.ts`: time every fetch
    - `trackInteraction` after success in `login-form.tsx`, `signup-form.tsx`, `create-trip-dialog.tsx`, `edit-trip-button.tsx`, `join-action.tsx` (POST only)
    - `data-track` on `main-nav.tsx` CTAs, the user-menu trigger, the create-trip trigger and the join buttons
  - tests: `server-admin/src/lib/analytics.test.ts`: describeClickTarget priority and 40-character truncation; nothing is queued while disabled or on `/admin`; batch size
  - done when: with consent, the Network tab shows batches to `/api/analytics` answered 204; with Reject, there are none
- [x] **T7 Admin Analytics tab**
  - files:
    - `server-admin/src/lib/admin-tabs.ts`: "Analytics" `/admin/analytics` after Statistics
    - `admin-tabs.test.ts`
    - `server-admin/src/app/admin/analytics/page.tsx`: requireAdmin + apiGet; range links through `searchParams`; tiles and tables
    - `server-admin/src/components/admin/analytics-charts.tsx`: client component, recharts
    - `components/ui/chart.tsx`
    - recharts in `server-admin/package.json`
    - `e2e/smoke.spec.ts`: `/admin/analytics` redirect; `/privacy` returns 200 and shows the banner
  - done when: `pnpm build && pnpm e2e` is green
- [x] **T8 Docs:** `docs/adr/0006-first-party-analytics-with-consent.md`, one line in `CLAUDE.md` Architecture

## Verification
- `pnpm check`
- `pnpm db:check`
- `pnpm build && pnpm e2e`
- In `pnpm dev`, after the human OKs `pnpm db:migrate`:
  - banner; Reject sends nothing and sets no `tt_vid`
  - Accept, browse, and log in as alex, then check rows (no IP or UA columns)
  - Cookie settings with Analytics off deletes `tt_vid`/`tt_sid` and stops batches
  - GPC on (a browser flag) hides the banner
  - `/admin/*` sends no events
  - as admin, `/admin/analytics` shows tiles, charts and tables for each range
- Afterwards delete the local `…|/analytics` rate-limit key and the test analytics rows.

## Open questions
- [nice] Supabase region for `/privacy`: resolved, Frankfurt (ADR 0002).
- [nice] Legitimate interest (security: session IP/UA, rate limit, audit log) on the privacy page's legal bases: approved by the human at gate 1 (2026-11-24); the spec now lists it.
- Unverified: whether shadcn `base-nova` includes `chart`; the exact content of `main-nav.tsx` and the user menu; whether a `(main)` layout exists for `/privacy`.

## Fix round 2 (after VERIFY round 2 and REVIEW, 2026-11-24)
Last fix round allowed. Tests first (tester), then code (coder).
- F1 [blocker] `leave` on tab close: `server-admin/src/components/analytics/analytics-tracker.tsx` pushes `leave` only in the route-change cleanup. On `pagehide` and on `visibilitychange` hidden, queue `{type:"leave", path, durationMs}` once per page view (current path + start time in a ref or module state, so cleanup and pagehide never both send it), then `flush({keepalive:true})`. When the page becomes visible again, start a new timing segment for the same path. Prefer putting the logic in `server-admin/src/lib/analytics.ts` as a testable function (e.g. `startPageView(path)` / `endPageView()`).
- F2 Web Vitals once per metric name per document load: in dev, strict mode registers web-vitals twice and each copy has its own `metric.id`. Key the dedupe on `metric.name` (latest value before flush; never resend a name already sent in this document).
- F3 Flood bound: `server-app/src/lib/analytics-limit.ts` counts events, not requests: per IP 300 events per 60 s (fits a classroom behind one NAT); plus a global budget of 10,000 events per UTC day (a `rate_limit` row keyed `global|/analytics|YYYY-MM-DD` or similar). Over either budget: 429 for the per-IP limit, 204 with nothing stored for the global cap. IPv6 addresses are keyed by their /64 prefix.
- F4 Referrer: the server keeps only a hostname (parse with `URL`, or accept a bare host); anything else is stored as null. The client sends the external referrer only on the first page view of a document load, never on client-side navigations.
- F5 Body size: read the body as text, return 413 when it is over 65,536 characters (with or without `content-length`), then `JSON.parse` and validate with zod.
- F6 Click targets: `describeClickTarget` passes link paths through `normalizePath`, and reduces `mailto:` and `tel:` hrefs to their scheme (`a mailto:`). External links are reduced to their host.
- F7 Consent off: in `consent-provider.tsx` `choose(false)` (and Save with Analytics off), call `setAnalyticsEnabled(false)` synchronously before `revokeAnalytics()`, so a flush can't write `tt_vid`/`tt_sid` back.
- F8 Report: the `daily` series counts `distinct visitor_id` as visitors (same as the tile). It keeps `distinct ip_hash` as a separate `uniqueIps` series (the human chose the IP hash for unique visitors), shown as a third series in the chart. It returns an overall average time on page (all `leave` events) in `totals`, for the tile, and fills days with no events with zeros for the 7d/30d ranges.
- Tests to add: leave on pagehide/hidden sent once per page view; vitals deduped by name; describeClickTarget normalizes ids and reduces mailto/tel/external; revokeAnalytics deletes both cookies (`max-age=0`); ingest stores a hostname-only referrer (null for junk); 413 without `content-length`; per-IP event budget (51st-300th events counting) and global cap → 204 with no insert; IPv6 /64 keying; report fills zero days. e2e: Accept → Cookie settings off → no `tt_vid`/`tt_sid`.

## Fix round 3 (approved by the human after REVIEW round 2, 2026-11-24)
Extra round, allowed explicitly by the human; tests first, then code.
- F9 [blocker] No raw IP in `rate_limit` for analytics: the per-IP bucket key is `hashIp(limitKey(ip), dailySalt)` + `|/analytics` (fetch the daily salt before the limiter). The global key stays `global|/analytics|<day>`.
- F10 [blocker] `pruneAnalytics` also deletes expired `rate_limit` rows (every key whose last request is older than 24 h, in batches of 500), so the raw-IP keys of `/signup` and Better Auth disappear within a day; `/privacy` says rate-limit keys holding an IP are deleted within 24 hours.
- F11 `analyticsBatchSchema.events` needs at least 1 event (empty batch → 400).
- F12 `track` decides by `event.path` for `leave` events (a `leave` for a tracked page is kept even when the browser is already on `/admin`).
- F13 `describeClickTarget` reduces every non-http(s) scheme (`sms:`, `whatsapp:`, …) to its scheme, like mailto/tel.
- F14 Formatting: `server-admin/src/components/auth/login-form.tsx` `const role =(` spacing.
- Docs (orchestrator): README row for `POST /api/analytics`; ADR 0006 mentions the event budget, global cap, /64 keying and hashed bucket keys.

## Run notes
- VERIFY T3: every POST /api/analytics returned 500 on the live DB: `pruneAnalytics` interpolated a JS `Date` into a raw `sql` template, which postgres.js rejects; the mocked DB in unit tests can't see it (the coder had switched to raw `sql` because the fake db recursed on the builder subquery) → fix round 1.
- VERIFY T6: Web Vitals sent 2-3 times per metric in one batch (`useReportWebVitals` with an inline callback) → fix round 1.
- VERIFY T6 (round 2): Web Vitals still sent twice with identical values but different ids (dedupe by `metric.id` doesn't catch it; likely React strict mode in `next dev` running the `useReportWebVitals` effect twice, so web-vitals registers two observers) → folded into fix round 2 with the review blockers.
- REVIEW: CHANGES. Blocker: `leave` only sent on client-side navigation, so the last page of every visit had no time on page. Warnings from the reviewer and the security reviewer: unbounded DB flood (60 req × 50 events per IP per minute, no global cap), IPv6 rotation, full referrer stored, 413 trusting `content-length`, chart counting ip_hash vs the visitor_id tile, href ids not normalized, consent-off race re-writing cookies → fix round 2 (F1-F8).
- REVIEW (round 2): CHANGES. Blocker: per-IP limiter rows in `rate_limit` keep the raw IP forever (nothing prunes `rate_limit`), contradicting the spec and `/privacy`; same for the existing `/signup` and Better Auth rows. Warnings: empty batches pass zod and bypass the event budget; README lacks the `POST /api/analytics` row. Fix rounds exhausted (2/2) → stop, asked the human.
- REVIEW (round 3): APPROVE. Warnings handled by the orchestrator: `/privacy` and ADR 0006 said rate-limit rows go "within 24 hours", but pruning only runs on ingest → reworded; the new raw-`sql` `rate_limit` delete was confirmed on the live DB (one consented POST /api/analytics → 204, no errors).
- IMPLEMENT round 3: a tester replace matched only calls ending in `NOW);`, leaving `NOW))` calls with the old signature → the coder flagged it, the tester fixed it.
- APPROVE (gate 2): the human opened /admin/analytics and got an error: `GET /api/admin/analytics` 500, `column "analytics_events.referrer" must appear in the GROUP BY clause` — `counted()` rendered `coalesce(nullif(col,''), ${fallback})` twice, so select bound `$1` and group by `$4`; unit tests mock the DB and the verifier had no admin password → group/order by position (`sql\`1\``); confirmed with `getAnalyticsReport` for today/7d/30d against the live DB via tsx.
