#!/usr/bin/env bash
# PreToolUse (Edit|Write): generated files must come from their generator, not from hand edits.
# Exit 2 = blocked, message goes back to Claude.
file=$(node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{console.log(JSON.parse(s).tool_input?.file_path??"")}catch{console.log("")}})')
case "$file" in
  */pnpm-lock.yaml)
    echo "pnpm-lock.yaml is generated. Change package.json and run pnpm install instead." >&2; exit 2 ;;
  */drizzle/*)
    echo "drizzle/ is generated. Edit src/db/schema/* and run pnpm db:generate; never hand-edit an applied migration." >&2; exit 2 ;;
esac
exit 0
