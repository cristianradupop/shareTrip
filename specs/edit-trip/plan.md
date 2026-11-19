# Plan: Edit a trip as its organizer

Spec: [spec.md](spec.md) · Status: approved 2026-11-19

## Approach
Add `PATCH /api/trips/[id]` in server-app, mirroring `POST /api/trips` (checkSameOrigin, requireApiUser, requireJson, then `tripSchema`). It loads the trip scoped to `organizerId = session user`, together with its joined count, and rejects the update if the trip is missing or someone else's (404), if it is cancelled or its departure has passed (409), or if `maxTravelers < joined` (400, message names N). Otherwise it updates only the 10 form columns. One pure rule, `canEditTrip({status, departureDate})`, lives in `validators.ts` (exported through `server-app/shared`), so the handler and the card hide/allow Edit the same way. On the UI side, the "Trip details" dialog body is pulled out of `CreateTripButton` into a reusable dialog. A new client `EditTripButton` uses it pre-filled ("Edit trip", "Save", a discard prompt) and is rendered inside `OrganizerTripCard`, so it shows on both `/organizer` and `/organizer/trips`.

## Options considered
- Extract a shared `TripFormDialog` that Create and Edit both wrap. Risk: a regression in the create flow. Chosen: one form, one set of field rules, small diff.
- Copy the dialog into `edit-trip-dialog.tsx`. Risk: ~200 duplicated lines that drift apart. Rejected.
- Add an optional `trip` prop to `CreateTripButton`. Risk: it mixes in create-only behaviour (`router.replace("/organizer")` on close, the "cancel this trip" text). Rejected.
- Server: one conditional `UPDATE ... WHERE count(members) <= max`. Race-safe, but needs a second query to report N, and the spec accepts last-save-wins. Rejected in favour of select-then-update.

## Risks and assumptions
- ADR 0005: authorization sits in the handler. The organizer comes from the session and ownership is in the WHERE of both the select and the update (`id` AND `organizerId`), so admins get 404 on others' trips. ADR 0003: no migration and no schema change.
- CLAUDE.md shared-file rule: small additions only, `canEditTrip` in `server-app/src/lib/validators.ts` (zod-only, re-exported by `src/shared/index.ts`). No change in `components/ui`. `trip_members` and `FeedTripCard` are untouched.
- Assumption: status `full` is still editable, because the rule is `status !== "cancelled" && departureDate >= today` (UTC, same `today()` as `tripSchema`). The spec only names cancelled and past dates as blocked.
- Assumption: N = rows in `trip_members` (organizer not counted), as in `joinedExpr`. A malformed id (not `z.guid()`) returns 404, like an unknown id, before any DB call. Postgres would otherwise throw on a bad uuid and return 500.
- Unknown body keys (`organizerId`, `status`, `id`, `createdAt`) are dropped by `z.object` and never reach `.set()`, so `createdAt` and feed order are unchanged.
- Test mock limit: `helpers.ts` returns `state.result` for every query, so tests prove "no row means 404, no write", not the WHERE clause itself. The verifier checks the cross-user case in the running app.
- Route files may only export HTTP handlers (Next typegen), so the queries go in `server-app/src/data/trips.ts`, not in the route.
- Learnings:
  - (1) Mock `@/db/client`: the new tests use the `helpers.ts` mocks.
  - (3) Every mutating handler needs `checkSameOrigin`: it is the first line of the PATCH handler, and PATCH is added to the hardening table.
  - (2) and (4): don't apply.

## Tasks
- [x] T1 Shared edit rule.
  - Files: `server-app/src/lib/validators.ts`, `server-app/src/lib/validators.test.ts`.
  - Work: export `canEditTrip(trip: { status: string; departureDate: string }, today = today())`.
  - Tests: true for active or full with departure today or later; false for cancelled; false for a past departure.
  - Done when: `pnpm test:file server-app/src/lib/validators.test.ts` is green.
- [x] T2 Data layer and test helper.
  - Files: `server-app/src/data/trips.ts`, `server-app/src/test/helpers.ts`.
  - Work in `data/trips.ts`:
    - `getOrganizerTripForEdit(id, organizerId)`: select `id, status, departureDate, joined: joinedExpr`, leftJoin `joinedCounts`, where id and organizerId, limit 1.
    - `updateOrganizerTrip(id, organizerId, t: TripInput)`: `.set()` only the 10 form columns, `returnDate || null`, `budgetEstimate.toFixed(2)`, where id, organizerId and `ne(status,'cancelled')`, `.returning({id})`.
  - Work in `helpers.ts`: record `.set()` arguments in a new `state.sets` (cleared in `reset`). Calling `.set()` still pushes to `state.updates`.
  - Done when: the existing `pnpm test` still passes.
