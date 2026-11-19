# Plan: Admin console: statistics, trips, activity, account history, audit log

Spec: [spec.md](spec.md) · Status: approved 2026-11-19

## Approach
Add one append-only table `audit_events` (no FKs) with no update or delete path. The three history views are `WHERE` filters on it: Account history = `category='account'`, Activity = `category='trip'`, Audit log = `actor_role='admin'`. Each view returns the latest 300 rows, newest first.

Each row stores:
- `id` uuid, `created_at`, `category`, `action`
- `actor_id`, `actor_role` (`holder|admin|user`), `actor_name` (snapshot)
- `subject_type` (`user|trip`), `subject_id` (text), `subject_label` (name, or "City, Country"), `subject_email`
- `related_id`, `related_label` (the applicant on approve/decline)
- `changed_fields text[]` (default '{}'), `reason`, `new_role`, `auto_declined int`

Indexes: `(category, created_at)` and `(actor_role, created_at)`.

**How logging joins the writes:** every logged write runs inside a `db.transaction` together with `tx.insert(auditEvents)`.
- Existing transactions get one more insert: approve, leave, admin PATCH (password branch), ban, `createCredentialUser`.
- Today's single writes get wrapped: create trip, edit trip, request, withdraw, decline, profile, admin delete.
- The only exception is sign-up. Better Auth creates that user, so it is logged in a `databaseHooks.user.create.after` hook, which Better Auth queues after its own transaction (`queueAfterTransactionHook`). That hook is try/catch with a PII-free `console.error`.

**How Better Auth endpoints are blocked:** an allowlist in `api/auth/[...all]/route.ts`.

**Admin header tabs:** a client `AdminTabs` component (`usePathname`) inside the server `admin/layout.tsx`.

## Options considered
- **Better Auth `disabledPaths` in auth.ts:** it matches paths exactly. The admin plugin alone has 15 paths, and endpoints added by a future upgrade would stay open. Not chosen.
- **Allowlist wrapper in `[...all]/route.ts`:** allows `/sign-in/email`, `/sign-in/username`, `/sign-out`, `/get-session`, `/sign-up/email`; everything else returns 404. It fails closed and doesn't touch the shared auth.ts. Chosen.
  - `auth.api.*` server calls (signup, getSession) don't go through HTTP, so they are unaffected.
  - The UI only uses `signIn.email`, `signIn.username` and `signOut` (`login-form.tsx`, `user-menu.tsx`).
- **Logging after the write, outside the transaction:** fewer round trips, but the change could succeed without its event, which the spec forbids. Not chosen.
- **A `details jsonb` column:** it would invite storing values the spec forbids. Explicit `reason`, `new_role`, `auto_declined` columns chosen instead.

## Risks and assumptions
**ADRs**
- 0003: additive migration, new table only, generated with `pnpm db:generate`.
- 0005: new endpoints check `requireApiAdmin`; `shared/` gets only types and consts.
- 0002: no workers; retention is unlimited.
- No ADR conflict.

**Behaviour choices I made**
- The actor role reflects the capacity, not the account. An admin creating or joining trips is logged as `user`; only admin endpoints log `admin`.
- No event is written when an edit changes nothing.
- Approve writes one event with `auto_declined = n`, not one row per auto-declined request.
- Admin PATCH, ban and DELETE return 404 when the user row is missing. Today they silently answer ok.
- Deleted subjects are detected at read time with `exists(...)` against `user` / `trips` (`trips.id::text`).
- Changed-field names compare the normalised values we write: lowercased email/username, `budget.toFixed(2)`, `returnDate || null`. Derived columns `name` and `displayUsername` are ignored; `role` is its own event (`account.role_changed` + `new_role`); a password reset adds `"password"`.

**Accepted gaps and coupling**
- A sign-up event can be lost if the after-hook fails; the user is still created.
- `createCredentialUser(u, opts?: { actor })` writes an event only when `actor` is given. Seed scripts don't pass it, and the backfill covers those users.
- Each mutation gets one more BEGIN/COMMIT round trip on the transaction pooler. Approve already runs a transaction there.

**Learnings**
- Mock `@/db/client`: all new tests use `helpers.ts` fakes.
- `checkSameOrigin`: no new mutating endpoints; the edited ones keep their guards.
- Backfill as an idempotent `db:*` script: T6, named as a release step.
- No exact `state.inserts`/`state.updates` counts: `authz.test.ts:179` (`inserts toHaveLength(1)`) must change to filter by the `trips` table, and new tests assert the table and payload.

