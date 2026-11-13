# Copilot instructions

TripTogether (package `tripshare`): Next.js 16 / React 19 course project, demoed live. The team prefers answers in Romanian.

## FIRST STEP of every task (before creating or editing ANY file)

Never work on `main`. Run, in this order, and confirm `git branch --show-current` is not `main`:

```bash
git fetch origin && git switch main && git pull --ff-only && git switch -c <type>/<slug>
```

Types: `feat`, `fix`, `chore`, `docs`, `ci`, `refactor`. If tracked files have uncommitted changes, or `main` cannot fast-forward, STOP and tell the user (no stash, no reset, no branching from another branch). Commit and push only when the user explicitly asks, and never to `main`.

## Where the rules live

Read these before changing code; they apply to Copilot as much as to Claude Code, and are not repeated here so they can't drift apart:

- `CLAUDE.md`: the single source for commands, architecture, security rules (auth checks, ownership checks, DB pooler settings, photo uploads), shared-file rules and the git/release workflow.
- `AGENTS.md`: Next.js 16 has breaking changes; read `node_modules/next/dist/docs/` before writing Next-specific code.
- `docs/learnings.md`: mistakes not to repeat. `docs/git-workflow.md`: the full git steps.

## Copilot-specific notes

- The Claude Code parts of `CLAUDE.md` (the `harness` skill, `.claude/agents`, `.claude/hooks`) don't run for you. Do their job by hand: add or update tests with every behaviour change, run `pnpm check` before finishing, and never hand-edit generated files (`pnpm-lock.yaml`, `drizzle/`, `src/db/schema/auth.ts`).
- Nothing stops you from editing files on `main`; only the git hooks in `.githooks/` refuse it, at commit time. That is why the first step above comes first.
- MCP: `.vscode/mcp.json` configures the Playwright server, for driving the running app (`pnpm dev`).
