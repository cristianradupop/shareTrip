# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

TripTogether (workspace `tripshare`: `server-app` + `server-admin`): Next.js 16 / React 19 proof-of-concept where users organize or join trips. Two-person course project, demoed live. Live at https://share-trip-inky.vercel.app (Vercel Hobby, two projects, auto-deploy from `main`, region `fra1`). The user prefers answers in Romanian. Hosting must stay free: no Docker, VPS or workers. See `README.md` for setup, demo logins, zone owners and the two Vercel projects.

## Next.js is not the one you know

Next 16.4 has breaking changes (see `AGENTS.md`). Read the relevant guide in `<package>/node_modules/next/dist/docs/` (`server-app/` or `server-admin/`) before writing Next-specific code. Example already in the repo: `server-admin/src/proxy.ts` replaces `middleware.ts`.

## Commands

Package manager is pnpm (`packageManager` is pinned); Node 24 (`.nvmrc`). The repo is a pnpm workspace with two Next apps: `server-app/` (backend: DB, auth, storage, REST API, migrations; port 3001) and `server-admin/` (the whole web UI, no DB, no secrets; port 3000). `e2e/` and `playwright.config.ts` stay at the root. Run every command below from the repo root; the root `package.json` delegates to the packages. Decision: `docs/adr/0005-two-modules-server-app-server-admin.md`.

- `pnpm dev` (both apps) / `pnpm build` (both) / `pnpm start`
- `pnpm lint` · `pnpm typecheck` (runs `next typegen` first, then `tsc --noEmit`)
- `pnpm test` (Vitest, `*/src/**/*.test.ts`, no DB: `@/db/client` is mocked) · `pnpm test:file server-admin/src/lib/format.test.ts` for one file
- `pnpm e2e` (Playwright smoke in `e2e/`, starts both production builds, server-app on :3001 and server-admin on :3100, so run `pnpm build` first; needs no DB or secrets). After a `@playwright/test` version bump (Dependabot), run `pnpm exec playwright install chromium` once, or every test fails with "Executable doesn't exist"
- `pnpm check` = lint + typecheck + unit tests; the same gate runs locally (hooks) and in CI
- Database (Drizzle, uses `DIRECT_URL`, goes to server-app): `pnpm db:generate` after editing `server-app/src/db/schema/*`, commit the new SQL in `server-app/drizzle/`; `pnpm db:migrate`; `pnpm db:check`; `pnpm db:studio`. `server-app/.env.local` points at the live Supabase DB, so `pnpm dev` and every `db:*` script touch live data: run `db:migrate` only once the migration SQL is final (after review) and with the human's OK
- Scripts (read `server-app/.env.local` via `tsx --env-file`): `pnpm db:seed-admin`, `pnpm db:seed-demo`, `pnpm db:setup-storage`, `pnpm db:backfill-gender` (run once after migration 0001)

All secrets live only in `server-app/.env.local`; `server-app/.env.example` lists every variable. `server-admin/.env.local` needs only `SERVER_APP_URL` (default `http://localhost:3001`). `BETTER_AUTH_URL` must equal the server-admin URL in production (the browser origin), not the server-app one.

## Architecture

**server-app** (`server-app/src/`): route handlers only, no pages. REST API under `src/app/api/` (`session`, `signup`, `feed`, `trips`, `organizer/*`, `admin/users`, `health`, plus the Better Auth handler `api/auth/[...all]`); the endpoint table is in `server-app/README.md`. Mutations and reads are handlers; there are no Server Actions. `src/shared/` (exported as `server-app/shared`) holds the JSON-safe types and zod validators; it must stay DB-free and use only `zod` and relative imports, because server-admin type-checks it with its own `@/` alias.

**server-admin** (`server-admin/src/`): the UI, with route-group "zones" under `src/app/`: `(main)` landing with the public trip feed, `(auth)` login/signup, `(organizer)`, `(joiner)` (placeholder, another developer builds it), `admin`. `next.config.ts` rewrites `/api/:path*` to `SERVER_APP_URL` (default `http://localhost:3001`; required on Vercel), so the browser sees one origin. Server Components read through `apiFetch`/`apiGet` (`src/lib/api.ts`, forwards the cookie header); client components use `clientFetch` (`src/lib/client-api.ts`) and `router.refresh()` after a mutation.

**Auth and authorization** (spans `server-app/src/lib/auth.ts`, `server-app/src/lib/api-auth.ts`, `server-admin/src/lib/session.ts`, `server-admin/src/proxy.ts`):
- Better Auth with Drizzle adapter, `username` + `admin` plugins, email/password (min 10 chars, no email verification). `nextCookies()` must stay last in the plugins list so `/api/signup` can set cookies. Rate limiting is stored in the DB because in-memory does not work on serverless.
- One global role per account (`user` | `admin`). "Organizer"/"Joiner" are per-trip relationships (`trips.organizerId`, rows in `trip_members`), not roles.
- server-app is public, so authorization lives in every handler: `requireApiUser(req)` / `requireApiAdmin(req)` first, before reading the body. Mutating handlers also refuse a foreign `Origin` (403, `checkSameOrigin`) and non-JSON bodies (415, `requireJson`). The organizer id of a trip always comes from the session. `server-admin/src/proxy.ts` and `requireUser()` / `requireAdmin()` (`session.ts`) only redirect: NOT a security boundary.
- Server code connects to Postgres directly, which bypasses Supabase RLS, so ownership checks (e.g. "is this my trip") must be written in the handler itself.
- Signup requires a profile photo, enforced in a Better Auth `databaseHooks.user.create.before` hook, not only in the form or `/api/signup`, because the public Better Auth sign-up endpoint can be called directly.

