# Git workflow

One rule: **`main` only changes through a merged pull request with a green pipeline.** Nobody pushes to `main`, not even the owner (branch protection enforces it).

```
issue  ->  branch from main  ->  commits  ->  push branch  ->  PR  ->  CI on the server  ->  merge on GitHub  ->  main  ->  Vercel deploy
```

## Steps

1. **Issue.** Every change starts as a GitHub issue (templates: feature, bug, chore). The issue number names the branch.
2. **Branch from an up-to-date `main`.**
   ```bash
   git switch main && git pull --ff-only
   git switch -c feat/12-join-trip        # <type>/<issue-number>-<short-slug>
   ```
   Types: `feat`, `fix`, `chore`, `docs`, `ci`, `refactor`. One issue, one branch, one PR. For harness work the spec folder uses the same slug: `specs/12-join-trip/`.
3. **Work and commit** on the branch. Small commits, imperative subject (`Add join button to feed card`). The `pre-commit` hook runs `pnpm check`; fix, don't `--no-verify`. Agents never commit or push: the human does.
4. **Push the branch** to GitHub: `git push -u origin feat/12-join-trip`.
5. **Open the pull request** (GitHub prints the link after the push) into `main`. Fill the template, write `Closes #12` so the issue closes on merge. CI starts automatically on the PR.
6. **CI runs on the server** (`.github/workflows/ci.yml`): `check` (lint, types, unit tests), `migrations` (Drizzle history), `e2e` (build + Playwright smoke), plus `security` and `dependency-review`. Required: `check`, `migrations`, `e2e`. Red: fix on the same branch and push again; the PR re-runs by itself.
7. **Merge on GitHub**, not locally: button **Squash and merge** (one commit per issue on `main`). The branch is deleted automatically.
8. **After the merge**: Vercel deploys `main`; `deploy-smoke.yml` checks the live site; if `drizzle/**` changed, `migrate.yml` applies the migration to Supabase (it must be backward compatible).
9. **Sync locally**: `git switch main && git pull --ff-only`, delete the local branch (`git branch -d feat/12-join-trip`).

## Rules

- Never commit to `main`, never force-push a shared branch, never merge your own PR with red checks.
- Keep PRs small (about a day of work). A schema change ships with its generated migration (`pnpm db:generate`) in the same PR.
- Shared files (`src/db/schema`, `src/lib/auth.ts`, `src/components/ui`, root layout, `.github/`, `.claude/`) go in their own small PRs.
- Secrets never go in a commit; they live in `.env.local`, Vercel and GitHub Environments.

## One-time GitHub settings (repository owner)

Settings -> General -> Pull Requests: allow **squash merging** only, enable **Automatically delete head branches**.

Settings -> Rules -> Rulesets, two rulesets, **Enforcement: Active**, empty bypass list (so it binds the owner too):

1. **`protect-main`**, target: default branch.
   - Restrict deletions, Block force pushes.
   - Require a pull request before merging (0 approvals while the team is two people; raise it later).
   - Require status checks to pass: `check`, `migrations`, `e2e`, branch up to date. (They are listed only after CI has run once, so add them after the first PR's CI run.)
   - Result: nobody can push to `main`, only merge a pull request.
2. **`issue-branches`**, target: all branches except the default one (pattern `~DEFAULT_BRANCH` excluded).
   - Require branch names to match (Regex): `^(feat|fix|chore|docs|ci|refactor)/[0-9]+-[a-z0-9-]+$`
   - Result: only branches named after an issue (`feat/12-join-trip`) can be created and pushed.

Settings -> Environments -> `production`: secret `DIRECT_URL`.
