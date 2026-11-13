# 0004 Issue branch, pull request, squash merge on GitHub

Status: accepted 2026-11-13 · Source: harness setup

## Context
Two developers, one `main` that Vercel deploys. The harness expects a human to approve and merge, and CI to be the release gate.

## Decision
Trunk-based flow: one branch per issue from `main`, named `<type>/<issue-number>-<slug>`; push the branch, open a PR, CI must pass, merge on GitHub with squash, delete the branch. Full steps in `docs/git-workflow.md`. No long-lived branches, no direct pushes to `main`.

## Consequences
`main` history is one commit per issue. CI runs on pull requests (and on `main` after the merge), so a branch pushed without a PR is not checked. The agent cannot push or merge (deny rule, read-only GitHub MCP); the human owns the merge.