**Database** (`server-app/src/db/`): `schema/auth.ts` is generated by Better Auth tooling, `trips.ts`, `trip-members.ts` (approved members) and `trip-requests.ts` (join requests: pending/approved/declined) are ours. `src/db/client.ts` throws at import if `DATABASE_URL` is missing (tests and CI builds need a dummy value; the server-app vitest config sets one). It uses the Supabase transaction pooler (port 6543) with `postgres.js` `prepare: false` and `max_pipeline: 1`; removing either makes concurrent queries hang. Migrations use the session pooler (`DIRECT_URL`, port 5432).

**Users created outside the sign-up flow:** `server-app/src/lib/user-service.ts` (`createCredentialUser`) inserts user + credential account in one transaction, hashing with Better Auth's own hasher. Used by the admin "create user" endpoint and the seed scripts, so it must not import `server-only`.

**Photos:** `server-app/src/lib/storage.ts` uploads to a public Supabase Storage bucket using the server-only secret key. Type is detected from file signature (JPG/PNG), max 2 MB, generated file names.

**UI:** shadcn/ui on Base UI (not Radix) in `server-admin/src/components/ui`, Tailwind 4 via `@tailwindcss/turbopack` rules in `server-admin/next.config.ts`. `server-app/src/data/{trips,users}.ts` (server-only) is the Drizzle query layer the handlers call. Cache Components is intentionally off.

## Rules for shared files

Edit your own zone; changes to shared files (`server-app/src/db/schema`, `server-app/src/lib/auth.ts`, `server-app/src/shared`, `server-admin/src/components/ui`, root layout) go in small PRs. `FeedTripCard`'s `action` slot (the feed is on the landing page) now hosts `JoinAction` (requests in `trip_requests`, members in `trip_members`); the Joiner developer adds `chats`/`messages` tables in `server-app/src/db/schema/`, with endpoints in `server-app/src/app/api/` that call `requireApiUser`; keep `trip_members` and that slot stable.

## Workflow

- Features and behaviour changes run through the harness workflow (the `harness` skill), started by describing the change or with `/harness <ask>`: the planner's questions, your plan approval, tests first, implementation, verification, review, learnings, your final approval. Small fixes, docs and CSS: work directly.
- Commands (quiet output):
  - test: `pnpm test` · single file: `pnpm test:file <path>`
  - lint: `pnpm lint` · types: `pnpm typecheck`
  - full check, same as pre-commit and CI: `pnpm check`
  - end-to-end / run the app: `pnpm build && pnpm e2e` · `pnpm dev`
  - in-app checks log in as the demo user `alex` (README) and use trips alex owns: the admin password lives only in `server-app/.env.local`, which agents can't read. `pnpm dev` writes to the real Supabase DB, so record and restore any trip an agent edits.
- Specs and plans: `specs/<slug>/`. Decisions: `docs/adr/`. Mistakes not to repeat: `docs/learnings.md`, read before planning.
- Roles: `.claude/agents/harness-*.md`. LEARN may refine them, with approval; it never loosens them or touches hooks, settings or CI.
- Agents commit and push only when the user explicitly asks (`git push` always prompts for confirmation, via an `ask` rule in `.claude/settings.json`); never on their own initiative, never to `main`, never force-push. Keep this file under 200 lines.
- Enforced, not optional: `.claude/hooks/require-branch.sh` (run by `pre-edit.sh`) blocks Edit/Write on `main`, judging each worktree by its own branch; the git hooks in `.githooks/` refuse every new commit on `main` (commit, merge, cherry-pick, revert, am, also with `--no-verify`) and `pre-push` refuses pushing it. Local guards only: the GitHub `protect-main` ruleset is the real gate.
- Starting an issue or feature (before `/harness` step 1 and before writing any file): always branch from an up-to-date `main`: `git fetch origin && git switch main && git pull --ff-only && git switch -c <type>/<slug>`. If tracked files have uncommitted changes (untracked ones like `.serena/` don't count), or `main` cannot fast-forward, stop and tell the user instead of stashing, resetting or branching from the current branch. Creating the branch is allowed for agents; committing and pushing only when the user explicitly asks.
- Git: issue -> branch `<type>/<slug>` from `main` (any name but `main`) -> push branch -> PR (`Closes #n`) -> CI on GitHub -> squash merge on GitHub. Never work on `main`; full steps in `docs/git-workflow.md`.
- Release: PR into `main` -> CI (`.github/workflows/ci.yml`) must be green -> merge -> Vercel deploys; migrations in `server-app/drizzle/` are applied by `.github/workflows/migrate.yml` and must be backward compatible (add first, remove in a later release), because deploy and migration start together.

## MCP servers (`.mcp.json`)

- `playwright` (pinned): the verifier drives the real app and takes screenshots.
- `serena`: symbol-level code navigation (definitions, callers, references); the planner uses it when available. Needs `uv` (`brew install uv`).
- `github`: **read-only** (header `X-MCP-Readonly`), toolsets repos/issues/pull_requests/actions, to read PRs and CI failures. Needs `GITHUB_PERSONAL_ACCESS_TOKEN` in the shell environment (never in the repo). It stays read-only on purpose: agents never commit, push or merge.
