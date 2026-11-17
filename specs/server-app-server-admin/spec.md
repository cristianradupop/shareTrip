# Split into server-app (backend) and server-admin (frontend)

Source: instructor requirement (course chat, 2026-11-17): "a client-server application with two modules: backend named server-app and frontend (web app) named server-admin", stack Next.js 16 + React 19 + TypeScript, Postgres (Supabase) + Drizzle, Tailwind 4 + shadcn/ui.

## Problem
The repo is one Next.js app where pages read Postgres directly and forms call Server Actions (ADR 0001). The instructor requires two modules: `server-app`, a backend, and `server-admin`, the whole web UI (landing, auth, organizer, joiner, admin, feed), talking to each other client-server. End users must not notice the change, and the live demo site must keep working throughout.

## Behaviour
- Given the repo root, when listing it, then `server-app/` and `server-admin/` are pnpm workspace packages, each a Next.js 16 app.
- Given `server-admin`, when it is built, then it contains no DB, Drizzle, postgres, Supabase, Better Auth server or secret-reading code; its only env var is the backend URL.
- Given the browser on server-admin, when it calls `/api/*`, then server-admin's rewrite forwards the call to server-app and auth cookies land on server-admin's origin.
- Given client components that mutate data (signup with photo, create trip, feed load more/refresh, admin create/update/ban/delete user), when they run, then they `fetch` `/api/*`; no Server Actions remain.
- Given a server-admin page that needs data or the session (nav, feed, organizer trips, admin users, redirects), when it renders, then its Server Component fetches server-app server-side, forwarding the request cookies; redirects and rendering behave as today.
- Given no session, when a protected endpoint is called, then it returns 401.
- Given a non-admin session, when an admin endpoint is called, then it returns 403.
- Given a trip creation request, when it is handled, then the organizer is the session user, never a value from the body.
- Given a signup without a photo, with a photo over 2 MB, or with a non-JPG/PNG file, when it is posted, then it is rejected as today.
- Given server-app's own URL, when `/` is requested, then it returns a small JSON health/info response; every data endpoint enforces its own session/role check.
- Given a logged-out user, when visiting `/organizer`, `/joiner`, `/feed` or `/admin`, then they are redirected to `/login?next=...` as today.
- Given the repo root, when running `pnpm check`, `pnpm test`, `pnpm build`, `pnpm e2e` and `pnpm db:*`, then they work for both modules (CI job names `check`, `migrations`, `e2e` unchanged).
- Given `pnpm e2e`, when it runs with no DB and dummy env, then both apps start, the 7 current smoke tests pass on desktop and mobile, plus one test that a server-app health endpoint answers through server-admin's `/api` rewrite.
- Given shared types and validators (validators.ts, FeedTrip, OrganizerTrip, AdminUserRow, FeedSort), when server-admin imports them, then it uses a DB-free `shared` entry point exported by the `server-app` package.

## Out of scope
Joiner features, `chats`/`messages` tables, schema changes or new migrations, new end-user features, a custom domain, OpenAPI. Vercel UI work (new project, Root Directory, env vars) is done by the human, from written steps.

## Constraints
- Delivered as two PRs, each leaving the live site working: PR 1 turns the repo into a pnpm workspace and moves the current app unchanged into `server-admin/`; PR 2 extracts `server-app` and switches to REST.
- Folders at the repo root: `server-app/`, `server-admin/`. Migrations move to `server-app/drizzle/`.
- Guardrail files (`.github/workflows/*`, `.githooks/*`, `.claude/hooks/*`, `.claude/settings*.json`, CODEOWNERS, `.claude/agents/*`) are not edited by agents: exact patches go in `specs/server-app-server-admin/guardrail-patches/`, the human applies them in the same PR before merge (migrate.yml paths, stop-check pathspec, deploy-smoke URLs, CI steps if needed, CODEOWNERS, security-reviewer paths).
- Production cutover with zero downtime: server-app Vercel project created and checked first, then the existing `share-trip` project's Root Directory switches to `server-admin`. `BETTER_AUTH_URL` stays https://share-trip-inky.vercel.app (server-admin's origin).
- server-admin previews point at production server-app; preview origins are not added to `trustedOrigins` (login on previews may fail, accepted).
- server-app is public, no shared-secret header.
- Unit tests for the REST handlers' authorization: 401 without session, 403 non-admin on admin endpoints, organizer from session, 2 MB / type photo limit. Rule from docs/learnings.md: mock `@/db/client` in tests.
- REST endpoints documented as a table (method, path, auth, body, response) in `server-app/README.md`.
- Update README, CLAUDE.md (stay under 200 lines), `docs/ghid-colega.md` (currently untracked, include it); new ADR superseding 0001.
- ADR 0002: hosting stays free (two Vercel Hobby projects, region fra1). ADR 0003: required checks and backward-compatible migrations. ADR 0004: git flow.
- CLAUDE.md invariants carry over to server-app: Next 16.4 docs in `node_modules/next/dist/docs/` before Next-specific code; `nextCookies()` last; DB rate limiting; postgres.js `prepare: false` + `max_pipeline: 1`; signup photo enforced in the Better Auth `databaseHooks.user.create.before` hook; `user-service.ts` without `server-only`.

## Open questions
None blocking.
