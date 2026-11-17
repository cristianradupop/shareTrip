# Learnings

Mistakes not to repeat in this repo. Agents propose them at LEARN; a human approves. Read before planning.

## Rules
- Tests that import code touching `@/db/client` must mock it (see `server-admin/src/lib/user-service.test.ts`), because the module throws at import without `DATABASE_URL`; `server-admin/vitest.config.mts` sets a dummy value for the import only. · 2026-11-13 · setup · seen 1
- When a root script moves to `pnpm -r` or `pnpm --filter`, check that everything the old root command covered still is, because `pnpm -r` skips the workspace root: `e2e/` and the root configs silently dropped out of `lint` until a root `eslint.config.mjs` and an explicit `eslint e2e ...` step were added. · 2026-11-17 · specs/server-app-server-admin · seen 1

## Open questions
