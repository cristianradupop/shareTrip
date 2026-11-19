# Plan: Join requests from the landing feed

Spec: [spec.md](spec.md) · Status: approved 2026-11-19

## Approach
Requests go in a new `trip_requests` table, PK `(trip_id,user_id)`, with status `pending|approved|declined`. `trip_members` still means "approved member". The user gets a nullable `gender` text column, and the migration backfills it at random.

All join rules live in one pure module, `server-app/src/lib/join-rules.ts` (no DB, no `server-only`). The feed, the joiner endpoints and the organizer endpoints all call it, so the tester can target it directly. A thin data layer, `server-app/src/data/requests.ts`, loads a "join context" and runs the writes. Approval runs in one transaction that locks the trip row (`select ... for update`).

The feed gains an optional `viewerState` on each trip, only when there is a session. In server-admin, a `JoinAction` goes into the existing `FeedTripCard` `action` slot, and its state is patched locally through a new reducer action. On the organizer side: a requests dialog on `OrganizerTripCard`, and a nav badge fed by `/api/organizer/stats`.

## Options considered
- **Capacity race on approve:** `SELECT ... FOR UPDATE` on the trip inside the transaction (chosen; it works through the transaction pooler). A plain count-then-insert can overfill when two approvals run at once. A DB trigger is heavier and hides the rule from tests.
- **Account gender column:** `text` plus validation in zod and the auth hook (chosen). A pg enum would mean hand-editing the Better Auth-generated `auth.ts`, which its CLI would overwrite. A CHECK constraint was skipped for the same reason.
- **Better Auth additionalField `gender`:** `required: false` plus the `user.create.before` hook (chosen, same as the photo rule). `required: true` would make a CLI regeneration emit `.notNull()`, which breaks ADR 0003.
- **Source of the pending-count badge:** add `pendingRequests` to `OrganizerStats` (chosen, no new route). A dedicated endpoint would be one more handler with no gain.

