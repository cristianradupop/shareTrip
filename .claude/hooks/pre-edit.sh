#!/usr/bin/env bash
# PreToolUse (Edit|Write): reads the edited file's path from the hook payload once (one Node start),
# then runs each guard with it as $1. Exit 2 = blocked, the guard's message goes back to Claude.
hooks="$(cd "$(dirname "$0")" && pwd)"
file=$(node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{console.log(JSON.parse(s).tool_input?.file_path??"")}catch{console.log("")}})')
[ -n "$file" ] || exit 0
for guard in require-branch.sh protect-generated.sh; do
  "$hooks/$guard" "$file" || exit $?
done
exit 0
