# TripTogether

Travel-companion web app (proof of concept). Users create an account, then **organize** a trip or **join** one.
Stack: Next.js 16 · React 19 · TypeScript · Tailwind 4 · shadcn/ui (Base UI) · Drizzle ORM · Supabase Postgres · Better Auth.

## Run it locally

```bash
pnpm install
cp .env.example .env.local        # then fill it in (see comments inside; never commit it)
pnpm db:migrate                   # create tables in Supabase
pnpm db:setup-storage             # public bucket for profile photos
pnpm db:seed-admin                # first administrator (ADMIN_* in .env.local, password >= 10 chars)
pnpm db:seed-demo                 # fictional users + trips for the demo
pnpm dev                          # http://localhost:3000
```

Demo login: `alex.popescu@demo.test` (or username `alex`) / `Demo-Pass-123!`. Admin: the `ADMIN_*` values, then open `/admin`.

| Script | What it does |
|---|---|
| `pnpm db:generate` | create a SQL migration after changing `src/db/schema` (commit the file in `drizzle/`) |
| `pnpm db:migrate` | apply migrations (uses `DIRECT_URL`, session pooler :5432) |
| `pnpm db:studio` | visual database browser (Drizzle Studio) |
| `pnpm typecheck` / `pnpm lint` / `pnpm build` | checks to run before a PR |

## Zones and owners

```
src/app/
  (main)/        landing page                     <- Organizer dev
  (auth)/        login, signup                    <- Organizer dev
  (organizer)/   dashboard, trips, profile        <- Organizer dev
  feed/          community feed (read-only)       <- shared; Joiner dev adds "Join"
  (joiner)/      Joiner area (placeholder)        <- Joiner dev
  admin/         user management (admins only)    <- Organizer dev
  api/auth/      Better Auth handler              <- shared
src/db/schema/   auth.ts (generated), trips.ts, trip-members.ts  <- Joiner dev adds chats/messages
```

Rules: edit your own zone; changes to shared files (schema, `src/lib/auth.ts`, `src/components/ui`, root layout) go in small PRs.

## For the Joiner developer

- `trip_members` already exists (`tripId`, `userId`, `joinedAt`). The organizer is `trips.organizerId`, not a row in `trip_members`.
- `FeedTripCard` has an `action` slot: pass your "Join" button there. Spots left = `maxTravelers - joined`.
- Add `chats` / `messages` tables in new schema files, then `pnpm db:generate`.
- Server code must call `requireUser()` from `src/lib/session.ts` and check ownership itself: the database connection bypasses RLS.

## Things worth knowing

- **Roles:** one global role per account (`user` or `admin`). "Organizer" / "Joiner" are per-trip relationships, not roles.
- **Database access:** server code only. The app connects with the Supabase *transaction pooler* (`DATABASE_URL`, port 6543). `postgres.js` must run with `prepare: false` and `max_pipeline: 1` (see `src/db/client.ts`), otherwise concurrent queries hang.
- **Security:** `src/proxy.ts` is only a redirect. Every admin page and action calls `requireAdmin()` / `assertAdmin()`.
- **Photos:** JPG/PNG, max 2 MB, checked in the browser and again on the server (file signature).
- **Deploy:** live at https://share-trip-inky.vercel.app (Vercel Hobby, project `share-trip`, auto-deploys on push to `main`; `vercel.json` pins `fra1`). Set the same variables as `.env.example` (`BETTER_AUTH_URL` = production URL) and pick the Frankfurt function region (`fra1`) to be near Supabase.
