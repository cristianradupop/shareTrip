# 0005 Two modules: server-app (backend) and server-admin (frontend)

Status: accepted 2026-11-17 · Source: specs/server-app-server-admin
Supersedes: 0001

## Context
The instructor requires a client-server application with two modules: a backend named `server-app` and a web frontend named `server-admin`, on Next.js 16 + React 19 + TypeScript, Supabase Postgres + Drizzle, Tailwind 4 + shadcn/ui. ADR 0001 kept one Next.js app with zones, which does not meet that. `server-admin` is the whole web UI, not only an admin panel.

## Decision
A pnpm workspace with two Next.js 16 apps at the repo root:
- `server-app` owns the database, Better Auth, storage, migrations and a REST API under `/api`; it has no pages.
- `server-admin` is the whole web UI (landing, auth, organizer, joiner, admin, feed). It has no DB access and no secrets, calls `server-app` over HTTP, and rewrites `/api/*` to it so the browser sees one origin and auth cookies stay first-party.
- Shared types and validators come from a DB-free `server-app/shared` export.

Delivered in two PRs: PR 1 moves the current app unchanged into `server-admin/`; PR 2 extracts `server-app` and switches to REST.

## Consequences
Two Vercel Hobby projects from one repo, each with its own Root Directory, still free (ADR 0002); `BETTER_AUTH_URL` stays the server-admin origin. Root scripts (`check`, `build`, `e2e`, `db:*`) delegate to the packages, so the required CI job names stay (ADR 0003). Every endpoint checks the session and role itself, since server-app is public. Zones remain a convention inside `server-admin/src/app/`.
