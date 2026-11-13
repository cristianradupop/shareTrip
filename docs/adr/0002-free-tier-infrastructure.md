# 0002 Free-tier infrastructure only

Status: accepted 2026-11-13 · Source: project kickoff

## Context
Course project with no budget. DanubeData was checked: its free tier is static sites only.

## Decision
Vercel Hobby (app, region `fra1`), Supabase free project in Frankfurt (Postgres + Storage), GitHub Actions (CI). No Docker, VPS, queues or workers.

## Consequences
Serverless constraints apply: DB access through the transaction pooler (`prepare: false`, `max_pipeline: 1`), rate limiting stored in the DB, no long-running jobs. Vercel Hobby is single-account, so only the owner can deploy.
