# Trip cover photos

Source: user request in Claude Code, 2026-11-26 (after the redesign, PR #24)

## Problem

Trips have no photo of their own: every card shows one of 14 bundled travel photos chosen by a hash of the city, so the picture rarely matches the destination and two cities can share one. Organizers should upload a real cover photo for each new trip, shown wherever the trip appears as a card.

## Behaviour

- Given a logged-in user creating a trip, when they submit the form without a photo, then the trip is not created and the form says a photo is required.
- Given a logged-in user creating a trip, when they attach a JPG or PNG of at most 2 MB, then the trip is created, the photo is stored in the existing public bucket under a `trips/` prefix with a generated name, and the trip row holds its public URL.
- Given a create request, when the file is larger than 2 MB, or not a real JPG/PNG by its file signature (whatever its declared type), then the API answers 400 and no trip row and no stored file remain.
- Given a create request, when storing the photo succeeds but inserting the trip fails, then the uploaded file is deleted (best effort).
- Given an organizer editing their own editable trip, when they save without choosing a photo, then the existing photo (uploaded or automatic) is kept.
- Given an organizer editing their own editable trip, when they choose a new valid photo and press Save, then the new photo is stored, the trip points to it, the previous uploaded file (if any) is deleted, and one `trip.edited` audit event lists `photo` among the changed fields.
- Given an organizer editing a trip, when they choose a photo and press Cancel, then nothing is uploaded and nothing changes.
- Given a trip with an uploaded photo, when it appears on the public feed card (FeedTripCard) or the organizer trip card, then that photo is shown; given a trip without one, then the automatic TripCover photo is shown.
- Given any create or edit request, the existing guards still apply first: same-origin check (403), session (401), ownership and editability for edits, and only the expected body type is accepted (415 otherwise).
- Given a stored trip photo URL, the API only ever writes URLs it produced itself (public bucket URL under `trips/`); a client cannot set the photo URL directly.

## Out of scope

- Removing a photo to go back to the automatic one (replace only).
- Showing or moderating trip photos in the admin console (`/admin/trips`).
- Deleting trip photo files when an admin deletes a user (today profile photos stay too).
- Uploading photos for demo trips in `pnpm db:seed-demo`.
- A rate limit on trip creation.
- Multiple photos per trip, cropping or resizing on the server.

## Constraints

- Free hosting only (ADR 0002); UI in server-admin, API and storage in server-app (ADR 0005).
- Same file rules as the profile photo: JPG/PNG detected by signature, max 2 MB (`PHOTO_MAX_BYTES`, `PHOTO_TYPES`), generated file names, public bucket `SUPABASE_PHOTOS_BUCKET`.
- Mutating handlers: `checkSameOrigin` and `requireApiUser` before reading the body; organizer id from the session; ownership checked in the handler (RLS is bypassed).
- Trip changes are audited in the same transaction (`server-app/src/lib/audit.ts`).
- Schema change via `pnpm db:generate` only; the migration adds a nullable column (backward compatible, deploy and migration start together). Existing rows stay NULL.
- `server-admin/src/shared` types stay DB-free; `FeedTrip` and `OrganizerTrip` gain the photo URL.
- next/image in server-admin must be allowed to load the Supabase public URL, or the photo is rendered without optimisation.
- Learnings: mock `@/db/client` in tests; new SQL must be run against real Postgres before merge; migrations only through `db:generate`.

## Open questions

- Known limit, accepted by the user: no per-user cap on new trips, so Storage (1 GB free) grows by up to 2 MB per new trip.
