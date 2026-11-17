# Learnings

Mistakes not to repeat in this repo. Agents propose them at LEARN; a human approves. Read before planning.

## Rules
- Tests that import code touching `@/db/client` must mock it (see `server-app/src/lib/user-service.test.ts`), because the module throws at import without `DATABASE_URL`; `server-app/vitest.config.mts` sets a dummy value for the import only. · 2026-11-17 · setup, specs/server-app-server-admin · seen 2
- When a root script moves to `pnpm -r` or `pnpm --filter`, check that everything the old root command covered still is, because `pnpm -r` skips the workspace root: `e2e/` and the root configs silently dropped out of `lint` until a root `eslint.config.mjs` and an explicit `eslint e2e ...` step were added. · 2026-11-17 · specs/server-app-server-admin · seen 1
- When a Server Action becomes a route handler, give every mutating handler a same-origin check (`checkSameOrigin` in `server-app/src/lib/api-auth.ts`). Server Actions got Next's built-in Origin/Host check for free, and handlers that call `auth.api.*` directly skip Better Auth's own origin check, so the first REST version of `POST /api/signup` was open to login CSRF. · 2026-11-17 · specs/server-app-server-admin · seen 1
- Vercel skips the build when a commit doesn't touch the project's Root Directory. It shows "Canceled" in Vercel but still reports `Vercel: pass` on GitHub, so an empty commit does not rebuild after a settings change. Use Redeploy in the Vercel UI, and check the deployment page, not only the GitHub check. · 2026-11-17 · specs/server-app-server-admin · seen 1

## Open questions
