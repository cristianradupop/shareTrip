# server-app

The backend of TripTogether. It owns the database (Drizzle + Supabase Postgres), Better Auth, photo storage, migrations and a REST API under `/api`. It has no pages. The web UI is `server-admin`, which calls this module over HTTP.

## Run it

From the repo root (the root scripts delegate here):

```bash
cp server-app/.env.example server-app/.env.local   # fill it in; never commit it
pnpm db:migrate && pnpm db:setup-storage && pnpm db:seed-admin && pnpm db:seed-demo   # first time only
pnpm dev                                           # runs both apps; server-app is on http://localhost:3001
```

Only server-app: `pnpm --filter server-app dev`. Tests: `pnpm test:file server-app/src` (no DB; `@/db/client` is mocked).

## Environment variables

Names only; see `.env.example` for what each one is. Secrets live in `server-app/.env.local` and in the Vercel project of this module.

`DATABASE_URL`, `DIRECT_URL`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `SUPABASE_PHOTOS_BUCKET`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `ADMIN_EMAIL`, `ADMIN_USERNAME`, `ADMIN_PASSWORD` (the last three only for `pnpm db:seed-admin`).

`BETTER_AUTH_URL` is the origin of the UI (`server-admin`), not of this module: the browser talks to the UI, which proxies `/api/*` here, and Better Auth checks the request origin against it.

## Authorization

This module is public on the internet, so every handler checks the session itself: `requireApiUser(req)` (401 without a session) or `requireApiAdmin(req)` (401, or 403 for a non-admin), from `src/lib/api-auth.ts`. Ownership checks (for example "my trips") are done in the handler, using the session user id and never an id from the body. Errors are `{ "ok": false, "error": "<message>" }`.

Every mutating handler (POST, PATCH, DELETE) first runs `checkSameOrigin`: an `Origin` header that differs from the origin of `BETTER_AUTH_URL` gets 403 before anything is read (a missing `Origin` is allowed). JSON handlers (everything mutating except `/api/signup`, which is multipart, and DELETE) answer 415 unless `content-type` is `application/json`.

## Endpoints

Auth: public = no session needed, user = any signed-in account, admin = role `admin`. Without a valid session the user and admin endpoints return 401; admin endpoints return 403 for a `user` role.

