#!/usr/bin/env bash
# No commit is created on main, whatever command creates it. Run by:
#   pre-commit          git commit (fails fast, before pnpm check)
#   prepare-commit-msg  git commit, also with --no-verify, and merge, cherry-pick, revert
#   pre-applypatch      git am
# Local guard only; the real gate is the protect-main ruleset on GitHub (docs/git-workflow.md).
[ "$(git branch --show-current)" = "main" ] || exit 0
echo "${1:-git hook}: refusing to create a commit on main. Create a branch first:" >&2
echo "  git fetch origin && git switch main && git pull --ff-only && git switch -c <type>/<slug>" >&2
echo "(uncommitted work comes along with: git switch -c <type>/<slug>; a stopped merge, cherry-pick, revert or am: run it with --abort first)" >&2
exit 1
