# Learnings

Mistakes not to repeat in this repo. Agents propose them at LEARN; a human approves. Read before planning.

## Rules
- Tests that import code touching `@/db/client` must mock it (see `src/lib/user-service.test.ts`), because the module throws at import without `DATABASE_URL`; `vitest.config.mts` sets a dummy value for the import only. · 2026-11-13 · setup · seen 1

## Open questions