| Method | Path | Auth | Body or query | Response |
|---|---|---|---|---|
| GET | `/` | public | none | `{ name: "server-app", status: "ok" }` |
| GET | `/api/health` | public | none | `{ status: "ok" }` |
| GET, POST | `/api/auth/[...all]` | public (Better Auth decides) | Better Auth routes (sign-in, sign-out, get-session; its own sign-up path is disabled, use `/api/signup`); DB rate limited | Better Auth responses |
| GET | `/api/session` | public | none (reads the cookie) | `{ user: SessionUser \| null }`, `Cache-Control: private, no-store` |
| POST | `/api/signup` | public | multipart: `username`, `password`, `firstName`, `lastName`, `email`, `phone`, `address`, `birthDate`, `photo` (JPG/PNG, max 2 MB) | `{ ok: true }` and the session cookie; 400 invalid data or photo, 409 username or email taken, 429 with `Retry-After` after 10 attempts per IP per hour (every attempt counts) |
| GET | `/api/feed` | public, optional session (a signed-in user's own trips are excluded) | query `city`, `cursor` (newest first, pages of 20) | `{ trips: FeedTrip[], nextCursor: string \| null, now: string }`; with a session each trip has `viewerState` (`join`, `requested`, `declined`, `joined`, `full`, `wrong_gender`); 400 on a bad `cursor` or `city` |
| GET | `/api/feed/since` | public, optional session (own trips excluded) | query `since` (ISO date, required), `city` | `{ trips: FeedTrip[], now: string }`; 400 on a bad `since` or `city` |
| GET | `/api/feed/cities` | public, optional session (own trips excluded) | none | `{ cities: string[] }` |
| POST | `/api/analytics` | public, only with the `tt_consent` cookie granting analytics (ADR 0006) | JSON `{ visitorId, sessionId, events }`, 1 to 50 events (`pageview`, `leave`, `click`, `interaction`, `api`, `vital`), body at most 64 KB | 204 (also when consent is missing or denied, for bots and over the global daily cap: nothing stored); 400 invalid batch, 403 foreign origin, 413 body too large, 415 not JSON, 429 with `Retry-After` over 300 events per IP per minute |
| POST | `/api/trips` | user | multipart form: the trip fields (`destinationCity`, `destinationCountry`, `departureDate`, `returnDate`, `maxTravelers`, `gender`, `budgetEstimate`, `currency`, `transport`, `theme`) and a required `photo` file (JPG/PNG, max 2 MB); the organizer is the session user | `{ ok: true, id }`; 400 invalid data or missing/invalid photo |
| PATCH | `/api/trips/[id]` | user (organizer of the trip only) | multipart form, same fields as `POST /api/trips`; `photo` optional (omitted keeps the current one, a new one replaces it) | `{ ok: true }`; 400 invalid data or `maxTravelers` below the joined count, 404 unknown or not your trip, 409 trip cancelled or already departed |
| POST | `/api/trips/[id]/request` | user | none | `{ ok: true, viewerState: "requested", joined }`; 400 own trip, 404 unknown trip, 409 cancelled, departed, already member or requested, full, or gender mismatch |
| DELETE | `/api/trips/[id]/request` | user | none | `{ ok: true, viewerState: "join", joined }` (withdraws the caller's pending request); 404 unknown trip, 409 no pending request or already decided |
| DELETE | `/api/trips/[id]/membership` | user | none | `{ ok: true, viewerState: "join", joined }` (the caller leaves); 404 unknown trip, 409 not a member or already departed |
| GET | `/api/organizer/trips/[id]/requests` | user, the trip's organizer only (admins get no exception) | none | `{ pending: Person[], members: Person[] }` (name, image, age, gender only), `Cache-Control: private, no-store`; 404 unknown trip or not yours |
| PATCH | `/api/organizer/trips/[id]/requests/[userId]` | user, the trip's organizer only | JSON `action`: `approve` or `decline` | `{ ok: true }`, approve also `autoDeclined` (other requests declined when the trip filled); 400 bad action, 404 unknown trip or not yours, 409 not pending, full, departed or gender mismatch |
| PATCH | `/api/profile` | user | JSON `gender` (`male` or `female`) | `{ ok: true }`; 400 invalid |
| GET | `/api/organizer/trips` | user | query `limit` (1 to 100) | `{ trips: OrganizerTrip[] }` (own trips only) |
| GET | `/api/organizer/stats` | user | none | `{ stats: OrganizerStats }` (own trips only) |
| GET | `/api/admin/users` | admin | query `q` (max 100 chars), `page` | `{ users: AdminUserRow[], total, pages }` |
| GET | `/api/admin/stats` | admin | none | `AdminStats` (users, trips, requests, members) |
| GET | `/api/admin/analytics` | admin | query `range` = `today` \| `7d` \| `30d` | `AnalyticsReport` (visitors, daily, top pages, referrers, devices, browsers, clicks, interactions, API latency p50/p95, Web Vitals p75), `Cache-Control: private, no-store`; 400 unknown range |
| GET | `/api/admin/trips` | admin | query `q` (max 100 chars, city or organizer name/email), `status` (`active`/`full`/`cancelled`), `page` | `{ trips: AdminTripRow[], total, page, pageSize }` |
| GET | `/api/admin/events` | admin | query `view` = `account` \| `activity` \| `audit` | `{ events: AuditEventRow[] }` (latest 300, newest first); 400 unknown view |
| POST | `/api/admin/users` | admin | JSON `username`, `email`, `firstName`, `lastName`, `phone`, `address`, `birthDate`, `role`, `password` | `{ ok: true }`; 400 invalid data, 409 taken |
| PATCH | `/api/admin/users/[id]` | admin | JSON as above; `password` optional (empty keeps it) | `{ ok: true }`; 400 invalid or removing your own admin role, 404 unknown user, 409 taken |
| DELETE | `/api/admin/users/[id]` | admin | none | `{ ok: true }`; 400 when deleting yourself, 404 unknown user |
| POST | `/api/admin/users/[id]/ban` | admin | JSON `banned` (boolean), `reason` (optional) | `{ ok: true }`; 400 invalid or banning yourself, 404 unknown user; banning ends the user's sessions |

The response types (`FeedTrip`, `OrganizerTrip`, `OrganizerStats`, `AdminUserRow`, `SessionUser`, `ApiResult`) and the zod validators live in `src/shared/` and are exported as `server-app/shared`. That folder must stay DB-free and use only `zod` and relative imports, because `server-admin` type-checks it with its own `@/` alias.

## Layout

- `src/app/` route handlers only (`route.ts`), no pages.
- `src/db/` Drizzle client and schema (`schema/auth.ts` is generated by Better Auth tooling; `trips.ts` and `trip-members.ts` are ours). Migrations are in `drizzle/`.
- `src/data/` server-only query layer used by the handlers.
- `src/lib/` `auth.ts`, `api-auth.ts`, `storage.ts`, `user-service.ts` (no `server-only`, because the seed scripts use it), `validators.ts`.
- `src/test/` handler tests; `scripts/` seed and storage setup.

## Invariants

- `nextCookies()` stays last in the Better Auth plugins list, so `/api/signup` can set the session cookie.
- Rate limiting is stored in the database (in-memory does not work on serverless).
- `src/db/client.ts` uses the transaction pooler with `prepare: false` and `max_pipeline: 1`; removing either makes concurrent queries hang.
- The profile photo requirement is enforced in the Better Auth `databaseHooks.user.create.before` hook, as a second defence behind the signup handler (Better Auth's public sign-up path is not allowlisted, so it returns 404).
- Migrations must be backward compatible (add first, remove in a later release), because deploy and migration start together.
