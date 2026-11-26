# Plan: Trip cover photos

Spec: [spec.md](spec.md) · Status: approved 2026-11-26

## Approach
`POST /api/trips` and `PATCH /api/trips/[id]` switch from JSON to multipart/form-data: the 10 trip fields plus an optional file field `photo`, which is required on create. The handlers keep the guard order (`checkSameOrigin`, `requireApiUser`, a new `requireMultipart` giving 415), then validate the fields with `tripSchema`. On edit they also check ownership, editability and `maxTravelers` before uploading. Then they upload to `trips/<uuid>.<ext>` through a new `uploadTripPhoto` and write `photo_url` in the same transaction as the audit event. If the DB write fails, the new file is deleted (best effort). After a successful edit, the previous `trips/` file is deleted. A new nullable `trips.photo_url` column flows into `FeedTrip.photoUrl` and `OrganizerTrip.photoUrl`, and `TripCover` renders that URL when it is set, otherwise the automatic photo.

## Options considered
- Multipart on both POST and PATCH (chosen): one request, so a trip is never created without a photo. It changes the API contract, so the UI and 4 test files change in the same PR.
- JSON create plus a separate `PUT /api/trips/[id]/photo`: create is no longer atomic, so a trip without a photo could exist and the "photo required" rule breaks. Rejected.
- PATCH accepts both JSON and multipart: two code paths and a blurry 415 rule. Rejected.
- next/image: hard-coded `remotePatterns` `{protocol:"https", hostname:"*.supabase.co", port:"", pathname:"/storage/v1/object/public/*/trips/**", search:""}` (chosen; `*` matches one segment per the Next 16 docs in `server-admin/node_modules/next/dist/docs/01-app/03-api-reference/02-components/image.md`). Rejected: a new server-admin env var (adds Vercel config) and `unoptimized` (the spec wants optimisation).

## Risks and assumptions
- ADRs: 0002 is respected (Supabase Storage plus Vercel image optimisation on Hobby; the Hobby transformation quota is unverified, fine for a demo). 0005 is respected (UI in server-admin, API and storage in server-app). 0006 is unaffected (no new cookie or tracked field, so `/privacy` stays as is). Shared files touched (schema, `server-app/src/shared`, `validators.ts`): keep the PR small, per CLAUDE.md.
- Migration: `ALTER TABLE trips ADD COLUMN photo_url text` only, backward compatible. While deploy and `migrate.yml` run together, the new code can 500 for a moment until the column exists. This is accepted by the repo's release policy. No backfill (rows stay NULL), so the backfill-script learning does not apply.
- Between T4 and T6 the UI still sends JSON and gets a 415. `pnpm check` stays green; all tasks land in one PR.
- Vercel's 4.5 MB request body limit is above 2 MB plus the fields (unverified for the rewrite path, but signup already works this way).
- The only URL ever written comes from the `uploadTripPhoto` result. `tripSchema` strips unknown keys, so a `photoUrl` form field is ignored. `deleteTripPhoto` only removes paths under `trips/`, so a trip can never delete a profile photo.
- Learnings:
  - Mock `@/db/client` in every new test.
  - Don't assert exact `state.inserts`/`state.updates` counts; assert the table or payload. Sign in as the mocked owner.
  - Run the new SQL against real Postgres: run `getFeed` and `getOrganizerTrips` through the `tsx --eval` recipe after `db:migrate`.
  - Migrations only through `db:generate`; `drizzle/` is hook-protected.
  - The Date-in-`sql` rule: no new raw `sql` is added. The other learnings don't apply.

## Tasks
Names shared by several tasks:
- DB: column `photoUrl: text("photo_url")`.
- Types: `FeedTrip.photoUrl` and `OrganizerTrip.photoUrl`, both `string | null`.
- `server-app/src/lib/validators.ts`: `TRIP_FIELDS` (the 10 `tripSchema` keys, `as const`) and `TRIP_PHOTO_REQUIRED = "Add a cover photo (JPG or PNG, max 2 MB)"`.
- `server-app/src/lib/storage.ts`: `uploadTripPhoto(file: File): Promise<PhotoResult>` (empty file gives `TRIP_PHOTO_REQUIRED`; reuses the existing size, type and upload messages) and `deleteTripPhoto(url): Promise<void>` (never throws, `trips/` only).
- `server-app/src/lib/api-auth.ts`: `requireMultipart(req)` returns a 415 with "Content-Type must be multipart/form-data".
- `server-app/src/lib/trip-upload.ts`: `readTripForm(req): Promise<{ok:true; trip:TripInput; photo:File|null} | {ok:false; response:Response}>`. It reads only string values from `TRIP_FIELDS`; a missing or 0-byte `photo` becomes `null`.
- Data layer: `updateOrganizerTrip(id, organizerId, t, actor, photoUrl?: string): Promise<{previousPhotoUrl: string|null} | null>`, which adds the audit field `"photo"`.
- Create failure: 500 with "Could not create the trip. Try again.".
- Test helpers: `sendForm(method, path, fields, photo?)`, `jpgFile(size?)`, `pngFile(size?)`.
- UI: `TripFormDialog` gets `onSubmit(values: TripInput, photo: File|null)` and `photoRequired?: boolean`. `server-admin/src/lib/trip-form.ts` gets `toTripFormData(values, photo)` and `photoFileError({type,size}): string|null`. `TripCover` gets the prop `photoUrl?: string|null`.