## Risks and assumptions
- **ADR 0003:** the migration is additive (a new enum and table, a nullable `user.gender`, a backfill UPDATE). Signups during the deploy window can still end up with NULL. NULL counts as "no match" on single-gender trips, and the user can fix it in their profile.
- **ADR 0005:** every new handler checks auth itself. `shared/` only gets types and zod (`JoinState`, the new fields). `nextCookies()` stays last.
- **ADR 0002:** no realtime; the badge is computed per page load.
- **Layout caching:** layouts persist across client navigation, so the badge refreshes on a full load or after `router.refresh()`, which the dialog calls after each decision.
- **PR #16 (unverified, not on this branch):** if it adds `api/trips/[x]` or `api/organizer/trips/[x]` with a different slug name, Next will refuse to build. I use `[id]`, like `admin/users/[id]`; align on merge.
- **Unverified APIs:** drizzle-orm 0.45 `.for("update")` on a pg select, and Better Auth 1.7 `databaseHooks.user.update.before`. If either is missing, use ``sql`...for update` `` and drop the update hook (zod still guards our own endpoints).
- **Open redirect in the current code:** `safeNext` accepts `/\evil.com`, which browsers treat as `//evil.com`. It gets fixed while moving it to a shared helper.
- **`next` must be URL-encoded:** `/login?next=/#trips` would lose `#trips` as a fragment. Use `/login?next=%2F%23trips`.
- **"Before departure" (assumption):** leave and request are allowed while `departureDate >= today` (same as the feed's visibility); refused when `departureDate < today`. "Full" means `status==='full' || joined+1 >= maxTravelers`, the same as `feedCardView`.
- **Seed data:** existing demo `trip_members` rows ignore gender. They stay as they are; the rule only applies to new approvals.
- **Learnings:**
  - (1) Every new handler test mocks `@/db/client` and `@/lib/auth` (`state.session`), and `@/data/requests` / `@/data/trips` where needed. `join-rules.ts` needs no mocks.
  - (2) The `pnpm -r` rule doesn't apply: no script changes.
  - (3) `checkSameOrigin` goes first in all 5 new mutating handlers (POST/DELETE request, DELETE membership, PATCH decide, PATCH profile), each with a row in `hardening.test.ts`.
  - (4) Vercel skip: both projects change, so both build.
  - (5) The feed `since` watermark: the new `tripPatched` reducer action must leave `since`, `cursor` and `gen` untouched (tested).

## Tasks
- Seams and contracts fixed by the tests (from the testers):
  - Handlers compute `today` as `new Date().toISOString().slice(0, 10)`; tests fake only `Date`. The rules in `join-rules.ts` take `today` as a parameter.
  - The contract for `@/data/requests` and the handler response shapes is listed at the top of `server-app/src/test/api/join.test.ts`.
  - `toFeedTrip(row, viewer?)`; `getFeed({…, viewer})`; `getTripsSince(since, city, {excludeOrganizerId, viewer})`.
  - `safeNext(next?: string | null): string | null`; `joinActionView(trip)` returns `{label, disabled, href, secondary, reason}`; the reducer action is `{type:"tripPatched", id, patch}`.
- [x] **T1 Schema, migration and backfill.**
  - Files: new `server-app/src/db/schema/trip-requests.ts` (pgEnum `trip_request_status`; `trip_requests` with tripId uuid FK cascade, userId text FK cascade, status default `pending`, createdAt, decidedAt nullable; PK `(trip_id,user_id)`; indexes `(trip_id,status)` and `user_id`); `schema/index.ts`; `schema/auth.ts` (`gender: text("gender")`, nullable); `pnpm db:generate` gives `server-app/drizzle/0001_*.sql` + meta.
  - Then append to the generated SQL: `--> statement-breakpoint` and `UPDATE "user" SET "gender" = CASE WHEN random() < 0.5 THEN 'male' ELSE 'female' END WHERE "gender" IS NULL;`
  - Tests: `pnpm db:check`, `pnpm typecheck`.
  - Done when: the SQL has CREATE TYPE, CREATE TABLE, ADD COLUMN (no NOT NULL) and the UPDATE.
- [x] **T2 Account gender, server side.**
  - `lib/validators.ts`: `ACCOUNT_GENDERS=["male","female"]`, `gender` in `signUpSchema` and `adminUserSchema`, plus `profileSchema`.
  - `lib/auth.ts`: additionalField `gender {type:"string", required:false}`. `user.create.before` throws BAD_REQUEST "Choose your gender" unless the value is male or female; `user.update.before` rejects an invalid gender when the key is present.
  - `api/signup/route.ts`: add `gender` to FIELDS and to the body.
  - `lib/user-service.ts`: `NewUserData.gender`, inserted with the user.
  - `scripts/seed-demo.ts`, `scripts/seed-admin.ts`: set genders.
  - `api/admin/users/route.ts` and `[id]/route.ts`: set gender.
  - `data/users.ts` and `shared/types.ts`: `gender: "male"|"female"|null` on `AdminUserRow` and `SessionUser`; `api/session/route.ts` maps it.
  - New `api/profile/route.ts` PATCH: origin → user → json → zod → update own row.
  - Tests:
    - `auth-photo-hook.test.ts`: the "accepts" fixture gains a gender; new rejects for missing, "mixed" and garbage gender.
    - `validators.test.ts`.
    - `hardening.test.ts`: `signupForm` and `userBody` gain gender, plus a PATCH `/api/profile` row.
    - `authz.test.ts`: profile gives 401.
    - `user-service.test.ts`.
  - Done when: `pnpm test` is green.
- [x] **T3 Pure join rules (no DB), in `server-app/src/lib/join-rules.ts`.**
  - `isTripFull`, `genderAllows(tripGender, userGender|null)`, `ageOn(birthDate, today)`.
  - `viewerJoinState({isMember, requestStatus, full, tripGender, userGender})`, precedence joined > requested > declined > full > wrong_gender > join.
  - `checkCanRequest(ctx, user, today)` returns `{ok}` or `{ok:false,status,error}` for: own trip 400, cancelled 409, departed 409, member or existing request 409, full 409, gender 409.
  - `checkCanApprove(ctx, applicantGender, today)`, `checkCanLeave(ctx, today)`, `fillsLastSeat(joinedAfter, max)`.
  - Tests: `join-rules.test.ts`, a table for each rule, including the null gender and the today boundary.
  - Done when: `pnpm test:file server-app/src/lib/join-rules.test.ts` passes.
- [x] **T4 Feed viewer state and joiner endpoints.**
  - `shared/types.ts`: `JoinState`, `FeedTrip.viewerState?`.
  - `data/trips.ts`:
    - `getFeed` and `getTripsSince` take `viewer?: {id, gender}` and, only when given, select scalar subqueries `isMember` and `requestStatus`;
    - `toFeedTrip(r, viewer?)` adds the key only when there is a viewer.
  - Feed handlers (`api/feed/route.ts`, `since/route.ts`) pass `session.user.{id,gender}`.
  - New `data/requests.ts` (server-only): `loadJoinContext`, `createJoinRequest` (`isUniqueViolation` → 409), `withdrawRequest` (pending only), `leaveTrip` (transaction deleting the `trip_members` row and the request row).
  - New `api/trips/[id]/request/route.ts` (POST request, DELETE withdraw) and `api/trips/[id]/membership/route.ts` (DELETE leave). Order in each: origin → user → `z.uuid()` id, else 404 → rules. All reply `{ok, viewerState, joined}`.
  - Tests:
    - `data/trips.test.ts`: the key set with and without a viewer.
    - `feed.test.ts`: the viewer is passed only with a session.
    - New `test/api/join.test.ts` with `@/data/requests` mocked: 401, 403, bad uuid 404, the rule errors mapped to their status codes, duplicate → 409, the user id taken from the session.
    - authz and hardening rows.
  - Done when: `pnpm test` is green.
- [x] **T5 Organizer endpoints.**
  - `data/requests.ts`:
    - `getTripOwner`;
    - `listTripPeople(tripId, today)` returns pending requests and members as `{userId, name, image, age, gender}`, with no email, phone or birthDate;
    - `approveRequest`: one transaction that locks the trip, re-counts, runs `checkCanApprove`, inserts into `trip_members`, marks the request approved, and declines every other pending request when `fillsLastSeat`;
    - `declineRequest` (pending only).
  - New `api/organizer/trips/[id]/requests/route.ts` (GET), and `.../requests/[userId]/route.ts` (PATCH `{action:"approve"|"decline"}`, json). Both check ownership in the handler (404 when not the owner).
  - `getOrganizerStats` gets `pendingRequests`; `getOrganizerTrips` gets `pending`; matching changes to `OrganizerStats` and `OrganizerTrip` in `shared/types.ts`.
  - Tests in `join.test.ts`: not the owner → 404, approve refused (full or gender) → 409 with its message, auto-decline reported, the list has no email or phone. Plus authz and hardening rows.
  - Done when: `pnpm test` is green.
- [x] **T6 Account UI.**
  - New `server-admin/src/lib/safe-next.ts` (rejects `//`, `/\`, absolute URLs) with a test.
  - `login-form.tsx`: uses it; the signup link carries `next`.
  - `(auth)/signup/page.tsx` + `signup-form.tsx`: accept `next`, add a required gender control, `router.push(safeNext(next) ?? "/")`.
  - `organizer/profile/page.tsx`: shows gender and gets a new client `gender-form.tsx` (PATCH `/api/profile`, then `router.refresh()`).
  - `admin/user-form-dialog.tsx`: gender Select.
  - Tests: `safe-next.test.ts`.
  - Done when: `pnpm check` passes.
- [x] **T7 Feed join UI.**
  - New `server-admin/src/lib/join-action.ts`: `joinActionView(trip)` returns the label, disabled, secondary (withdraw/leave) and reason. Without `viewerState`: Full, or a Join link to `/login?next=%2F%23trips`.
  - `feed-state.ts`: `tripPatched(id, patch)` action.
  - New `components/trips/join-action.tsx`: AlertDialog "Send request" with the trip details; Withdraw and Leave; errors as toasts.
  - `feed-client.tsx` passes `action`.
  - Tests: `join-action.test.ts` (every state, gender reason text) and `feed-state.test.ts` (`tripPatched` leaves since, cursor and gen unchanged).
  - Done when: `pnpm check` passes.
- [x] **T8 Organizer UI and docs.**
  - New `components/trips/trip-requests-dialog.tsx`: "Requests (n)"; on open, GET the list; Approve and Decline, then refetch and `router.refresh()`.
  - `organizer-trip-card.tsx` renders it.
  - `organizer/layout.tsx`: `apiGet("/api/organizer/stats")` in try/catch, passing `pendingRequests` to `OrganizerShell`; `organizer-nav.tsx` shows the badge on "My Trips".
  - Docs: the endpoint table in `server-app/README.md`; mention requests in `server-admin/README.md`.
  - Done when: `pnpm check` passes and `pnpm build && pnpm e2e` is green.

## Verification
- `pnpm check`; `pnpm db:check`; `pnpm build && pnpm e2e` (the landing still renders its error state without a DB).
- Against the dev DB: `pnpm db:migrate`, then confirm with `select gender, count(*) from "user" group by 1` that no NULL is left, then `pnpm db:seed-demo` and `pnpm dev`. Then, in Playwright MCP:
  - **Logged out:** Join on a card goes to the login page with `next`; logging in returns to `/#trips`; signup with `next` comes back too.
  - **As maria (female):** a male-only trip shows the reason; on a mixed trip, Join, confirm and see Requested, then Withdraw returns it to Join.
  - **As the organizer:** the badge count matches; the dialog shows age and gender with no email; approving the last seat auto-declines the others.
  - **As a declined user:** the card shows Declined.
  - **As a member:** Leave returns the card to Join.
  - **Admin dialog** edits gender; **profile** changes gender.
  - **Mobile:** at 390px there is no horizontal scroll.
- `curl -X POST -H 'Origin: https://evil.example' localhost:3001/api/trips/<id>/request` returns 403.

## Open questions
- None blocking. Assumptions to confirm at approval:
  - leave and request are allowed on the departure day itself;
  - only the trip's organizer (not admins) sees and decides its requests;
  - users with a NULL gender count as not matching single-gender trips.

## Run notes
- PLAN: the local `pnpm dev` uses the same Supabase DB as the live site (7 of 8 live feed trip ids found locally) → no `db:migrate` during IMPLEMENT; apply the final migration only after review, with the human told first, then verify in the browser.
- IMPLEMENT T1: the `protect-generated.sh` hook blocks any edit under `server-app/drizzle/` (generated files), so the random gender backfill could not be appended to `0001_*.sql` → moved to an idempotent script `pnpm db:backfill-gender` (`UPDATE ... WHERE gender IS NULL`), run once right after the migration.
- IMPLEMENT T4/T5: the coder reported 2 wrong tests: the organizer GET describe never signed in as the owner, and the profile test expected 1 recorded update while the fake records each chained call → the tester fixed both; the code was right.
- REVIEW: Verdict OK with warnings → fix round 1: `approveRequest` read the request without a lock and its UPDATE had no `status='pending'` guard (an approve racing a withdraw could still add the member); `checkCanApprove` allowed cancelled trips; `pendingRequests` counted departed/cancelled trips; CLAUDE.md's Joiner-slot line was stale.
- VERIFY: with the human's OK, `pnpm db:migrate` (0001) and `pnpm db:backfill-gender` ran on the shared live DB (9 accounts got random genders; a second run updated 0). All 4 verifier checks passed. Leftover: Andrei's auto-declined request on the Paris trip.
