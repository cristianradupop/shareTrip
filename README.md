# TripTogether

Travel-companion web app (proof of concept). Users create an account, then **organize** a trip or **join** one.
Stack: Next.js 16 · React 19 · TypeScript · Tailwind 4 · shadcn/ui (Base UI) · Drizzle ORM · Supabase Postgres · Better Auth.

## Two modules

The instructor requires a client-server application with two modules, so the repo is a pnpm workspace with two Next.js apps (decision: [ADR 0005](docs/adr/0005-two-modules-server-app-server-admin.md)):

- [`server-app/`](server-app/README.md) is the backend: database, Better Auth, photo storage, migrations and a REST API under `/api` (no pages). Port 3001.
- [`server-admin/`](server-admin/README.md) is the whole web UI (landing with the public trip feed, auth, organizer, joiner, admin). It has no DB access and no secrets; it calls server-app over HTTP and rewrites `/api/*` to it, so the browser sees one origin. Port 3000.

## Run it locally

```bash
pnpm install
cp server-app/.env.example server-app/.env.local   # then fill it in (see comments inside; never commit it)
cp server-admin/.env.example server-admin/.env.local   # only SERVER_APP_URL, default http://localhost:3001
pnpm db:migrate                   # create tables in Supabase
pnpm db:backfill-gender           # random gender for accounts that have none; run once after migration 0001
pnpm db:backfill-audit            # creation events for existing accounts and trips; run once after migration 0002
pnpm db:setup-storage             # public bucket for profile photos
pnpm db:seed-admin                # first administrator (ADMIN_* in server-app/.env.local, password >= 10 chars)
pnpm db:seed-demo                 # fictional users + trips for the demo
pnpm dev                          # server-admin http://localhost:3000, server-app http://localhost:3001
```

All secrets live in `server-app/.env.local`. `server-admin/.env.local` needs only `SERVER_APP_URL`. Run all commands from the repo root; `db:*` scripts go to server-app.

Demo login: `alex.popescu@demo.test` (or username `alex`) / `Demo-Pass-123!`. Admin: the `ADMIN_*` values, then open `/admin`.

| Script | What it does |
|---|---|
| `pnpm db:generate` | create a SQL migration after changing `server-app/src/db/schema` (commit the file in `server-app/drizzle/`) |
| `pnpm db:migrate` | apply migrations (uses `DIRECT_URL`, session pooler :5432) |
| `pnpm db:studio` | visual database browser (Drizzle Studio) |
| `pnpm check` | lint + typecheck + unit tests (Vitest); the gate used by the pre-commit hook and CI |
| `pnpm e2e` | Playwright smoke tests against both production builds (`pnpm build` first; no DB needed) |
| `pnpm test:file <path>` | run a single unit test file |

## Zones and owners

```
server-admin/src/app/
  (main)/        landing page + public trip feed  <- Organizer dev; Joiner dev adds "Join" in the feed card
  (auth)/        login, signup                    <- Organizer dev
  (organizer)/   dashboard, trips, profile        <- Organizer dev
  (joiner)/      Joiner area (placeholder)        <- Joiner dev
  admin/         user management (admins only)    <- Organizer dev
server-app/src/app/api/       REST endpoints (table in server-app/README.md)  <- shared
server-app/src/db/schema/     auth.ts (generated), trips.ts, trip-members.ts  <- Joiner dev adds chats/messages
```

Rules: edit your own zone; changes to shared files (schema, `server-app/src/lib/auth.ts`, `server-admin/src/components/ui`, root layout) go in small PRs.

## For the Joiner developer

- `trip_members` already exists (`tripId`, `userId`, `joinedAt`). The organizer is `trips.organizerId`, not a row in `trip_members`.
- `FeedTripCard` has an `action` slot: pass your "Join" button there. The feed lives on the landing page (`/`). Spots left = `maxTravelers - joined`.
- Add `chats` / `messages` tables in new files under `server-app/src/db/schema/`, then `pnpm db:generate`.
- New endpoints go in `server-app/src/app/api/...` and must call `requireApiUser(req)` and check ownership themselves: the database connection bypasses RLS.

## Things worth knowing

- **Roles:** one global role per account (`user` or `admin`). "Organizer" / "Joiner" are per-trip relationships, not roles.
- **Database access:** server-app only. It connects with the Supabase *transaction pooler* (`DATABASE_URL`, port 6543). `postgres.js` must run with `prepare: false` and `max_pipeline: 1` (see `server-app/src/db/client.ts`), otherwise concurrent queries hang.
- **Security:** server-app is public, so every endpoint checks the session itself (`requireApiUser` / `requireApiAdmin`). `server-admin/src/proxy.ts` and `requireUser()` / `requireAdmin()` in server-admin only redirect.
- **Photos:** JPG/PNG, max 2 MB, checked in the browser and again on the server (file signature).
- **Deploy:** two Vercel Hobby projects from this repo, both in `fra1` (pinned by `vercel.json` in each module):
  - `share-trip` (https://share-trip-inky.vercel.app, auto-deploys on push to `main`): Root Directory `server-admin`, "Include files outside Root Directory" on, env `SERVER_APP_URL` = the production URL of the server-app project (required for the build).
  - A second project (for example `share-trip-server-app`): Root Directory `server-app`, env `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `SUPABASE_PHOTOS_BUCKET`, `BETTER_AUTH_SECRET`, and `BETTER_AUTH_URL` = `https://share-trip-inky.vercel.app` (the UI origin, not the server-app one).
- **Preview logins fail by design:** the preview origin differs from `BETTER_AUTH_URL`, Better Auth's origin check rejects it, and the login form shows one generic error ("Wrong username/email or password"). Test login on production or locally.

## Workflow and CI/CD

Features follow a nine-step agentic workflow with two human gates (plan, approve). In Claude Code: describe the change or run `/harness <ask>`; details in `CLAUDE.md` (Workflow) and `.claude/skills/harness/SKILL.md`.

| Step | Who | Where |
|---|---|---|
| 1 Context · 2 **Plan** (you approve) · 3 Implement (tests first) · 4 Verify · 5 Review · 6 Learn | agents + you at the plan gate | `specs/<slug>/`, `docs/adr/`, `docs/learnings.md` |
| 7 Check | local, forced | Claude Code `Stop` hook and git `pre-commit` (`.githooks/`), both run `pnpm check` |
| 8 **Approve** | you | PR template: you must be able to explain the change |
| 9 Release | CI, cannot be skipped | `.github/workflows/ci.yml` (check, migrations, e2e, security), then Vercel deploy and `migrate.yml` |

**Git flow:** issue -> branch from `main` -> push -> pull request -> CI on GitHub -> squash merge on GitHub (steps and rules: [`docs/git-workflow.md`](docs/git-workflow.md)).

**Pipeline:** PR -> CI (`check`, `migrations`, `e2e` required) -> merge to `main` -> Vercel deploys -> post-deploy smoke (`deploy-smoke.yml`). When `server-app/drizzle/**` changes, `migrate.yml` applies the migrations to Supabase; they must be backward compatible because deploy and migration start together.

**One-time repository setup (GitHub UI):** Settings -> Branches/Rules: require a pull request and the status checks `check`, `migrations`, `e2e` on `main`. Settings -> Environments: create `production` and add the secret `DIRECT_URL` (Supabase session pooler, port 5432). Hooks are enabled automatically by `pnpm install`.
