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
| `pnpm check` | lint + typecheck + unit tests (Vitest); the gate used by the pre-commit hook and CI |
| `pnpm e2e` | Playwright smoke tests against the production build (`pnpm build` first; no DB needed) |
| `pnpm test:file <path>` | run a single unit test file |

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

## Workflow and CI/CD

Features follow a nine-step agentic workflow with two human gates (plan, approve). In Claude Code: describe the change or run `/harness <ask>`; details in `CLAUDE.md` (Workflow) and `.claude/skills/harness/SKILL.md`.

| Step | Who | Where |
|---|---|---|
| 1 Context · 2 **Plan** (you approve) · 3 Implement (tests first) · 4 Verify · 5 Review · 6 Learn | agents + you at the plan gate | `specs/<slug>/`, `docs/adr/`, `docs/learnings.md` |
| 7 Check | local, forced | Claude Code `Stop` hook and git `pre-commit` (`.githooks/`), both run `pnpm check` |
| 8 **Approve** | you | PR template: you must be able to explain the change |
| 9 Release | CI, cannot be skipped | `.github/workflows/ci.yml` (check, migrations, e2e, security), then Vercel deploy and `migrate.yml` |

**Git flow:** issue -> branch from `main` -> push -> pull request -> CI on GitHub -> squash merge on GitHub (steps and rules: [`docs/git-workflow.md`](docs/git-workflow.md)).

**Pipeline:** PR -> CI (`check`, `migrations`, `e2e` required) -> merge to `main` -> Vercel deploys -> post-deploy smoke (`deploy-smoke.yml`). When `drizzle/**` changes, `migrate.yml` applies the migrations to Supabase; they must be backward compatible because deploy and migration start together.

**One-time repository setup (GitHub UI):** Settings -> Branches/Rules: require a pull request and the status checks `check`, `migrations`, `e2e` on `main`. Settings -> Environments: create `production` and add the secret `DIRECT_URL` (Supabase session pooler, port 5432). Hooks are enabled automatically by `pnpm install`.