**Existing tests that will change (extra argument)**
- `join.test.ts` lines 122, 203, 214, 256, 262, 354, 381: add `expect.objectContaining({ id })` for the actor.
- `hardening.test.ts:286`: `createUser` is now called with a second argument.

## Tasks
- [x] **T1 Event model and pure builders**
  - files: `server-app/src/db/schema/audit-events.ts`, `server-app/src/db/schema/index.ts`, generated `server-app/drizzle/*` (via `pnpm db:generate` only), `server-app/src/shared/audit.ts` (+ export in `shared/index.ts`: `AUDIT_ACTIONS`, `AuditAction`, `ActorRole`, `AuditView`, `AuditEventRow`), `server-app/src/lib/audit.ts` (no `server-only`, no db import: `buildEvent(action, actor, subject, extra)` derives `category`; `accountSubject`, `tripSubject`; `changedFields(before, next, ignore)`; `recordEvent(tx, ev)`)
  - tests: `server-app/src/lib/audit.test.ts`: category from action; snapshots copied; `changedFields` ignores equal values, null vs '' and ignored keys, and returns names only; `buildEvent` rejects `reason` on non-ban actions
  - done when: `pnpm test:file server-app/src/lib/audit.test.ts` passes and `pnpm db:check` is clean
- [x] **T2 Account events**
  - files: `server-app/src/lib/user-service.ts` (optional `actor`), `api/admin/users/route.ts` (POST), `api/admin/users/[id]/route.ts` (PATCH: `select ... for update` before, diff, update, then events; DELETE: snapshot, delete, event), `api/admin/users/[id]/ban/route.ts` (banned or unbanned + reason), `api/profile/route.ts` (holder, gender diff), `server-app/src/lib/auth.ts` (add `user.create.after` only; `nextCookies()` stays last)
  - tests: new `server-app/src/test/api/account-events.test.ts` asserting the `auditEvents` insert payload and `actorRole` for each case; after-hook test like `auth-photo-hook.test.ts`; update `hardening.test.ts:286`
  - done when: `pnpm test` is green
- [x] **T3 Trip activity events**
  - files: `api/trips/route.ts` (transaction), `server-app/src/data/trips.ts` (`updateOrganizerTrip(..., actor)`: lock the row, diff, update, event), `server-app/src/data/requests.ts` (add `actor` to `createJoinRequest`, `withdrawRequest`, `leaveTrip`, `approveRequest`, `declineRequest`; approve adds `destinationCity`/`Country` and `user.name` to its existing selects), the 3 request/membership/decide handlers
  - tests: update `join.test.ts` arguments and `authz.test.ts:179`; new `server-app/src/test/api/trip-events.test.ts` for the create and edit payloads
  - done when: `pnpm test` is green
- [x] **T4 Better Auth allowlist**
  - files: `server-app/src/lib/auth-paths.ts` (`isAllowedAuthPath(pathname)`), `server-app/src/app/api/auth/[...all]/route.ts` (wrap GET/POST)
  - tests: `server-app/src/lib/auth-paths.test.ts`: `/update-user`, `/change-password`, `/admin/set-role`, `/admin/ban-user`, a trailing slash and an unknown path return 404; the 5 allowed paths pass
  - done when: `curl -X POST localhost:3001/api/auth/update-user` returns 404 and login/logout still work in `pnpm dev`
- [x] **T5 Admin read API**
  - files: `server-app/src/data/admin.ts` (`getAdminStats`: users with `count(*) filter` for total/active/banned/admins/7d/30d, trips by status plus upcoming/departed among non-cancelled, requests by status, `count(trip_members)`; `listAllTrips({ q, status, page })`, 10 per page, ilike on city or organizer name/email, `escapeLike` as in `users.ts`), `server-app/src/data/audit.ts` (`listEvents(view)`, limit 300, `created_at desc, id desc`), routes `api/admin/stats`, `api/admin/trips`, `api/admin/events?view=account|activity|audit` (400 otherwise), shared types `AdminStats` and `AdminTripRow` in `shared/types.ts`, `server-app/README.md` endpoint table
  - tests: add the 3 GETs to `adminEndpoints` in `authz.test.ts` (401/403); invalid `view` returns 400
  - done when: `pnpm test` and `pnpm typecheck` are green
