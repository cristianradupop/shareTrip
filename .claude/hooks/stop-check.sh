#!/usr/bin/env bash
# Harness step 7 (CHECK): before Claude hands work back, run the project's full check.
# Exit 2 + stderr = Claude must fix and try again. Skips when only docs changed or this exact code state already passed.
set -u
cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0

input=$(cat)
# If a previous Stop hook already forced a retry, don't loop forever: let the human see the failure.
if printf '%s' "$input" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{process.exit(JSON.parse(s).stop_hook_active?0:1)}catch{process.exit(1)}})'; then
  exit 0
fi

# Only code/config changes need the full check.
changed=$(git status --porcelain -- src e2e scripts drizzle package.json pnpm-lock.yaml next.config.ts tsconfig.json eslint.config.mjs vitest.config.mts playwright.config.ts 2>/dev/null)
[ -z "$changed" ] && exit 0

# Run each check once per code state.
state=$( (git diff HEAD -- . ':!.claude'; git ls-files --others --exclude-standard -- src e2e scripts drizzle | xargs -I{} sh -c 'echo {}; cat "{}"') 2>/dev/null | shasum | cut -d' ' -f1)
stamp="$(git rev-parse --git-dir)/claude-check-ok"
[ -f "$stamp" ] && [ "$(cat "$stamp")" = "$state" ] && exit 0

out=$(pnpm check 2>&1)
if [ $? -eq 0 ]; then
  printf '%s' "$state" > "$stamp"
  exit 0
fi
echo "pnpm check failed. Fix it before finishing. Last output:" >&2
printf '%s\n' "$out" | tail -40 >&2
exit 2