- [x] T3 Tests first for PATCH, in `server-app/src/test/api/trips-update.test.ts` (new), plus new rows in `authz.test.ts` (401 table) and `hardening.test.ts` (403 Origin, 415, 200 with `state.result` set to an editable row). Cases:
  - 401 without a session.
  - Unknown, foreign or malformed id returns 404 and `updates` stays empty; same with an admin session.
  - Cancelled or past trip returns 409.
  - `maxTravelers: 2` with joined 3 returns 400, the error contains "3", no update.
  - Invalid body returns the 400 message from `tripSchema`.
  - Valid edit returns 200 `{ok:true}`.
  - `state.sets[0]` has no `organizerId`, `status`, `id` or `createdAt`, even when the body has them.
- [x] T4 Handler.
  - File: `server-app/src/app/api/trips/[id]/route.ts`, with `type Ctx = { params: Promise<{ id: string }> }` as in `admin/users/[id]`.
  - Order: origin, user, json, id check, parse, load (404), `canEditTrip` (409), member count (400), update (404 if no row returned), `{ ok: true }`.
  - Done when: the T3 tests pass.
- [x] T5 Extract the dialog.
  - File: `server-admin/src/components/trips/create-trip-dialog.tsx`, or a new `trip-form-dialog.tsx` next to it.
  - Work: a `TripFormDialog` with props for title, submit label, pending label, initial values, `requireChanges`, discard texts, `onSubmit(values) => Promise<string | null>` and `onClose`.
  - `CreateTripButton` keeps exactly its current texts and behaviour.
  - Done when: create works as before in `pnpm dev` and typecheck passes.
- [x] T6 Edit button.
  - Files: `server-admin/src/lib/trip-form.ts` and its `.test.ts`, `server-admin/src/components/trips/edit-trip-button.tsx` (client), `server-admin/src/components/trips/organizer-trip-card.tsx`.
  - `toTripFormValues(trip: OrganizerTrip): TripFormInput` maps null `returnDate` to `""` and keeps the budget and currency strings. Its unit test covers that mapping.
  - Edit dialog behaviour:
    - Opens pre-filled, reset to the current trip values on every open, title "Edit trip".
    - Save is disabled when `!isDirty || !isValid`.
    - Close with changes shows a "Discard changes?" prompt (Keep editing / Discard); close with no changes closes directly, with no navigation.
    - On success it shows a toast, closes and calls `router.refresh()`; a server error shows in the dialog.
  - The card renders `{canEditTrip(trip) && <EditTripButton trip={trip} />}` with an aria-label naming the city.
- [x] T7 Docs: add the PATCH row (auth: user, organizer only; 400/404/409) to the endpoint table in `server-app/README.md`.

## Verification
- `pnpm check` (lint, typecheck, all unit tests), then `pnpm build && pnpm e2e` (smoke regression).
- In `pnpm dev`, logged in as the demo admin, which owns the Mirissa trip:
  - Edit appears on cards on `/organizer` and `/organizer/trips`, and not on cancelled or past trips.
  - The dialog is pre-filled with every field; Save is disabled until something changes.
  - Close with changes asks to discard; close without changes closes directly.
  - Saving shows the new data on the card and in the same feed position.
  - Max travelers below the joined count shows the server message with N.
  - As a second user, `fetch('/api/trips/<that id>', {method:'PATCH', ...})` from the browser console returns 404.
  - Creating a new trip still works with the old texts.

## Open questions
- None blocking. The assumptions above (`full` stays editable, malformed id returns 404, 409 for non-editable trips) are within the spec's allowed answers.

## Run notes
- IMPLEMENT: the Stop hook (`.claude/hooks/stop-check.sh`, runs `pnpm check`) blocked every turn end while the tests-first red was expected (missing `[id]/route`, `./trip-form`) → waited until T4 and T6 were green.
- VERIFY: verifier hit its 30-turn limit with no report → resumed once with a narrower job (restore data first, then report).
- VERIFY: the demo admin password is only in `.env.local` (unreadable to agents) → verifier used demo user `alex`; the Mirissa trip was not reached.
- VERIFY: the non-owner `PATCH /api/trips/<id>` check was denied by the auto-mode permission classifier → not run; left to the human at gate 2 (unit tests cover the handler, not the WHERE clause).
- VERIFY: `pnpm e2e` failed, browser executable missing, after main's Dependabot bump of `@playwright/test` 1.65.0 → 1.65.1 → `pnpm exec playwright install chromium`, then 16 passed.
