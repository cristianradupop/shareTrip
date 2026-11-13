# Copilot instructions

TripTogether (package `tripshare`): Next.js 16 / React 19 proof-of-concept where users organize or join trips. Course project, demoed live. Hosting must stay free (Vercel Hobby): no Docker, VPS or workers. The team prefers answers in Romanian. See `README.md` for setup and `AGENTS.md` for the Next.js warning.

## FIRST STEP of every task (before creating or editing ANY file)

Never work on `main`. Run, in this order, and confirm `git branch --show-current` is not `main`:

```bash
git fetch origin && git switch main && git pull --ff-only && git switch -c <type>/<slug>
```

Types: `feat`, `fix`, `chore`, `docs`, `ci`, `refactor`. If tracked files have uncommitted changes, or `main` cannot fast-forward, STOP and tell the user (no stash, no reset, no branching from another branch). Commit and push only when the user explicitly asks, and never to `main`. `.githooks/pre-commit` and `pre-push` reject `main` for everyone.

## Next.js is not the one you know

Next 16.4 has breaking changes. Read the relevant guide in `node_modules/next/dist/docs/` before writing Next-specific code. `src/proxy.ts` replaces `middleware.ts`. Cache Components is intentionally off.

## Commands

pnpm (pinned), Node 24.
- `pnpm dev` / `pnpm build` / `pnpm start`
- `pnpm lint` · `pnpm typecheck` · `pnpm test` (Vitest, no DB, `@/db/client` is mocked) · `pnpm test:file <path>`
- `pnpm check` = lint + typecheck + unit tests (same gate as hooks and CI)
- `pnpm build && pnpm e2e` (Playwright smoke)
- Drizzle: `pnpm db:generate` after editing `src/db/schema/*` and commit the SQL in `drizzle/`; `pnpm db:migrate`; `pnpm db:check`

Secrets live only in `.env.local`; `.env.example` lists every variable. Never commit secrets.

## Architecture

Route-group zones under `src/app/`: `(main)`, `(auth)`, `(organizer)`, `(joiner)`, `admin`, `feed`, `api/auth/[...all]`. Mutations are Server Actions in `src/app/actions/{auth,trips,admin}.ts`; no REST API besides the auth handler.

- Auth: Better Auth + Drizzle adapter, `username` and `admin` plugins; `nextCookies()` must stay last in the plugins list. One global role per account (`user` | `admin`); "organizer"/"joiner" are per-trip relationships (`trips.organizerId`, `trip_members`).
- `src/proxy.ts` only redirects when there is no session cookie; it is NOT a security boundary. Every admin page/action must call `requireAdmin()`/`assertAdmin()`, every user zone `requireUser()` (`src/lib/session.ts`).
- Server code talks to Postgres directly (bypasses Supabase RLS), so ownership checks must be written in the action itself.
- Signup requires a profile photo, enforced in the Better Auth `databaseHooks.user.create.before` hook, not just the form.
- DB (`src/db/`): `schema/auth.ts` is generated, don't hand-edit. `client.ts` uses the transaction pooler with `prepare: false` and `max_pipeline: 1`; do not remove them. Migrations must be backward compatible (add first, remove later).
- `src/lib/user-service.ts` must not import `server-only` (used by seed scripts).
- Photos: `src/lib/storage.ts`, JPG/PNG detected by signature, max 2 MB, generated names.
- UI: shadcn/ui on Base UI (not Radix) in `src/components/ui`, Tailwind 4. Reads go through `src/data/{trips,users}.ts` (server-only).

## Rules

- Edit your own zone; changes to shared files (`src/db/schema`, `src/lib/auth.ts`, `src/components/ui`, root layout) go in small PRs. Keep `trip_members` and `FeedTripCard`'s `action` slot stable.
- Add or update tests for behaviour changes; run `pnpm check` before finishing.
- Git: never work on or push to `main`. Branch `<type>/<slug>` from an up-to-date `main`, open a PR (`Closes #n`), CI must be green, squash merge. See `docs/git-workflow.md`.
- Mistakes not to repeat: `docs/learnings.md`. Decisions: `docs/adr/`.
