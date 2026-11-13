# 0003 CI gates the deploy

Status: accepted 2026-11-13 · Source: harness setup

## Context
Vercel deployed every push to `main` with no checks. The harness workflow expects CI to re-run everything in a clean environment, which the agent cannot skip.

## Decision
GitHub Actions runs lint, types, unit tests, build, Drizzle consistency check, Playwright smoke and a dependency audit on every PR. Branch protection on `main` requires those checks and a pull request, so Vercel (still Git-connected) only deploys merged, green code. Drizzle migrations are applied by a separate workflow on pushes that change `drizzle/**`, with `DIRECT_URL` stored in the GitHub Environment `production`.

## Consequences
Migrations and the Vercel deploy start at the same time, so every migration must be backward compatible with the previous release (add, then remove later). E2E smoke tests use dummy env and no database; flows that need data wait for a test database.
