#!/usr/bin/env bash
# Edit/Write guard, run by pre-edit.sh with the file path as $1: generated files must come from
# their generator, not from hand edits. Exit 2 = blocked, message goes back to Claude.
file="${1//\\//}"
case "$file" in
  */pnpm-lock.yaml)
    echo "pnpm-lock.yaml is generated. Change package.json and run pnpm install instead." >&2; exit 2 ;;
  */drizzle/*)
    echo "drizzle/ is generated. Edit src/db/schema/* and run pnpm db:generate; never hand-edit an applied migration." >&2; exit 2 ;;
esac
exit 0
