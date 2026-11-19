# Admin console: statistics, trips, activity, account history, audit log

Source: user request (chat, 2026-11-19), with a screenshot of another app's admin area as the model: "implementeaza sa am si aceste meniuri si functionalitati aferente, pt partea de admin". Tabs in the screenshot: Statistici, Conturi, Proiecte, Activitate, Istoric conturi, Jurnal de audit. Its account history reads: the last 300 changes to accounts, by the holders and by administrators; history cannot be edited or deleted.

## Problem
The admin area is a single Users page. Admins can't see how the platform is doing, can't see all trips, and nothing records who changed an account or a trip, or when. The admin needs tabs for statistics, accounts, trips, and three read-only history views, backed by one append-only event log.

## Behaviour
Navigation:
- Given an admin on any admin page, when it renders, then the header shows tabs (English): Statistics, Accounts, Trips, Activity, Account history, Audit log; each tab has its own route; `/admin` stays the Accounts list (existing links and tests keep working).
- Given a non-admin or logged-out visitor, when they open any new admin page or admin endpoint, then they are redirected (pages) or get 401/403 (endpoints).

Statistics (numbers only, no charts):
- Given an admin, when Statistics loads, then it shows: accounts total / active / banned / admins; new accounts in the last 7 and 30 days; trips by status (active, full, cancelled) and upcoming vs departed; join requests pending / approved / declined; total approved members.

Trips (read only):
- Given an admin, when Trips loads, then it lists all trips (any organizer, any status) with search by city or organizer, a status filter and pagination, and read-only details; no edit, cancel or delete actions (admins keep no exception on trip mutations).

Event log (one append-only table, three views, latest 300 rows each, newest first, no filters):
- Account history: account events. By the holder: created their account, changed their profile (e.g. gender), changed their password if the UI offers it. By an admin: created, edited, banned (with reason), unbanned, changed role, deleted the account. Each row: when, account (name + email as they were at the time, marked "deleted" if the account no longer exists), what changed, who (badge "holder" or "administrator" + admin name).
- Activity: what users do with trips: created a trip, edited a trip, requested to join, withdrew, left, organizer approved / declined (with auto-declined requests).
- Audit log: every action performed by an administrator, on any entity.
- "What changed" lists field names only ("changed name, phone"), never values, except the ban reason and the new role. No IP addresses or user agents are stored or shown.
- History rows are never updated or deleted by the app: no update/delete endpoints; the table has no cascading foreign key, so deleting a user or trip keeps its history (with the name/email/city copied at the time).
- Retention is unlimited; each view shows the latest 300 rows.
- Past events are backfilled once by an idempotent script: "created their account" from `user.createdAt`, "created the trip" from `trips.createdAt`.

Better Auth endpoints:
- Given Better Auth's own account-changing endpoints that bypass our handlers (`/api/auth/update-user`, `/api/auth/change-password`, the admin plugin's `/api/auth/admin/*`, and any other our UI doesn't use), when they are called, then they are disabled (404), so every account change goes through our logged handlers. Sign-in, sign-out, session and sign-up keep working.

Security:
- New admin endpoints check `requireApiAdmin` first; any mutating handler keeps `checkSameOrigin` and `requireJson`. Logging never fails silently into a partial write: an event is written in the same transaction as the change where the change is transactional, and logging failures never expose data.

## Out of scope
- Admin actions on trips (cancel, delete, edit); admin exceptions on join requests.
- Charts, top destinations, filters, search or export on history views; pagination of history.
- Login/logout events; IP and user agent; email verification and password reset (not configured).
- DB-level immutability (trigger or revoked grants): a hand-written SQL migration would be needed, which agents may not write (`protect-generated.sh`).
- Automatic deletion of old history (ADR 0002: no workers).

## Constraints
- ADR 0005: every endpoint checks the role itself; `server-app/src/shared` stays DB-free. ADR 0003: additive migration (new table, no FK cascade). ADR 0002: free tier, no workers.
- `docs/learnings.md`: mock `@/db/client`; `checkSameOrigin` on mutating handlers; backfills as an idempotent `db:*` script, not in a migration; don't assert exact `state.updates` counts.
- `server-app/src/lib/auth.ts` is a shared file: keep the change small (disabled paths); `nextCookies()` stays last; the signup photo and gender hooks keep working.
- Activity logging adds one call per handler in the join request / membership endpoints (Joiner developer's area), without touching `trip_members` or the `FeedTripCard` slot.
- The local `pnpm dev` and `db:*` scripts hit the live DB: run `db:migrate` and the backfill only once the SQL is final, with the human's OK.
- Labels in English, like the rest of the UI.

## Open questions
- None.