- [x] **T6 Backfill**
  - files: `server-app/scripts/backfill-audit.ts` (two `INSERT ... SELECT ... WHERE NOT EXISTS` statements: `account.created` from `user.created_at` as holder, `trip.created` from `trips.created_at` by the organizer, as user), `db:backfill-audit` in `server-app/package.json` and the root `package.json`
  - tests: none (SQL is idempotent by `NOT EXISTS`); review only
  - done when: `pnpm typecheck` is green. Do not run it until the human OKs migrate.
- [x] **T7 Admin tabs and formatting helpers**
  - files: `server-admin/src/lib/admin-tabs.ts` (`ADMIN_TABS` in spec order: `/admin/statistics`, `/admin`, `/admin/trips`, `/admin/activity`, `/admin/account-history`, `/admin/audit-log`; `activeAdminTab(pathname)`: `/admin` exact, others by prefix), `server-admin/src/components/admin/admin-tabs.tsx` ("use client", second header row, `overflow-x-auto`), `admin/layout.tsx`, `server-admin/src/lib/audit-format.ts` (`actionLabel`, `describeChange` e.g. "changed name, phone" / "banned: <reason>" / "role -> admin" / "+3 auto-declined", `actorBadge`)
  - tests: `server-admin/src/lib/admin-tabs.test.ts`, `server-admin/src/lib/audit-format.test.ts`
  - done when: the tests pass and `/admin` highlights only Accounts
- [x] **T8 Admin pages**
  - files: `server-admin/src/app/admin/{statistics,trips,activity,account-history,audit-log}/page.tsx` (each calls `requireAdmin()` + `apiGet`), `server-admin/src/components/admin/trips-table.tsx` (search, status select, pagination, read-only details; same pattern as `users-table.tsx`), `server-admin/src/components/admin/event-table.tsx` (shows a "deleted" badge when `!subject.exists`), `e2e/smoke.spec.ts` (new paths redirect)
  - tests: e2e redirect for the 5 new paths
  - done when: `pnpm build && pnpm e2e` is green

## Verification
- `pnpm check`
- `pnpm build && pnpm e2e`
- With `pnpm dev` (live DB, only after the human OKs `pnpm db:migrate` and `pnpm db:backfill-audit`), as admin:
  - every tab renders and is highlighted on its own route
  - Statistics numbers add up
  - Trips search and status filter work
  - Editing a user's phone shows "changed phone" with the admin name in Account history and Audit log
  - Approving a request shows in Activity
  - Deleting a user keeps their rows, marked "deleted"
- As a normal user, `/admin/*` redirects.
- `curl -X POST http://localhost:3001/api/auth/admin/set-role` returns 404.

## Open questions
- None blocking.
- Unverified: Next 16 page conventions were not re-read in `node_modules/next/dist/docs`, because the new pages copy the existing `PageProps`/`LayoutProps` pattern. The coder should check them if anything new is needed.
- Spec mismatch: the spec names `disabledPaths`, and the plan uses a route-level allowlist instead. Tell the human at approval.

## Run notes
- IMPLEMENT (tests): the two testers named two actions differently (`account.profile_changed` vs `account.edited` by the holder; `trip.withdrew` vs `trip.withdrawn`) → aligned on the server names (T1 is the source: `AUDIT_ACTIONS` = `account.created|edited|banned|unbanned|role_changed|deleted`, `trip.created|edited|requested|withdrawn|left|approved|declined`).
- REVIEW: Verdict CHANGES, blocker: the 5 request/membership activity events (`data/requests.ts`) had no tests because `join.test.ts` mocks the module → fix round 1: data-level tests for the event payloads and no-op cases, plus a `listEvents` filter test and the auth wrapper test; code fixes: "full" derived like `isTripFull` in stats and the trips filter, no ban/unban event when the state doesn't change, README 404 notes, `organizerId` dropped from `AdminTripRow`. Release: apply 0002 before merging so mutations never hit a missing `audit_events`.
- VERIFY: with the human's OK, migration 0002 and `pnpm db:backfill-audit` ran on the live DB (9 account + 23 trip events; a second run inserted 0). Logged-out and non-admin checks passed (307 to login or `/?forbidden=admin`, 403 on admin APIs). The human checked the admin console as admin: OK.
