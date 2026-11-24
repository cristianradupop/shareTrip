# 0006 First-party analytics behind cookie consent

Status: accepted 2026-11-24 · Source: specs/analytics-consent

## Context
We want to see how visitors use the site (pages, clicks, named interactions, API timings, Web Vitals) and the site had no privacy notice or cookie consent. Hosting must stay free (ADR 0002: no workers or cron), and a third-party analytics service would add a data transfer to declare under GDPR and event limits on its free tier.

## Decision
- Own analytics in Supabase Postgres. Tables `analytics_events` and `analytics_salts` (migration 0003, append-only, no FKs).
- server-admin collects events only while the `tt_consent` cookie grants analytics. GPC/DNT counts as refusal.
- Events go in JSON batches (`fetch` with `keepalive`, not `sendBeacon`) to the public `POST /api/analytics` in server-app.
- That endpoint checks origin, JSON, the consent cookie and body size (64 KB, read as text), validates with zod, then enforces two budgets in `rate_limit`, counted in events:
  - 300 per IP per minute, answered 429. The key is a daily-salted hash of the IP; IPv6 is grouped by /64.
  - 10,000 per UTC day across all visitors. Over it the endpoint answers 204 and stores nothing.
- No raw IP and no raw user agent are stored. Each event keeps an IP hash with a random daily salt; older salts are deleted. Device and browser family are derived on the server.
- Retention is 30 days. Old rows are deleted opportunistically during ingest. The same ingest also deletes `rate_limit` rows idle for more than 24 hours, so the raw-IP keys of sign-up and Better Auth are removed at the next ingest after a day idle (on a quiet site, later).
- Admins read the report at `GET /api/admin/analytics`, shown in the `/admin/analytics` tab with recharts. `/admin/*` is never tracked.

## Consequences
- Cost: the public write endpoint adds DB writes per batch. The daily cap bounds storage at about 300k rows over 30 days, within the free 500 MB.
- Pruning: it only runs while traffic arrives, so a quiet site keeps rows past 30 days until the next ingest.
- Withdrawal: only collection stops. Rows already stored can't be linked to a person, so they age out instead of being deleted.
- New tracking or new cookies must update `/privacy` (its cookie table and data list) and keep the no-consent path sending nothing.
