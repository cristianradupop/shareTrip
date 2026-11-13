#!/usr/bin/env bash
# PreToolUse (Edit|Write): no project file is touched while on main (or detached HEAD).
# Workflow rule: branch from an up-to-date main first. Exit 2 = blocked, message goes back to Claude.
root="${CLAUDE_PROJECT_DIR:-.}"
file=$(node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{console.log(JSON.parse(s).tool_input?.file_path??"")}catch{console.log("")}})')
# Only guard files inside this repository (memory, scratchpad and other outside paths are fine).
case "$file" in "$root"/*) ;; *) exit 0 ;; esac
branch=$(git -C "$root" branch --show-current 2>/dev/null)
if [ -z "$branch" ] || [ "$branch" = "main" ]; then
  echo "BLOCKED: you are on '${branch:-detached HEAD}'. Before writing any file, create a branch from an up-to-date main:" >&2
  echo "  git fetch origin && git switch main && git pull --ff-only && git switch -c <type>/<slug>" >&2
  echo "If tracked files have uncommitted changes or main cannot fast-forward, stop and tell the user. See docs/git-workflow.md." >&2
  exit 2
fi
exit 0
