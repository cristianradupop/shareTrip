# 0001 One Next.js app with zones

Status: accepted 2026-11-13 · Source: project kickoff

## Context
Two developers build TripTogether for a course. Landing, organizer, admin and (later) joiner areas share auth, schema and UI.

## Decision
One Next.js app with route-group zones (`(main)`, `(auth)`, `(organizer)`, `(joiner)`, `admin`, `feed`), not several deployed apps or a monorepo. Each developer edits their own zone; shared files go in small PRs.

## Consequences
One deploy, one CI pipeline, one schema. Zone boundaries are a convention (README, CODEOWNERS), not enforced by the build.
