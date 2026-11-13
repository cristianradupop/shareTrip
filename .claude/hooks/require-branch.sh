#!/usr/bin/env bash
# Edit/Write guard, run by pre-edit.sh with the file path as $1: no file of this repository is touched
# while the checkout that holds it is on main. Each worktree (.claude/worktrees/*) is judged by its own
# branch. Detached HEAD (rebase, bisect) is allowed. Exit 2 = blocked, message goes back to Claude.
file="${1//\\//}"   # Windows (Git Bash) paths: backslashes to slashes
[ -n "$file" ] || exit 0
# Nearest existing directory: a new file may go into a folder that does not exist yet.
dir=$(dirname -- "$file")
while [ ! -d "$dir" ]; do dir=$(dirname -- "$dir"); done
# Compare repositories as git resolves them (physical paths), so symlinks, letter case and extra
# slashes can't make a file inside the repo look like an outside one. Worktrees share the common dir.
repo_of() { git -C "$1" rev-parse --path-format=absolute --git-common-dir 2>/dev/null; }
project=$(repo_of "${CLAUDE_PROJECT_DIR:-.}") || exit 0
# Outside this repository (memory, scratchpad, other projects): not our business.
[ "$(repo_of "$dir")" = "$project" ] || exit 0
[ "$(git -C "$dir" branch --show-current 2>/dev/null)" = "main" ] || exit 0
echo "BLOCKED: $(git -C "$dir" rev-parse --show-toplevel) is on 'main'. Before writing any file, create a branch from an up-to-date main:" >&2
echo "  git fetch origin && git switch main && git pull --ff-only && git switch -c <type>/<slug>" >&2
echo "If tracked files have uncommitted changes or main cannot fast-forward, stop and tell the user. See docs/git-workflow.md." >&2
exit 2
