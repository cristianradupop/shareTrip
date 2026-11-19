# Learnings

Mistakes not to repeat in this repo. Agents propose them at LEARN; a human approves. Read before planning.

## Rules
- Tests that import code touching `@/db/client` must mock it (see `server-app/src/lib/user-service.test.ts`), because the module throws at import without `DATABASE_URL`; `server-app/vitest.config.mts` sets a dummy value for the import only. · 2026-11-17 · setup, specs/server-app-server-admin · seen 2
- When a root script moves to `pnpm -r` or `pnpm --filter`, check that everything the old root command covered still is, because `pnpm -r` skips the workspace root: `e2e/` and the root configs silently dropped out of `lint` until a root `eslint.config.mjs` and an explicit `eslint e2e ...` step were added. · 2026-11-17 · specs/server-app-server-admin · seen 1
- When a Server Action becomes a route handler, give every mutating handler a same-origin check (`checkSameOrigin` in `server-app/src/lib/api-auth.ts`). Server Actions got Next's built-in Origin/Host check for free, and handlers that call `auth.api.*` directly skip Better Auth's own origin check, so the first REST version of `POST /api/signup` was open to login CSRF. · 2026-11-17 · specs/server-app-server-admin · seen 1
- Vercel skips the build when a commit doesn't touch the project's Root Directory. It shows "Canceled" in Vercel but still reports `Vercel: pass` on GitHub, so an empty commit does not rebuild after a settings change. Use Redeploy in the Vercel UI, and check the deployment page, not only the GitHub check. · 2026-11-17 · specs/server-app-server-admin · seen 1
- In the landing feed's reducer (`server-admin/src/lib/feed-state.ts`), take the Refresh watermark `since` only from a generation's first page, never from later pages: a trip posted between the first load and a later page is newer than every trip on the list, so the newest-first cursor never reaches it, and a moved `since` makes Refresh skip it too. · 2026-11-19 · specs/public-feed-home · seen 1
- Put data backfills in an idempotent script under `server-app/scripts/` with a `db:*` package script (e.g. `pnpm db:backfill-gender`, `UPDATE ... WHERE col IS NULL`), not in a Drizzle migration: `.claude/hooks/protect-generated.sh` blocks every edit under `server-app/drizzle/`, and `migrate.yml` does not run scripts, so name the script as a release step in the PR. · 2026-11-19 · specs/feed-join · seen 1
- In server-app handler tests, don't assert exact counts on `state.updates`/`state.inserts`: the fake in `server-app/src/test/helpers.ts` records one entry per chained call (`update().set().where()` records twice). Assert the table or payload instead, and sign in as the mocked owner in every describe that hits an owner-only route. · 2026-11-19 · specs/feed-join · seen 1

## Open questions