- [x] T1 Schema, migration and read path.
  - files: `server-app/src/db/schema/trips.ts`, `server-app/drizzle/*` (via `pnpm db:generate`), `server-app/src/shared/types.ts`, `server-app/src/data/trips.ts` (`feedColumns`, `FeedRow`, `toFeedTrip`), and the fixtures in `server-app/src/data/trips.test.ts`, `server-admin/src/lib/{feed-card,feed-state,join-action,trip-form}.test.ts`.
  - tests: `ALLOWED_KEYS` includes `photoUrl`; `toFeedTrip` passes `photoUrl` through.
  - done when: the generated SQL is just the ADD COLUMN, and `pnpm check` is green.
- [x] T2 Storage for trip photos.
  - files: `server-app/src/lib/storage.ts`, `server-app/src/lib/validators.ts`, new `server-app/src/lib/storage.test.ts` (mocks `@supabase/supabase-js` `createClient`, stubs `SUPABASE_URL`/`SUPABASE_SECRET_KEY`).
  - tests: a file over 2 MB gives 400 and upload is not called; GIF bytes declared as `image/jpeg` are rejected; the stored path matches `/^trips\/[0-9a-f-]{36}\.(jpg|png)$/`; `deleteTripPhoto` ignores non-`trips/` URLs and swallows errors; the profile functions are unchanged.
  - done when: the tests pass and the signup tests stay green.
- [x] T3 Multipart parsing.
  - files: `server-app/src/lib/api-auth.ts`, new `server-app/src/lib/trip-upload.ts`, `server-app/src/test/helpers.ts`.
  - tests: (in T4) a text/plain or JSON body gives 415; an unparsable body gives 400.
  - done when: it typechecks.
- [x] T4 `POST /api/trips` with a required photo.
  - files: `server-app/src/app/api/trips/route.ts`, new `server-app/src/test/api/trips-create.test.ts`, and the switch to `sendForm` in `server-app/src/test/api/{authz,hardening,trip-events}.test.ts` (hardening: mock `uploadTripPhoto` too and assert it is not called on 403).
  - tests: no photo gives 400 `TRIP_PHOTO_REQUIRED` and no trips insert; over 2 MB or a spoofed signature gives 400, with no upload and no insert; a valid JPG inserts `photoUrl` equal to the public URL under `trips/`; a `photoUrl` form field is ignored; a rejected `db.transaction` (`vi.spyOn(db,"transaction")`) gives 500 and calls remove on the uploaded path; the existing 401/403/415 and audit cases still hold.
  - done when: all API tests are green.
- [x] T5 `PATCH /api/trips/[id]` with an optional photo.
  - files: `server-app/src/app/api/trips/[id]/route.ts`, `server-app/src/data/trips.ts`, `server-app/src/test/api/{trips-update,trip-events}.test.ts`.
  - tests: no photo means `photoUrl` is absent from the set (kept); a new photo sets `photoUrl`, `changedFields` contains `"photo"` (not `photoUrl`), and the previous `trips/` file is removed; a null previous URL removes nothing; on 404/409/400 there is no upload; an update returning null deletes the new upload.
  - done when: the tests are green.
- [x] T6 Photo picker in the form.
  - files: `server-admin/src/lib/trip-form.ts` and its `.test.ts`, `server-admin/src/components/trips/{trip-form-dialog,create-trip-dialog,edit-trip-button}.tsx`.
  - tests: `toTripFormData` contains all `TRIP_FIELDS`, with `returnDate` `""` when undefined and `photo` only when given; `photoFileError` returns errors for type and size.
  - done when: Create stays disabled until a valid photo is chosen; on edit a chosen photo counts as dirty, so Save is enabled and Close asks first; both send `{ form }` (PATCH keeps `method: "PATCH"`).
- [x] T7 Show the photo.
  - files: `server-admin/src/components/trips/{trip-cover,feed-trip-card,organizer-trip-card}.tsx`, `server-admin/next.config.ts` (`images.remotePatterns`), `server-app/README.md` (endpoint table: multipart, `photo`).
  - tests: none (no component tests); checked in the UI.
  - done when: a URL renders through next/image without `placeholder="blur"`, and null falls back to the automatic photo.

## Verification
- `pnpm db:generate` (review the SQL), `pnpm check`, `pnpm build && pnpm e2e`.
- With the human's OK: `pnpm db:migrate`. Then, from `server-app/`, run `getFeed({})` and `getOrganizerTrips(<alex id>)` through the learnings' `tsx --eval` recipe.
- `pnpm dev`, log in as `alex`. First record alex's trip ids and their `photo_url` (NULL).
  - Create without a photo: blocked, with the required message.
  - A 3 MB file or a renamed .gif: error message.
  - A valid JPG: created, and the photo shows on `/organizer`. Also check the landing feed while logged out, since your own trips are hidden from your feed.
  - Edit: Save without a photo keeps it; choose a photo then Cancel/Discard changes nothing; a new photo then Save shows the new cover, the old file is gone from the bucket, and the `trip.edited` event has `changedFields` with `photo` (check it with tsx eval).
- Restore, with the human's OK, through tsx eval: delete the created trip row(s) and their `trips/` files, and set the edited trip's `photo_url` back to NULL and delete its file. The audit events stay (append-only by design).

## Open questions
None blocking. Unverified: the Vercel Hobby image-optimisation quota and the body-size limit when the upload goes through the `/api` rewrite.

## Run notes
- VERIFY: verifier hit its 30-turn limit mid-run (UI checks + live-DB cleanup in one job) → resumed it with "finish checks, then cleanup, then report".
- VERIFY T6: after a server photo error, picking a valid photo left the red error visible (client can't detect a GIF renamed .jpg, server rejects it) → fix round: clear the photo/submit error when a new file is chosen.
- REVIEW T5: PATCH's transaction-failure path (500 + delete new upload) had no test while POST's twin did → tester added it; it passed (coverage gap, not a bug).
