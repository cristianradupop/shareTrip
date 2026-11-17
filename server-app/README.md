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
| GET, POST | `/api/auth/[...all]` | public (Better Auth decides) | Better Auth routes (sign-in, sign-out, ...); DB rate limited | Better Auth responses |
| GET | `/api/session` | public | none (reads the cookie) | `{ user: SessionUser \| null }`, `Cache-Control: private, no-store` |
| POST | `/api/signup` | public | multipart: `username`, `password`, `firstName`, `lastName`, `email`, `phone`, `address`, `birthDate`, `photo` (JPG/PNG, max 2 MB) | `{ ok: true }` and the session cookie; 400 invalid data or photo, 409 username or email taken |
| GET | `/api/feed` | user | query `city`, `sort` (`asc` or `desc`), `cursor` | `{ trips: FeedTrip[], nextCursor: string \| null }` |
| GET | `/api/feed/since` | user | query `since` (ISO date, required), `city` | `{ trips: FeedTrip[], now: string }`; 400 on a bad date |
| GET | `/api/feed/cities` | user | none | `{ cities: string[] }` |
| POST | `/api/trips` | user | JSON trip (`destinationCity`, `destinationCountry`, `departureDate`, `returnDate`, `maxTravelers`, `gender`, `budgetEstimate`, `currency`, `transport`, `theme`); the organizer is the session user | `{ ok: true, id }`; 400 invalid data |
| GET | `/api/organizer/trips` | user | query `limit` (1 to 100) | `{ trips: OrganizerTrip[] }` (own trips only) |
| GET | `/api/organizer/stats` | user | none | `{ stats: OrganizerStats }` (own trips only) |
| GET | `/api/admin/users` | admin | query `q` (max 100 chars), `page` | `{ users: AdminUserRow[], total, pages }` |
| POST | `/api/admin/users` | admin | JSON `username`, `email`, `firstName`, `lastName`, `phone`, `address`, `birthDate`, `role`, `password` | `{ ok: true }`; 400 invalid data, 409 taken |
| PATCH | `/api/admin/users/[id]` | admin | JSON as above; `password` optional (empty keeps it) | `{ ok: true }`; 400 invalid or removing your own admin role, 409 taken |
| DELETE | `/api/admin/users/[id]` | admin | none | `{ ok: true }`; 400 when deleting yourself |
| POST | `/api/admin/users/[id]/ban` | admin | JSON `banned` (boolean), `reason` (optional) | `{ ok: true }`; 400 invalid or banning yourself; banning ends the user's sessions |

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
- The profile photo requirement is enforced in the Better Auth `databaseHooks.user.create.before` hook, not only in the signup handler.
- Migrations must be backward compatible (add first, remove in a later release), because deploy and migration start together.
